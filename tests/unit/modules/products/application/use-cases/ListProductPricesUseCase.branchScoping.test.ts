import { InMemoryProductRepository } from "@/modules/products/infrastructure/repositories/InMemoryProductRepository";
import { InMemoryProductPriceRepository } from "@/modules/products/infrastructure/repositories/InMemoryProductPriceRepository";
import { CreateProductPriceUseCase, BranchActiveLookup } from "@/modules/products/application/use-cases/CreateProductPriceUseCase";
import { ListProductPricesUseCase } from "@/modules/products/application/use-cases/ListProductPricesUseCase";
import { ProductPriceBranchNotFoundError } from "@/modules/products/domain/errors/ProductPriceBranchNotFoundError";
import { ProductNotFoundError } from "@/modules/products/domain/errors/ProductNotFoundError";

const DEPT = "11111111-1111-1111-1111-111111111111";
const ZARIOZ = "22222222-2222-2222-2222-222222222222";
const HUAJUAPAN = "55555555-5555-5555-5555-555555555555";
const UNKNOWN_BRANCH = "44444444-4444-4444-4444-444444444444";

class FakeBranchLookup implements BranchActiveLookup {
  async findById(id: string) {
    if (id === ZARIOZ || id === HUAJUAPAN) return { isActive: true };
    return null;
  }
}

describe("ListProductPricesUseCase — precio efectivo por sucursal", () => {
  it("sin branchId retorna sólo los precios base", async () => {
    const productRepo = new InMemoryProductRepository();
    const priceRepo = new InMemoryProductPriceRepository();
    const create = new CreateProductPriceUseCase(productRepo, priceRepo, new FakeBranchLookup());
    const { product } = await productRepo.create({ code: "P1", name: "Fertilizante", unit: "kg", departmentId: DEPT });

    await create.execute(product.id, { name: "Precio Publico", price: 100, isDefault: true });
    await create.execute(product.id, { name: "Precio Publico", price: 80, branchId: ZARIOZ });

    const list = new ListProductPricesUseCase(productRepo, priceRepo, new FakeBranchLookup());
    const result = await list.execute(product.id);

    expect(result.items).toHaveLength(1);
    expect(result.items[0].branchId).toBeNull();
    expect(result.items[0].isOverride).toBe(false);
  });

  it("con branchId retorna el override cuando existe", async () => {
    const productRepo = new InMemoryProductRepository();
    const priceRepo = new InMemoryProductPriceRepository();
    const create = new CreateProductPriceUseCase(productRepo, priceRepo, new FakeBranchLookup());
    const { product } = await productRepo.create({ code: "P1", name: "Fertilizante", unit: "kg", departmentId: DEPT });

    await create.execute(product.id, { name: "Precio Publico", price: 3666.65, isDefault: true });
    await create.execute(product.id, { name: "Precio Publico", price: 699.35, branchId: ZARIOZ });

    const list = new ListProductPricesUseCase(productRepo, priceRepo, new FakeBranchLookup());
    const result = await list.execute(product.id, ZARIOZ);

    expect(result.items).toHaveLength(1);
    expect(result.items[0].price).toBe(699.35);
    expect(result.items[0].branchId).toBe(ZARIOZ);
    expect(result.items[0].isOverride).toBe(true);
  });

  it("con branchId hereda el base cuando la sucursal no tiene override", async () => {
    const productRepo = new InMemoryProductRepository();
    const priceRepo = new InMemoryProductPriceRepository();
    const create = new CreateProductPriceUseCase(productRepo, priceRepo, new FakeBranchLookup());
    const { product } = await productRepo.create({ code: "P1", name: "Fertilizante", unit: "kg", departmentId: DEPT });

    await create.execute(product.id, { name: "Precio Publico", price: 100, isDefault: true });
    await create.execute(product.id, { name: "Precio Publico", price: 80, branchId: ZARIOZ });

    const list = new ListProductPricesUseCase(productRepo, priceRepo, new FakeBranchLookup());
    const result = await list.execute(product.id, HUAJUAPAN);

    expect(result.items).toHaveLength(1);
    expect(result.items[0].price).toBe(100);
    expect(result.items[0].isOverride).toBe(false);
  });

  it("con branchId y override presente, excluye los demás tiers base (no los hereda por name)", async () => {
    const productRepo = new InMemoryProductRepository();
    const priceRepo = new InMemoryProductPriceRepository();
    const create = new CreateProductPriceUseCase(productRepo, priceRepo, new FakeBranchLookup());
    const { product } = await productRepo.create({ code: "P1", name: "Fertilizante", unit: "kg", departmentId: DEPT });

    await create.execute(product.id, { name: "Precio Publico", price: 3666.65, isDefault: true });
    await create.execute(product.id, { name: "Precio Subdis 10%", price: 3300 });
    await create.execute(product.id, { name: "Precio Distri 15%", price: 3116.65 });
    await create.execute(product.id, { name: "Precio Publico", price: 699.35, branchId: ZARIOZ });

    const list = new ListProductPricesUseCase(productRepo, priceRepo, new FakeBranchLookup());
    const result = await list.execute(product.id, ZARIOZ);

    expect(result.items).toHaveLength(1);
    expect(result.items[0].price).toBe(699.35);
    expect(result.items[0].isOverride).toBe(true);
  });

  it("rechaza branchId de sucursal inexistente", async () => {
    const productRepo = new InMemoryProductRepository();
    const priceRepo = new InMemoryProductPriceRepository();
    const { product } = await productRepo.create({ code: "P1", name: "Fertilizante", unit: "kg", departmentId: DEPT });

    const list = new ListProductPricesUseCase(productRepo, priceRepo, new FakeBranchLookup());
    await expect(list.execute(product.id, UNKNOWN_BRANCH)).rejects.toThrow(ProductPriceBranchNotFoundError);
  });

  it("lanza ProductNotFoundError cuando el producto no existe", async () => {
    const productRepo = new InMemoryProductRepository();
    const priceRepo = new InMemoryProductPriceRepository();

    const list = new ListProductPricesUseCase(productRepo, priceRepo, new FakeBranchLookup());
    await expect(list.execute("00000000-0000-0000-0000-000000000000")).rejects.toThrow(ProductNotFoundError);
  });
});
