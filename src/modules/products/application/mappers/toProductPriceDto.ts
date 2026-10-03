import { ProductPrice } from "../../domain/entities/ProductPrice";
import { ProductPriceDto } from "../dto/ProductPriceDto";

export function toProductPriceDto(price: ProductPrice): ProductPriceDto {
  return {
    id: price.id,
    productId: price.productId,
    branchId: price.branchId,
    name: price.name,
    price: price.price,
    minQuantity: price.minQuantity,
    discountPct: price.discountPct,
    isDefault: price.isDefault,
    createdAt: price.createdAt.toISOString(),
    updatedAt: price.updatedAt.toISOString(),
  };
}
