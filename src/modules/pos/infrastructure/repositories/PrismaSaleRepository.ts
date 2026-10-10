import { Prisma, PrismaClient } from "@prisma/client";
import { randomUUID } from "crypto";
import {
  SaleRepository,
  FindAllSalesOptions,
  CreateSaleData,
  CreateSaleFromQuoteData,
  EditSaleData,
  SaleSummary,
} from "../../application/ports/SaleRepository";
import { Sale, SaleStatus } from "../../domain/entities/Sale";
import { SaleItem } from "../../domain/entities/SaleItem";
import { SaleJoinedFields } from "../../application/mappers/toSaleDto";
import { InactiveResourceError } from "../../domain/errors/InactiveResourceError";
import { SaleHasActivePaymentsError } from "@/modules/payments/domain/errors/SaleHasActivePaymentsError";
import { allocateBranchFolio } from "@/shared/infrastructure/folios/allocateBranchFolio";
import { recordInventoryMovement, type LowStockSignal } from "@/shared/infrastructure/inventory/recordInventoryMovement";
import { inventoryQuantityOf } from "@/shared/domain/services/inventoryQuantityOf";
import type { AdminNotificationService } from "@/shared/application/services/AdminNotificationService";
import { isBranchScopedInventory } from "@/shared/infrastructure/config/inventoryScope";
import { isPrismaUniqueError } from "@/shared/infrastructure/prisma/errors";

/** Suma `days` días naturales a una fecha, devolviendo una nueva instancia. */
function addDays(base: Date, days: number): Date {
  return new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
}

type PrismaSaleWithJoins = {
  id: string;
  folioId: string;
  folioNumber: number;
  folioCode: string;
  branchId: string;
  customerId: string | null;
  cashierId: string;
  paymentMethodId: string;
  quoteId: string | null;
  status: string;
  paidAmount: Prisma.Decimal;
  paymentStatus: string;
  subtotal: Prisma.Decimal;
  taxTotal: Prisma.Decimal;
  total: Prisma.Decimal;
  notes: string | null;
  completedAt: Date | null;
  cancelledAt: Date | null;
  cancellationReason: string | null;
  editedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  branch: { name: string } | null;
  customer: { name: string; rfc: string; address: string | null; creditDays: number } | null;
  cashier: { name: string | null; email: string } | null;
  paymentMethod: { code: string; name: string; isCredit: boolean } | null;
  items: Array<{
    id: string;
    saleId: string;
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
  branch: { select: { name: true } },
  customer: { select: { name: true, rfc: true, address: true, creditDays: true } },
  cashier: { select: { name: true, email: true } },
  paymentMethod: { select: { code: true, name: true, isCredit: true } },
  items: true,
} as const;

type TxClient = Prisma.TransactionClient;

interface SnapshotLike {
  productId: string;
  productPriceId: string | null;
  dosificationId: string | null;
  numPartsSnapshot: number | null;
  productCodeSnapshot: string;
  productNameSnapshot: string;
  priceNameSnapshot: string;
  quantity: number;
  unitPrice: number;
  discountPct: number | null;
  discountAmount: number;
  ivaRate: number | null;
  iepsRate: number | null;
  lineSubtotal: number;
  lineTax: number;
  lineTotal: number;
}

function toSaleItemCreate(it: SnapshotLike) {
  return {
    productId: it.productId,
    productPriceId: it.productPriceId,
    dosificationId: it.dosificationId,
    numPartsSnapshot: it.numPartsSnapshot,
    productCodeSnapshot: it.productCodeSnapshot,
    productNameSnapshot: it.productNameSnapshot,
    priceNameSnapshot: it.priceNameSnapshot,
    quantity: new Prisma.Decimal(it.quantity),
    unitPrice: new Prisma.Decimal(it.unitPrice),
    discountPct: it.discountPct === null ? null : new Prisma.Decimal(it.discountPct),
    discountAmount: new Prisma.Decimal(it.discountAmount),
    ivaRate: it.ivaRate === null ? null : new Prisma.Decimal(it.ivaRate),
    iepsRate: it.iepsRate === null ? null : new Prisma.Decimal(it.iepsRate),
    lineSubtotal: new Prisma.Decimal(it.lineSubtotal),
    lineTax: new Prisma.Decimal(it.lineTax),
    lineTotal: new Prisma.Decimal(it.lineTotal),
  };
}

function toSummary(row: PrismaSaleWithJoins): SaleSummary {
  const items = row.items.map((it) =>
    SaleItem.create({
      id: it.id,
      saleId: it.saleId,
      productId: it.productId,
      productPriceId: it.productPriceId,
      dosificationId: it.dosificationId,
      numPartsSnapshot: it.numPartsSnapshot,
      productCodeSnapshot: it.productCodeSnapshot,
      productNameSnapshot: it.productNameSnapshot,
      priceNameSnapshot: it.priceNameSnapshot,
      quantity: Number(it.quantity),
      unitPrice: Number(it.unitPrice),
      discountPct: it.discountPct ? Number(it.discountPct) : null,
      discountAmount: Number(it.discountAmount),
      ivaRate: it.ivaRate ? Number(it.ivaRate) : null,
      iepsRate: it.iepsRate ? Number(it.iepsRate) : null,
      lineSubtotal: Number(it.lineSubtotal),
      lineTax: Number(it.lineTax),
      lineTotal: Number(it.lineTotal),
    })
  );

  const sale = Sale.create({
    id: row.id,
    folioId: row.folioId,
    folioNumber: row.folioNumber,
    folioCode: row.folioCode,
    branchId: row.branchId,
    customerId: row.customerId,
    cashierId: row.cashierId,
    paymentMethodId: row.paymentMethodId,
    quoteId: row.quoteId,
    status: row.status as SaleStatus,
    paidAmount: Number(row.paidAmount),
    paymentStatus: row.paymentStatus,
    subtotal: Number(row.subtotal),
    taxTotal: Number(row.taxTotal),
    total: Number(row.total),
    notes: row.notes,
    completedAt: row.completedAt,
    cancelledAt: row.cancelledAt,
    cancellationReason: row.cancellationReason,
    editedAt: row.editedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    items,
  });

  const joined: SaleJoinedFields = {
    branchName: row.branch?.name ?? null,
    customerName: row.customer?.name ?? null,
    customerRfc: row.customer?.rfc ?? null,
    customerAddress: row.customer?.address ?? null,
    customerCreditDays: row.customer?.creditDays ?? null,
    cashierName: row.cashier?.name ?? row.cashier?.email ?? null,
    paymentMethodCode: row.paymentMethod?.code ?? null,
    paymentMethodName: row.paymentMethod?.name ?? null,
    paymentMethodIsCredit: row.paymentMethod?.isCredit ?? false,
  };

  return { sale, joined };
}

export class PrismaSaleRepository implements SaleRepository {
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

  async findAll(opts: FindAllSalesOptions): Promise<{ items: SaleSummary[]; total: number }> {
    const skip = (opts.page - 1) * opts.pageSize;

    const where: Prisma.SaleWhereInput = {
      ...(opts.branchId ? { branchId: opts.branchId } : {}),
      ...(opts.customerId ? { customerId: opts.customerId } : {}),
      ...(opts.statuses && opts.statuses.length > 0 ? { status: { in: opts.statuses } } : {}),
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
      this.prisma.sale.findMany({
        where,
        include: includeJoins,
        skip,
        take: opts.pageSize,
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.sale.count({ where }),
    ]);

    return { items: rows.map((r) => toSummary(r as unknown as PrismaSaleWithJoins)), total };
  }

  async findByIdWithItems(id: string): Promise<SaleSummary | null> {
    const row = await this.prisma.sale.findUnique({ where: { id }, include: includeJoins });
    if (!row) return null;

    const summary = toSummary(row as unknown as PrismaSaleWithJoins);
    const saleItemIds = summary.sale.items.map((i) => i.id);
    summary.returnedQuantityBySaleItem = await this.aggregateReturnedQty(saleItemIds);
    summary.satProductCodeByProductId = await this.findSatProductCodesByProductId(
      summary.sale.items.map((i) => i.productId)
    );
    return summary;
  }

  private async findSatProductCodesByProductId(productIds: string[]): Promise<Record<string, string | null>> {
    const uniqueIds = Array.from(new Set(productIds));
    if (uniqueIds.length === 0) return {};
    const products = await this.prisma.product.findMany({
      where: { id: { in: uniqueIds } },
      select: { id: true, satProductCode: true },
    });
    const result: Record<string, string | null> = {};
    for (const p of products) {
      result[p.id] = p.satProductCode ?? null;
    }
    return result;
  }

  async findByClientRequestId(clientRequestId: string): Promise<SaleSummary | null> {
    const row = await this.prisma.sale.findUnique({
      where: { clientRequestId },
      include: includeJoins,
    });
    if (!row) return null;

    const summary = toSummary(row as unknown as PrismaSaleWithJoins);
    const saleItemIds = summary.sale.items.map((i) => i.id);
    summary.returnedQuantityBySaleItem = await this.aggregateReturnedQty(saleItemIds);
    return summary;
  }

  private async aggregateReturnedQty(saleItemIds: string[]): Promise<Record<string, number>> {
    if (saleItemIds.length === 0) return {};
    type Row = { sale_item_id: string; total: number };
    const rows = await this.prisma.$queryRaw<Row[]>`
      SELECT ri.sale_item_id, SUM(ri.quantity)::float8 AS total
      FROM return_items ri
      JOIN returns r ON r.id = ri.return_id
      WHERE ri.sale_item_id = ANY(${saleItemIds}::text[])
        AND r.status = 'completed'
      GROUP BY ri.sale_item_id
    `;
    const result: Record<string, number> = {};
    for (const r of rows) {
      result[r.sale_item_id] = Number(r.total);
    }
    return result;
  }

  async createCompleted(data: CreateSaleData): Promise<SaleSummary> {
    const saleId = randomUUID();
    const lowStockSignals: LowStockSignal[] = [];

    let summary: SaleSummary;
    try {
      summary = await this.prisma.$transaction(async (tx) => {
        const { folioNumber, folioCode } = await allocateBranchFolio(tx, data.folioId, data.branchId);
        const completedAt = new Date();

        for (const item of data.items) {
          const { lowStockSignal } = await recordInventoryMovement(tx, {
            branchId: data.branchId,
            productId: item.productId,
            movementAt: completedAt,
            movementType: "sale",
            direction: "OUT",
            quantity: inventoryQuantityOf(item.quantity, item.numPartsSnapshot),
            unitPrice: item.unitPrice,
            customerId: data.customerId,
            folioId: data.folioId,
            folioCode,
            folioNumber,
            sourceType: "sale",
            sourceId: saleId,
            allowRowCreation: !isBranchScopedInventory(),
          });
          if (lowStockSignal) lowStockSignals.push(lowStockSignal);
        }

        let dueDate: Date | null = null;

        // Credit sale: debit customer balance (increase debt) + set due date
        if (data.paymentStatus !== "paid" && data.customerId) {
          const cust = await tx.customer.findUnique({
            where: { id: data.customerId },
            select: { creditDays: true },
          });
          dueDate = addDays(completedAt, cust?.creditDays ?? 30);
          await tx.$executeRaw`
          UPDATE customers SET current_balance = current_balance + ${data.total}::numeric
          WHERE id = ${data.customerId}
        `;
        }

        await tx.sale.create({
          data: {
            id: saleId,
            folioId: data.folioId,
            folioNumber,
            folioCode,
            branchId: data.branchId,
            customerId: data.customerId,
            cashierId: data.cashierId,
            paymentMethodId: data.paymentMethodId,
            quoteId: data.quoteId ?? null,
            clientRequestId: data.clientRequestId ?? null,
            status: "completed",
            paidAmount: new Prisma.Decimal(data.paidAmount),
            paymentStatus: data.paymentStatus,
            subtotal: new Prisma.Decimal(data.subtotal),
            taxTotal: new Prisma.Decimal(data.taxTotal),
            total: new Prisma.Decimal(data.total),
            notes: data.notes,
            dueDate,
            completedAt,
            items: { create: data.items.map(toSaleItemCreate) },
          },
        });

        const row = await tx.sale.findUnique({ where: { id: saleId }, include: includeJoins });
        return toSummary(row as unknown as PrismaSaleWithJoins);
      });
    } catch (err) {
      // Idempotent replay lost the race with a concurrent retry carrying the same
      // clientRequestId (e.g. an offline-sync outbox retry fired before the winning
      // attempt's response was acknowledged): the unique constraint on
      // client_request_id let only one INSERT through. Resolve to the winner's row
      // instead of surfacing a 500 — see TECH_DEBT_CHECKLIST.md §1-bis.
      if (data.clientRequestId && isPrismaUniqueError(err, "client_request_id")) {
        const existing = await this.findByClientRequestId(data.clientRequestId);
        if (existing) return existing;
      }
      throw err;
    }

    await this.fireLowStockNotifications(lowStockSignals, summary.joined.branchName ?? summary.sale.branchId);
    return summary;
  }

  async createCompletedFromQuote(data: CreateSaleFromQuoteData): Promise<SaleSummary> {
    const saleId = randomUUID();
    const lowStockSignals: LowStockSignal[] = [];

    let summary: SaleSummary;
    try {
      summary = await this.prisma.$transaction(async (tx) => {
        const { folioNumber, folioCode } = await allocateBranchFolio(tx, data.folioId, data.branchId);
        const completedAt = new Date();

        for (const item of data.items) {
          const { lowStockSignal } = await recordInventoryMovement(tx, {
            branchId: data.branchId,
            productId: item.productId,
            movementAt: completedAt,
            movementType: "sale",
            direction: "OUT",
            quantity: inventoryQuantityOf(item.quantity, item.numPartsSnapshot),
            unitPrice: item.unitPrice,
            customerId: data.customerId,
            folioId: data.folioId,
            folioCode,
            folioNumber,
            sourceType: "sale",
            sourceId: saleId,
            allowRowCreation: !isBranchScopedInventory(),
          });
          if (lowStockSignal) lowStockSignals.push(lowStockSignal);
        }

        let dueDate: Date | null = null;

        // Credit sale: debit customer balance (increase debt) + set due date
        if (data.paymentStatus !== "paid" && data.customerId) {
          const cust = await tx.customer.findUnique({
            where: { id: data.customerId },
            select: { creditDays: true },
          });
          dueDate = addDays(completedAt, cust?.creditDays ?? 30);
          await tx.$executeRaw`
          UPDATE customers SET current_balance = current_balance + ${data.total}::numeric
          WHERE id = ${data.customerId}
        `;
        }

        await tx.sale.create({
          data: {
            id: saleId,
            folioId: data.folioId,
            folioNumber,
            folioCode,
            branchId: data.branchId,
            customerId: data.customerId,
            cashierId: data.cashierId,
            paymentMethodId: data.paymentMethodId,
            quoteId: data.quoteId,
            clientRequestId: data.clientRequestId ?? null,
            status: "completed",
            paidAmount: new Prisma.Decimal(data.paidAmount),
            paymentStatus: data.paymentStatus,
            subtotal: new Prisma.Decimal(data.subtotal),
            taxTotal: new Prisma.Decimal(data.taxTotal),
            total: new Prisma.Decimal(data.total),
            notes: data.notes,
            dueDate,
            completedAt,
            items: { create: data.items.map(toSaleItemCreate) },
          },
        });

        // Atomically mark the originating quote as converted (both link directions consistent).
        await tx.quote.update({
          where: { id: data.quoteId },
          data: {
            status: "converted",
            convertedAt: new Date(),
            convertedSaleId: saleId,
          },
        });

        const row = await tx.sale.findUnique({ where: { id: saleId }, include: includeJoins });
        return toSummary(row as unknown as PrismaSaleWithJoins);
      });
    } catch (err) {
      // Same concurrent-replay race as createCompleted above, applied to the
      // quote-conversion path.
      if (data.clientRequestId && isPrismaUniqueError(err, "client_request_id")) {
        const existing = await this.findByClientRequestId(data.clientRequestId);
        if (existing) return existing;
      }
      throw err;
    }

    await this.fireLowStockNotifications(lowStockSignals, summary.joined.branchName ?? summary.sale.branchId);
    return summary;
  }

  async cancel(id: string, reason: string | null): Promise<SaleSummary> {
    const summary = await this.prisma.$transaction(async (tx) => {
      const current = await tx.sale.findUnique({
        where: { id },
        include: { items: true },
      });
      if (!current) throw new Error("Sale not found in cancel transaction");

      // Idempotent if already cancelled
      if (current.status === "cancelled") {
        const row = await tx.sale.findUnique({ where: { id }, include: includeJoins });
        return toSummary(row as unknown as PrismaSaleWithJoins);
      }

      // Block cancellation if sale has active (completed) payments
      const activePayments = await tx.customerPayment.findMany({
        where: { saleId: id, status: "completed" },
        select: { id: true },
      });
      if (activePayments.length > 0) {
        throw new SaleHasActivePaymentsError(activePayments.map((p) => p.id));
      }

      // Restore stock + record sale_cancel movement per line
      const cancelledAt = new Date();
      for (const item of current.items) {
        await recordInventoryMovement(tx, {
          branchId: current.branchId,
          productId: item.productId,
          movementAt: cancelledAt,
          movementType: "sale_cancel",
          direction: "IN",
          quantity: inventoryQuantityOf(Number(item.quantity), item.numPartsSnapshot),
          unitPrice: Number(item.unitPrice),
          customerId: current.customerId,
          folioId: current.folioId,
          folioCode: current.folioCode,
          folioNumber: current.folioNumber,
          sourceType: "sale",
          sourceId: id,
        });
      }

      // Restore customer credit balance for credit sales (paymentStatus !== 'paid' means outstanding debt)
      const outstanding = Number(current.total) - Number(current.paidAmount);
      if (outstanding > 0 && current.customerId) {
        await tx.$executeRaw`
          UPDATE customers SET current_balance = current_balance - ${outstanding}::numeric
          WHERE id = ${current.customerId}
        `;
      }

      await tx.sale.update({
        where: { id },
        data: {
          status: "cancelled",
          cancelledAt,
          cancellationReason: reason,
        },
      });

      const row = await tx.sale.findUnique({ where: { id }, include: includeJoins });
      return toSummary(row as unknown as PrismaSaleWithJoins);
    });

    return summary;
  }

  async replaceItemsAndRecalculate(id: string, data: EditSaleData): Promise<SaleSummary> {
    const lowStockSignals: LowStockSignal[] = [];
    const summary = await this.prisma.$transaction(async (tx) => {
      const current = await tx.sale.findUnique({
        where: { id },
        include: { items: true },
      });
      if (!current) throw new Error("Sale not found in edit transaction");

      // Block edit if sale has active (completed) payments
      const activePayments = await tx.customerPayment.findMany({
        where: { saleId: id, status: "completed" },
        select: { id: true },
      });
      if (activePayments.length > 0) {
        throw new SaleHasActivePaymentsError(activePayments.map((p) => p.id));
      }

      const editedAt = new Date();

      // 1. Restore old items' stock
      for (const item of current.items) {
        await recordInventoryMovement(tx, {
          branchId: current.branchId,
          productId: item.productId,
          movementAt: editedAt,
          movementType: "sale_edit_restore",
          direction: "IN",
          quantity: inventoryQuantityOf(Number(item.quantity), item.numPartsSnapshot),
          unitPrice: Number(item.unitPrice),
          customerId: current.customerId,
          folioId: current.folioId,
          folioCode: current.folioCode,
          folioNumber: current.folioNumber,
          sourceType: "sale",
          sourceId: id,
        });
      }

      // 2. Delete old items
      await tx.saleItem.deleteMany({ where: { saleId: id } });

      // 3. Decrement new items' stock + insert new items
      for (const item of data.items) {
        const { lowStockSignal } = await recordInventoryMovement(tx, {
          branchId: current.branchId,
          productId: item.productId,
          movementAt: editedAt,
          movementType: "sale_edit_apply",
          direction: "OUT",
          quantity: inventoryQuantityOf(item.quantity, item.numPartsSnapshot),
          unitPrice: item.unitPrice,
          customerId: data.customerId ?? current.customerId,
          folioId: current.folioId,
          folioCode: current.folioCode,
          folioNumber: current.folioNumber,
          sourceType: "sale",
          sourceId: id,
          allowRowCreation: !isBranchScopedInventory(),
        });
        if (lowStockSignal) lowStockSignals.push(lowStockSignal);
        await tx.saleItem.create({
          data: {
            saleId: id,
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
          },
        });
      }

      // 4. Adjust credit balance delta for credit sales (active payments already blocked above)
      const oldOutstanding = Number(current.total) - Number(current.paidAmount);
      if (oldOutstanding > 0 && current.customerId) {
        const newTotal = data.total;
        const delta = newTotal - Number(current.total);
        if (delta !== 0) {
          await tx.$executeRaw`
            UPDATE customers SET current_balance = current_balance + ${delta}::numeric
            WHERE id = ${current.customerId}
          `;
        }
      }

      // 5. Update sale header
      await tx.sale.update({
        where: { id },
        data: {
          ...(data.customerId !== undefined ? { customerId: data.customerId } : {}),
          ...(data.paymentMethodId !== undefined ? { paymentMethodId: data.paymentMethodId } : {}),
          ...(data.notes !== undefined ? { notes: data.notes } : {}),
          subtotal: new Prisma.Decimal(data.subtotal),
          taxTotal: new Prisma.Decimal(data.taxTotal),
          total: new Prisma.Decimal(data.total),
          status: "edited",
          editedAt,
        },
      });

      const row = await tx.sale.findUnique({ where: { id }, include: includeJoins });
      return toSummary(row as unknown as PrismaSaleWithJoins);
    });

    await this.fireLowStockNotifications(lowStockSignals, summary.joined.branchName ?? summary.sale.branchId);
    return summary;
  }

  async markReturnedTotal(saleId: string): Promise<void> {
    await this.prisma.sale.update({
      where: { id: saleId },
      data: { status: "returned_total" },
    });
  }
}
