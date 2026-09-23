import { CreateProductPriceUseCase } from "@/modules/products/application/use-cases/CreateProductPriceUseCase";
import { InMemoryProductRepository } from "@/modules/products/infrastructure/repositories/InMemoryProductRepository";
import { InMemoryProductPriceRepository } from "@/modules/products/infrastructure/repositories/InMemoryProductPriceRepository";
import { ProductNotFoundError } from "@/modules/products/domain/errors/ProductNotFoundError";
import { DuplicatePriceNameError } from "@/modules/products/domain/errors/DuplicatePriceNameError";
import { DuplicateDefaultPriceError } from "@/modules/products/domain/errors/DuplicateDefaultPriceError";

const DEPT = "11111111-1111-1111-1111-111111111111";
const BRANCH = "22222222-2222-2222-2222-222222222222";

describe("CreateProductPriceUseCase", () => {
  let productRepo: InMemoryProductRepository;
  let priceRepo: InMemoryProductPriceRepository;
  let useCase: CreateProductPriceUseCase;
  let productId: string;

  beforeEach(async () => {
    productRepo = new InMemoryProductRepository();
    productRepo.reset();
    priceRepo = new InMemoryProductPriceRepository();
    priceRepo.reset();
    useCase = new CreateProductPriceUseCase(productRepo, priceRepo);
    const created = await productRepo.create({ code: "P1", name: "Arroz", unit: "kg", departmentId: DEPT });
    productId = created.product.id;
  });

  it("creates a non-default price", async () => {
    const result = await useCase.execute(productId, { branchId: BRANCH, name: "Mayoreo", price: 10.5, minQuantity: 10 });
    expect(result.name).toBe("Mayoreo");
    expect(result.minQuantity).toBe(10);
    expect(result.isDefault).toBe(false);
  });

  it("creates the first default price", async () => {
    const result = await useCase.execute(productId, { branchId: BRANCH, name: "Menudeo", price: 12, isDefault: true });
    expect(result.isDefault).toBe(true);
  });

  it("rejects a second default price", async () => {
    await useCase.execute(productId, { branchId: BRANCH, name: "Menudeo", price: 12, isDefault: true });
    await expect(
      useCase.execute(productId, { branchId: BRANCH, name: "Otro", price: 14, isDefault: true })
    ).rejects.toThrow(DuplicateDefaultPriceError);
  });

  it("rejects a duplicate price name", async () => {
    await useCase.execute(productId, { branchId: BRANCH, name: "Menudeo", price: 12 });
    await expect(useCase.execute(productId, { branchId: BRANCH, name: "Menudeo", price: 13 })).rejects.toThrow(DuplicatePriceNameError);
  });

  it("throws ProductNotFoundError when the product does not exist", async () => {
    await expect(useCase.execute("nope", { branchId: BRANCH, name: "X", price: 1 })).rejects.toThrow(ProductNotFoundError);
  });
});
