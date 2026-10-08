import { Prisma, PrismaClient } from "@prisma/client";
import { randomUUID } from "crypto";
import {
  ReturnRepository,
  ReturnWithItems,
  ReturnSummary,
  ReturnJoinedFields,
  FindAllReturnsOptions,
  PriorReturnItemRow,
  CreateReturnData,
} from "../../application/ports/ReturnRepository";
import { Return } from "../../domain/entities/Return";
import { ReturnItem } from "../../domain/entities/ReturnItem";
import { ReturnStatus } from "../../domain/value-objects/ReturnStatus";
import { recordInventoryMovement, type LowStockSignal } from "@/shared/infrastructure/inventory/recordInventoryMovement";
import { inventoryQuantityOf } from "@/shared/domain/services/inventoryQuantityOf";
import type { AdminNotificationService } from "@/shared/application/services/AdminNotificationService";

type PrismaReturnWithJoins = {
  id: string;
  saleId: string;
  branchId: string;
  customerId: string | null;
  creatorId: string;
  status: string;
  reason: string;
  returnedAt: Date;
  refundSubtotal: Prisma.Decimal;
  refundTax: Prisma.Decimal;
  refundTotal: Prisma.Decimal;
  notes: string | null;
  cancelledAt: Date | null;
  cancelledBy: string | null;
  cancellationReason: string | null;
  createdAt: Date;
  updatedAt: Date;
  sale: { folioCode: string; folioNumber: number } | null;
  branch: { name: string } | null;
  customer: { name: string; rfc: string | null } | null;
  creator: { name: string | null; email: string } | null;
  items: Array<{
    id: string;
    returnId: string;
    saleItemId: string;
    productId: string;
    productPriceId: string | null;
    dosificationId: string | null;
    numPartsSnapshot: number | null;
    productCodeSnapshot: string;
    productNameSnapshot: string;
    priceNameSnapshot: string;
    quantity: Prisma.Decimal;
    unitPrice: Prisma.Decimal;
    discountPct: Prisma.Decimal | null;
    discountAmount: Prisma.Decimal;
    ivaRate: Prisma.Decimal | null;
    iepsRate: Prisma.Decimal | null;
    lineSubtotal: Prisma.Decimal;
    lineTax: Prisma.Decimal;
    lineTotal: Prisma.Decimal;
  }>;
};

const includeJoins = {
  sale: { select: { folioCode: true, folioNumber: true } },
  branch: { select: { name: true } },
  customer: { select: { name: true, rfc: true } },
  creator: { select: { name: true, email: true } },
  items: true,
} as const;

const includeSummaryJoins = {
  sale: { select: { folioCode: true, folioNumber: true } },
  branch: { select: { name: true } },
  customer: { select: { name: true, rfc: true } },
  creator: { select: { name: true, email: true } },
} as const;

function toReturn(row: PrismaReturnWithJoins): Return {
  return Return.create({
    id: row.id,
    saleId: row.saleId,
    branchId: row.branchId,
    customerId: row.customerId,
    creatorId: row.creatorId,
    status: row.status as ReturnStatus,
    reason: row.reason,
    returnedAt: row.returnedAt,
    refundSubtotal: Number(row.refundSubtotal),
    refundTax: Number(row.refundTax),
    refundTotal: Number(row.refundTotal),
    notes: row.notes,
    cancelledAt: row.cancelledAt,
    cancelledBy: row.cancelledBy,
    cancellationReason: row.cancellationReason,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

function toReturnItem(item: PrismaReturnWithJoins["items"][0]): ReturnItem {
  return ReturnItem.create({
    id: item.id,
    returnId: item.returnId,
    saleItemId: item.saleItemId,
    productId: item.productId,
    productPriceId: item.productPriceId,
    dosificationId: item.dosificationId,
    numPartsSnapshot: item.numPartsSnapshot,
    productCodeSnapshot: item.productCodeSnapshot,
    productNameSnapshot: item.productNameSnapshot,
    priceNameSnapshot: item.priceNameSnapshot,
    quantity: Number(item.quantity),
    unitPrice: Number(item.unitPrice),
    discountPct: item.discountPct ? Number(item.discountPct) : null,
    discountAmount: Number(item.discountAmount),
    ivaRate: item.ivaRate ? Number(item.ivaRate) : null,
    iepsRate: item.iepsRate ? Number(item.iepsRate) : null,
    lineSubtotal: Number(item.lineSubtotal),
    lineTax: Number(item.lineTax),
    lineTotal: Number(item.lineTotal),
  });
}

function toJoined(row: {
  sale: { folioCode: string; folioNumber: number } | null;
  branch: { name: string } | null;
  customer: { name: string; rfc: string | null } | null;
  creator: { name: string | null; email: string } | null;
}): ReturnJoinedFields {
  return {
    saleFolioCode: row.sale?.folioCode ?? null,
    saleFolioNumber: row.sale?.folioNumber ?? null,
    branchName: row.branch?.name ?? null,
    customerName: row.customer?.name ?? null,
    customerRfc: row.customer?.rfc ?? null,
    creatorName: row.creator?.name ?? row.creator?.email ?? null,
  };
}

function toWithItems(row: PrismaReturnWithJoins): ReturnWithItems {
  return {
    return: toReturn(row),
    items: row.items.map(toReturnItem),
    joined: toJoined(row),
  };
}

type TxClient = Prisma.TransactionClient;

export class PrismaReturnRepository implements ReturnRepository {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly notifier?: AdminNotificationService
  ) {}

  private async fireLowStockNotifications(signals: LowStockSignal[], branchName: string): Promise<void> {
    if (!this.notifier) return;
    for (const signal of signals) {
      await this.notifier.notifyLowStock({
        productName: signal.productName,
        productCode: signal.productCode,
        branchName,
        quantity: signal.quantity,
        reorderPoint: signal.reorderPoint,
      });
    }
  }

  async findAll(
    opts: FindAllReturnsOptions
  ): Promise<{ items: ReturnSummary[]; total: number }> {
    const skip = (opts.page - 1) * opts.pageSize;

    const where: Prisma.ReturnWhereInput = {
      ...(opts.branchId ? { branchId: opts.branchId } : {}),
      ...(opts.customerId ? { customerId: opts.customerId } : {}),
      ...(opts.saleId ? { saleId: opts.saleId } : {}),
      ...(opts.statuses && opts.statuses.length > 0 ? { status: { in: opts.statuses } } : {}),
      ...(opts.from || opts.to
        ? {
            returnedAt: {
              ...(opts.from ? { gte: opts.from } : {}),
              ...(opts.to ? { lte: opts.to } : {}),
            },
          }
        : {}),
      ...(opts.search
        ? {
            OR: [
              { sale: { folioCode: { contains: opts.search, mode: "insensitive" } } },
              ...(Number.isInteger(Number(opts.search))
                ? [{ sale: { folioNumber: Number(opts.search) } }]
                : []),
              { customer: { name: { contains: opts.search, mode: "insensitive" } } },
              { customer: { rfc: { contains: opts.search, mode: "insensitive" } } },
            ],
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.return.findMany({
        where,
        include: includeSummaryJoins,
        skip,
        take: opts.pageSize,
        orderBy: [{ returnedAt: "desc" }, { createdAt: "desc" }],
      }),
      this.prisma.return.count({ where }),
    ]);

    const items: ReturnSummary[] = rows.map((row) => ({
      return: Return.create({
        id: row.id,
        saleId: row.saleId,
        branchId: row.branchId,
        customerId: row.customerId,
        creatorId: row.creatorId,
        status: row.status as ReturnStatus,
        reason: row.reason,
        returnedAt: row.returnedAt,
        refundSubtotal: Number(row.refundSubtotal),
        refundTax: Number(row.refundTax),
        refundTotal: Number(row.refundTotal),
        notes: row.notes,
        cancelledAt: row.cancelledAt,
        cancelledBy: row.cancelledBy,
        cancellationReason: row.cancellationReason,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      }),
      joined: toJoined(row),
    }));

    return { items, total };
  }

  async findByIdWithItems(id: string): Promise<ReturnWithItems | null> {
    const row = await this.prisma.return.findUnique({
      where: { id },
      include: includeJoins,
    });
    return row ? toWithItems(row as unknown as PrismaReturnWithJoins) : null;
  }

  async findBySaleId(saleId: string): Promise<ReturnWithItems[]> {
    const rows = await this.prisma.return.findMany({
      where: { saleId },
      include: includeJoins,
      orderBy: [{ returnedAt: "desc" }, { createdAt: "desc" }],
    });
    return rows.map((r) => toWithItems(r as unknown as PrismaReturnWithJoins));
  }

  async findPriorReturnItemsBySaleItemIds(saleItemIds: string[]): Promise<PriorReturnItemRow[]> {
    if (saleItemIds.length === 0) return [];
    type Row = { sale_item_id: string; quantity: Prisma.Decimal; status: string };
    const rows = await this.prisma.$queryRaw<Row[]>`
      SELECT ri.sale_item_id, ri.quantity, r.status
      FROM return_items ri
      JOIN returns r ON r.id = ri.return_id
      WHERE ri.sale_item_id = ANY(${saleItemIds}::text[])
    `;
    return rows.map((r) => ({
      saleItemId: r.sale_item_id,
      quantity: Number(r.quantity),
      returnStatus: r.status,
    }));
  }

  async aggregateReturnedQuantityBySaleItemIds(
    saleItemIds: string[]
  ): Promise<Record<string, number>> {
    if (saleItemIds.length === 0) return {};
    type Row = { sale_item_id: string; total: number };
    const rows = await this.prisma.$queryRaw<Row[]>`
      SELECT ri.sale_item_id, SUM(ri.quantity)::float8 as total
      FROM return_items ri
      JOIN returns r ON r.id = ri.return_id
      WHERE ri.sale_item_id = ANY(${saleItemIds}::text[])
        AND r.status = 'completed'
      GROUP BY ri.sale_item_id
    `;
    const result: Record<string, number> = {};
    for (const row of rows) {
      result[row.sale_item_id] = Number(row.total);
    }
    return result;
  }

  async createWithItems(data: CreateReturnData): Promise<ReturnWithItems> {
    const returnId = randomUUID();

    const result = await this.prisma.$transaction(async (tx) => {
      // Referenced sale's folio identifies the document being corrected (Return has no folio of its own).
      const sale = await tx.sale.findUnique({
        where: { id: data.saleId },
        select: { folioId: true, folioCode: true, folioNumber: true },
      });

      // Record return movement + increment inventory per item
      for (const item of data.items) {
        await recordInventoryMovement(tx, {
          branchId: data.branchId,
          productId: item.productId,
          movementAt: data.returnedAt,
          movementType: "return",
          direction: "IN",
          quantity: inventoryQuantityOf(item.quantity, item.numPartsSnapshot),
          unitPrice: item.unitPrice,
          customerId: data.customerId,
          folioId: sale?.folioId ?? null,
          folioCode: sale?.folioCode ?? null,
          folioNumber: sale?.folioNumber ?? null,
          originFolioCode: sale?.folioCode ?? null,
          originFolioNumber: sale?.folioNumber ?? null,
          sourceType: "return",
          sourceId: returnId,
        });
      }

      // Insert return
      await tx.return.create({
        data: {
          id: returnId,
          saleId: data.saleId,
          branchId: data.branchId,
          customerId: data.customerId,
          creatorId: data.creatorId,
          status: "completed",
          reason: data.reason,
          returnedAt: data.returnedAt,
          refundSubtotal: new Prisma.Decimal(data.refundSubtotal),
          refundTax: new Prisma.Decimal(data.refundTax),
          refundTotal: new Prisma.Decimal(data.refundTotal),
          notes: data.notes,
          cancelledAt: null,
          cancelledBy: null,
          cancellationReason: null,
          items: {
            create: data.items.map((item) => ({
              id: randomUUID(),
              saleItemId: item.saleItemId,
              productId: item.productId,
              productPriceId: item.productPriceId,
              dosificationId: item.dosificationId,
              numPartsSnapshot: item.numPartsSnapshot,
              productCodeSnapshot: item.productCodeSnapshot,
              productNameSnapshot: item.productNameSnapshot,
              priceNameSnapshot: item.priceNameSnapshot,
              quantity: new Prisma.Decimal(item.quantity),
              unitPrice: new Prisma.Decimal(item.unitPrice),
              discountPct: item.discountPct === null ? null : new Prisma.Decimal(item.discountPct),
              discountAmount: new Prisma.Decimal(item.discountAmount),
              ivaRate: item.ivaRate === null ? null : new Prisma.Decimal(item.ivaRate),
              iepsRate: item.iepsRate === null ? null : new Prisma.Decimal(item.iepsRate),
              lineSubtotal: new Prisma.Decimal(item.lineSubtotal),
              lineTax: new Prisma.Decimal(item.lineTax),
              lineTotal: new Prisma.Decimal(item.lineTotal),
            })),
          },
        },
      });

      if (data.markSaleReturnedTotalId) {
        await tx.sale.update({
          where: { id: data.markSaleReturnedTotalId },
          data: { status: "returned_total" },
        });
      }

      const row = await tx.return.findUnique({
        where: { id: returnId },
        include: includeJoins,
      });
      return row as unknown as PrismaReturnWithJoins;
    });

    return toWithItems(result);
  }

  async markCancelled(
    id: string,
    cancelledBy: string,
    cancellationReason: string | null,
    itemsToUndo: Array<{ productId: string; quantity: number; numPartsSnapshot: number | null }>
  ): Promise<Return> {
    const ret = await this.prisma.return.findUniqueOrThrow({ where: { id } });
    const lowStockSignals: LowStockSignal[] = [];

    const updated = await this.prisma.$transaction(async (tx) => {
      const sale = await tx.sale.findUnique({
        where: { id: ret.saleId },
        select: { folioId: true, folioCode: true, folioNumber: true },
      });

      const cancelledAt = new Date();

      // Decrement inventory to undo the return (allow negative) + record return_cancel movement
      for (const item of itemsToUndo) {
        const { lowStockSignal } = await recordInventoryMovement(tx, {
          branchId: ret.branchId,
          productId: item.productId,
          movementAt: cancelledAt,
          movementType: "return_cancel",
          direction: "OUT",
          quantity: inventoryQuantityOf(item.quantity, item.numPartsSnapshot),
          customerId: ret.customerId,
          folioId: sale?.folioId ?? null,
          folioCode: sale?.folioCode ?? null,
          folioNumber: sale?.folioNumber ?? null,
          originFolioCode: sale?.folioCode ?? null,
          originFolioNumber: sale?.folioNumber ?? null,
          sourceType: "return",
          sourceId: id,
        });
        if (lowStockSignal) lowStockSignals.push(lowStockSignal);
      }

      return tx.return.update({
        where: { id },
        data: {
          status: "cancelled",
          cancelledAt,
          cancelledBy,
          cancellationReason,
        },
      });
    });

    if (lowStockSignals.length > 0) {
      const branch = await this.prisma.branch.findUnique({ where: { id: ret.branchId }, select: { name: true } });
      await this.fireLowStockNotifications(lowStockSignals, branch?.name ?? ret.branchId);
    }

    return Return.create({
      id: updated.id,
      saleId: updated.saleId,
      branchId: updated.branchId,
      customerId: updated.customerId,
      creatorId: updated.creatorId,
      status: updated.status as ReturnStatus,
      reason: updated.reason,
      returnedAt: updated.returnedAt,
      refundSubtotal: Number(updated.refundSubtotal),
      refundTax: Number(updated.refundTax),
      refundTotal: Number(updated.refundTotal),
      notes: updated.notes,
      cancelledAt: updated.cancelledAt,
      cancelledBy: updated.cancelledBy,
      cancellationReason: updated.cancellationReason,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    });
  }
}
