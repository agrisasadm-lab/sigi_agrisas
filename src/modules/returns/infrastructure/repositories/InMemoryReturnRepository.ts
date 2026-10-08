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
import { inventoryQuantityOf } from "@/shared/domain/services/inventoryQuantityOf";

function emptyJoined(): ReturnJoinedFields {
  return {
    saleFolioCode: null,
    saleFolioNumber: null,
    branchName: null,
    customerName: null,
    customerRfc: null,
    creatorName: null,
  };
}

/**
 * In-memory ReturnRepository for unit tests. No real transactions — inventory
 * side effects are tracked in a plain Map for assertion purposes. Tests that
 * need real FK / transaction semantics should use the integration suite.
 */
export class InMemoryReturnRepository implements ReturnRepository {
  private returns: Map<string, Return> = new Map();
  private items: Map<string, ReturnItem[]> = new Map();
  /** inventory[branchId:productId] = quantity */
  readonly inventory: Map<string, number> = new Map();

  private inventoryKey(branchId: string, productId: string): string {
    return `${branchId}:${productId}`;
  }

  private adjustInventory(
    branchId: string,
    delta: number,
    items: Array<{ productId: string; quantity: number; numPartsSnapshot?: number | null }>
  ): void {
    for (const item of items) {
      const key = this.inventoryKey(branchId, item.productId);
      const current = this.inventory.get(key) ?? 0;
      const amount = inventoryQuantityOf(item.quantity, item.numPartsSnapshot ?? null);
      this.inventory.set(key, current + delta * amount);
    }
  }

  async findAll(opts: FindAllReturnsOptions): Promise<{ items: ReturnSummary[]; total: number }> {
    let results = Array.from(this.returns.values());

    if (opts.branchId) results = results.filter((r) => r.branchId === opts.branchId);
    if (opts.customerId) results = results.filter((r) => r.customerId === opts.customerId);
    if (opts.saleId) results = results.filter((r) => r.saleId === opts.saleId);
    if (opts.statuses?.length) results = results.filter((r) => opts.statuses!.includes(r.status));
    if (opts.from) results = results.filter((r) => r.returnedAt >= opts.from!);
    if (opts.to) results = results.filter((r) => r.returnedAt <= opts.to!);
    if (opts.search) {
      const q = opts.search.toLowerCase();
      results = results.filter((r) => r.reason.toLowerCase().includes(q));
    }

    results = [...results].sort((a, b) => b.returnedAt.getTime() - a.returnedAt.getTime());

    const total = results.length;
    const start = (opts.page - 1) * opts.pageSize;
    const page = results.slice(start, start + opts.pageSize);

    return {
      items: page.map((r) => ({ return: r, joined: emptyJoined() })),
      total,
    };
  }

  async findByIdWithItems(id: string): Promise<ReturnWithItems | null> {
    const ret = this.returns.get(id);
    if (!ret) return null;
    return {
      return: ret,
      items: this.items.get(id) ?? [],
      joined: emptyJoined(),
    };
  }

  async findBySaleId(saleId: string): Promise<ReturnWithItems[]> {
    const results = Array.from(this.returns.values())
      .filter((r) => r.saleId === saleId)
      .sort((a, b) => b.returnedAt.getTime() - a.returnedAt.getTime());

    return results.map((r) => ({
      return: r,
      items: this.items.get(r.id) ?? [],
      joined: emptyJoined(),
    }));
  }

  async findPriorReturnItemsBySaleItemIds(saleItemIds: string[]): Promise<PriorReturnItemRow[]> {
    if (saleItemIds.length === 0) return [];
    const set = new Set(saleItemIds);
    const rows: PriorReturnItemRow[] = [];

    for (const [returnId, itemList] of this.items.entries()) {
      const ret = this.returns.get(returnId);
      if (!ret) continue;
      for (const item of itemList) {
        if (set.has(item.saleItemId)) {
          rows.push({
            saleItemId: item.saleItemId,
            quantity: item.quantity,
            returnStatus: ret.status,
          });
        }
      }
    }

    return rows;
  }

  async aggregateReturnedQuantityBySaleItemIds(saleItemIds: string[]): Promise<Record<string, number>> {
    if (saleItemIds.length === 0) return {};
    const set = new Set(saleItemIds);
    const result: Record<string, number> = {};

    for (const [returnId, itemList] of this.items.entries()) {
      const ret = this.returns.get(returnId);
      if (!ret || ret.status !== "completed") continue;
      for (const item of itemList) {
        if (set.has(item.saleItemId)) {
          result[item.saleItemId] = (result[item.saleItemId] ?? 0) + item.quantity;
        }
      }
    }

    return result;
  }

  async createWithItems(data: CreateReturnData): Promise<ReturnWithItems> {
    const returnId = randomUUID();

    // Simulate inventory increment
    this.adjustInventory(
      data.branchId,
      +1,
      data.items.map((i) => ({ productId: i.productId, quantity: i.quantity, numPartsSnapshot: i.numPartsSnapshot }))
    );

    const ret = Return.create({
      id: returnId,
      saleId: data.saleId,
      branchId: data.branchId,
      customerId: data.customerId,
      creatorId: data.creatorId,
      status: "completed" as ReturnStatus,
      reason: data.reason,
      returnedAt: data.returnedAt,
      refundSubtotal: data.refundSubtotal,
      refundTax: data.refundTax,
      refundTotal: data.refundTotal,
      notes: data.notes,
      cancelledAt: null,
      cancelledBy: null,
      cancellationReason: null,
    });

    const items = data.items.map((item) =>
      ReturnItem.create({
        id: randomUUID(),
        returnId,
        saleItemId: item.saleItemId,
        productId: item.productId,
        productPriceId: item.productPriceId,
        dosificationId: item.dosificationId,
        numPartsSnapshot: item.numPartsSnapshot,
        productCodeSnapshot: item.productCodeSnapshot,
        productNameSnapshot: item.productNameSnapshot,
        priceNameSnapshot: item.priceNameSnapshot,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discountPct: item.discountPct,
        discountAmount: item.discountAmount,
        ivaRate: item.ivaRate,
        iepsRate: item.iepsRate,
        lineSubtotal: item.lineSubtotal,
        lineTax: item.lineTax,
        lineTotal: item.lineTotal,
      })
    );

    this.returns.set(returnId, ret);
    this.items.set(returnId, items);

    return { return: ret, items, joined: emptyJoined() };
  }

  async markCancelled(
    id: string,
    cancelledBy: string,
    cancellationReason: string | null,
    itemsToUndo: Array<{ productId: string; quantity: number; numPartsSnapshot: number | null }>
  ): Promise<Return> {
    const existing = this.returns.get(id);
    if (!existing) throw new Error(`Return ${id} not found`);

    // Simulate inventory decrement (allows negative)
    this.adjustInventory(existing.branchId, -1, itemsToUndo);

    const updated = Return.create({
      id: existing.id,
      saleId: existing.saleId,
      branchId: existing.branchId,
      customerId: existing.customerId,
      creatorId: existing.creatorId,
      status: "cancelled" as ReturnStatus,
      reason: existing.reason,
      returnedAt: existing.returnedAt,
      refundSubtotal: existing.refundSubtotal,
      refundTax: existing.refundTax,
      refundTotal: existing.refundTotal,
      notes: existing.notes,
      cancelledAt: new Date(),
      cancelledBy,
      cancellationReason,
      createdAt: existing.createdAt,
    });

    this.returns.set(id, updated);
    return updated;
  }

  /** Test helper — seed a Return+items directly without inventory side effects */
  seed(ret: Return, items: ReturnItem[] = []): void {
    this.returns.set(ret.id, ret);
    this.items.set(ret.id, items);
  }

  /** Test helper — set a known inventory level */
  setInventory(branchId: string, productId: string, quantity: number): void {
    this.inventory.set(this.inventoryKey(branchId, productId), quantity);
  }

  getInventory(branchId: string, productId: string): number {
    return this.inventory.get(this.inventoryKey(branchId, productId)) ?? 0;
  }
}
