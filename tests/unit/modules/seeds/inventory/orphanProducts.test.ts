import { detectOrphanProducts } from "../../../../../prisma/seeds/lib/inventory/report";
import type { PrismaLike } from "../../../../../prisma/seeds/lib/inventory/types";

interface FakeProduct { id: string; code: string; name: string; isActive: boolean }

function makeFakePrisma(products: FakeProduct[], inventoryProductIds: string[]): PrismaLike {
  return {
    branch: {
      findUnique: async () => {
        throw new Error("not used in detectOrphanProducts");
      },
      upsert: async () => {
        throw new Error("not used in detectOrphanProducts");
      },
    },
    department: {
      upsert: async () => {
        throw new Error("not used in detectOrphanProducts");
      },
    },
    product: {
      findUnique: async () => {
        throw new Error("not used in detectOrphanProducts");
      },
      findMany: async ({ where }) => {
        const list = where?.isActive ? products.filter((p) => p.isActive) : products;
        return list.map((p) => ({ id: p.id, code: p.code, name: p.name }));
      },
      upsert: async () => {
        throw new Error("not used in detectOrphanProducts");
      },
    },
    productPrice: {
      findFirst: async () => null,
      updateMany: async () => ({ count: 0 }),
      upsert: async () => {
        throw new Error("not used in detectOrphanProducts");
      },
    },
    branchInventory: {
      upsert: async () => {
        throw new Error("detectOrphanProducts no debe escribir branch_inventory");
      },
      findMany: async () => inventoryProductIds.map((productId) => ({ productId })),
    },
  };
}

describe("detectOrphanProducts", () => {
  it("detecta un producto activo sin ninguna fila de branch_inventory", async () => {
    const prisma = makeFakePrisma([{ id: "p1", code: "OLD01", name: "PRODUCTO VIEJO", isActive: true }], []);
    const result = await detectOrphanProducts(prisma);
    expect(result.count).toBe(1);
    expect(result.sampleCodes).toContain("OLD01");
  });

  it("producto con fila en al menos una sucursal no aparece como huérfano", async () => {
    const prisma = makeFakePrisma([{ id: "p1", code: "OK01", name: "PRODUCTO OK", isActive: true }], ["p1"]);
    const result = await detectOrphanProducts(prisma);
    expect(result.count).toBe(0);
    expect(result.sampleCodes).toEqual([]);
  });

  it("no crea ni modifica branch_inventory como efecto de la detección", async () => {
    const prisma = makeFakePrisma([{ id: "p1", code: "OLD01", name: "X", isActive: true }], []);
    // `branchInventory.upsert` lanza si se llama — si la detección intentara escribir, el test falla.
    await expect(detectOrphanProducts(prisma)).resolves.toEqual({ count: 1, sampleCodes: ["OLD01"] });
  });

  it("limita sampleCodes a 20 ejemplos", async () => {
    const products: FakeProduct[] = Array.from({ length: 25 }, (_, i) => ({
      id: `p${i}`,
      code: `CODE${i}`,
      name: `P${i}`,
      isActive: true,
    }));
    const prisma = makeFakePrisma(products, []);
    const result = await detectOrphanProducts(prisma);
    expect(result.count).toBe(25);
    expect(result.sampleCodes).toHaveLength(20);
  });
});
