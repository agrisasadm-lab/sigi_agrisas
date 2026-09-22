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
  /** null = precio base (aplica a toda sucursal); no-null = override exclusivo de esa sucursal. */
  branchId: string | null;
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
  /** `branchId` resuelve el default de esa sucursal primero, cayendo al default global si no existe. */
  getDosificationForSale(id: string, branchId: string): Promise<DosificationLookup | null>;
  getCustomer(id: string): Promise<CustomerLookup | null>;
  getBranch(id: string): Promise<BranchLookup | null>;
  getFolio(id: string): Promise<FolioLookup | null>;
  getPaymentMethod(id: string): Promise<PaymentMethodLookup | null>;
  /** Currently configured dosification surcharge percentage (settings-api), default 5 when unconfigured. */
  getDosificationSurchargePct(): Promise<number>;
  /** true si existe fila de branch_inventory para (branchId, productId) — asignación del producto a la sucursal (modo INVENTORY_SCOPE_MODE=branch). */
  isProductAvailableInBranch(productId: string, branchId: string): Promise<boolean>;
  /** true si el producto tiene al menos un ProductPrice con branchId = esa sucursal — gate para rechazar la selección del precio base cuando la sucursal ya tiene su propio precio. */
  hasBranchPriceOverrides(productId: string, branchId: string): Promise<boolean>;
}
