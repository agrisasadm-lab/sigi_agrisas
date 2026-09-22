import { ProductRepository } from "../ports/ProductRepository";
import { ProductPriceRepository } from "../ports/ProductPriceRepository";
import { CreateProductPriceRequest } from "../dto/CreateProductPriceRequest";
import { ProductPriceDto } from "../dto/ProductPriceDto";
import { toProductPriceDto } from "../mappers/toProductPriceDto";
import { ProductNotFoundError } from "../../domain/errors/ProductNotFoundError";
import { DuplicateDefaultPriceError } from "../../domain/errors/DuplicateDefaultPriceError";
import { ProductPriceInvalidBranchError } from "../../domain/errors/ProductPriceInvalidBranchError";

/** Minimal branch lookup this use case needs — avoids depending on the full BranchRepository port. */
export interface BranchActiveLookup {
  findById(id: string): Promise<{ isActive: boolean } | null>;
}

export class CreateProductPriceUseCase {
  constructor(
    private readonly productRepo: ProductRepository,
    private readonly priceRepo: ProductPriceRepository,
    private readonly branchRepo?: BranchActiveLookup
  ) {}

  async execute(productId: string, req: CreateProductPriceRequest): Promise<ProductPriceDto> {
    const product = await this.productRepo.findById(productId);
    if (!product) throw new ProductNotFoundError(productId);

    const branchId = req.branchId;
    if (this.branchRepo) {
      const branch = await this.branchRepo.findById(branchId);
      if (!branch || !branch.isActive) throw new ProductPriceInvalidBranchError(branchId);
    }

    const isDefault = req.isDefault ?? false;
    if (isDefault) {
      const existingDefault = await this.priceRepo.findDefaultByProductId(productId, branchId);
      if (existingDefault) throw new DuplicateDefaultPriceError();
    }

    const created = await this.priceRepo.create({
      productId,
      branchId,
      name: req.name,
      price: req.price,
      minQuantity: req.minQuantity ?? 1,
      discountPct: req.discountPct ?? null,
      isDefault,
    });
    return toProductPriceDto(created);
  }
}
