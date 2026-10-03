import {
  SaleRepository,
  SaleSummary,
  FindAllSalesOptions,
  CreateSaleData,
  CreateSaleFromQuoteData,
  EditSaleData,
} from "../../application/ports/SaleRepository";
import { Sale } from "../../domain/entities/Sale";
import { SaleItem } from "../../domain/entities/SaleItem";
import { SaleNotFoundError } from "../../domain/errors/SaleNotFoundError";

let idCounter = 0;
let itemIdCounter = 0;
let folioCounter: Record<string, number> = {};

function makeId(): string {
  return `test-sale-${++idCounter}`;
}

function makeItemId(): string {
  return `test-item-${++itemIdCounter}`;
}

function emptyJoined() {
  return { branchName: null, customerName: null, customerRfc: null, customerAddress: null, customerCreditDays: null, cashierName: null, paymentMethodCode: null, paymentMethodName: null, paymentMethodIsCredit: false };
}

/**
 * In-memory SaleRepository for unit tests. No real transactions — side effects
 * (folio increment, inventory decrement) are skipped; use integration tests for those.
 */
export class InMemorySaleRepository implements SaleRepository {
  private store: SaleSummary[] = [];
  private clientRequestIndex: Map<string, SaleSummary> = new Map();

  async findAll(opts: FindAllSalesOptions): Promise<{ items: SaleSummary[]; total: number }> {
    let items = this.store;

    if (opts.branchId) items = items.filter((s) => s.sale.branchId === opts.branchId);
    if (opts.customerId) items = items.filter((s) => s.sale.customerId === opts.customerId);
    if (opts.statuses?.length) items = items.filter((s) => opts.statuses!.includes(s.sale.status));
    if (opts.from) items = items.filter((s) => s.sale.createdAt >= opts.from!);
    if (opts.to) items = items.filter((s) => s.sale.createdAt <= opts.to!);
    if (opts.search) {
      const q = opts.search.toLowerCase();
      items = items.filter(
        (s) =>
          s.sale.folioCode.toLowerCase().includes(q) ||
          String(s.sale.folioNumber).includes(q) ||
          (s.joined.customerName ?? "").toLowerCase().includes(q) ||
          (s.joined.customerRfc ?? "").toLowerCase().includes(q)
      );
    }

    const total = items.length;
    const start = (opts.page - 1) * opts.pageSize;
    return { items: items.slice(start, start + opts.pageSize), total };
  }

  async findByIdWithItems(id: string): Promise<SaleSummary | null> {
    return this.store.find((s) => s.sale.id === id) ?? null;
  }

  async findByClientRequestId(clientRequestId: string): Promise<SaleSummary | null> {
    return this.clientRequestIndex.get(clientRequestId) ?? null;
  }

  async createCompleted(data: CreateSaleData): Promise<SaleSummary> {
    // Contador por (folio, sucursal) — espejo de folio_branch_counters, no del contador global.
    const folioKey = `${data.folioId}|${data.branchId}`;
    const folioNum = (folioCounter[folioKey] = (folioCounter[folioKey] ?? 0) + 1);
    const now = new Date();
    const items = data.items.map((it) =>
      SaleItem.create({
        id: makeItemId(),
        saleId: "pending",
        productId: it.productId,
        productPriceId: it.productPriceId,
        dosificationId: it.dosificationId,
        numPartsSnapshot: it.numPartsSnapshot,
        productCodeSnapshot: it.productCodeSnapshot,
        productNameSnapshot: it.productNameSnapshot,
        priceNameSnapshot: it.priceNameSnapshot,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        discountPct: it.discountPct,
        ivaRate: it.ivaRate,
        iepsRate: it.iepsRate,
        lineSubtotal: it.lineSubtotal,
        lineTax: it.lineTax,
        lineTotal: it.lineTotal,
      })
    );
    const sale = Sale.create({
      id: makeId(),
      folioId: data.folioId,
      folioNumber: folioNum,
      folioCode: `F-${folioNum}`,
      branchId: data.branchId,
      customerId: data.customerId,
      cashierId: data.cashierId,
      paymentMethodId: data.paymentMethodId,
      quoteId: data.quoteId ?? null,
      status: "completed",
      paidAmount: data.paidAmount,
      paymentStatus: data.paymentStatus,
      subtotal: data.subtotal,
      taxTotal: data.taxTotal,
      total: data.total,
      notes: data.notes,
      completedAt: now,
      cancelledAt: null,
      cancellationReason: null,
      editedAt: null,
      createdAt: now,
      updatedAt: now,
      items,
    });
    const summary: SaleSummary = { sale, joined: emptyJoined() };
    this.store.push(summary);
    if (data.clientRequestId) this.clientRequestIndex.set(data.clientRequestId, summary);
    return summary;
  }

  async createCompletedFromQuote(data: CreateSaleFromQuoteData): Promise<SaleSummary> {
    return this.createCompleted(data);
  }

  async cancel(id: string, reason: string | null): Promise<SaleSummary> {
    const idx = this.store.findIndex((s) => s.sale.id === id);
    if (idx === -1) throw new SaleNotFoundError(id);

    const existing = this.store[idx];
    if (existing.sale.status === "cancelled") return existing;

    const now = new Date();
    const sale = Sale.create({
      ...existing.sale,
      status: "cancelled",
      cancelledAt: now,
      cancellationReason: reason,
      updatedAt: now,
    });
    const updated: SaleSummary = { sale, joined: existing.joined };
    this.store[idx] = updated;
    return updated;
  }

  async replaceItemsAndRecalculate(id: string, data: EditSaleData): Promise<SaleSummary> {
    const idx = this.store.findIndex((s) => s.sale.id === id);
    if (idx === -1) throw new SaleNotFoundError(id);

    const existing = this.store[idx];
    const now = new Date();
    const items = data.items.map((it) =>
      SaleItem.create({
        id: makeItemId(),
        saleId: id,
        productId: it.productId,
        productPriceId: it.productPriceId,
        dosificationId: it.dosificationId,
        numPartsSnapshot: it.numPartsSnapshot,
        productCodeSnapshot: it.productCodeSnapshot,
        productNameSnapshot: it.productNameSnapshot,
        priceNameSnapshot: it.priceNameSnapshot,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        discountPct: it.discountPct,
        ivaRate: it.ivaRate,
        iepsRate: it.iepsRate,
        lineSubtotal: it.lineSubtotal,
        lineTax: it.lineTax,
        lineTotal: it.lineTotal,
      })
    );
    const sale = Sale.create({
      ...existing.sale,
      customerId: data.customerId ?? existing.sale.customerId,
      paymentMethodId: data.paymentMethodId ?? existing.sale.paymentMethodId,
      notes: "notes" in data ? data.notes ?? null : existing.sale.notes,
      subtotal: data.subtotal,
      taxTotal: data.taxTotal,
      total: data.total,
      status: "edited",
      editedAt: now,
      updatedAt: now,
      items,
    });
    const updated: SaleSummary = { sale, joined: existing.joined };
    this.store[idx] = updated;
    return updated;
  }

  async markReturnedTotal(saleId: string): Promise<void> {
    const idx = this.store.findIndex((s) => s.sale.id === saleId);
    if (idx === -1) throw new SaleNotFoundError(saleId);
    const existing = this.store[idx];
    const sale = Sale.create({ ...existing.sale, status: "returned_total", updatedAt: new Date() });
    this.store[idx] = { sale, joined: existing.joined };
  }

  reset(): void {
    this.store = [];
    this.clientRequestIndex.clear();
    idCounter = 0;
    itemIdCounter = 0;
    folioCounter = {};
  }
}
