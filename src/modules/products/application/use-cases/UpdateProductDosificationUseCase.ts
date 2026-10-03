import { ProductPriceRepository } from "../ports/ProductPriceRepository";
import { ProductDosificationRepository } from "../ports/ProductDosificationRepository";
import { UpdateProductDosificationRequest } from "../dto/UpdateProductDosificationRequest";
import { ProductDosificationDto } from "../dto/ProductDosificationDto";
import { toProductDosificationDto } from "../mappers/toProductDosificationDto";
import { ProductDosificationNotFoundError } from "../../domain/errors/ProductDosificationNotFoundError";
import type { PricingSettingsRepository } from "@/modules/settings/application/ports/PricingSettingsRepository";

export class UpdateProductDosificationUseCase {
  constructor(
    private readonly priceRepo: ProductPriceRepository,
    private readonly dosificationRepo: ProductDosificationRepository,
    private readonly pricingSettingsRepo: PricingSettingsRepository
  ) {}

  async execute(
    productId: string,
    dosificationId: string,
    branchId: string,
    req: UpdateProductDosificationRequest
  ): Promise<ProductDosificationDto> {
    const existing = await this.dosificationRepo.findById(dosificationId);
    if (!existing || existing.productId !== productId) {
      throw new ProductDosificationNotFoundError(dosificationId);
    }

    const updated = await this.dosificationRepo.update(dosificationId, req);
    const [defaultPrice, pricingSettings] = await Promise.all([
      this.priceRepo.findDefaultByProductId(productId, branchId),
      this.pricingSettingsRepo.get(),
    ]);
    return toProductDosificationDto(updated, defaultPrice, pricingSettings.dosificationSurchargePct);
  }
}
