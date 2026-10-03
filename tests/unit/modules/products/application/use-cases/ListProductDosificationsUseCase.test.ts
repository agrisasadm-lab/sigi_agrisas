import { ListProductDosificationsUseCase } from "@/modules/products/application/use-cases/ListProductDosificationsUseCase";
import { InMemoryProductRepository } from "@/modules/products/infrastructure/repositories/InMemoryProductRepository";
import { InMemoryProductPriceRepository } from "@/modules/products/infrastructure/repositories/InMemoryProductPriceRepository";
import { InMemoryProductDosificationRepository } from "@/modules/products/infrastructure/repositories/InMemoryProductDosificationRepository";
import { InMemoryPricingSettingsRepository } from "@/modules/settings/infrastructure/repositories/InMemoryPricingSettingsRepository";
import { ProductNotFoundError } from "@/modules/products/domain/errors/ProductNotFoundError";

const DEPT = "11111111-1111-1111-1111-111111111111";
const BRANCH_ID = "22222222-2222-2222-2222-222222222222";

describe("ListProductDosificationsUseCase", () => {
  let productRepo: InMemoryProductRepository;
  let priceRepo: InMemoryProductPriceRepository;
  let dosificationRepo: InMemoryProductDosificationRepository;
  let pricingSettingsRepo: InMemoryPricingSettingsRepository;
  let useCase: ListProductDosificationsUseCase;
  let productId: string;

  beforeEach(async () => {
    productRepo = new InMemoryProductRepository();
    productRepo.reset();
    priceRepo = new InMemoryProductPriceRepository();
    priceRepo.reset();
    dosificationRepo = new InMemoryProductDosificationRepository();
    dosificationRepo.reset();
    pricingSettingsRepo = new InMemoryPricingSettingsRepository();
    useCase = new ListProductDosificationsUseCase(productRepo, priceRepo, dosificationRepo, pricingSettingsRepo);
    const created = await productRepo.create({ code: "P1", name: "Producto", unit: "kg", departmentId: DEPT });
    productId = created.product.id;
    await dosificationRepo.create({ productId, name: "Por dosis", numParts: 10, isActive: true });
  });

  it("computes computedUnitPrice with the default 5% surcharge when a default price exists (100 / 10 * 1.05)", async () => {
    await priceRepo.create({ productId, branchId: BRANCH_ID, name: "Menudeo", price: 100, minQuantity: 1, isDefault: true });
    const result = await useCase.execute(productId, BRANCH_ID);
    expect(result.items[0].requiresDefaultPrice).toBe(false);
    expect(result.items[0].computedUnitPrice).toBeCloseTo(10.5, 10);
  });

  it("computes computedUnitPrice using a configured custom surcharge (100 / 10 * 1.08)", async () => {
    await priceRepo.create({ productId, branchId: BRANCH_ID, name: "Menudeo", price: 100, minQuantity: 1, isDefault: true });
    await pricingSettingsRepo.update({ dosificationSurchargePct: 8 });
    const result = await useCase.execute(productId, BRANCH_ID);
    expect(result.items[0].computedUnitPrice).toBeCloseTo(10.8, 10);
  });

  it("returns null computedUnitPrice and requiresDefaultPrice=true when no default price", async () => {
    const result = await useCase.execute(productId, BRANCH_ID);
    expect(result.items[0].computedUnitPrice).toBeNull();
    expect(result.items[0].requiresDefaultPrice).toBe(true);
  });

  it("throws ProductNotFoundError when the product does not exist", async () => {
    await expect(useCase.execute("nope", BRANCH_ID)).rejects.toThrow(ProductNotFoundError);
  });
});
