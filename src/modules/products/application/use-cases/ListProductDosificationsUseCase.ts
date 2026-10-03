import { ProductRepository } from "../ports/ProductRepository";
import { ProductPriceRepository } from "../ports/ProductPriceRepository";
import { ProductDosificationRepository } from "../ports/ProductDosificationRepository";
import { ListProductDosificationsResponse } from "../dto/ListProductDosificationsResponse";
import { toProductDosificationDto } from "../mappers/toProductDosificationDto";
import { ProductNotFoundError } from "../../domain/errors/ProductNotFoundError";
import type { PricingSettingsRepository } from "@/modules/settings/application/ports/PricingSettingsRepository";

export class ListProductDosificationsUseCase {
  constructor(
    private readonly productRepo: ProductRepository,
    private readonly priceRepo: ProductPriceRepository,
    private readonly dosificationRepo: ProductDosificationRepository,
    private readonly pricingSettingsRepo: PricingSettingsRepository
  ) {}

  /** `branchId` determina el precio default que alimenta `computedUnitPrice`. */
  async execute(productId: string, branchId: string): Promise<ListProductDosificationsResponse> {
    const product = await this.productRepo.findById(productId);
    if (!product) throw new ProductNotFoundError(productId);

    const [dosifications, defaultPrice, pricingSettings] = await Promise.all([
      this.dosificationRepo.findByProductId(productId),
      this.priceRepo.findDefaultByProductId(productId, branchId),
      this.pricingSettingsRepo.get(),
    ]);

    return {
      items: dosifications.map((d) =>
        toProductDosificationDto(d, defaultPrice, pricingSettings.dosificationSurchargePct)
      ),
    };
  }
}
