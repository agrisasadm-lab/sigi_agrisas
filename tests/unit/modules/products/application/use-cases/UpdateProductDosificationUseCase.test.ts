import { UpdateProductDosificationUseCase } from "@/modules/products/application/use-cases/UpdateProductDosificationUseCase";
import { InMemoryProductDosificationRepository } from "@/modules/products/infrastructure/repositories/InMemoryProductDosificationRepository";
import { InMemoryProductPriceRepository } from "@/modules/products/infrastructure/repositories/InMemoryProductPriceRepository";
import { InMemoryPricingSettingsRepository } from "@/modules/settings/infrastructure/repositories/InMemoryPricingSettingsRepository";
import { ProductDosificationNotFoundError } from "@/modules/products/domain/errors/ProductDosificationNotFoundError";
import { DuplicateDosificationNameError } from "@/modules/products/domain/errors/DuplicateDosificationNameError";

const BRANCH = "66666666-6666-6666-6666-666666666666";

const PRODUCT_ID = "11111111-1111-1111-1111-111111111111";
const OTHER_PRODUCT = "99999999-9999-9999-9999-999999999999";

describe("UpdateProductDosificationUseCase", () => {
  let dosificationRepo: InMemoryProductDosificationRepository;
  let priceRepo: InMemoryProductPriceRepository;
  let useCase: UpdateProductDosificationUseCase;

  beforeEach(() => {
    dosificationRepo = new InMemoryProductDosificationRepository();
    dosificationRepo.reset();
    priceRepo = new InMemoryProductPriceRepository();
    priceRepo.reset();
    useCase = new UpdateProductDosificationUseCase(priceRepo, dosificationRepo, new InMemoryPricingSettingsRepository());
  });

  it("updates numParts", async () => {
    const created = await dosificationRepo.create({ productId: PRODUCT_ID, name: "Por dosis", numParts: 10, isActive: true });
    const result = await useCase.execute(PRODUCT_ID, created.id, BRANCH, { numParts: 24 });
    expect(result.numParts).toBe(24);
  });

  it("deactivates a dosification via isActive: false", async () => {
    const created = await dosificationRepo.create({ productId: PRODUCT_ID, name: "Por dosis", numParts: 10, isActive: true });
    const result = await useCase.execute(PRODUCT_ID, created.id, BRANCH, { isActive: false });
    expect(result.isActive).toBe(false);
  });

  it("includes computedUnitPrice when a default price exists", async () => {
    await priceRepo.create({ productId: PRODUCT_ID, branchId: BRANCH, name: "Menudeo", price: 100, minQuantity: 1, isDefault: true });
    const created = await dosificationRepo.create({ productId: PRODUCT_ID, name: "Por dosis", numParts: 10, isActive: true });
    const result = await useCase.execute(PRODUCT_ID, created.id, BRANCH, { numParts: 10 });
    expect(result.computedUnitPrice).toBeCloseTo(10.5);
    expect(result.requiresDefaultPrice).toBe(false);
  });

  it("returns computedUnitPrice null when no default price exists", async () => {
    const created = await dosificationRepo.create({ productId: PRODUCT_ID, name: "Por dosis", numParts: 10, isActive: true });
    const result = await useCase.execute(PRODUCT_ID, created.id, BRANCH, { numParts: 10 });
    expect(result.computedUnitPrice).toBeNull();
    expect(result.requiresDefaultPrice).toBe(true);
  });

  it("throws ProductDosificationNotFoundError for a missing dosification", async () => {
    await expect(
      useCase.execute(PRODUCT_ID, "nope", BRANCH, { numParts: 10 })
    ).rejects.toThrow(ProductDosificationNotFoundError);
  });

  it("throws ProductDosificationNotFoundError when the dosification belongs to another product", async () => {
    const created = await dosificationRepo.create({ productId: PRODUCT_ID, name: "Por dosis", numParts: 10, isActive: true });
    await expect(
      useCase.execute(OTHER_PRODUCT, created.id, BRANCH, { numParts: 5 })
    ).rejects.toThrow(ProductDosificationNotFoundError);
  });

  it("throws DuplicateDosificationNameError on duplicate name", async () => {
    await dosificationRepo.create({ productId: PRODUCT_ID, name: "Dosis A", numParts: 10, isActive: true });
    const b = await dosificationRepo.create({ productId: PRODUCT_ID, name: "Dosis B", numParts: 20, isActive: true });
    await expect(
      useCase.execute(PRODUCT_ID, b.id, BRANCH, { name: "Dosis A" })
    ).rejects.toThrow(DuplicateDosificationNameError);
  });
});
