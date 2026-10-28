import { GetSalesCutReportUseCase } from "@/modules/reports/application/use-cases/GetSalesCutReportUseCase";
import {
  InMemorySalesCutRepository,
  InMemCutSale,
  InMemCutPayment,
  InMemCutReturn,
  InMemCutExpense,
} from "@/modules/reports/infrastructure/repositories/InMemorySalesCutRepository";

const GEN = { userId: "u1", email: "op@test.com" };
const FROM = new Date("2026-07-01T00:00:00.000Z");
const TO = new Date("2026-07-31T00:00:00.000Z");

function sale(over: Partial<InMemCutSale> = {}): InMemCutSale {
  return {
    id: "s1", status: "completed", total: 116, subtotal: 100, taxTotal: 16, iva: 16, ieps: 0,
    branchId: "b1", branchName: "Matriz", cashierId: "c1", cashierName: "Ana",
    paymentMethodId: "pm1", paymentMethodName: "Efectivo",
    createdAt: new Date("2026-07-05T10:00:00.000Z"), ...over,
  };
}

function base(
  sales: InMemCutSale[],
  payments: InMemCutPayment[] = [],
  returns: InMemCutReturn[] = [],
  expenses: InMemCutExpense[] = []
) {
  return new GetSalesCutReportUseCase(new InMemorySalesCutRepository(sales, payments, returns, expenses));
}

function expense(over: Partial<InMemCutExpense> = {}): InMemCutExpense {
  return { amount: 50, isActive: true, branchId: "b1", expenseDate: new Date("2026-07-08T00:00:00.000Z"), ...over };
}

const req = (over = {}) => ({
  branchId: null, cashierId: null, paymentMethodId: null, from: FROM, to: TO, generatedBy: GEN, ...over,
});

describe("GetSalesCutReportUseCase", () => {
  it("periodo vacío → ceros y arrays vacíos", async () => {
    const dto = await base([]).execute(req());
    expect(dto.totals.grossSales).toBe("0.0000");
    expect(dto.totals.ticketCount).toBe(0);
    expect(dto.cash.netCash).toBe("0.0000");
    expect(dto.byPaymentMethod).toHaveLength(0);
    expect(dto.byDay).toHaveLength(0);
  });

  it("neto de caja = ventas + abonos − devoluciones", async () => {
    const dto = await base(
      [sale({ total: 500 })],
      [{ amount: 200, status: "completed", branchId: "b1", createdAt: new Date("2026-07-06T10:00:00Z") }],
      [{ refundTotal: 100, status: "completed", branchId: "b1", returnedAt: new Date("2026-07-07T10:00:00Z") }]
    ).execute(req());
    expect(dto.cash.grossSales).toBe("500.0000");
    expect(dto.cash.paymentsReceived).toBe("200.0000");
    expect(dto.cash.returnsRefunded).toBe("100.0000");
    expect(dto.cash.netCash).toBe("600.0000");
  });

  it("neto de caja resta los gastos activos de la sucursal", async () => {
    const dto = await base(
      [sale({ total: 500 })],
      [{ amount: 200, status: "completed", branchId: "b1", createdAt: new Date("2026-07-06T10:00:00Z") }],
      [{ refundTotal: 100, status: "completed", branchId: "b1", returnedAt: new Date("2026-07-07T10:00:00Z") }],
      [expense({ amount: 50 }), expense({ amount: 25.5 })]
    ).execute(req({ branchId: "b1" }));
    expect(dto.cash.expensesTotal).toBe("75.5000");
    expect(dto.cash.netCash).toBe("524.5000"); // 500 + 200 − 100 − 75.5
  });

  it("gastos inactivos, de otra sucursal o fuera de rango no restan", async () => {
    const dto = await base(
      [sale({ total: 500 })],
      [],
      [],
      [
        expense({ isActive: false }),
        expense({ branchId: "b2" }),
        expense({ expenseDate: new Date("2026-06-30T00:00:00.000Z") }),
        expense({ expenseDate: new Date("2026-08-01T00:00:00.000Z") }),
      ]
    ).execute(req({ branchId: "b1" }));
    expect(dto.cash.expensesTotal).toBe("0.0000");
    expect(dto.cash.netCash).toBe("500.0000");
  });

  it("sin gastos, expensesTotal es 0 y el neto no cambia", async () => {
    const dto = await base([sale({ total: 300 })]).execute(req());
    expect(dto.cash.expensesTotal).toBe("0.0000");
    expect(dto.cash.netCash).toBe("300.0000");
  });

  it("filtros de cajero/método no excluyen gastos de la sucursal", async () => {
    const dto = await base(
      [sale({ id: "a", cashierId: "c1", total: 100 }), sale({ id: "b", cashierId: "c2", total: 200 })],
      [],
      [],
      [expense({ amount: 30 })]
    ).execute(req({ cashierId: "c1", paymentMethodId: "pm1" }));
    expect(dto.cash.expensesTotal).toBe("30.0000");
    expect(dto.cash.netCash).toBe("70.0000"); // 100 − 30
  });

  it("canceladas aparte; abonos/devoluciones cancelados no cuentan", async () => {
    const dto = await base(
      [sale({ total: 300 }), sale({ id: "s2", status: "cancelled", total: 999 })],
      [{ amount: 50, status: "cancelled", branchId: "b1", createdAt: new Date("2026-07-06T10:00:00Z") }],
      [{ refundTotal: 30, status: "cancelled", branchId: "b1", returnedAt: new Date("2026-07-07T10:00:00Z") }]
    ).execute(req());
    expect(dto.totals.grossSales).toBe("300.0000");
    expect(dto.cancelled).toEqual({ count: 1, total: "999.0000" });
    expect(dto.cash.paymentsReceived).toBe("0.0000");
    expect(dto.cash.returnsRefunded).toBe("0.0000");
    expect(dto.cash.netCash).toBe("300.0000");
  });

  it("filtro por cajero acota los agregados", async () => {
    const dto = await base([
      sale({ id: "a", cashierId: "c1", total: 100 }),
      sale({ id: "b", cashierId: "c2", total: 200 }),
    ]).execute(req({ cashierId: "c1" }));
    expect(dto.totals.grossSales).toBe("100.0000");
    expect(dto.byCashier).toHaveLength(1);
  });

  it("byDepartment y byProduct suman piezas del mismo producto en varios tickets, canceladas no cuentan", async () => {
    const item = {
      productId: "prod1",
      productCode: "PROD1",
      productName: "Fertilizante",
      departmentId: "dept1",
      departmentName: "FERTILIZANTES",
      quantity: 2,
      subtotal: 100,
      taxTotal: 16,
      total: 116,
    };
    const dto = await base([
      sale({ id: "s1", total: 116, items: [item] }),
      sale({ id: "s2", total: 116, items: [item] }),
      sale({ id: "s3", status: "cancelled", total: 999, items: [{ ...item, quantity: 99 }] }),
    ]).execute(req());

    expect(dto.byDepartment).toHaveLength(1);
    expect(dto.byDepartment[0].label).toBe("FERTILIZANTES");
    expect(dto.byDepartment[0].ticketCount).toBe(2);
    expect(dto.byDepartment[0].total).toBe("232.0000");

    expect(dto.byProduct).toHaveLength(1);
    expect(dto.byProduct[0].label).toBe("Fertilizante (PROD1)");
    expect(dto.byProduct[0].quantitySold).toBe("4.0000");
    expect(dto.byProduct[0].total).toBe("232.0000");
  });
});
