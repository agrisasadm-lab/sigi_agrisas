import { InMemoryProductPriceRepository } from "@/modules/products/infrastructure/repositories/InMemoryProductPriceRepository";
import { DuplicatePriceNameError } from "@/modules/products/domain/errors/DuplicatePriceNameError";
import { DuplicateDefaultPriceError } from "@/modules/products/domain/errors/DuplicateDefaultPriceError";

const PRODUCT_ID = "product-1";
const MATRIZ = "branch-matriz";
const ZARIOZ = "branch-zarioz";
const HUAJUAPAN = "branch-huajuapan";

describe("InMemoryProductPriceRepository — precio por sucursal", () => {
  it("findByProductAndBranch retorna únicamente los precios de esa sucursal", async () => {
    const repo = new InMemoryProductPriceRepository();
    await repo.create({ productId: PRODUCT_ID, branchId: MATRIZ, name: "Precio Publico", price: 100, minQuantity: 1, isDefault: true });
    await repo.create({ productId: PRODUCT_ID, branchId: ZARIOZ, name: "Precio Publico", price: 80, minQuantity: 1, isDefault: true });

    const matriz = await repo.findByProductAndBranch(PRODUCT_ID, MATRIZ);

    expect(matriz).toHaveLength(1);
    expect(matriz[0].branchId).toBe(MATRIZ);
    expect(matriz[0].price).toBe(100);
  });

  it("no hereda: una sucursal sin precios propios devuelve lista vacía", async () => {
    const repo = new InMemoryProductPriceRepository();
    await repo.create({ productId: PRODUCT_ID, branchId: MATRIZ, name: "Precio Publico", price: 100, minQuantity: 1, isDefault: true });

    const huajuapan = await repo.findByProductAndBranch(PRODUCT_ID, HUAJUAPAN);

    expect(huajuapan).toEqual([]);
  });

  it("el mismo name coexiste en sucursales distintas", async () => {
    const repo = new InMemoryProductPriceRepository();
    await repo.create({ productId: PRODUCT_ID, branchId: MATRIZ, name: "Precio Publico", price: 100, minQuantity: 1, isDefault: false });

    await expect(
      repo.create({ productId: PRODUCT_ID, branchId: ZARIOZ, name: "Precio Publico", price: 80, minQuantity: 1, isDefault: false })
    ).resolves.toBeDefined();
  });

  it("dos precios con el mismo name en la misma sucursal colisionan", async () => {
    const repo = new InMemoryProductPriceRepository();
    await repo.create({ productId: PRODUCT_ID, branchId: ZARIOZ, name: "Precio Publico", price: 80, minQuantity: 1, isDefault: false });

    await expect(
      repo.create({ productId: PRODUCT_ID, branchId: ZARIOZ, name: "Precio Publico", price: 90, minQuantity: 1, isDefault: false })
    ).rejects.toBeInstanceOf(DuplicatePriceNameError);
  });

  it("cada sucursal tiene su propio default sin colisionar", async () => {
    const repo = new InMemoryProductPriceRepository();
    await repo.create({ productId: PRODUCT_ID, branchId: MATRIZ, name: "Precio Publico", price: 100, minQuantity: 1, isDefault: true });

    await expect(
      repo.create({ productId: PRODUCT_ID, branchId: ZARIOZ, name: "Precio Publico", price: 80, minQuantity: 1, isDefault: true })
    ).resolves.toBeDefined();
  });

  it("un segundo default en la misma sucursal colisiona", async () => {
    const repo = new InMemoryProductPriceRepository();
    await repo.create({ productId: PRODUCT_ID, branchId: ZARIOZ, name: "Precio Publico", price: 80, minQuantity: 1, isDefault: true });

    await expect(
      repo.create({ productId: PRODUCT_ID, branchId: ZARIOZ, name: "Precio Distri", price: 70, minQuantity: 1, isDefault: true })
    ).rejects.toBeInstanceOf(DuplicateDefaultPriceError);
  });

  it("findDefaultByProductId resuelve el default de la sucursal pedida, sin fallback", async () => {
    const repo = new InMemoryProductPriceRepository();
    await repo.create({ productId: PRODUCT_ID, branchId: MATRIZ, name: "Precio Publico", price: 100, minQuantity: 1, isDefault: true });
    await repo.create({ productId: PRODUCT_ID, branchId: ZARIOZ, name: "Precio Publico", price: 80, minQuantity: 1, isDefault: true });

    expect((await repo.findDefaultByProductId(PRODUCT_ID, ZARIOZ))?.price).toBe(80);
    expect((await repo.findDefaultByProductId(PRODUCT_ID, MATRIZ))?.price).toBe(100);
    expect(await repo.findDefaultByProductId(PRODUCT_ID, HUAJUAPAN)).toBeNull();
  });

  it("unsetDefaultAndUpdate sólo afecta la sucursal del precio editado", async () => {
    const repo = new InMemoryProductPriceRepository();
    const matrizDefault = await repo.create({ productId: PRODUCT_ID, branchId: MATRIZ, name: "Precio Publico", price: 100, minQuantity: 1, isDefault: true });
    const zariozOther = await repo.create({ productId: PRODUCT_ID, branchId: ZARIOZ, name: "Precio Distri", price: 70, minQuantity: 1, isDefault: false });

    const promoted = await repo.unsetDefaultAndUpdate(PRODUCT_ID, ZARIOZ, zariozOther.id, { isDefault: true });

    expect(promoted.isDefault).toBe(true);
    const stillMatrizDefault = await repo.findById(matrizDefault.id);
    expect(stillMatrizDefault?.isDefault).toBe(true);
  });
});
