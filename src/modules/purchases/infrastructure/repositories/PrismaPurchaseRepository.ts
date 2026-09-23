import { Prisma, PrismaClient } from "@prisma/client";
import { randomUUID } from "crypto";
import {
  PurchaseRepository,
  FindAllPurchasesOptions,
  CreatePurchaseData,
  PurchaseSummary,
  PurchaseWithItems,
  PurchaseJoinedFields,
} from "../../application/ports/PurchaseRepository";
import { Purchase } from "../../domain/entities/Purchase";
import { PurchaseItem } from "../../domain/entities/PurchaseItem";
import { ProviderPayment } from "../../domain/entities/ProviderPayment";
import { PurchaseStatus } from "../../domain/value-objects/PurchaseStatus";
import { PurchasePaymentStatus } from "../../domain/value-objects/PurchasePaymentStatus";
import { ProviderPaymentStatus } from "../../domain/value-objects/ProviderPaymentStatus";
import { PurchaseTotalsCalculator } from "../../domain/services/PurchaseTotalsCalculator";
import { ProviderNotFoundOrInactiveError } from "../../domain/errors/ProviderNotFoundOrInactiveError";
import { ProductNotFoundOrInactiveError } from "../../domain/errors/ProductNotFoundOrInactiveError";
import { PurchaseHasActiveProviderPaymentsError } from "../../domain/errors/PurchaseHasActiveProviderPaymentsError";
import { SatUuidAlreadyExistsError } from "../../domain/errors/SatUuidAlreadyExistsError";
import { InactiveResourceError } from "@/modules/pos/domain/errors/InactiveResourceError";
import { allocateBranchFolio } from "@/shared/infrastructure/folios/allocateBranchFolio";
import { recordInventoryMovement } from "@/shared/infrastructure/inventory/recordInventoryMovement";

type TxClient = Prisma.TransactionClient;

const CP_FOLIO_CODE = "CP";
const FOLIO_SCOPE = "OPERATIONS";

const includeJoins = {
  provider: { select: { name: true, rfc: true } },
  branch: { select: { name: true } },
  paymentMethod: { select: { code: true, isCredit: true } },
  creator: { select: { name: true, email: true } },
  items: true,
  providerPayments: true,
} as const;

type PrismaPurchaseWithJoins = Prisma.PurchaseGetPayload<{ include: typeof includeJoins }>;

function toDomainPurchase(row: PrismaPurchaseWithJoins): Purchase {
  return Purchase.create({
    id: row.id,
    providerId: row.providerId,
    branchId: row.branchId,
    folioId: row.folioId,
    folioNumber: row.folioNumber,
    folioCode: row.folioCode,
    paymentMethodId: row.paymentMethodId,
    creatorId: row.creatorId,
    status: row.status as PurchaseStatus,
    subtotal: Number(row.subtotal),
    taxTotal: Number(row.taxTotal),
    total: Number(row.total),
    paidAmount: Number(row.paidAmount),
    paymentStatus: row.paymentStatus as PurchasePaymentStatus,
    notes: row.notes,
    purchasedAt: row.purchasedAt,
    satUuid: row.satUuid,
    supplierInvoiceNumber: row.supplierInvoiceNumber,
    invoiceDate: row.invoiceDate,
    xmlFileName: row.xmlFileName,
    cancelledAt: row.cancelledAt,
    cancelledBy: row.cancelledBy,
    cancellationReason: row.cancellationReason,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

function toDomainItem(item: PrismaPurchaseWithJoins["items"][number]): PurchaseItem {
  return PurchaseItem.create({
    id: item.id,
    purchaseId: item.purchaseId,
    productId: item.productId,
    productCodeSnapshot: item.productCodeSnapshot,
    productNameSnapshot: item.productNameSnapshot,
    quantity: Number(item.quantity),
    unitCost: Number(item.unitCost),
    discountPct: item.discountPct === null ? null : Number(item.discountPct),
    ivaRate: item.ivaRate === null ? null : Number(item.ivaRate),
    iepsRate: item.iepsRate === null ? null : Number(item.iepsRate),
    lineSubtotal: Number(item.lineSubtotal),
    lineTax: Number(item.lineTax),
    lineTotal: Number(item.lineTotal),
  });
}

function toDomainProviderPayment(pp: PrismaPurchaseWithJoins["providerPayments"][number]): ProviderPayment {
  return ProviderPayment.create(pp.id, {
    purchaseId: pp.purchaseId,
    providerId: pp.providerId,
    branchId: pp.branchId,
    folioId: pp.folioId,
    folioNumber: pp.folioNumber,
    folioCode: pp.folioCode,
    creatorId: pp.creatorId,
    amount: Number(pp.amount),
    status: pp.status as ProviderPaymentStatus,
    notes: pp.notes,
    paidAt: pp.paidAt,
    cancelledAt: pp.cancelledAt,
    cancelledBy: pp.cancelledBy,
    cancellationReason: pp.cancellationReason,
  });
}

function toJoined(row: PrismaPurchaseWithJoins): PurchaseJoinedFields {
  return {
    providerName: row.provider?.name ?? null,
    providerRfc: row.provider?.rfc ?? null,
    branchName: row.branch?.name ?? null,
    paymentMethodCode: row.paymentMethod?.code ?? null,
    paymentMethodIsCredit: row.paymentMethod?.isCredit ?? false,
    creatorName: row.creator ? row.creator.name || row.creator.email : null,
  };
}

function toSummary(row: PrismaPurchaseWithJoins): PurchaseSummary {
  return { purchase: toDomainPurchase(row), joined: toJoined(row) };
}

function toWithItems(row: PrismaPurchaseWithJoins): PurchaseWithItems {
  return {
    purchase: toDomainPurchase(row),
    items: row.items.map(toDomainItem),
    providerPayments: row.providerPayments.map(toDomainProviderPayment),
    joined: toJoined(row),
  };
}

async function resolveCanonicalFolio(tx: TxClient, code: string) {
  const folio = await tx.folio.findFirst({
    where: { code, scope: FOLIO_SCOPE, isActive: true },
  });
  if (!folio) throw new InactiveResourceError(`Folio ${code}`);
  return folio;
}

export class PrismaPurchaseRepository implements PurchaseRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findAll(opts: FindAllPurchasesOptions): Promise<{ items: PurchaseSummary[]; total: number }> {
    const where: Prisma.PurchaseWhereInput = {
      branchId: opts.branchId,
      providerId: opts.providerId,
      status: opts.statuses && opts.statuses.length > 0 ? { in: opts.statuses } : undefined,
      purchasedAt:
        opts.from || opts.to
          ? { gte: opts.from, lte: opts.to }
          : undefined,
    };

    const [rows, total] = await Promise.all([
      this.prisma.purchase.findMany({
        where,
        include: includeJoins,
        orderBy: { purchasedAt: "desc" },
        skip: (opts.page - 1) * opts.pageSize,
        take: opts.pageSize,
      }),
      this.prisma.purchase.count({ where }),
    ]);

    return { items: rows.map((row) => toSummary(row as PrismaPurchaseWithJoins)), total };
  }

  async findByIdWithItems(id: string): Promise<PurchaseWithItems | null> {
    const row = await this.prisma.purchase.findUnique({ where: { id }, include: includeJoins });
    if (!row) return null;
    return toWithItems(row as PrismaPurchaseWithJoins);
  }

  async createCompleted(data: CreatePurchaseData): Promise<PurchaseWithItems> {
    const purchaseId = randomUUID();

    const result = await this.prisma.$transaction(async (tx) => {
      if (data.satUuid) {
        const existing = await tx.purchase.findUnique({ where: { satUuid: data.satUuid } });
        if (existing) {
          throw new SatUuidAlreadyExistsError(`${existing.folioCode}-${String(existing.folioNumber).padStart(6, "0")}`);
        }
      }

      let providerId = data.providerId;
      if (data.newProvider) {
        // rfc ya no es @unique en Prisma (índice único parcial vía SQL crudo), así que
        // no puede usarse como where de upsert — se resuelve con find-or-create manual.
        const existingProvider = await tx.provider.findFirst({ where: { rfc: data.newProvider.rfc } });
        const created =
          existingProvider ??
          (await tx.provider.create({
            data: {
              code: `PROV_${data.newProvider.rfc}`,
              name: data.newProvider.name,
              rfc: data.newProvider.rfc,
              legalName: data.newProvider.legalName ?? null,
              taxRegime: data.newProvider.taxRegime ?? null,
            },
          }));
        providerId = created.id;
      }
      if (!providerId) throw new ProviderNotFoundOrInactiveError();

      const provider = await tx.provider.findUnique({ where: { id: providerId } });
      if (!provider || !provider.isActive) throw new ProviderNotFoundOrInactiveError();

      const branch = await tx.branch.findUnique({ where: { id: data.branchId } });
      if (!branch || !branch.isActive) throw new InactiveResourceError("Branch");

      const paymentMethod = await tx.paymentMethod.findUnique({ where: { id: data.paymentMethodId } });
      if (!paymentMethod || !paymentMethod.isActive) throw new InactiveResourceError("PaymentMethod");

      const calcLines: Array<{
        quantity: number;
        unitCost: number;
        discountPct: number | null;
        ivaRate: number | null;
        iepsRate: number | null;
        isTaxable: boolean;
      }> = [];
      const snapshots: Array<{
        id: string;
        productId: string;
        productCodeSnapshot: string;
        productNameSnapshot: string;
        quantity: number;
        unitCost: number;
        discountPct: number | null;
        ivaRate: number | null;
        iepsRate: number | null;
        lotNumber: string | null;
        expirationDate: Date | null;
        manufactureDate: Date | null;
      }> = [];

      for (const item of data.items) {
        const product = await tx.product.findUnique({ where: { id: item.productId } });
        if (!product || !product.isActive) throw new ProductNotFoundOrInactiveError();

        const ivaRate = product.ivaRate === null ? null : Number(product.ivaRate);
        const iepsRate = product.iepsRate === null ? null : Number(product.iepsRate);

        calcLines.push({
          quantity: item.quantity,
          unitCost: item.unitCost,
          discountPct: item.discountPct,
          ivaRate,
          iepsRate,
          isTaxable: product.isTaxable,
        });
        snapshots.push({
          id: randomUUID(),
          productId: product.id,
          productCodeSnapshot: product.code,
          productNameSnapshot: product.name,
          quantity: item.quantity,
          unitCost: item.unitCost,
          discountPct: item.discountPct,
          ivaRate: product.isTaxable ? ivaRate : 0,
          iepsRate: product.isTaxable ? iepsRate : 0,
          lotNumber: item.lotNumber ?? null,
          expirationDate: item.expirationDate ?? null,
          manufactureDate: item.manufactureDate ?? null,
        });
      }

      const totals = PurchaseTotalsCalculator.computeTotals(calcLines);

      const folio = await resolveCanonicalFolio(tx, CP_FOLIO_CODE);
      const { folioNumber, folioCode } = await allocateBranchFolio(tx, folio.id, data.branchId);

      const purchasedAt = data.purchasedAt ?? new Date();
      for (let i = 0; i < snapshots.length; i++) {
        const item = snapshots[i];
        await recordInventoryMovement(tx, {
          branchId: data.branchId,
          productId: item.productId,
          movementAt: purchasedAt,
          movementType: "purchase",
          direction: "IN",
          quantity: item.quantity,
          unitCost: item.unitCost,
          providerId,
          folioId: folio.id,
          folioCode,
          folioNumber,
          sourceType: "purchase",
          sourceId: purchaseId,
        });
        // El costo de adquisición del producto se actualiza con el último costo comprado.
        // Comportamiento intencional: cancel() no lo revierte (ver purchases-api spec).
        await tx.product.update({
          where: { id: item.productId },
          data: { acquisitionPrice: new Prisma.Decimal(item.unitCost) },
        });
      }

      const isCredit = paymentMethod.isCredit;
      const paidAmount = isCredit ? 0 : totals.total;
      const paymentStatus: PurchasePaymentStatus = isCredit ? "pending" : "paid";

      if (isCredit) {
        await tx.$executeRaw`
          UPDATE providers SET current_balance = current_balance + ${totals.total}::numeric, updated_at = NOW()
          WHERE id = ${providerId}
        `;
      }

      await tx.purchase.create({
        data: {
          id: purchaseId,
          providerId,
          branchId: data.branchId,
          folioId: folio.id,
          folioNumber,
          folioCode,
          paymentMethodId: data.paymentMethodId,
          creatorId: data.creatorId,
          status: "completed",
          subtotal: new Prisma.Decimal(totals.subtotal),
          taxTotal: new Prisma.Decimal(totals.taxTotal),
          total: new Prisma.Decimal(totals.total),
          paidAmount: new Prisma.Decimal(paidAmount),
          paymentStatus,
          notes: data.notes,
          purchasedAt,
          satUuid: data.satUuid ?? null,
          supplierInvoiceNumber: data.supplierInvoiceNumber ?? null,
          invoiceDate: data.invoiceDate ?? null,
          xmlFileName: data.xmlFileName ?? null,
          items: {
            create: snapshots.map((item, i) => ({
              id: item.id,
              productId: item.productId,
              productCodeSnapshot: item.productCodeSnapshot,
              productNameSnapshot: item.productNameSnapshot,
              quantity: new Prisma.Decimal(item.quantity),
              unitCost: new Prisma.Decimal(item.unitCost),
              discountPct: item.discountPct === null ? null : new Prisma.Decimal(item.discountPct),
              ivaRate: item.ivaRate === null ? null : new Prisma.Decimal(item.ivaRate),
              iepsRate: item.iepsRate === null ? null : new Prisma.Decimal(item.iepsRate),
              lineSubtotal: new Prisma.Decimal(totals.lines[i].lineSubtotal),
              lineTax: new Prisma.Decimal(totals.lines[i].lineTax),
              lineTotal: new Prisma.Decimal(totals.lines[i].lineTotal),
            })),
          },
        },
      });

      const lotsToCreate = snapshots.filter((item) => item.lotNumber && item.expirationDate);
      if (lotsToCreate.length > 0) {
        await tx.inventoryLot.createMany({
          data: lotsToCreate.map((item) => ({
            branchId: data.branchId,
            productId: item.productId,
            purchaseItemId: item.id,
            lotNumber: item.lotNumber as string,
            expirationDate: item.expirationDate as Date,
            manufactureDate: item.manufactureDate ?? null,
            quantity: new Prisma.Decimal(item.quantity),
          })),
        });
      }

      const row = await tx.purchase.findUnique({ where: { id: purchaseId }, include: includeJoins });
      return toWithItems(row as PrismaPurchaseWithJoins);
    });

    return result;
  }

  async cancel(
    id: string,
    cancelledBy: string,
    cancellationReason: string | null
  ): Promise<PurchaseWithItems> {
    const result = await this.prisma.$transaction(async (tx) => {
      const current = await tx.purchase.findUnique({ where: { id }, include: { items: true } });
      if (!current) throw new Error("Purchase not found in cancel transaction");

      const activeProviderPayments = await tx.providerPayment.findMany({
        where: { purchaseId: id, status: "completed" },
        select: { id: true },
      });
      if (activeProviderPayments.length > 0) {
        throw new PurchaseHasActiveProviderPaymentsError(activeProviderPayments.map((p) => p.id));
      }

      await tx.inventoryLot.deleteMany({
        where: { purchaseItemId: { in: current.items.map((item) => item.id) } },
      });

      const cancelledAt = new Date();
      for (const item of current.items) {
        await recordInventoryMovement(tx, {
          branchId: current.branchId,
          productId: item.productId,
          movementAt: cancelledAt,
          movementType: "purchase_cancel",
          direction: "OUT",
          quantity: Number(item.quantity),
          unitCost: Number(item.unitCost),
          providerId: current.providerId,
          folioId: current.folioId,
          folioCode: current.folioCode,
          folioNumber: current.folioNumber,
          sourceType: "purchase",
          sourceId: id,
        });
      }

      const outstanding = Number(current.total) - Number(current.paidAmount);
      if (outstanding > 0) {
        await tx.$executeRaw`
          UPDATE providers SET current_balance = current_balance - ${outstanding}::numeric, updated_at = NOW()
          WHERE id = ${current.providerId}
        `;
      }

      await tx.purchase.update({
        where: { id },
        data: { status: "cancelled", cancelledAt, cancelledBy, cancellationReason },
      });

      const row = await tx.purchase.findUnique({ where: { id }, include: includeJoins });
      return toWithItems(row as PrismaPurchaseWithJoins);
    });

    return result;
  }
}
