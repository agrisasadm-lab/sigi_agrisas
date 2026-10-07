import { createSeedContext } from "../../../../../prisma/seeds/lib/inventory/context";
import type { PrismaLike } from "../../../../../prisma/seeds/lib/inventory/types";

interface FakeDepartment {
  id: string;
  code: string;
  name: string;
}

let idSeq = 0;
function nextId(prefix: string): string {
  idSeq++;
  return `${prefix}-${idSeq}`;
}

function makeFakePrisma() {
  const departments: FakeDepartment[] = [];

  const prisma: PrismaLike = {
    branch: {
      findUnique: async ({ where }) => (where.code === "MATRIZ" ? { id: "matriz-id" } : null),
      upsert: async () => {
        throw new Error("not used in this test");
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
      findUnique: async () => null,
      findMany: async () => [],
      upsert: async () => {
        throw new Error("not used in this test");
      },
    },
    productPrice: {
      findFirst: async () => null,
      updateMany: async () => ({ count: 0 }),
      upsert: async () => {
        throw new Error("not used in this test");
      },
    },
    branchInventory: {
      upsert: async () => {
        throw new Error("not used in this test");
      },
      findMany: async () => [],
    },
  };

  return { prisma, departments };
}

describe("resolveDepartmentId — alias de departamento", () => {
  it("variantes de captura de INNOVAK resuelven al mismo departamento canónico", async () => {
    const { prisma, departments } = makeFakePrisma();
    const ctx = await createSeedContext(prisma);

    const id1 = await ctx.resolveDepartmentId("-INNOVAK");
    const id2 = await ctx.resolveDepartmentId("INNOVAK");
    const id3 = await ctx.resolveDepartmentId("INNOVAK OUT");

    expect(id1).toBe(id2);
    expect(id2).toBe(id3);
    expect(departments).toHaveLength(1);
    expect(departments[0].name).toBe("INNOVAK GLOBAL");
  });

  it("los 4 pares restantes con sufijo OUT resuelven a su departamento base", async () => {
    const { prisma, departments } = makeFakePrisma();
    const ctx = await createSeedContext(prisma);

    const agrinovaId = await ctx.resolveDepartmentId("AGRINOVA OUT");
    const keybiotecId = await ctx.resolveDepartmentId("KEY BIOTEC OUT");
    const otrasLineasId = await ctx.resolveDepartmentId("OTRAS LINEAS OUT");
    const formulabId = await ctx.resolveDepartmentId("FORMULABAGRO OUT");

    expect(departments.find((d) => d.id === agrinovaId)?.name).toBe("AGRINOVA");
    expect(departments.find((d) => d.id === keybiotecId)?.name).toBe("KEYBIOTEC");
    expect(departments.find((d) => d.id === otrasLineasId)?.name).toBe("OTRAS LINEAS");
    expect(departments.find((d) => d.id === formulabId)?.name).toBe("FORMU LAB");
  });

  it("departamento fuera del mapa de alias conserva el comportamiento actual, sin fusión", async () => {
    const { prisma, departments } = makeFakePrisma();
    const ctx = await createSeedContext(prisma);

    await ctx.resolveDepartmentId("AGROMEN AGRISAS");
    await ctx.resolveDepartmentId("AGROMEN AGROFIGUEROA");

    expect(departments).toHaveLength(2);
    expect(departments.map((d) => d.name).sort()).toEqual(["AGROMEN AGRISAS", "AGROMEN AGROFIGUEROA"].sort());
  });
});
