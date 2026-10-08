import type { AgrisasRefreshRow, TiendaInventoryRow, TlaxiacoRawRow } from "../../data/inventarioTiendasTypes";

export const FALLBACK_DEPARTMENT_NAME = "Sin Departamento";

export interface PrismaLike {
  branch: {
    findUnique: (args: { where: { code: string }; select: { id: true } }) => Promise<{ id: string } | null>;
    upsert: (args: {
      where: { code: string };
      create: Record<string, unknown>;
      update: Record<string, unknown>;
    }) => Promise<{ id: string }>;
  };
  department: {
    upsert: (args: {
      where: { code: string };
      create: Record<string, unknown>;
      update: Record<string, unknown>;
    }) => Promise<{ id: string }>;
  };
  product: {
    findUnique: (args: {
      where: { code: string };
      select: { id: true; name: true };
    }) => Promise<{ id: string; name: string } | null>;
    findMany: (args: {
      where?: { isActive: true };
      select: { id: true; code: true; name: true };
    }) => Promise<Array<{ id: string; code: string; name: string }>>;
    upsert: (args: {
      where: { code: string };
      create: Record<string, unknown>;
      update: Record<string, unknown>;
    }) => Promise<{ id: string }>;
  };
  productPrice: {
    findFirst: (args: {
      where: { productId: string; branchId: string; name: string };
      select: { id: true; price: true };
    }) => Promise<{ id: string; price: number } | null>;
    updateMany: (args: {
      where: { productId: string; branchId: string; isDefault: boolean };
      data: { isDefault: boolean };
    }) => Promise<{ count: number }>;
    /** `branchId` siempre real — cada precio pertenece a exactamente una sucursal, Matriz incluida. */
    upsert: (args: {
      where: { productId_branchId_name: { productId: string; branchId: string; name: string } };
      create: Record<string, unknown>;
      update: Record<string, unknown>;
    }) => Promise<{ id: string }>;
  };
  branchInventory: {
    upsert: (args: {
      where: { branchId_productId: { branchId: string; productId: string } };
      create: Record<string, unknown>;
      update: Record<string, unknown>;
    }) => Promise<{ id: string }>;
    findMany: (args: { select: { productId: true } }) => Promise<Array<{ productId: string }>>;
  };
}

export interface TiendasSeedData {
  agrisas: AgrisasRefreshRow[];
  tiendas: TiendaInventoryRow[];
  tlaxiaco: TlaxiacoRawRow[];
}

export interface TiendasSeedError {
  context: string;
  message: string;
}

export interface OrphanProductsSummary {
  count: number;
  sampleCodes: string[];
}

export interface TiendasSeedCounters {
  branchesCreated: number;
  productsCreated: number;
  nameMismatch: number;
  branchFallbackDepartment: number;
  matrizRefreshed: number;
  tlaxiacoMatched: number;
  tlaxiacoCreated: number;
  tlaxiacoFallbackDepartment: number;
  tlaxiacoAliased: number;
  priceOverridesByBranch: Record<string, number>;
  inventoryUpserted: number;
  emptyPriceRows: number;
  orphanProducts: OrphanProductsSummary;
  errors: TiendasSeedError[];
}

export function emptyCounters(): TiendasSeedCounters {
  return {
    branchesCreated: 0,
    productsCreated: 0,
    nameMismatch: 0,
    branchFallbackDepartment: 0,
    matrizRefreshed: 0,
    tlaxiacoMatched: 0,
    tlaxiacoCreated: 0,
    tlaxiacoFallbackDepartment: 0,
    tlaxiacoAliased: 0,
    priceOverridesByBranch: {},
    inventoryUpserted: 0,
    emptyPriceRows: 0,
    orphanProducts: { count: 0, sampleCodes: [] },
    errors: [],
  };
}

/** Forma normalizada de fila que consume el motor de siembra, independiente de la hoja de origen. */
export interface NormalizedSeedRow {
  /** Identificador para el reporte de errores, ej. "AGRISAS:ACTIVA1" | "TLAXIACO:1042". */
  sourceRef: string;
  /** `code` conocido cuando `productMatch: "code"`; `null` cuando `productMatch: "name"` (se resuelve en runtime). */
  code: string | null;
  name: string;
  unit: string;
  satCode: string | null;
  departmentName: string | null;
  /** Sólo Matriz trae IVA/IEPS crudos de la fila. */
  ivaRaw: number | null;
  iepsRaw: number | null;
  /** Sólo Matriz trae existencia real de la fila; el resto usa `quantitySource: "zero"`. */
  quantity: number | null;
  prices: Array<{ tierName: string; value: number; isDefault?: boolean }>;
}

export interface BranchSeedPlan {
  branchCode: string;
  rows: NormalizedSeedRow[];
  /** "code": emparejamiento exacto por `Product.code`. "name": emparejamiento por nombre normalizado (Tlaxiaco). */
  productMatch: "code" | "name";
  /** "refresh": el `update` de producto pisa todos los campos (Matriz). "preserve": no sobrescribe `name` de un producto ya existente. */
  productSync: "refresh" | "preserve";
  /** "base-tiers": escribe múltiples tiers con `branchId` real de Matriz. "branch-override": un solo precio condicional a divergencia contra el de Matriz. */
  priceMode: "base-tiers" | "branch-override";
  /** "row": usa `row.quantity`. "zero": siempre `0` (hojas sin columna de existencia). */
  quantitySource: "row" | "zero";
  createBranchIfMissing: boolean;
}

/** Contexto compartido de una corrida: caches de resolución + contadores acumulados. */
export interface SeedContext {
  counters: TiendasSeedCounters;
  matrizFound: boolean;
  resolveDepartmentId(name: string): Promise<string>;
  resolveBranchId(branchCode: string): Promise<string>;
  /** Índice `nombre normalizado → {id, code}` de TODO el catálogo, construido una sola vez (lazy) para Tlaxiaco. */
  getNameIndex(): Promise<Map<string, { id: string; code: string }>>;
}
