import { seedInventoryTiendas, type PrismaLike } from "../../../../prisma/seeds/lib/inventoryTiendasSeedLogic";
import type { AgrisasRefreshRow, TiendaInventoryRow, TlaxiacoRawRow } from "../../../../prisma/seeds/data/inventario-tiendas-v3";

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

function makeFakePrisma(seed?: { branches?: FakeBranch[]; products?: FakeProduct[]; prices?: FakePrice[] }) {
  const branches: FakeBranch[] = seed?.branches ?? [{ id: "matriz-id", code: "MATRIZ", name: "Matriz", isActive: true, isHeadquarters: false }];
  const departments: FakeDepartment[] = [];
  const products: FakeProduct[] = seed?.products ?? [];
  const prices: FakePrice[] = seed?.prices ?? [];
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
      // Nota: el fake no modela `isActive` de producto — todos los productos creados
      // en estos tests se consideran activos, `where: {isActive: true}` no filtra nada.
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
          p = {
            id: nextId("price"),
            productId: key.productId,
            branchId: key.branchId,
            name: key.name,
            price: create.price as number,
            isDefault: create.isDefault as boolean,
          };
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

function agrisasRow(overrides: Partial<AgrisasRefreshRow> = {}): AgrisasRefreshRow {
  return {
    code: "ACTIVA1",
    name: "ACTIVANE 1KG",
    unit: "H87",
    satCode: "10171600",
    departmentName: "AGRICULTOR",
    ivaRaw: 0,
    iepsRaw: 0,
    existencia: 16,
    prices: [{ tierName: "Precio Publico", value: 1562.64, isDefault: true }],
    ...overrides,
  };
}

function tiendaRow(overrides: Partial<TiendaInventoryRow> = {}): TiendaInventoryRow {
  return {
    code: "AK1",
    name: "ALGAK 1L",
    unit: "H87",
    satCode: "10171500",
    price: 376,
    departmentName: "INNOVAK",
    branchCode: "ZARIOZ",
    ...overrides,
  };
}

function tlaxiacoRow(overrides: Partial<TlaxiacoRawRow> = {}): TlaxiacoRawRow {
  return {
    tlaxiacoRawCode: 185,
    name: "KER KAB 1L",
    unit: "H87",
    satCode: "10171500",
    price: 770,
    departmentName: "KER",
    branchCode: "TLAXIACO",
    ...overrides,
  };
}

describe("seedInventoryTiendas", () => {
  it("producto nuevo se auto-crea en tienda", async () => {
    const { prisma, products } = makeFakePrisma();
    await seedInventoryTiendas(prisma, { agrisas: [], tiendas: [tiendaRow()], tlaxiaco: [] });
    expect(products).toHaveLength(1);
    expect(products[0].code).toBe("AK1");
  });

  it("nombre existente no se sobrescribe en tiendas (nameMismatch)", async () => {
    const { prisma, products } = makeFakePrisma({
      products: [{ id: "p1", code: "AK1", name: "ALGAK 1L (viejo)", unit: "H87", satProductCode: null, departmentId: "d1", ivaRate: 0, iepsRate: 0 }],
    });
    const counters = await seedInventoryTiendas(prisma, { agrisas: [], tiendas: [tiendaRow({ name: "ALGAK 1L (nuevo)" })], tlaxiaco: [] });
    expect(products[0].name).toBe("ALGAK 1L (viejo)");
    expect(counters.nameMismatch).toBe(1);
  });

  it("producto de Agrisas SÍ se sobrescribe completo (D8)", async () => {
    const { prisma, products } = makeFakePrisma({
      products: [{ id: "p1", code: "ACTIVA1", name: "ACTIVANE 1KG (viejo)", unit: "PZA", satProductCode: null, departmentId: "d1", ivaRate: 0, iepsRate: 0 }],
    });
    const counters = await seedInventoryTiendas(prisma, { agrisas: [agrisasRow({ name: "ACTIVANE 1KG" })], tiendas: [], tlaxiaco: [] });
    expect(products[0].name).toBe("ACTIVANE 1KG");
    expect(counters.matrizRefreshed).toBe(1);
  });

  it("multi-tier de Agrisas sincroniza tiers no-cero + default siempre presente", async () => {
    const { prisma, prices } = makeFakePrisma();
    await seedInventoryTiendas(prisma, {
      agrisas: [agrisasRow({ prices: [{ tierName: "Precio Publico", value: 1562.64, isDefault: true }, { tierName: "Precio Subdis 10%", value: 1426.76 }] })],
      tiendas: [],
      tlaxiaco: [],
    });
    const basePrices = prices.filter((p) => p.branchId === "matriz-id");
    expect(basePrices).toHaveLength(2);
    expect(basePrices.find((p) => p.name === "Precio Publico")?.isDefault).toBe(true);
  });

  it("ivaRaw/iepsRaw se dividen entre 100 al escribir Product.ivaRate/iepsRate", async () => {
    const { prisma, products } = makeFakePrisma();
    await seedInventoryTiendas(prisma, { agrisas: [agrisasRow({ ivaRaw: 16, iepsRaw: 6 })], tiendas: [], tlaxiaco: [] });
    expect(products[0].ivaRate).toBeCloseTo(0.16);
    expect(products[0].iepsRate).toBeCloseTo(0.06);
  });

  it("code inválido se omite sin abortar la corrida", async () => {
    const { prisma, products } = makeFakePrisma();
    const counters = await seedInventoryTiendas(prisma, {
      agrisas: [],
      tiendas: [tiendaRow({ code: "" }), tiendaRow({ code: "AT1", name: "ATP UP 1L" })],
      tlaxiaco: [],
    });
    expect(products).toHaveLength(1);
    expect(counters.errors.length).toBeGreaterThan(0);
  });

  it("sucursal nueva se crea vía upsert por code", async () => {
    const { prisma, branches } = makeFakePrisma();
    const counters = await seedInventoryTiendas(prisma, { agrisas: [], tiendas: [tiendaRow()], tlaxiaco: [] });
    expect(branches.find((b) => b.code === "ZARIOZ")).toBeDefined();
    expect(counters.branchesCreated).toBe(1);
  });

  it("sucursal existente no se duplica ni pierde isHeadquarters", async () => {
    const { prisma, branches } = makeFakePrisma({
      branches: [
        { id: "matriz-id", code: "MATRIZ", name: "Matriz", isActive: true, isHeadquarters: true },
        { id: "zarioz-id", code: "ZARIOZ", name: "Zarioz", isActive: true, isHeadquarters: false },
      ],
    });
    await seedInventoryTiendas(prisma, { agrisas: [], tiendas: [tiendaRow()], tlaxiaco: [] });
    const zariozRows = branches.filter((b) => b.code === "ZARIOZ");
    expect(zariozRows).toHaveLength(1);
    expect(branches.find((b) => b.code === "MATRIZ")?.isHeadquarters).toBe(true);
  });

  it("existencia de Matriz (Agrisas) sobrescribe el inventario en cada corrida", async () => {
    const { prisma, inventory } = makeFakePrisma();
    await seedInventoryTiendas(prisma, { agrisas: [agrisasRow({ existencia: 10 })], tiendas: [], tlaxiaco: [] });
    await seedInventoryTiendas(prisma, { agrisas: [agrisasRow({ existencia: 3 })], tiendas: [], tlaxiaco: [] });
    const inv = inventory.find((i) => i.branchId === "matriz-id");
    expect(inv?.quantity).toBe(3);
  });

  it("precio igual al base no crea override", async () => {
    const { prisma, prices } = makeFakePrisma();
    await seedInventoryTiendas(prisma, {
      agrisas: [agrisasRow({ code: "AK1", name: "ALGAK 1L", prices: [{ tierName: "Precio Publico", value: 376, isDefault: true }] })],
      tiendas: [tiendaRow({ price: 376 })],
      tlaxiaco: [],
    });
    const overrides = prices.filter((p) => p.branchId !== "matriz-id");
    expect(overrides).toHaveLength(0);
  });

  it("precio distinto crea override branch-scoped", async () => {
    const { prisma, prices } = makeFakePrisma();
    const counters = await seedInventoryTiendas(prisma, {
      agrisas: [agrisasRow({ code: "KAB1", name: "KER KAB 1L", prices: [{ tierName: "Precio Publico", value: 3666.65, isDefault: true }] })],
      tiendas: [tiendaRow({ code: "KAB1", name: "KER KAB 1L", price: 699.35, branchCode: "CHICHICAPAM" })],
      tlaxiaco: [],
    });
    const overrides = prices.filter((p) => p.branchId !== "matriz-id");
    expect(overrides).toHaveLength(1);
    expect(overrides[0].price).toBe(699.35);
    expect(counters.priceOverridesByBranch.CHICHICAPAM).toBe(1);
  });

  it("producto sin precio en Matriz crea su precio directo en la tienda, no en el branchId de Matriz", async () => {
    const { prisma, prices } = makeFakePrisma();
    await seedInventoryTiendas(prisma, {
      agrisas: [],
      tiendas: [tiendaRow({ code: "XYZ", name: "PRODUCTO SOLO TIENDA", price: 100, branchCode: "ZARIOZ" })],
      tlaxiaco: [],
    });
    expect(prices.filter((p) => p.branchId === "matriz-id")).toHaveLength(0);
    expect(prices.filter((p) => p.branchId !== "matriz-id")).toHaveLength(1);
  });

  it("Tlaxiaco con nombre normalizado matchea producto existente y usa su code", async () => {
    const { prisma, products } = makeFakePrisma({
      products: [{ id: "p1", code: "KAB1", name: "KER KAB 1L", unit: "H87", satProductCode: null, departmentId: "d1", ivaRate: 0, iepsRate: 0 }],
    });
    const counters = await seedInventoryTiendas(prisma, {
      agrisas: [],
      tiendas: [],
      tlaxiaco: [tlaxiacoRow({ name: "KER KAB DE 1L" })],
    });
    expect(products).toHaveLength(1); // no crea uno nuevo
    expect(counters.tlaxiacoMatched).toBe(1);
    expect(counters.tlaxiacoCreated).toBe(0);
  });

  it("Tlaxiaco sin match sintetiza code del nombre real, nunca el numérico interno", async () => {
    const { prisma, products } = makeFakePrisma();
    const counters = await seedInventoryTiendas(prisma, {
      agrisas: [],
      tiendas: [],
      tlaxiaco: [tlaxiacoRow({ tlaxiacoRawCode: 61, name: "BIO-FREEZE DE 1L" })],
    });
    expect(products).toHaveLength(1);
    expect(products[0].code).not.toBe("61");
    expect(products[0].code).toBe("BIO_FREEZE_DE_1L"); // normalizeProductCode NO quita "DE" (sólo normalizeProductNameForMatching lo hace)
    expect(counters.tlaxiacoCreated).toBe(1);
  });

  it("colisión de code sintetizado se reporta sin sobrescribir el producto existente", async () => {
    const { prisma, products } = makeFakePrisma();
    const counters = await seedInventoryTiendas(prisma, {
      agrisas: [],
      tiendas: [],
      tlaxiaco: [
        tlaxiacoRow({ tlaxiacoRawCode: 1, name: "PRODUCTO A/B", departmentName: "X" }),
        tlaxiacoRow({ tlaxiacoRawCode: 2, name: "PRODUCTO A?B", departmentName: "X" }),
      ],
    });
    // Ambos normalizan a code "PRODUCTO_AB" (mismo) pero a nombres de matching distintos
    // ("PRODUCTO A/B" vs "PRODUCTO A?B" no colapsan igual bajo normalizeProductNameForMatching,
    // que no toca "/" ni "?") -> la segunda fila colisiona de code sin ser el mismo producto.
    expect(products).toHaveLength(1);
    expect(counters.errors.some((e) => e.message.includes("colisiona"))).toBe(true);
  });

  it("Tlaxiaco sin match y sin departamento usa el departamento fallback en vez de omitirse", async () => {
    const { prisma, products, departments } = makeFakePrisma();
    const counters = await seedInventoryTiendas(prisma, {
      agrisas: [],
      tiendas: [],
      tlaxiaco: [tlaxiacoRow({ tlaxiacoRawCode: 7, name: "ALIETTE DOSIS 500GRS", departmentName: null })],
    });
    expect(products).toHaveLength(1);
    expect(departments.find((d) => d.code === "SIN_DEPARTAMENTO")).toBeDefined();
    expect(products[0].departmentId).toBe(departments.find((d) => d.code === "SIN_DEPARTAMENTO")?.id);
    expect(counters.tlaxiacoFallbackDepartment).toBe(1);
    expect(counters.tlaxiacoCreated).toBe(1);
    expect(counters.errors).toHaveLength(0);
  });

  it("Tlaxiaco sin match pero CON departamento explícito no usa el fallback", async () => {
    const { prisma, products, departments } = makeFakePrisma();
    const counters = await seedInventoryTiendas(prisma, {
      agrisas: [],
      tiendas: [],
      tlaxiaco: [tlaxiacoRow({ tlaxiacoRawCode: 61, name: "BIO-FREEZE DE 1L", departmentName: "AGROQUIMICOS" })],
    });
    expect(products[0].departmentId).not.toBe(departments.find((d) => d.code === "SIN_DEPARTAMENTO")?.id);
    expect(counters.tlaxiacoFallbackDepartment).toBe(0);
  });

  it("colisión de code sintetizado entre dos filas fallback se reporta como error, no como falta de departamento", async () => {
    const { prisma, products } = makeFakePrisma();
    const counters = await seedInventoryTiendas(prisma, {
      agrisas: [],
      tiendas: [],
      tlaxiaco: [
        tlaxiacoRow({ tlaxiacoRawCode: 1, name: "PRODUCTO A/B", departmentName: null }),
        tlaxiacoRow({ tlaxiacoRawCode: 2, name: "PRODUCTO A?B", departmentName: null }),
      ],
    });
    expect(products).toHaveLength(1);
    expect(counters.tlaxiacoFallbackDepartment).toBe(1);
    expect(counters.errors.some((e) => e.message.includes("colisiona"))).toBe(true);
  });

  it("dos filas fallback distintas en la misma corrida comparten el mismo departamento (una sola fila creada)", async () => {
    const { prisma, products, departments } = makeFakePrisma();
    await seedInventoryTiendas(prisma, {
      agrisas: [],
      tiendas: [],
      tlaxiaco: [
        tlaxiacoRow({ tlaxiacoRawCode: 7, name: "ALIETTE DOSIS 500GRS", departmentName: null }),
        tlaxiacoRow({ tlaxiacoRawCode: 8, name: "AMISTAR DE 100 GRS", departmentName: null }),
      ],
    });
    const sinDepartamento = departments.filter((d) => d.code === "SIN_DEPARTAMENTO");
    expect(sinDepartamento).toHaveLength(1);
    expect(products).toHaveLength(2);
    expect(products[0].departmentId).toBe(products[1].departmentId);
  });

  it("producto nuevo de tienda sin departmentName se crea con fallback en vez de omitirse", async () => {
    const { prisma, products, departments } = makeFakePrisma();
    const counters = await seedInventoryTiendas(prisma, {
      agrisas: [],
      tiendas: [tiendaRow({ code: "NEW1", name: "PRODUCTO SIN DEPTO", departmentName: null })],
      tlaxiaco: [],
    });
    expect(products).toHaveLength(1);
    expect(departments.find((d) => d.code === "SIN_DEPARTAMENTO")).toBeDefined();
    expect(products[0].departmentId).toBe(departments.find((d) => d.code === "SIN_DEPARTAMENTO")?.id);
    expect(counters.branchFallbackDepartment).toBe(1);
    expect(counters.errors).toHaveLength(0);
  });

  it("producto existente de tienda sin departmentName en la fila conserva su departmentId actual", async () => {
    const { prisma, products } = makeFakePrisma({
      products: [
        { id: "p1", code: "AK1", name: "ALGAK 1L", unit: "H87", satProductCode: null, departmentId: "dept-original", ivaRate: 0, iepsRate: 0 },
      ],
    });
    const counters = await seedInventoryTiendas(prisma, {
      agrisas: [],
      tiendas: [tiendaRow({ code: "AK1", name: "ALGAK 1L", departmentName: null })],
      tlaxiaco: [],
    });
    expect(products[0].departmentId).toBe("dept-original");
    expect(counters.branchFallbackDepartment).toBe(0);
  });

  it("Tlaxiaco matchea contra un producto creado en la misma corrida por otra tienda (orden determinístico)", async () => {
    const { prisma, products } = makeFakePrisma();
    const counters = await seedInventoryTiendas(prisma, {
      agrisas: [],
      tiendas: [tiendaRow({ code: "AK1", name: "ALGAK 1L", branchCode: "CHICHICAPAM" })],
      tlaxiaco: [tlaxiacoRow({ name: "ALGAK DE 1L" })],
    });
    expect(products).toHaveLength(1); // Tlaxiaco no auto-crea un duplicado
    expect(products[0].code).toBe("AK1");
    expect(counters.tlaxiacoMatched).toBe(1);
    expect(counters.tlaxiacoCreated).toBe(0);
  });
});
