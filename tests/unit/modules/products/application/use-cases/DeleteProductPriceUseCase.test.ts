import { DeleteProductPriceUseCase } from "@/modules/products/application/use-cases/DeleteProductPriceUseCase";
import { InMemoryProductPriceRepository } from "@/modules/products/infrastructure/repositories/InMemoryProductPriceRepository";
import { ProductPriceNotFoundError } from "@/modules/products/domain/errors/ProductPriceNotFoundError";

const PRODUCT_ID = "11111111-1111-1111-1111-111111111111";
const BRANCH_ID = "22222222-2222-2222-2222-222222222222";

describe("DeleteProductPriceUseCase", () => {
  let priceRepo: InMemoryProductPriceRepository;
  let useCase: DeleteProductPriceUseCase;

  beforeEach(() => {
    priceRepo = new InMemoryProductPriceRepository();
    priceRepo.reset();
    useCase = new DeleteProductPriceUseCase(priceRepo);
  });

  it("hard-deletes an existing price", async () => {
    const created = await priceRepo.create({ productId: PRODUCT_ID, branchId: BRANCH_ID, name: "Menudeo", price: 12, minQuantity: 1, isDefault: false });
    await useCase.execute(PRODUCT_ID, created.id);
    expect(await priceRepo.findById(created.id)).toBeNull();
  });

  it("throws ProductPriceNotFoundError when not found", async () => {
    await expect(useCase.execute(PRODUCT_ID, "nope")).rejects.toThrow(ProductPriceNotFoundError);
  });
});
