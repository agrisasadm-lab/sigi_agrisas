import { ProductRepository } from "../ports/ProductRepository";
import { ProductPriceRepository } from "../ports/ProductPriceRepository";
import { ProductDosificationRepository } from "../ports/ProductDosificationRepository";
import { CreateProductDosificationRequest } from "../dto/CreateProductDosificationRequest";
import { ProductDosificationDto } from "../dto/ProductDosificationDto";
import { toProductDosificationDto } from "../mappers/toProductDosificationDto";
import { ProductNotFoundError } from "../../domain/errors/ProductNotFoundError";
import type { PricingSettingsRepository } from "@/modules/settings/application/ports/PricingSettingsRepository";

export class CreateProductDosificationUseCase {
  constructor(
    private readonly productRepo: ProductRepository,
    private readonly priceRepo: ProductPriceRepository,
    private readonly dosificationRepo: ProductDosificationRepository,
    private readonly pricingSettingsRepo: PricingSettingsRepository
  ) {}

  async execute(productId: string, branchId: string, req: CreateProductDosificationRequest): Promise<ProductDosificationDto> {
    const product = await this.productRepo.findById(productId);
    if (!product) throw new ProductNotFoundError(productId);

    const created = await this.dosificationRepo.create({
      productId,
      name: req.name,
      numParts: req.numParts,
      isActive: req.isActive ?? true,
    });

    const [defaultPrice, pricingSettings] = await Promise.all([
      this.priceRepo.findDefaultByProductId(productId, branchId),
      this.pricingSettingsRepo.get(),
    ]);
    return toProductDosificationDto(created, defaultPrice, pricingSettings.dosificationSurchargePct);
  }
}
