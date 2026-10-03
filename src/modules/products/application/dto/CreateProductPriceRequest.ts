export interface CreateProductPriceRequest {
  /** Sucursal dueña del precio. Obligatorio: no existe precio compartido entre sucursales. */
  branchId: string;
  name: string;
  price: number;
  minQuantity?: number;
  discountPct?: number | null;
  isDefault?: boolean;
}
