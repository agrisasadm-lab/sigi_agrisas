import { authFetch, NetworkError } from "../authFetch";
import { getOfflineDb, setMeta, getMeta, CachedPaymentMethod, CachedFolio } from "./db";
import { isOnline } from "./connectivity";
import type { ProductDto, ProductPriceDto, DosificationOptionDto, CustomerDto } from "../../(private)/pos/_logic/types/api";

const PAGE_SIZE = 100;
const PRICE_FETCH_CONCURRENCY = 8;
/** Minimum age (ms) an automatic refresh trigger requires before running again; manual refresh ignores this. */
export const AUTO_REFRESH_MIN_INTERVAL_MS = 5 * 60_000;

/** Runs `fn` over `items` with at most `limit` calls in flight at once. */
async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

async function paginate<T>(
  fetchPage: (page: number) => Promise<{ items: T[]; total: number }>
): Promise<T[]> {
  const all: T[] = [];
  let page = 1;
  // Guard against an unbounded loop if `total` is misreported.
  for (let i = 0; i < 1000; i++) {
    const { items, total } = await fetchPage(page);
    all.push(...items);
    if (all.length >= total || items.length === 0) break;
    page += 1;
  }
  return all;
}

async function pullProductsAndStock(branchId: string): Promise<ProductDto[]> {
  return paginate<ProductDto>(async (page) => {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(PAGE_SIZE),
      includeInactive: "false",
      branchId,
    });
    const res = await authFetch(`/api/v1/admin/products?${params.toString()}`);
    if (!res.ok) throw new NetworkError();
    const body = (await res.json()) as { items: ProductDto[]; total: number };
    return body;
  });
}

async function pullPricesFor(productId: string, branchId: string): Promise<ProductPriceDto[]> {
  const res = await authFetch(`/api/v1/admin/products/${productId}/prices?branchId=${branchId}`);
  if (!res.ok) throw new NetworkError();
  const json = (await res.json()) as { items: ProductPriceDto[] } | ProductPriceDto[];
  return Array.isArray(json) ? json : json.items ?? [];
}

async function pullDosificationsFor(productId: string): Promise<DosificationOptionDto[]> {
  const res = await authFetch(`/api/v1/admin/products/${productId}/dosifications`);
  if (!res.ok) throw new NetworkError();
  const json = (await res.json()) as { items: DosificationOptionDto[] } | DosificationOptionDto[];
  return Array.isArray(json) ? json : json.items ?? [];
}

async function pullPaymentMethods(): Promise<CachedPaymentMethod[]> {
  const res = await authFetch("/api/v1/admin/payment-methods?pageSize=100&includeInactive=false");
  if (!res.ok) throw new NetworkError();
  const body = (await res.json()) as { items: CachedPaymentMethod[] };
  return body.items;
}

async function pullFolios(): Promise<CachedFolio[]> {
  const res = await authFetch("/api/v1/admin/folios?pageSize=100&includeInactive=false&scope=POS");
  if (!res.ok) throw new NetworkError();
  const body = (await res.json()) as { items: CachedFolio[] };
  return body.items;
}

async function pullCustomers(): Promise<CustomerDto[]> {
  return paginate<CustomerDto>(async (page) => {
    const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE), includeInactive: "false" });
    const res = await authFetch(`/api/v1/admin/customers?${params.toString()}`);
    if (!res.ok) throw new NetworkError();
    const body = (await res.json()) as { items: CustomerDto[]; total: number };
    return body;
  });
}

/**
 * Full catalog/stock/customer pull for `ownerBranchId`. Meant to run while
 * online — throws `NetworkError` (propagated from `authFetch`) if connectivity
 * drops mid-pull, leaving the previous cache contents untouched for that store.
 */
export async function refreshCatalogCache(ownerBranchId: string): Promise<void> {
  if (!isOnline()) throw new NetworkError();

  const [products, paymentMethods, folios, customers] = await Promise.all([
    pullProductsAndStock(ownerBranchId),
    pullPaymentMethods(),
    pullFolios(),
    pullCustomers(),
  ]);

  const pricesByProduct = await mapWithConcurrency(products, PRICE_FETCH_CONCURRENCY, (p) => pullPricesFor(p.id, ownerBranchId));
  const dosificationsByProduct = await mapWithConcurrency(products, PRICE_FETCH_CONCURRENCY, (p) => pullDosificationsFor(p.id));

  const db = await getOfflineDb();

  const productsTx = db.transaction(["catalogProducts", "branchInventory"], "readwrite");
  for (const p of products) {
    await productsTx.objectStore("catalogProducts").put({ ...p, ownerBranchId });
    await productsTx.objectStore("branchInventory").put({
      productId: p.id,
      ownerBranchId,
      quantity: p.stock ?? 0,
      reorderPoint: null,
    });
  }
  await productsTx.done;

  const pricesTx = db.transaction("catalogPrices", "readwrite");
  for (const prices of pricesByProduct) {
    for (const price of prices) await pricesTx.store.put({ ...price, ownerBranchId });
  }
  await pricesTx.done;

  const dosTx = db.transaction("catalogDosifications", "readwrite");
  for (const doses of dosificationsByProduct) {
    for (const d of doses) await dosTx.store.put({ ...d, ownerBranchId });
  }
  await dosTx.done;

  const pmTx = db.transaction("catalogPaymentMethods", "readwrite");
  for (const pm of paymentMethods) await pmTx.store.put({ ...pm, ownerBranchId });
  await pmTx.done;

  const folioTx = db.transaction("catalogFolios", "readwrite");
  for (const f of folios) await folioTx.store.put({ ...f, ownerBranchId });
  await folioTx.done;

  const custTx = db.transaction("catalogCustomers", "readwrite");
  for (const c of customers) await custTx.store.put({ ...c, ownerBranchId });
  await custTx.done;

  await setMeta({ catalogSyncedAt: Date.now() });
}

export async function getCatalogStalenessMs(): Promise<number | null> {
  const meta = await getMeta();
  if (meta.catalogSyncedAt === null) return null;
  return Date.now() - meta.catalogSyncedAt;
}

export async function searchProductsFromCache(
  ownerBranchId: string,
  search: string | undefined
): Promise<ProductDto[]> {
  const db = await getOfflineDb();
  const all = await db.getAllFromIndex("catalogProducts", "ownerBranchId", ownerBranchId);
  const inventory = await db.getAllFromIndex("branchInventory", "ownerBranchId", ownerBranchId);
  const stockByProduct = new Map(inventory.map((i) => [i.productId, i.quantity]));

  const q = search?.trim().toLowerCase();
  const filtered = q
    ? all.filter((p) => p.code.toLowerCase().includes(q) || p.name.toLowerCase().includes(q))
    : all;

  return filtered.map((p) => ({ ...p, stock: stockByProduct.get(p.id) ?? p.stock ?? null }));
}

export async function getProductPricesFromCache(productId: string): Promise<ProductPriceDto[]> {
  const db = await getOfflineDb();
  return db.getAllFromIndex("catalogPrices", "productId", productId);
}

export async function getProductDosificationsFromCache(productId: string): Promise<DosificationOptionDto[]> {
  const db = await getOfflineDb();
  return db.getAllFromIndex("catalogDosifications", "productId", productId);
}

export async function getPaymentMethodsFromCache(ownerBranchId: string): Promise<CachedPaymentMethod[]> {
  const db = await getOfflineDb();
  return db.getAllFromIndex("catalogPaymentMethods", "ownerBranchId", ownerBranchId);
}

export async function getFoliosFromCache(ownerBranchId: string): Promise<CachedFolio[]> {
  const db = await getOfflineDb();
  return db.getAllFromIndex("catalogFolios", "ownerBranchId", ownerBranchId);
}

export async function searchCustomersFromCache(
  ownerBranchId: string,
  search: string | undefined
): Promise<CustomerDto[]> {
  const db = await getOfflineDb();
  const all = await db.getAllFromIndex("catalogCustomers", "ownerBranchId", ownerBranchId);
  const q = search?.trim().toLowerCase();
  if (!q) return all;
  return all.filter(
    (c) => c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q) || c.rfc.toLowerCase().includes(q)
  );
}

export async function getInventoryFromCache(ownerBranchId: string) {
  const db = await getOfflineDb();
  return db.getAllFromIndex("branchInventory", "ownerBranchId", ownerBranchId);
}

/**
 * Offline, read-only view of `InventoryItem[]` synthesized by joining the
 * cached product catalog with cached stock. Degraded fidelity vs. the live
 * `/inventory` endpoint: `reservedQuantity` is always 0, `reorderPoint`
 * defaults to 0, and lot/expiry fields are always null — none of those are
 * captured by the POS catalog pull this cache is built from. `id` is the
 * `productId` (no real `branch_inventory` row id available offline); this is
 * safe only because no offline write path ever uses this id.
 */
export async function getInventoryItemsFromCache(
  ownerBranchId: string,
  search: string | undefined
): Promise<
  Array<{
    id: string;
    branchId: string;
    productId: string;
    productCode: string;
    productName: string;
    quantity: number;
    reservedQuantity: number;
    reorderPoint: number;
    updatedAt: Date;
    nearestExpirationDate: Date | null;
    nearestExpirationLotNumber: string | null;
    expiryStatus: "ok" | "warning" | "critical" | null;
  }>
> {
  const db = await getOfflineDb();
  const [products, inventory, meta] = await Promise.all([
    db.getAllFromIndex("catalogProducts", "ownerBranchId", ownerBranchId),
    db.getAllFromIndex("branchInventory", "ownerBranchId", ownerBranchId),
    getMeta(),
  ]);
  const stockByProduct = new Map(inventory.map((i) => [i.productId, i]));
  const q = search?.trim().toLowerCase();
  const cachedAt = meta.catalogSyncedAt ? new Date(meta.catalogSyncedAt) : new Date();

  return products
    .filter((p) => !q || p.code.toLowerCase().includes(q) || p.name.toLowerCase().includes(q))
    .map((p) => {
      const inv = stockByProduct.get(p.id);
      return {
        id: p.id,
        branchId: ownerBranchId,
        productId: p.id,
        productCode: p.code,
        productName: p.name,
        quantity: inv?.quantity ?? p.stock ?? 0,
        reservedQuantity: 0,
        reorderPoint: inv?.reorderPoint ?? 0,
        updatedAt: cachedAt,
        nearestExpirationDate: null,
        nearestExpirationLotNumber: null,
        expiryStatus: null,
      };
    });
}
