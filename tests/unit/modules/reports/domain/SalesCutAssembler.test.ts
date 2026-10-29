import { SalesCutAssembler } from "@/modules/reports/domain/services/SalesCutAssembler";
import {
  SalesCutAggregates,
  BreakdownRow,
  ProductBreakdownRow,
} from "@/modules/reports/domain/value-objects/SalesCutFilters";

function row(over: Partial<BreakdownRow> & { key: string }): BreakdownRow {
  return { label: over.key, ticketCount: 1, subtotal: 0, taxTotal: 0, total: 0, ...over };
}

function productRow(over: Partial<ProductBreakdownRow> & { key: string }): ProductBreakdownRow {
  return { label: over.key, ticketCount: 1, quantitySold: 0, subtotal: 0, taxTotal: 0, total: 0, ...over };
}

function agg(over: Partial<SalesCutAggregates> = {}): SalesCutAggregates {
  return {
    active: { grossSales: 1000, ticketCount: 3, subtotal: 900, taxTotal: 100 },
    cancelled: { count: 1, total: 200 },
    taxSplit: { ivaTotal: 80, iepsTotal: 20 },
    byPaymentMethod: [],
    byDay: [],
    byCashier: [],
    byBranch: [],
    byDepartment: [],
    byProduct: [],
    paymentsReceived: { count: 2, total: 300 },
    returnsRefunded: { count: 1, total: 120 },
    expenses: { count: 0, total: 0 },
    salesList: [],
    ...over,
  };
}

describe("SalesCutAssembler", () => {
  it("netCash = grossSales + paymentsReceived − returnsRefunded − expensesTotal", () => {
    const out = SalesCutAssembler.assemble(agg({ expenses: { count: 2, total: 50 } }));
    expect(out.cash.grossSales).toBe(1000);
    expect(out.cash.paymentsReceived).toBe(300);
    expect(out.cash.returnsRefunded).toBe(120);
    expect(out.cash.expensesTotal).toBe(50);
    expect(out.cash.netCash).toBe(1130); // 1000 + 300 − 120 − 50
  });

  it("sin gastos → expensesTotal 0 y neto igual al cálculo previo", () => {
    const out = SalesCutAssembler.assemble(agg());
    expect(out.cash.expensesTotal).toBe(0);
    expect(out.cash.netCash).toBe(1180); // 1000 + 300 − 120
  });

  it("canceladas se reportan aparte y no entran al neto", () => {
    const out = SalesCutAssembler.assemble(agg());
    expect(out.cancelled).toEqual({ count: 1, total: 200 });
    expect(out.totals.grossSales).toBe(1000); // sin canceladas
  });

  it("expone split IVA/IEPS global", () => {
    const out = SalesCutAssembler.assemble(agg());
    expect(out.totals.ivaTotal).toBe(80);
    expect(out.totals.iepsTotal).toBe(20);
  });

  it("ordena byDay ascendente por fecha y los demás descendente por total", () => {
    const out = SalesCutAssembler.assemble(
      agg({
        byDay: [row({ key: "2026-07-02", total: 5 }), row({ key: "2026-07-01", total: 99 })],
        byPaymentMethod: [row({ key: "a", total: 10 }), row({ key: "b", total: 90 })],
      })
    );
    expect(out.byDay.map((r) => r.key)).toEqual(["2026-07-01", "2026-07-02"]);
    expect(out.byPaymentMethod.map((r) => r.key)).toEqual(["b", "a"]);
  });

  it("ordena byDepartment y byProduct descendente por total, preservando quantitySold", () => {
    const out = SalesCutAssembler.assemble(
      agg({
        byDepartment: [row({ key: "d1", total: 10 }), row({ key: "d2", total: 90 })],
        byProduct: [
          productRow({ key: "p1", total: 10, quantitySold: 3 }),
          productRow({ key: "p2", total: 90, quantitySold: 7 }),
        ],
      })
    );
    expect(out.byDepartment.map((r) => r.key)).toEqual(["d2", "d1"]);
    expect(out.byProduct.map((r) => r.key)).toEqual(["p2", "p1"]);
    expect(out.byProduct[0].quantitySold).toBe(7);
  });

  it("sin drift en decimales", () => {
    const out = SalesCutAssembler.assemble(
      agg({
        active: { grossSales: 0.1, ticketCount: 1, subtotal: 0.1, taxTotal: 0 },
        paymentsReceived: { count: 1, total: 0.2 },
        returnsRefunded: { count: 0, total: 0 },
      })
    );
    expect(out.cash.netCash).toBe(0.3);
  });

  it("sin drift en decimales al restar gastos", () => {
    const out = SalesCutAssembler.assemble(
      agg({
        active: { grossSales: 0.3, ticketCount: 1, subtotal: 0.3, taxTotal: 0 },
        paymentsReceived: { count: 0, total: 0 },
        returnsRefunded: { count: 0, total: 0 },
        expenses: { count: 1, total: 0.1 },
      })
    );
    expect(out.cash.expensesTotal).toBe(0.1);
    expect(out.cash.netCash).toBe(0.2);
  });
});
