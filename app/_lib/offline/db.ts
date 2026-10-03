import { openDB, DBSchema, IDBPDatabase } from "idb";
import type {
  ProductDto,
  ProductPriceDto,
  DosificationOptionDto,
  CustomerDto,
} from "../../(private)/pos/_logic/types/api";

/** Local, offline-cache-only shape — needs `isCredit` for the credit-flow business rule, unlike the POS module's narrower option type. */
export interface CachedPaymentMethod {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  isCredit: boolean;
}

/** Local, offline-cache-only shape — always POS-scope folios. */
export interface CachedFolio {
  id: string;
  code: string;
  name: string;
  prefix: string | null;
  currentNumber: number;
  isActive: boolean;
  branchCurrentNumber?: number | null;
  nextFolioCode?: string | null;
}

const DB_NAME = "agrisas-offline";
const DB_VERSION = 1;

export interface OfflineMeta {
  key: "state";
  ownerBranchId: string | null;
  catalogSyncedAt: number | null;
}

export interface BranchInventoryRecord {
  productId: string;
  ownerBranchId: string;
  quantity: number;
  reorderPoint: number | null;
}

export type OutboxStatus = "pending" | "syncing" | "synced" | "failed";

export interface OutboxErrorInfo {
  code: string;
  message: string;
  httpStatus?: number;
}

export interface OutboxRecordBase<TPayload> {
  clientRequestId: string;
  ownerBranchId: string;
  createdAt: number;
  status: OutboxStatus;
  attempts: number;
  nextRetryAt: number | null;
  lastError: OutboxErrorInfo | null;
  payload: TPayload;
  localTotal: number;
  provisionalCode: string;
  serverId: string | null;
  serverFolioCode: string | null;
}

export type OutboxSaleRecord = OutboxRecordBase<Record<string, unknown>>;
export type OutboxQuoteRecord = OutboxRecordBase<Record<string, unknown>>;

interface AgrisasOfflineSchema extends DBSchema {
  meta: {
    key: string;
    value: OfflineMeta;
  };
  catalogProducts: {
    key: string;
    value: ProductDto & { ownerBranchId: string };
    indexes: { ownerBranchId: string; code: string };
  };
  catalogPrices: {
    key: string;
    value: ProductPriceDto & { ownerBranchId: string };
    indexes: { productId: string; ownerBranchId: string };
  };
  catalogDosifications: {
    key: string;
    value: DosificationOptionDto & { ownerBranchId: string };
    indexes: { productId: string; ownerBranchId: string };
  };
  catalogCustomers: {
    key: string;
    value: CustomerDto & { ownerBranchId: string };
    indexes: { ownerBranchId: string };
  };
  catalogPaymentMethods: {
    key: string;
    value: CachedPaymentMethod & { ownerBranchId: string };
    indexes: { ownerBranchId: string };
  };
  catalogFolios: {
    key: string;
    value: CachedFolio & { ownerBranchId: string };
    indexes: { ownerBranchId: string };
  };
  branchInventory: {
    key: string;
    value: BranchInventoryRecord;
    indexes: { ownerBranchId: string };
  };
  outboxSales: {
    key: string;
    value: OutboxSaleRecord;
    indexes: { ownerBranchId: string; status: string };
  };
  outboxQuotes: {
    key: string;
    value: OutboxQuoteRecord;
    indexes: { ownerBranchId: string; status: string };
  };
}

let dbPromise: Promise<IDBPDatabase<AgrisasOfflineSchema>> | null = null;

export function getOfflineDb(): Promise<IDBPDatabase<AgrisasOfflineSchema>> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB not available in this environment"));
  }
  if (!dbPromise) {
    dbPromise = openDB<AgrisasOfflineSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("meta")) {
          db.createObjectStore("meta", { keyPath: "key" });
        }
        if (!db.objectStoreNames.contains("catalogProducts")) {
          const store = db.createObjectStore("catalogProducts", { keyPath: "id" });
          store.createIndex("ownerBranchId", "ownerBranchId");
          store.createIndex("code", "code");
        }
        if (!db.objectStoreNames.contains("catalogPrices")) {
          const store = db.createObjectStore("catalogPrices", { keyPath: "id" });
          store.createIndex("productId", "productId");
          store.createIndex("ownerBranchId", "ownerBranchId");
        }
        if (!db.objectStoreNames.contains("catalogDosifications")) {
          const store = db.createObjectStore("catalogDosifications", { keyPath: "id" });
          store.createIndex("productId", "productId");
          store.createIndex("ownerBranchId", "ownerBranchId");
        }
        if (!db.objectStoreNames.contains("catalogCustomers")) {
          const store = db.createObjectStore("catalogCustomers", { keyPath: "id" });
          store.createIndex("ownerBranchId", "ownerBranchId");
        }
        if (!db.objectStoreNames.contains("catalogPaymentMethods")) {
          const store = db.createObjectStore("catalogPaymentMethods", { keyPath: "id" });
          store.createIndex("ownerBranchId", "ownerBranchId");
        }
        if (!db.objectStoreNames.contains("catalogFolios")) {
          const store = db.createObjectStore("catalogFolios", { keyPath: "id" });
          store.createIndex("ownerBranchId", "ownerBranchId");
        }
        if (!db.objectStoreNames.contains("branchInventory")) {
          const store = db.createObjectStore("branchInventory", { keyPath: "productId" });
          store.createIndex("ownerBranchId", "ownerBranchId");
        }
        if (!db.objectStoreNames.contains("outboxSales")) {
          const store = db.createObjectStore("outboxSales", { keyPath: "clientRequestId" });
          store.createIndex("ownerBranchId", "ownerBranchId");
          store.createIndex("status", "status");
        }
        if (!db.objectStoreNames.contains("outboxQuotes")) {
          const store = db.createObjectStore("outboxQuotes", { keyPath: "clientRequestId" });
          store.createIndex("ownerBranchId", "ownerBranchId");
          store.createIndex("status", "status");
        }
      },
    });
  }
  return dbPromise;
}

/**
 * Test-only: closes the current connection (if open) and forces re-opening
 * the database on the next `getOfflineDb()` call. Closing first is required
 * so a subsequent `indexedDB.deleteDatabase(...)` in test setup doesn't hang
 * waiting on a `blocked` connection that would otherwise never close.
 */
export async function resetOfflineDbForTests(): Promise<void> {
  if (dbPromise) {
    const db = await dbPromise.catch(() => null);
    db?.close();
  }
  dbPromise = null;
}

export const CATALOG_STORES = [
  "catalogProducts",
  "catalogPrices",
  "catalogDosifications",
  "catalogCustomers",
  "catalogPaymentMethods",
  "catalogFolios",
  "branchInventory",
] as const;

export const OUTBOX_STORES = ["outboxSales", "outboxQuotes"] as const;

export async function getMeta(): Promise<OfflineMeta> {
  const db = await getOfflineDb();
  const existing = await db.get("meta", "state");
  return existing ?? { key: "state", ownerBranchId: null, catalogSyncedAt: null };
}

export async function setMeta(patch: Partial<Omit<OfflineMeta, "key">>): Promise<OfflineMeta> {
  const db = await getOfflineDb();
  const current = await getMeta();
  const next: OfflineMeta = { ...current, ...patch, key: "state" };
  await db.put("meta", next);
  return next;
}

/** Purges every catalog/inventory/outbox record scoped to `ownerBranchId`. */
export async function purgeBranchData(ownerBranchId: string): Promise<void> {
  const db = await getOfflineDb();
  for (const storeName of [...CATALOG_STORES, ...OUTBOX_STORES]) {
    const tx = db.transaction(storeName, "readwrite");
    const index = tx.store.index("ownerBranchId");
    let cursor = await index.openCursor(IDBKeyRange.only(ownerBranchId));
    while (cursor) {
      await cursor.delete();
      cursor = await cursor.continue();
    }
    await tx.done;
  }
}

export type { AgrisasOfflineSchema };
