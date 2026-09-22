export interface ProductLookup {
  id: string;
  code: string;
  name: string;
  ivaRate: number | null;
  iepsRate: number | null;
  isTaxable: boolean;
  isActive: boolean;
}

export interface ProductPriceLookup {
  id: string;
  productId: string;
  /** Sucursal dueña del precio. Todo precio pertenece a exactamente una. */
  branchId: string;
  name: string;
  price: number;
  discountPct: number | null;
}

export interface DosificationLookup {
  id: string;
  productId: string;
  name: string;
  numParts: number;
  isActive: boolean;
  /** The product's default price amount, or `null` when no default price exists. */
  basePrice: number | null;
}

export interface CustomerLookup {
  id: string;
  isActive: boolean;
  creditLimit: number | null;
  currentBalance: number;
  email: string | null;
}

export interface BranchLookup {
  id: string;
  isActive: boolean;
}

import { FolioScope } from "@/shared/domain/types/FolioScope";

export interface FolioLookup {
  id: string;
  code: string;
  prefix: string | null;
  scope: FolioScope;
  isActive: boolean;
}

export interface PaymentMethodLookup {
  id: string;
  isActive: boolean;
  isCredit: boolean;
}

export interface PosLookupService {
  getProduct(id: string): Promise<ProductLookup | null>;
  getProductPrice(id: string): Promise<ProductPriceLookup | null>;
  /** Resuelve el default de esa sucursal. Sin fallback a ninguna otra. */
  getDosificationForSale(id: string, branchId: string): Promise<DosificationLookup | null>;
  getCustomer(id: string): Promise<CustomerLookup | null>;
  getBranch(id: string): Promise<BranchLookup | null>;
  getFolio(id: string): Promise<FolioLookup | null>;
  getPaymentMethod(id: string): Promise<PaymentMethodLookup | null>;
  /** Currently configured dosification surcharge percentage (settings-api), default 5 when unconfigured. */
  getDosificationSurchargePct(): Promise<number>;
  /** true si existe fila de branch_inventory para (branchId, productId) — asignación del producto a la sucursal (modo INVENTORY_SCOPE_MODE=branch). */
  isProductAvailableInBranch(productId: string, branchId: string): Promise<boolean>;
}
