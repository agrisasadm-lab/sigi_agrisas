import { InMemoryProductRepository } from "@/modules/products/infrastructure/repositories/InMemoryProductRepository";
import { InMemoryProductPriceRepository } from "@/modules/products/infrastructure/repositories/InMemoryProductPriceRepository";
import { CreateProductPriceUseCase, BranchActiveLookup } from "@/modules/products/application/use-cases/CreateProductPriceUseCase";
import { ListProductPricesUseCase } from "@/modules/products/application/use-cases/ListProductPricesUseCase";
import { ProductPriceBranchNotFoundError } from "@/modules/products/domain/errors/ProductPriceBranchNotFoundError";
import { ProductNotFoundError } from "@/modules/products/domain/errors/ProductNotFoundError";

const DEPT = "11111111-1111-1111-1111-111111111111";
const MATRIZ = "33333333-3333-3333-3333-333333333333";
const ZARIOZ = "22222222-2222-2222-2222-222222222222";
const HUAJUAPAN = "55555555-5555-5555-5555-555555555555";
const UNKNOWN_BRANCH = "44444444-4444-4444-4444-444444444444";

class FakeBranchLookup implements BranchActiveLookup {
  async findById(id: string) {
    if (id === ZARIOZ || id === HUAJUAPAN || id === MATRIZ) return { isActive: true };
    return null;
  }
}

function makeSut() {
  const productRepo = new InMemoryProductRepository();
  const priceRepo = new InMemoryProductPriceRepository();
  const create = new CreateProductPriceUseCase(productRepo, priceRepo, new FakeBranchLookup());
  const list = new ListProductPricesUseCase(productRepo, priceRepo, new FakeBranchLookup());
  return { productRepo, priceRepo, create, list };
}

describe("ListProductPricesUseCase — precios por sucursal", () => {
  it("retorna únicamente los precios de la sucursal pedida", async () => {
    const { productRepo, create, list } = makeSut();
    const { product } = await productRepo.create({ code: "P1", name: "Fertilizante", unit: "kg", departmentId: DEPT });

    await create.execute(product.id, { branchId: MATRIZ, name: "Precio Publico", price: 3666.65, isDefault: true });
    await create.execute(product.id, { branchId: ZARIOZ, name: "Precio Publico", price: 699.35, isDefault: true });

    const result = await list.execute(product.id, ZARIOZ);

    expect(result.items).toHaveLength(1);
    expect(result.items[0].price).toBe(699.35);
    expect(result.items[0].branchId).toBe(ZARIOZ);
  });

  it("no hereda de otra sucursal: sin precios propios la lista es vacía", async () => {
    const { productRepo, create, list } = makeSut();
    const { product } = await productRepo.create({ code: "P1", name: "Fertilizante", unit: "kg", departmentId: DEPT });

    await create.execute(product.id, { branchId: MATRIZ, name: "Precio Publico", price: 100, isDefault: true });

    const result = await list.execute(product.id, HUAJUAPAN);

    expect(result.items).toEqual([]);
  });

  it("los tiers de otra sucursal nunca se mezclan en el resultado", async () => {
    const { productRepo, create, list } = makeSut();
    const { product } = await productRepo.create({ code: "P1", name: "Fertilizante", unit: "kg", departmentId: DEPT });

    await create.execute(product.id, { branchId: MATRIZ, name: "Precio Publico", price: 3666.65, isDefault: true });
    await create.execute(product.id, { branchId: MATRIZ, name: "Precio Subdis 10%", price: 3300 });
    await create.execute(product.id, { branchId: MATRIZ, name: "Precio Distri 15%", price: 3116.65 });
    await create.execute(product.id, { branchId: ZARIOZ, name: "Precio Publico", price: 699.35, isDefault: true });

    const result = await list.execute(product.id, ZARIOZ);

    expect(result.items).toHaveLength(1);
    expect(result.items[0].price).toBe(699.35);
  });

  it("rechaza branchId de sucursal inexistente", async () => {
    const { productRepo, list } = makeSut();
    const { product } = await productRepo.create({ code: "P1", name: "Fertilizante", unit: "kg", departmentId: DEPT });

    await expect(list.execute(product.id, UNKNOWN_BRANCH)).rejects.toThrow(ProductPriceBranchNotFoundError);
  });

  it("lanza ProductNotFoundError cuando el producto no existe", async () => {
    const { list } = makeSut();

    await expect(list.execute("00000000-0000-0000-0000-000000000000", ZARIOZ)).rejects.toThrow(ProductNotFoundError);
  });
});
