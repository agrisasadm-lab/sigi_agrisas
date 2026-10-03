import { ProductPrice } from "../../domain/entities/ProductPrice";

export interface CreateProductPriceData {
  productId: string;
  branchId: string;
  name: string;
  price: number;
  minQuantity: number;
  discountPct?: number | null;
  isDefault: boolean;
}

export interface UpdateProductPriceData {
  name?: string;
  price?: number;
  minQuantity?: number;
  discountPct?: number | null;
  isDefault?: boolean;
}

export interface ProductPriceRepository {
  /** Precios de un producto en una sucursal. No hay herencia: sólo las filas de esa sucursal. */
  findByProductAndBranch(productId: string, branchId: string): Promise<ProductPrice[]>;
  findById(id: string): Promise<ProductPrice | null>;
  /** Default del producto en esa sucursal. Sin fallback a ninguna otra. */
  findDefaultByProductId(productId: string, branchId: string): Promise<ProductPrice | null>;
  create(data: CreateProductPriceData): Promise<ProductPrice>;
  update(id: string, data: UpdateProductPriceData): Promise<ProductPrice>;
  unsetDefaultForProduct(productId: string, branchId: string, exceptId?: string): Promise<void>;
  /** Atomically unsets any existing default in the SAME (productId, branchId) pair and updates the target price in one operation. */
  unsetDefaultAndUpdate(
    productId: string,
    branchId: string,
    priceId: string,
    data: UpdateProductPriceData
  ): Promise<ProductPrice>;
  delete(id: string): Promise<void>;
}
