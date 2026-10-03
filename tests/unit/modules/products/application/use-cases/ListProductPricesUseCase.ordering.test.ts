import { InMemoryProductRepository } from "@/modules/products/infrastructure/repositories/InMemoryProductRepository";
import { InMemoryProductPriceRepository } from "@/modules/products/infrastructure/repositories/InMemoryProductPriceRepository";
import { CreateProductPriceUseCase } from "@/modules/products/application/use-cases/CreateProductPriceUseCase";
import { ListProductPricesUseCase } from "@/modules/products/application/use-cases/ListProductPricesUseCase";

const DEPT = "11111111-1111-1111-1111-111111111111";
const BRANCH = "22222222-2222-2222-2222-222222222222";

describe("ListProductPricesUseCase — orden de negocio (Publico, Subdis, Distri, resto)", () => {
  it("retorna los 4 nombres reales del catálogo en el orden esperado", async () => {
    const productRepo = new InMemoryProductRepository();
    const priceRepo = new InMemoryProductPriceRepository();
    const create = new CreateProductPriceUseCase(productRepo, priceRepo);
    const { product } = await productRepo.create({ code: "P1", name: "Fertilizante", unit: "kg", departmentId: DEPT });

    await create.execute(product.id, { branchId: BRANCH, name: "Precio 4", price: 100, minQuantity: 1, isDefault: false });
    await create.execute(product.id, { branchId: BRANCH, name: "Precio Distri 15%", price: 90, minQuantity: 1, isDefault: false });
    await create.execute(product.id, { branchId: BRANCH, name: "Precio Subdis 10%", price: 95, minQuantity: 1, isDefault: false });
    await create.execute(product.id, { branchId: BRANCH, name: "Precio Publico", price: 100, minQuantity: 1, isDefault: true });

    const result = await new ListProductPricesUseCase(productRepo, priceRepo).execute(product.id, BRANCH);

    expect(result.items.map((p) => p.name)).toEqual([
      "Precio Publico",
      "Precio Subdis 10%",
      "Precio Distri 15%",
      "Precio 4",
    ]);
  });
});
