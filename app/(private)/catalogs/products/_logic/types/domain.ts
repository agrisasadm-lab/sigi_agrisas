export interface Product {
  id: string;
  code: string;
  name: string;
  unit: string;
  unitDescription: string | null;
  satProductCode: string | null;
  departmentId: string;
  departmentName: string;
  taxRateId: string | null;
  taxRateCode: string | null;
  providerId: string | null;
  providerName: string | null;
  ivaRate: number | null;
  iepsRate: number | null;
  imageUrl: string | null;
  manufactureDate: string | null;
  acquisitionPrice: number | null;
  isTaxable: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** Respuesta de POST /products — incluye el resultado de la auto-asignación a la sucursal propia del creador (null si no aplica: admin, sin sucursal, o modo general). */
export interface CreatedProduct extends Product {
  autoAssignedBranchId: string | null;
}

export interface ProductPrice {
  id: string;
  productId: string;
  branchId: string | null;
  isOverride: boolean;
  name: string;
  price: number;
  minQuantity: number;
  discountPct: number | null;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductDosification {
  id: string;
  productId: string;
  name: string;
  numParts: number;
  isActive: boolean;
  computedUnitPrice: number | null;
  requiresDefaultPrice: boolean;
  createdAt: Date;
  updatedAt: Date;
}
