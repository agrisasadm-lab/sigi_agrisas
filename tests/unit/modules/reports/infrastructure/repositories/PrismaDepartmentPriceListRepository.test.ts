import type { PrismaClient } from "@prisma/client";
import { PrismaDepartmentPriceListRepository } from "@/modules/reports/infrastructure/repositories/PrismaDepartmentPriceListRepository";

function fakePrisma(hqId: string | null) {
  const queryRaw = jest.fn().mockResolvedValue([]);
  const prisma = {
    branch: { findFirst: jest.fn().mockResolvedValue(hqId ? { id: hqId } : null) },
    product: { findMany: jest.fn().mockResolvedValue([]) },
    $queryRaw: queryRaw,
  };
  return { prisma: prisma as unknown as PrismaClient, queryRaw };
}

describe("PrismaDepartmentPriceListRepository — stock no se mezcla entre sucursales", () => {
  it("sin branchId cae al fallback de sucursal matriz, no suma todas las sucursales", async () => {
    const { prisma, queryRaw } = fakePrisma("hq-branch-id");

    await new PrismaDepartmentPriceListRepository(prisma).findRows({
      branchId: null,
      departmentId: null,
    });

    const fragment = queryRaw.mock.calls[0][1] as { sql: string; values: unknown[] };
    expect(fragment.sql).toBe("branch_id = ?");
    expect(fragment.values).toEqual(["hq-branch-id"]);
  });

  it("sin branchId y sin sucursal matriz configurada, no suma todas las sucursales (fallback a ninguna fila, como ya hacen los precios)", async () => {
    const { prisma, queryRaw } = fakePrisma(null);

    await new PrismaDepartmentPriceListRepository(prisma).findRows({
      branchId: null,
      departmentId: null,
    });

    const fragment = queryRaw.mock.calls[0][1] as { sql: string; values: unknown[] };
    expect(fragment.sql).toBe("FALSE");
  });

  it("con branchId explícito, filtra exactamente por esa sucursal (sin regresión)", async () => {
    const { prisma, queryRaw } = fakePrisma("hq-branch-id");

    await new PrismaDepartmentPriceListRepository(prisma).findRows({
      branchId: "b2",
      departmentId: null,
    });

    const fragment = queryRaw.mock.calls[0][1] as { sql: string; values: unknown[] };
    expect(fragment.sql).toBe("branch_id = ?");
    expect(fragment.values).toEqual(["b2"]);
  });
});
