import type { PrismaClient } from "@prisma/client";
import { PrismaSalesCutRepository } from "@/modules/reports/infrastructure/repositories/PrismaSalesCutRepository";

const emptyAgg = () => ({ _sum: {}, _count: { _all: 0 } });

function fakePrisma(expenseSum: string | null = null, expenseCount = 0) {
  const expenseAggregate = jest.fn().mockResolvedValue({
    _sum: { amount: expenseSum },
    _count: { _all: expenseCount },
  });
  const prisma = {
    sale: {
      aggregate: jest.fn().mockResolvedValue(emptyAgg()),
      groupBy: jest.fn().mockResolvedValue([]),
      findMany: jest.fn().mockResolvedValue([]),
    },
    customerPayment: { aggregate: jest.fn().mockResolvedValue(emptyAgg()) },
    return: { aggregate: jest.fn().mockResolvedValue(emptyAgg()) },
    expense: { aggregate: expenseAggregate },
    paymentMethod: { findMany: jest.fn().mockResolvedValue([]) },
    user: { findMany: jest.fn().mockResolvedValue([]) },
    branch: { findMany: jest.fn().mockResolvedValue([]) },
    $queryRaw: jest.fn().mockResolvedValue([]),
  };
  return { prisma: prisma as unknown as PrismaClient, expenseAggregate };
}

const FROM = new Date("2026-07-01T00:00:00.000Z");
const TO = new Date("2026-07-31T00:00:00.000Z");

describe("PrismaSalesCutRepository — gastos", () => {
  it("agrega sólo gastos activos de la sucursal y el rango, sin cajero ni método de pago", async () => {
    const { prisma, expenseAggregate } = fakePrisma("75.5000", 2);

    const agg = await new PrismaSalesCutRepository(prisma).getAggregates({
      branchId: "b1",
      cashierId: "c1",
      paymentMethodId: "pm1",
      from: FROM,
      to: TO,
    });

    expect(expenseAggregate).toHaveBeenCalledTimes(1);
    expect(expenseAggregate.mock.calls[0][0].where).toEqual({
      isActive: true,
      expenseDate: { gte: FROM, lte: TO },
      branchId: "b1",
    });
    expect(agg.expenses).toEqual({ count: 2, total: 75.5 });
  });

  it("sin sucursal no filtra por branchId; sin gastos devuelve 0", async () => {
    const { prisma, expenseAggregate } = fakePrisma();

    const agg = await new PrismaSalesCutRepository(prisma).getAggregates({
      branchId: null,
      cashierId: null,
      paymentMethodId: null,
      from: FROM,
      to: TO,
    });

    expect(expenseAggregate.mock.calls[0][0].where).toEqual({
      isActive: true,
      expenseDate: { gte: FROM, lte: TO },
    });
    expect(agg.expenses).toEqual({ count: 0, total: 0 });
  });
});
