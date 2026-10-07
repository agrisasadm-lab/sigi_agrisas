import { createSeedContext } from "../../../../../prisma/seeds/lib/inventory/context";
import { seedBranch } from "../../../../../prisma/seeds/lib/inventory/seedBranch";
import type { BranchSeedPlan, NormalizedSeedRow, PrismaLike } from "../../../../../prisma/seeds/lib/inventory/types";

interface FakeBranch { id: string; code: string; name: string; isActive: boolean; isHeadquarters: boolean }
interface FakeDepartment { id: string; code: string; name: string }
interface FakeProduct {
  id: string;
  code: string;
  name: string;
  unit: string;
  satProductCode: string | null;
  departmentId: string;
  ivaRate: number;
  iepsRate: number;
}
interface FakePrice { id: string; productId: string; branchId: string; name: string; price: number; isDefault: boolean }
interface FakeInventory { id: string; branchId: string; productId: string; quantity: number }

let idSeq = 0;
function nextId(prefix: string): string {
  idSeq++;
  return `${prefix}-${idSeq}`;
}

function makeFakePrisma(seed?: { products?: FakeProduct[] }) {
  const branches: FakeBranch[] = [{ id: "matriz-id", code: "MATRIZ", name: "Matriz", isActive: true, isHeadquarters: false }];
  const departments: FakeDepartment[] = [];
  const products: FakeProduct[] = seed?.products ?? [];
  const prices: FakePrice[] = [];
  const inventory: FakeInventory[] = [];

  const prisma: PrismaLike = {
    branch: {
      findUnique: async ({ where }) => {
        const b = branches.find((x) => x.code === where.code);
        return b ? { id: b.id } : null;
      },
      upsert: async ({ where, create }) => {
        let b = branches.find((x) => x.code === where.code);
        if (!b) {
          b = { id: nextId("branch"), code: where.code, name: create.name as string, isActive: true, isHeadquarters: false };
          branches.push(b);
        }
        return { id: b.id };
      },
    },
    department: {
      upsert: async ({ where, create }) => {
        let d = departments.find((x) => x.code === where.code);
        if (!d) {
          d = { id: nextId("dept"), code: where.code, name: create.name as string };
          departments.push(d);
        }
        return { id: d.id };
      },
    },
    product: {
      findUnique: async ({ where }) => {
        const p = products.find((x) => x.code === where.code);
        return p ? { id: p.id, name: p.name } : null;
      },
      findMany: async () => products.map((p) => ({ id: p.id, code: p.code, name: p.name })),
      upsert: async ({ where, create, update }) => {
        let p = products.find((x) => x.code === where.code);
        if (!p) {
          p = {
            id: nextId("product"),
            code: where.code,
            name: create.name as string,
            unit: create.unit as string,
            satProductCode: (create.satProductCode as string | null) ?? null,
            departmentId: create.departmentId as string,
            ivaRate: (create.ivaRate as number) ?? 0,
            iepsRate: (create.iepsRate as number) ?? 0,
          };
          products.push(p);
        } else {
          Object.assign(p, update);
        }
        return { id: p.id };
      },
    },
    productPrice: {
      findFirst: async ({ where }) => {
        const p = prices.find((x) => x.productId === where.productId && x.branchId === where.branchId && x.name === where.name);
        return p ? { id: p.id, price: p.price } : null;
      },
      updateMany: async ({ where, data }) => {
        let count = 0;
        for (const p of prices) {
          if (p.productId === where.productId && p.branchId === where.branchId && p.isDefault === where.isDefault) {
            p.isDefault = data.isDefault;
            count++;
          }
        }
        return { count };
      },
      upsert: async ({ where, create, update }) => {
        const key = where.productId_branchId_name;
        let p = prices.find((x) => x.productId === key.productId && x.branchId === key.branchId && x.name === key.name);
        if (!p) {
          p = { id: nextId("price"), productId: key.productId, branchId: key.branchId, name: key.name, price: create.price as number, isDefault: create.isDefault as boolean };
          prices.push(p);
        } else {
          p.price = update.price as number;
          p.isDefault = update.isDefault as boolean;
        }
        return { id: p.id };
      },
    },
    branchInventory: {
      upsert: async ({ where, create, update }) => {
        const key = where.branchId_productId;
        let inv = inventory.find((x) => x.branchId === key.branchId && x.productId === key.productId);
        if (!inv) {
          inv = { id: nextId("inv"), branchId: key.branchId, productId: key.productId, quantity: create.quantity as number };
          inventory.push(inv);
        } else {
          inv.quantity = update.quantity as number;
        }
        return { id: inv.id };
      },
      findMany: async () => inventory.map((inv) => ({ productId: inv.productId })),
    },
  };

  return { prisma, branches, departments, products, prices, inventory };
}

function row(overrides: Partial<NormalizedSeedRow> = {}): NormalizedSeedRow {
  return {
    sourceRef: "TEST:X1",
    code: "X1",
    name: "PRODUCTO X",
    unit: "H87",
    satCode: null,
    departmentName: "DEPTO",
    ivaRaw: 0,
    iepsRaw: 0,
    quantity: null,
    prices: [{ tierName: "Precio Publico", value: 100, isDefault: true }],
    ...overrides,
  };
}

function plan(overrides: Partial<BranchSeedPlan> = {}): BranchSeedPlan {
  return {
    branchCode: "ZARIOZ",
    rows: [row()],
    productMatch: "code",
    productSync: "preserve",
    priceMode: "branch-override",
    quantitySource: "zero",
    createBranchIfMissing: true,
    ...overrides,
  };
}

describe("seedBranch", () => {
  it("productMatch 'name' matchea por nombre normalizado y sintetiza code sin match", async () => {
    const { prisma, products } = makeFakePrisma();
    const ctx = await createSeedContext(prisma);
    await seedBranch(
      prisma,
      plan({ branchCode: "TLAXIACO", productMatch: "name", rows: [row({ code: null, name: "BIO-FREEZE DE 1L" })] }),
      ctx
    );
    expect(products).toHaveLength(1);
    expect(products[0].code).toBe("BIO_FREEZE_DE_1L");
    expect(ctx.counters.tlaxiacoCreated).toBe(1);
  });

  it("productSync 'refresh' pisa name/unit/departmentId/satProductCode/ivaRate/iepsRate", async () => {
    const { prisma, products } = makeFakePrisma({
      products: [{ id: "p1", code: "ACTIVA1", name: "VIEJO", unit: "PZA", satProductCode: null, departmentId: "old-dept", ivaRate: 0, iepsRate: 0 }],
    });
    const ctx = await createSeedContext(prisma);
    await seedBranch(
      prisma,
      plan({
        branchCode: "MATRIZ",
        productSync: "refresh",
        priceMode: "base-tiers",
        quantitySource: "row",
        rows: [row({ code: "ACTIVA1", name: "NUEVO", unit: "H87", satCode: "10171600", ivaRaw: 16, iepsRaw: 6, quantity: 5 })],
      }),
      ctx
    );
    expect(products[0].name).toBe("NUEVO");
    expect(products[0].unit).toBe("H87");
    expect(products[0].satProductCode).toBe("10171600");
    expect(products[0].ivaRate).toBeCloseTo(0.16);
    expect(products[0].iepsRate).toBeCloseTo(0.06);
  });

  it("productSync 'preserve' sólo cuenta nameMismatch sin sobrescribir el nombre existente", async () => {
    const { prisma, products } = makeFakePrisma({
      products: [{ id: "p1", code: "AK1", name: "NOMBRE VIEJO", unit: "H87", satProductCode: null, departmentId: "d1", ivaRate: 0, iepsRate: 0 }],
    });
    const ctx = await createSeedContext(prisma);
    await seedBranch(prisma, plan({ rows: [row({ code: "AK1", name: "NOMBRE NUEVO" })] }), ctx);
    expect(products[0].name).toBe("NOMBRE VIEJO");
    expect(ctx.counters.nameMismatch).toBe(1);
  });

  it("quantitySource 'zero' siempre upsertea 0 aunque row.quantity traiga valor", async () => {
    const { prisma, inventory } = makeFakePrisma();
    const ctx = await createSeedContext(prisma);
    await seedBranch(prisma, plan({ quantitySource: "zero", rows: [row({ quantity: 999 })] }), ctx);
    expect(inventory[0].quantity).toBe(0);
  });

  it("quantitySource 'row' usa row.quantity", async () => {
    const { prisma, inventory } = makeFakePrisma();
    const ctx = await createSeedContext(prisma);
    await seedBranch(
      prisma,
      plan({
        branchCode: "MATRIZ",
        productSync: "refresh",
        priceMode: "base-tiers",
        quantitySource: "row",
        rows: [row({ code: "ACTIVA1", quantity: 42 })],
      }),
      ctx
    );
    expect(inventory[0].quantity).toBe(42);
  });

  it("alias de producto Tlaxiaco resuelve al code existente sin crear producto nuevo", async () => {
    const { prisma, products } = makeFakePrisma({
      products: [{ id: "p1", code: "BF1KG", name: "BIOFIT G 1KG", unit: "H87", satProductCode: null, departmentId: "d1", ivaRate: 0, iepsRate: 0 }],
    });
    const ctx = await createSeedContext(prisma);
    await seedBranch(
      prisma,
      plan({ branchCode: "TLAXIACO", productMatch: "name", rows: [row({ code: null, name: "BIOFIT G" })] }),
      ctx
    );
    expect(products).toHaveLength(1);
    expect(products[0].name).toBe("BIOFIT G 1KG"); // no se sobrescribe
    expect(ctx.counters.tlaxiacoAliased).toBe(1);
    expect(ctx.counters.tlaxiacoCreated).toBe(0);
  });

  it("nombre fuera del mapa de alias y sin match normalizado sigue creando producto nuevo", async () => {
    const { prisma, products } = makeFakePrisma();
    const ctx = await createSeedContext(prisma);
    await seedBranch(
      prisma,
      plan({ branchCode: "TLAXIACO", productMatch: "name", rows: [row({ code: null, name: "PROMESOL G GRANULADO", departmentName: "INNOVAK GLOBAL" })] }),
      ctx
    );
    expect(products).toHaveLength(1);
    expect(ctx.counters.tlaxiacoCreated).toBe(1);
    expect(ctx.counters.tlaxiacoAliased).toBe(0);
  });

  it("alias con code inexistente en catálogo se reporta como error sin abortar la corrida", async () => {
    const { prisma, products } = makeFakePrisma(); // sin BF1KG en catálogo
    const ctx = await createSeedContext(prisma);
    await seedBranch(
      prisma,
      plan({ branchCode: "TLAXIACO", productMatch: "name", rows: [row({ code: null, name: "BIOFIT G" })] }),
      ctx
    );
    expect(products).toHaveLength(0);
    expect(ctx.counters.errors).toHaveLength(1);
    expect(ctx.counters.errors[0].message).toMatch(/alias de producto/);
  });

  it("alias de departamento aplica igual desde MATRIZ, una tienda, y TLAXIACO (mismo ctx compartido)", async () => {
    const { prisma, departments } = makeFakePrisma();
    const ctx = await createSeedContext(prisma);

    await seedBranch(
      prisma,
      plan({
        branchCode: "MATRIZ",
        productSync: "refresh",
        priceMode: "base-tiers",
        quantitySource: "row",
        rows: [row({ code: "M1", name: "PRODUCTO MATRIZ", departmentName: "INNOVAK OUT" })],
      }),
      ctx
    );
    await seedBranch(prisma, plan({ branchCode: "ZARIOZ", rows: [row({ code: "Z1", name: "PRODUCTO ZARIOZ", departmentName: "-INNOVAK" })] }), ctx);
    await seedBranch(
      prisma,
      plan({ branchCode: "TLAXIACO", productMatch: "name", rows: [row({ code: null, name: "PRODUCTO TLAXIACO", departmentName: "INNOVAK" })] }),
      ctx
    );

    const innovakDepts = departments.filter((d) => d.name === "INNOVAK GLOBAL");
    expect(innovakDepts).toHaveLength(1);
  });

  it("precio vacío/0 con base existente no escribe override falso", async () => {
    const { prisma, prices } = makeFakePrisma({
      products: [{ id: "p1", code: "X1", name: "PRODUCTO X", unit: "H87", satProductCode: null, departmentId: "d1", ivaRate: 0, iepsRate: 0 }],
    });
    prices.push({ id: "price-base", productId: "p1", branchId: "matriz-id", name: "Precio Publico", price: 292, isDefault: true });
    const ctx = await createSeedContext(prisma);
    await seedBranch(
      prisma,
      plan({ rows: [row({ code: "X1", prices: [{ tierName: "Precio Publico", value: 0, isDefault: true }] })] }),
      ctx
    );
    expect(prices.filter((p) => p.branchId !== "matriz-id")).toHaveLength(0);
    expect(ctx.counters.emptyPriceRows).toBe(1);
  });

  it("precio vacío/0 sin base en ninguna sucursal deja el producto sin precio", async () => {
    const { prisma, products, prices, inventory } = makeFakePrisma();
    const ctx = await createSeedContext(prisma);
    await seedBranch(
      prisma,
      plan({ rows: [row({ code: "NEW1", name: "PRODUCTO NUEVO", prices: [{ tierName: "Precio Publico", value: 0, isDefault: true }] })] }),
      ctx
    );
    expect(products).toHaveLength(1);
    expect(prices).toHaveLength(0);
    expect(inventory).toHaveLength(1);
    expect(ctx.counters.emptyPriceRows).toBe(1);
  });

  it("precio > 0 mantiene el comportamiento actual (override branch-scoped)", async () => {
    const { prisma, prices } = makeFakePrisma({
      products: [{ id: "p1", code: "X1", name: "PRODUCTO X", unit: "H87", satProductCode: null, departmentId: "d1", ivaRate: 0, iepsRate: 0 }],
    });
    const ctx = await createSeedContext(prisma);
    await seedBranch(
      prisma,
      plan({ rows: [row({ code: "X1", prices: [{ tierName: "Precio Publico", value: 150, isDefault: true }] })] }),
      ctx
    );
    expect(prices).toHaveLength(1);
    expect(prices[0].price).toBe(150);
    expect(ctx.counters.emptyPriceRows).toBe(0);
  });
});
