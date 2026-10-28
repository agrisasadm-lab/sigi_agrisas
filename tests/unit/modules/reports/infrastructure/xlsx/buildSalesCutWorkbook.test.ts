import * as XLSX from "xlsx";
import { buildSalesCutWorkbook } from "@/modules/reports/infrastructure/xlsx/buildSalesCutWorkbook";
import { SalesCutReportResponseDto } from "@/modules/reports/application/dto/SalesCutReportResponseDto";

function dto(): SalesCutReportResponseDto {
  return {
    generatedAt: "2026-07-31T00:00:00.000Z",
    generatedBy: { userId: "u1", email: "op@test.com" },
    filters: { branchId: null, cashierId: null, paymentMethodId: null, from: "2026-07-01", to: "2026-07-31" },
    totals: { grossSales: "1000.0000", ticketCount: 3, subtotal: "900.0000", taxTotal: "100.0000", ivaTotal: "80.0000", iepsTotal: "20.0000" },
    cancelled: { count: 0, total: "0.0000" },
    cash: {
      grossSales: "1000.0000",
      paymentsReceived: "300.0000",
      returnsRefunded: "120.0000",
      expensesTotal: "50.0000",
      netCash: "1130.0000",
    },
    byPaymentMethod: [],
    byDay: [],
    byCashier: [],
    byBranch: [],
    byDepartment: [],
    byProduct: [],
    salesList: [],
  };
}

describe("buildSalesCutWorkbook", () => {
  it("hoja Totales: '- Gastos' va entre Devoluciones y Neto", () => {
    const wb = XLSX.read(buildSalesCutWorkbook(dto()), { type: "buffer" });
    const rows = XLSX.utils.sheet_to_json<string[]>(wb.Sheets["Totales"], { header: 1 });
    const labels = rows.map((r) => r[0]);

    const iReturns = labels.indexOf("- Devoluciones");
    const iExpenses = labels.indexOf("- Gastos");
    const iNet = labels.indexOf("= Neto");

    expect(iExpenses).toBe(iReturns + 1);
    expect(iNet).toBe(iExpenses + 1);
    expect(rows[iExpenses][1]).toBe("50.0000");
    expect(rows[iNet][1]).toBe("1130.0000");
  });
});
