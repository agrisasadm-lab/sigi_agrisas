import { ProductRepository } from "../ports/ProductRepository";
import { ProductPriceRepository } from "../ports/ProductPriceRepository";
import { ListProductPricesResponse } from "../dto/ListProductPricesResponse";
import { toProductPriceDto } from "../mappers/toProductPriceDto";
import { ProductNotFoundError } from "../../domain/errors/ProductNotFoundError";
import { ProductPriceBranchNotFoundError } from "../../domain/errors/ProductPriceBranchNotFoundError";
import { BranchActiveLookup } from "./CreateProductPriceUseCase";

export class ListProductPricesUseCase {
  constructor(
    private readonly productRepo: ProductRepository,
    private readonly priceRepo: ProductPriceRepository,
    private readonly branchRepo?: BranchActiveLookup
  ) {}

  /** `branchId` es obligatorio: cada precio pertenece a una sucursal y no hay herencia. */
  async execute(productId: string, branchId: string): Promise<ListProductPricesResponse> {
    const [exists, branch] = await Promise.all([
      this.productRepo.exists(productId),
      this.branchRepo ? this.branchRepo.findById(branchId) : Promise.resolve(null),
    ]);
    if (!exists) throw new ProductNotFoundError(productId);
    if (this.branchRepo && !branch) throw new ProductPriceBranchNotFoundError(branchId);

    const prices = await this.priceRepo.findByProductAndBranch(productId, branchId);
    return { items: prices.map(toProductPriceDto) };
  }
}
