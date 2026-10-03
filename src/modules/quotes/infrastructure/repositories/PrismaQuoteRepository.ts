import { Prisma, PrismaClient } from "@prisma/client";
import { randomUUID } from "crypto";
import {
  QuoteRepository,
  FindAllQuotesOptions,
  CreateQuoteData,
  ReplaceQuoteItemsData,
  UpdateQuoteMetaData,
  QuoteSummary,
  TxHandle,
} from "../../application/ports/QuoteRepository";
import { Quote } from "../../domain/entities/Quote";
import { QuoteItem } from "../../domain/entities/QuoteItem";
import { QuoteStatus } from "../../domain/value-objects/QuoteStatus";
import { QuoteJoinedFields } from "../../application/mappers/toQuoteDto";
import { InactiveResourceError } from "../../domain/errors/InactiveResourceError";
import { allocateBranchFolio } from "@/shared/infrastructure/folios/allocateBranchFolio";

type PrismaQuoteWithJoins = {
  id: string;
  folioId: string;
  folioNumber: number;
  folioCode: string;
  branchId: string;
  customerId: string | null;
  creatorId: string;
  status: string;
  subtotal: Prisma.Decimal;
  taxTotal: Prisma.Decimal;
  total: Prisma.Decimal;
  notes: string | null;
  expiresAt: Date | null;
  authorizedAt: Date | null;
  authorizedBy: string | null;
  cancelledAt: Date | null;
  cancellationReason: string | null;
  convertedAt: Date | null;
  convertedSaleId: string | null;
  createdAt: Date;
  updatedAt: Date;
  branch: { name: string } | null;
  customer: { name: string; rfc: string } | null;
  creator: { name: string | null; email: string } | null;
  items: Array<{
    id: string;
    quoteId: string;
    productId: string;
    productPriceId: string | null;
    productCodeSnapshot: string;
    productNameSnapshot: string;
    priceNameSnapshot: string;
    quantity: Prisma.Decimal;
    unitPrice: Prisma.Decimal;
    discountPct: Prisma.Decimal | null;
    ivaRate: Prisma.Decimal | null;
    iepsRate: Prisma.Decimal | null;
    lineSubtotal: Prisma.Decimal;
    lineTax: Prisma.Decimal;
    lineTotal: Prisma.Decimal;
  }>;
};

const includeJoins = {
  branch: { select: { name: true } },
  customer: { select: { name: true, rfc: true } },
  creator: { select: { name: true, email: true } },
  items: true,
} as const;

function toSummary(row: PrismaQuoteWithJoins): QuoteSummary {
  const items = row.items.map((it) =>
    QuoteItem.create({
      id: it.id,
      quoteId: it.quoteId,
      productId: it.productId,
      productPriceId: it.productPriceId,
      productCodeSnapshot: it.productCodeSnapshot,
      productNameSnapshot: it.productNameSnapshot,
      priceNameSnapshot: it.priceNameSnapshot,
      quantity: Number(it.quantity),
      unitPrice: Number(it.unitPrice),
      discountPct: it.discountPct ? Number(it.discountPct) : null,
      ivaRate: it.ivaRate ? Number(it.ivaRate) : null,
      iepsRate: it.iepsRate ? Number(it.iepsRate) : null,
      lineSubtotal: Number(it.lineSubtotal),
      lineTax: Number(it.lineTax),
      lineTotal: Number(it.lineTotal),
    })
  );

  const quote = Quote.create({
    id: row.id,
    folioId: row.folioId,
    folioNumber: row.folioNumber,
    folioCode: row.folioCode,
    branchId: row.branchId,
    customerId: row.customerId,
    creatorId: row.creatorId,
    status: row.status as QuoteStatus,
    subtotal: Number(row.subtotal),
    taxTotal: Number(row.taxTotal),
    total: Number(row.total),
    notes: row.notes,
    expiresAt: row.expiresAt,
    authorizedAt: row.authorizedAt,
    authorizedBy: row.authorizedBy,
    cancelledAt: row.cancelledAt,
    cancellationReason: row.cancellationReason,
    convertedAt: row.convertedAt,
    convertedSaleId: row.convertedSaleId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    items,
  });

  const joined: QuoteJoinedFields = {
    branchName: row.branch?.name ?? null,
    customerName: row.customer?.name ?? null,
    customerRfc: row.customer?.rfc ?? null,
    creatorName: row.creator?.name ?? row.creator?.email ?? null,
  };

  return { quote, joined };
}

function appendNotes(existing: string | null, appendix: string | null): string | null {
  if (!appendix) return existing;
  if (!existing) return appendix;
  return `${existing}\n---\n${appendix}`;
}

export class PrismaQuoteRepository implements QuoteRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findAll(opts: FindAllQuotesOptions): Promise<{ items: QuoteSummary[]; total: number }> {
    const skip = (opts.page - 1) * opts.pageSize;

    // Status filter: "expired" matches both rows persisted with status='expired' AND
    // rows still persisted with status='authorized' but whose expires_at < NOW().
    const now = new Date();
    let statusWhere: Prisma.QuoteWhereInput | undefined;
    if (opts.statuses && opts.statuses.length > 0) {
      const includesExpired = opts.statuses.includes("expired");
      const concreteStatuses = opts.statuses.filter((s) => s !== "expired");
      const orClauses: Prisma.QuoteWhereInput[] = [];
      if (concreteStatuses.length > 0) {
        orClauses.push({ status: { in: concreteStatuses } });
      }
      if (includesExpired) {
        orClauses.push({ status: "expired" });
        orClauses.push({ status: "authorized", expiresAt: { lt: now } });
      }
      statusWhere = orClauses.length === 1 ? orClauses[0] : { OR: orClauses };
    }

    const where: Prisma.QuoteWhereInput = {
      ...(opts.branchId ? { branchId: opts.branchId } : {}),
      ...(opts.customerId ? { customerId: opts.customerId } : {}),
      ...(statusWhere ?? {}),
      ...(opts.from || opts.to
        ? {
            createdAt: {
              ...(opts.from ? { gte: opts.from } : {}),
              ...(opts.to ? { lte: opts.to } : {}),
            },
          }
        : {}),
      ...(opts.search
        ? {
            OR: [
              { folioCode: { contains: opts.search, mode: "insensitive" } },
              ...(Number.isInteger(Number(opts.search))
                ? [{ folioNumber: Number(opts.search) }]
                : []),
              { customer: { name: { contains: opts.search, mode: "insensitive" } } },
              { customer: { rfc: { contains: opts.search, mode: "insensitive" } } },
            ],
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.quote.findMany({
        where,
        include: includeJoins,
        skip,
        take: opts.pageSize,
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.quote.count({ where }),
    ]);

    return { items: rows.map((r) => toSummary(r as unknown as PrismaQuoteWithJoins)), total };
  }

  async findByIdWithItems(id: string): Promise<QuoteSummary | null> {
    const row = await this.prisma.quote.findUnique({ where: { id }, include: includeJoins });
    return row ? toSummary(row as unknown as PrismaQuoteWithJoins) : null;
  }

  async findByClientRequestId(clientRequestId: string): Promise<QuoteSummary | null> {
    const row = await this.prisma.quote.findUnique({
      where: { clientRequestId },
      include: includeJoins,
    });
    return row ? toSummary(row as unknown as PrismaQuoteWithJoins) : null;
  }

  async createWithItems(data: CreateQuoteData): Promise<QuoteSummary> {
    const quoteId = randomUUID();

    const summary = await this.prisma.$transaction(async (tx) => {
      const { folioNumber, folioCode } = await allocateBranchFolio(tx, data.folioId, data.branchId);

      // Use raw INSERT to support nullable customer_id (Prisma client was generated
      // before the NOT NULL constraint was dropped, so ORM validation rejects null).
      await tx.$executeRaw`
        INSERT INTO quotes (
          id, folio_id, folio_number, folio_code, branch_id, customer_id, creator_id,
          status, subtotal, tax_total, total, notes, expires_at, client_request_id, updated_at
        ) VALUES (
          ${quoteId}::text,
          ${data.folioId}::text,
          ${folioNumber}::integer,
          ${folioCode}::varchar,
          ${data.branchId}::text,
          ${data.customerId ?? null}::text,
          ${data.creatorId}::uuid,
          'draft',
          ${new Prisma.Decimal(data.subtotal)}::decimal,
          ${new Prisma.Decimal(data.taxTotal)}::decimal,
          ${new Prisma.Decimal(data.total)}::decimal,
          ${data.notes ?? null}::text,
          ${data.expiresAt ?? null}::timestamp,
          ${data.clientRequestId ?? null}::text,
          NOW()
        )
      `;

      for (const it of data.items) {
        await tx.quoteItem.create({
          data: {
            quoteId,
            productId: it.productId,
            productPriceId: it.productPriceId,
            productCodeSnapshot: it.productCodeSnapshot,
            productNameSnapshot: it.productNameSnapshot,
            priceNameSnapshot: it.priceNameSnapshot,
            quantity: new Prisma.Decimal(it.quantity),
            unitPrice: new Prisma.Decimal(it.unitPrice),
            discountPct: it.discountPct === null ? null : new Prisma.Decimal(it.discountPct),
            ivaRate: it.ivaRate === null ? null : new Prisma.Decimal(it.ivaRate),
            iepsRate: it.iepsRate === null ? null : new Prisma.Decimal(it.iepsRate),
            lineSubtotal: new Prisma.Decimal(it.lineSubtotal),
            lineTax: new Prisma.Decimal(it.lineTax),
            lineTotal: new Prisma.Decimal(it.lineTotal),
          },
        });
      }

      const row = await tx.quote.findUnique({ where: { id: quoteId }, include: includeJoins });
      return toSummary(row as unknown as PrismaQuoteWithJoins);
    });

    return summary;
  }

  async replaceItemsAndRecalculate(
    id: string,
    data: ReplaceQuoteItemsData
  ): Promise<QuoteSummary> {
    const summary = await this.prisma.$transaction(async (tx) => {
      await tx.quoteItem.deleteMany({ where: { quoteId: id } });

      for (const it of data.items) {
        await tx.quoteItem.create({
          data: {
            quoteId: id,
            productId: it.productId,
            productPriceId: it.productPriceId,
            productCodeSnapshot: it.productCodeSnapshot,
            productNameSnapshot: it.productNameSnapshot,
            priceNameSnapshot: it.priceNameSnapshot,
            quantity: new Prisma.Decimal(it.quantity),
            unitPrice: new Prisma.Decimal(it.unitPrice),
            discountPct: it.discountPct === null ? null : new Prisma.Decimal(it.discountPct),
            ivaRate: it.ivaRate === null ? null : new Prisma.Decimal(it.ivaRate),
            iepsRate: it.iepsRate === null ? null : new Prisma.Decimal(it.iepsRate),
            lineSubtotal: new Prisma.Decimal(it.lineSubtotal),
            lineTax: new Prisma.Decimal(it.lineTax),
            lineTotal: new Prisma.Decimal(it.lineTotal),
          },
        });
      }

      await tx.quote.update({
        where: { id },
        data: {
          ...(data.notes !== undefined ? { notes: data.notes } : {}),
          ...(data.expiresAt !== undefined ? { expiresAt: data.expiresAt } : {}),
          subtotal: new Prisma.Decimal(data.subtotal),
          taxTotal: new Prisma.Decimal(data.taxTotal),
          total: new Prisma.Decimal(data.total),
        },
      });

      const row = await tx.quote.findUnique({ where: { id }, include: includeJoins });
      return toSummary(row as unknown as PrismaQuoteWithJoins);
    });

    return summary;
  }

  async updateMeta(id: string, data: UpdateQuoteMetaData): Promise<QuoteSummary> {
    await this.prisma.quote.update({
      where: { id },
      data: {
        ...(data.notes !== undefined ? { notes: data.notes } : {}),
        ...(data.expiresAt !== undefined ? { expiresAt: data.expiresAt } : {}),
      },
    });
    const row = await this.prisma.quote.findUnique({ where: { id }, include: includeJoins });
    return toSummary(row as unknown as PrismaQuoteWithJoins);
  }

  async markAuthorized(
    id: string,
    userId: string,
    notesAppendix: string | null
  ): Promise<QuoteSummary> {
    const summary = await this.prisma.$transaction(async (tx) => {
      const current = await tx.quote.findUnique({ where: { id }, select: { notes: true } });
      const newNotes = appendNotes(current?.notes ?? null, notesAppendix);
      await tx.quote.update({
        where: { id },
        data: {
          status: "authorized",
          authorizedAt: new Date(),
          authorizedBy: userId,
          notes: newNotes,
        },
      });
      const row = await tx.quote.findUnique({ where: { id }, include: includeJoins });
      return toSummary(row as unknown as PrismaQuoteWithJoins);
    });
    return summary;
  }

  async markCancelled(id: string, reason: string | null): Promise<QuoteSummary> {
    await this.prisma.quote.update({
      where: { id },
      data: {
        status: "cancelled",
        cancelledAt: new Date(),
        cancellationReason: reason,
      },
    });
    const row = await this.prisma.quote.findUnique({ where: { id }, include: includeJoins });
    return toSummary(row as unknown as PrismaQuoteWithJoins);
  }

  async markConverted(id: string, saleId: string, tx?: TxHandle): Promise<QuoteSummary> {
    const client = (tx as Prisma.TransactionClient | undefined) ?? this.prisma;
    await client.quote.update({
      where: { id },
      data: {
        status: "converted",
        convertedAt: new Date(),
        convertedSaleId: saleId,
      },
    });
    const row = await client.quote.findUnique({ where: { id }, include: includeJoins });
    return toSummary(row as unknown as PrismaQuoteWithJoins);
  }
}
