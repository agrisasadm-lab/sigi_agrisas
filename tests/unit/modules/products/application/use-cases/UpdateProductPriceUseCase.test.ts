import { UpdateProductPriceUseCase } from "@/modules/products/application/use-cases/UpdateProductPriceUseCase";
import { InMemoryProductPriceRepository } from "@/modules/products/infrastructure/repositories/InMemoryProductPriceRepository";
import { ProductPriceNotFoundError } from "@/modules/products/domain/errors/ProductPriceNotFoundError";

const PRODUCT_ID = "11111111-1111-1111-1111-111111111111";
const BRANCH_ID = "22222222-2222-2222-2222-222222222222";

describe("UpdateProductPriceUseCase", () => {
  let priceRepo: InMemoryProductPriceRepository;
  let useCase: UpdateProductPriceUseCase;

  beforeEach(() => {
    priceRepo = new InMemoryProductPriceRepository();
    priceRepo.reset();
    useCase = new UpdateProductPriceUseCase(priceRepo);
  });

  it("updates the price value", async () => {
    const created = await priceRepo.create({ productId: PRODUCT_ID, branchId: BRANCH_ID, name: "Menudeo", price: 12, minQuantity: 1, isDefault: false });
    const result = await useCase.execute(PRODUCT_ID, created.id, { price: 13.5 });
    expect(result.price).toBe(13.5);
  });

  it("promotes a price to default and unsets the previous default", async () => {
    const a = await priceRepo.create({ productId: PRODUCT_ID, branchId: BRANCH_ID, name: "Menudeo", price: 12, minQuantity: 1, isDefault: true });
    const b = await priceRepo.create({ productId: PRODUCT_ID, branchId: BRANCH_ID, name: "Mayoreo", price: 10, minQuantity: 10, isDefault: false });

    const result = await useCase.execute(PRODUCT_ID, b.id, { isDefault: true });
    expect(result.isDefault).toBe(true);

    const prior = await priceRepo.findById(a.id);
    expect(prior?.isDefault).toBe(false);
  });

  it("throws ProductPriceNotFoundError for a missing price", async () => {
    await expect(useCase.execute(PRODUCT_ID, "nope", { price: 1 })).rejects.toThrow(ProductPriceNotFoundError);
  });

  it("throws ProductPriceNotFoundError when the price belongs to another product", async () => {
    const created = await priceRepo.create({ productId: PRODUCT_ID, branchId: BRANCH_ID, name: "Menudeo", price: 12, minQuantity: 1, isDefault: false });
    await expect(
      useCase.execute("99999999-9999-9999-9999-999999999999", created.id, { price: 5 })
    ).rejects.toThrow(ProductPriceNotFoundError);
  });
});
