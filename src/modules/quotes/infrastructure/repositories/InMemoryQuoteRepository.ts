import { randomUUID } from "crypto";
import {
  QuoteRepository,
  QuoteSummary,
  FindAllQuotesOptions,
  CreateQuoteData,
  ReplaceQuoteItemsData,
  UpdateQuoteMetaData,
  TxHandle,
} from "../../application/ports/QuoteRepository";
import { Quote } from "../../domain/entities/Quote";
import { QuoteItem } from "../../domain/entities/QuoteItem";
import { QuoteNotFoundError } from "../../domain/errors/QuoteNotFoundError";

let folioCounter: Record<string, number> = {};

function makeId(): string {
  return randomUUID();
}

function makeItemId(): string {
  return randomUUID();
}

function emptyJoined() {
  return { branchName: null, customerName: null, customerRfc: null, creatorName: null };
}

function appendNotes(existing: string | null, appendix: string | null): string | null {
  if (!appendix) return existing;
  if (!existing) return appendix;
  return `${existing}\n---\n${appendix}`;
}

/**
 * In-memory QuoteRepository for unit tests. No real transactions — folio counter
 * is a module-level Map keyed by folioId. Idempotency and atomicity are NOT
 * simulated faithfully; integration tests cover those concerns.
 */
export class InMemoryQuoteRepository implements QuoteRepository {
  private store: QuoteSummary[] = [];
  private clientRequestIndex: Map<string, QuoteSummary> = new Map();

  async findAll(opts: FindAllQuotesOptions): Promise<{ items: QuoteSummary[]; total: number }> {
    let items = this.store;
    const now = new Date();

    if (opts.branchId) items = items.filter((s) => s.quote.branchId === opts.branchId);
    if (opts.customerId) items = items.filter((s) => s.quote.customerId === opts.customerId);
    if (opts.statuses?.length) {
      const includesExpired = opts.statuses.includes("expired");
      items = items.filter((s) => {
        if (opts.statuses!.includes(s.quote.status)) return true;
        if (includesExpired && s.quote.isExpiredNow(now)) return true;
        return false;
      });
    }
    if (opts.from) items = items.filter((s) => s.quote.createdAt >= opts.from!);
    if (opts.to) items = items.filter((s) => s.quote.createdAt <= opts.to!);
    if (opts.search) {
      const q = opts.search.toLowerCase();
      items = items.filter(
        (s) =>
          s.quote.folioCode.toLowerCase().includes(q) ||
          String(s.quote.folioNumber).includes(q) ||
          (s.joined.customerName ?? "").toLowerCase().includes(q) ||
          (s.joined.customerRfc ?? "").toLowerCase().includes(q)
      );
    }

    const total = items.length;
    const start = (opts.page - 1) * opts.pageSize;
    return { items: items.slice(start, start + opts.pageSize), total };
  }

  async findByIdWithItems(id: string): Promise<QuoteSummary | null> {
    return this.store.find((s) => s.quote.id === id) ?? null;
  }

  async findByClientRequestId(clientRequestId: string): Promise<QuoteSummary | null> {
    return this.clientRequestIndex.get(clientRequestId) ?? null;
  }

  async createWithItems(data: CreateQuoteData): Promise<QuoteSummary> {
    // Contador por (folio, sucursal) — espejo de folio_branch_counters, no del contador global.
    const folioKey = `${data.folioId}|${data.branchId}`;
    const folioNum = (folioCounter[folioKey] = (folioCounter[folioKey] ?? 0) + 1);
    const now = new Date();
    const quoteId = makeId();
    const items = data.items.map((it) =>
      QuoteItem.create({
        id: makeItemId(),
        quoteId,
        productId: it.productId,
        productPriceId: it.productPriceId,
        productCodeSnapshot: it.productCodeSnapshot,
        productNameSnapshot: it.productNameSnapshot,
        priceNameSnapshot: it.priceNameSnapshot,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        discountPct: it.discountPct,
        discountAmount: it.discountAmount,
        ivaRate: it.ivaRate,
        iepsRate: it.iepsRate,
        lineSubtotal: it.lineSubtotal,
        lineTax: it.lineTax,
        lineTotal: it.lineTotal,
      })
    );
    const quote = Quote.create({
      id: quoteId,
      folioId: data.folioId,
      folioNumber: folioNum,
      folioCode: `COT-${folioNum}`,
      branchId: data.branchId,
      customerId: data.customerId,
      creatorId: data.creatorId,
      status: "draft",
      subtotal: data.subtotal,
      taxTotal: data.taxTotal,
      total: data.total,
      notes: data.notes,
      expiresAt: data.expiresAt,
      authorizedAt: null,
      authorizedBy: null,
      cancelledAt: null,
      cancellationReason: null,
      convertedAt: null,
      convertedSaleId: null,
      createdAt: now,
      updatedAt: now,
      items,
    });
    const summary: QuoteSummary = { quote, joined: emptyJoined() };
    this.store.push(summary);
    if (data.clientRequestId) this.clientRequestIndex.set(data.clientRequestId, summary);
    return summary;
  }

  async replaceItemsAndRecalculate(
    id: string,
    data: ReplaceQuoteItemsData
  ): Promise<QuoteSummary> {
    const idx = this.store.findIndex((s) => s.quote.id === id);
    if (idx === -1) throw new QuoteNotFoundError(id);

    const existing = this.store[idx];
    const now = new Date();
    const items = data.items.map((it) =>
      QuoteItem.create({
        id: makeItemId(),
        quoteId: id,
        productId: it.productId,
        productPriceId: it.productPriceId,
        productCodeSnapshot: it.productCodeSnapshot,
        productNameSnapshot: it.productNameSnapshot,
        priceNameSnapshot: it.priceNameSnapshot,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        discountPct: it.discountPct,
        discountAmount: it.discountAmount,
        ivaRate: it.ivaRate,
        iepsRate: it.iepsRate,
        lineSubtotal: it.lineSubtotal,
        lineTax: it.lineTax,
        lineTotal: it.lineTotal,
      })
    );
    const quote = Quote.create({
      ...existing.quote,
      notes: data.notes !== undefined ? data.notes ?? null : existing.quote.notes,
      expiresAt: data.expiresAt !== undefined ? data.expiresAt ?? null : existing.quote.expiresAt,
      subtotal: data.subtotal,
      taxTotal: data.taxTotal,
      total: data.total,
      updatedAt: now,
      items,
    });
    const updated: QuoteSummary = { quote, joined: existing.joined };
    this.store[idx] = updated;
    return updated;
  }

  async updateMeta(id: string, data: UpdateQuoteMetaData): Promise<QuoteSummary> {
    const idx = this.store.findIndex((s) => s.quote.id === id);
    if (idx === -1) throw new QuoteNotFoundError(id);

    const existing = this.store[idx];
    const now = new Date();
    const quote = Quote.create({
      ...existing.quote,
      notes: data.notes !== undefined ? data.notes ?? null : existing.quote.notes,
      expiresAt: data.expiresAt !== undefined ? data.expiresAt ?? null : existing.quote.expiresAt,
      updatedAt: now,
    });
    const updated: QuoteSummary = { quote, joined: existing.joined };
    this.store[idx] = updated;
    return updated;
  }

  async markAuthorized(
    id: string,
    userId: string,
    notesAppendix: string | null
  ): Promise<QuoteSummary> {
    const idx = this.store.findIndex((s) => s.quote.id === id);
    if (idx === -1) throw new QuoteNotFoundError(id);

    const existing = this.store[idx];
    const now = new Date();
    const quote = Quote.create({
      ...existing.quote,
      status: "authorized",
      authorizedAt: now,
      authorizedBy: userId,
      notes: appendNotes(existing.quote.notes, notesAppendix),
      updatedAt: now,
    });
    const updated: QuoteSummary = { quote, joined: existing.joined };
    this.store[idx] = updated;
    return updated;
  }

  async markCancelled(id: string, reason: string | null): Promise<QuoteSummary> {
    const idx = this.store.findIndex((s) => s.quote.id === id);
    if (idx === -1) throw new QuoteNotFoundError(id);

    const existing = this.store[idx];
    const now = new Date();
    const quote = Quote.create({
      ...existing.quote,
      status: "cancelled",
      cancelledAt: now,
      cancellationReason: reason,
      updatedAt: now,
    });
    const updated: QuoteSummary = { quote, joined: existing.joined };
    this.store[idx] = updated;
    return updated;
  }

  async markConverted(id: string, saleId: string, _tx?: TxHandle): Promise<QuoteSummary> {
    const idx = this.store.findIndex((s) => s.quote.id === id);
    if (idx === -1) throw new QuoteNotFoundError(id);

    const existing = this.store[idx];
    const now = new Date();
    const quote = Quote.create({
      ...existing.quote,
      status: "converted",
      convertedAt: now,
      convertedSaleId: saleId,
      updatedAt: now,
    });
    const updated: QuoteSummary = { quote, joined: existing.joined };
    this.store[idx] = updated;
    return updated;
  }

  reset(): void {
    this.store = [];
    this.clientRequestIndex.clear();
    folioCounter = {};
  }
}
