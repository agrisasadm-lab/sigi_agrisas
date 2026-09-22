export interface ProductPriceDto {
  id: string;
  productId: string;
  /** Sucursal dueña del precio. Todo precio pertenece a exactamente una. */
  branchId: string;
  name: string;
  price: number;
  minQuantity: number;
  discountPct: number;
  isDefault: boolean;
}

export interface ProductDto {
  id: string;
  code: string;
  name: string;
  ivaRate: number | null;
  iepsRate: number | null;
  satProductCode?: string | null;
  isActive: boolean;
  departmentId: string;
  departmentName?: string;
  createdAt: Date;
  updatedAt: Date;
  stock: number | null;
}

export interface CustomerDto {
  id: string;
  code: string;
  name: string;
  rfc: string;
  legalName?: string | null;
  taxRegime?: string | null;
  cfdiUse?: string | null;
  taxZipCode?: string | null;
  email?: string | null;
  phone?: string | null;
  creditLimit?: number | null;
  currentBalance: number;
  isActive: boolean;
}

export interface BranchOption {
  id: string;
  code: string;
  name: string;
  isHeadquarters: boolean;
}

export interface FolioOption {
  id: string;
  code: string;
  name: string;
  prefix?: string | null;
  currentNumber: number;
  isActive: boolean;
}

export interface PaymentMethodOption {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
}

export interface SaleItemInputBody {
  productId: string;
  productPriceId?: string;
  dosificationId?: string;
  quantity: number;
  discountPctOverride?: number;
}

export interface DosificationOptionDto {
  id: string;
  productId: string;
  name: string;
  numParts: number;
  isActive: boolean;
  computedUnitPrice: number | null;
  requiresDefaultPrice: boolean;
}

export interface CreateSaleBody {
  branchId: string;
  customerId?: string;
  folioId: string;
  paymentMethodId: string;
  items: SaleItemInputBody[];
  notes?: string;
  /** Idempotency key set by `offline-sync` when this sale was queued offline; omitted for online submissions. */
  clientRequestId?: string;
}

export interface SaleItemDto {
  id: string;
  productId: string;
  productCodeSnapshot: string;
  productNameSnapshot: string;
  productPriceId: string;
  priceNameSnapshot: string;
  quantity: number;
  unitPrice: number;
  discountPct: number;
  ivaRate: number;
  iepsRate: number;
  lineSubtotal: number;
  lineIva: number;
  lineIeps: number;
  lineTotal: number;
}

export interface SaleDetailDto {
  id: string;
  branchId: string;
  branchName?: string;
  customerId?: string | null;
  customerName?: string | null;
  customerRfc?: string | null;
  cashierId: string;
  cashierName?: string;
  folioId: string;
  folioNumber: number;
  folioPrefix?: string | null;
  paymentMethodId: string;
  paymentMethodName?: string;
  status: "completed" | "cancelled" | "edited";
  subtotal: number;
  taxTotal: number;
  total: number;
  notes?: string | null;
  cancelledAt?: string | null;
  cancellationReason?: string | null;
  editedAt?: string | null;
  items: SaleItemDto[];
  createdAt: string;
  updatedAt: string;
  creditLimitExceeded?: boolean;
}
