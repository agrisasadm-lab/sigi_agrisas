/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen } from "@testing-library/react";

jest.mock("../../../../../../app/_hooks/useCurrentUser");
jest.mock("../../../../../../app/_hooks/useBranchesOptions");
jest.mock("../../../../../../app/_hooks/usePaymentMethodsOptions");
jest.mock("../../../../../../app/(private)/reports/sales-cut/_logic/hooks/useCashiersOptions");
jest.mock("../../../../../../app/(private)/reports/sales-cut/_logic/hooks/useSalesCut");

import { useCurrentUser } from "../../../../../../app/_hooks/useCurrentUser";
import { useBranchesOptions } from "../../../../../../app/_hooks/useBranchesOptions";
import { usePaymentMethodsOptions } from "../../../../../../app/_hooks/usePaymentMethodsOptions";
import { useCashiersOptions } from "../../../../../../app/(private)/reports/sales-cut/_logic/hooks/useCashiersOptions";
import { useSalesCut } from "../../../../../../app/(private)/reports/sales-cut/_logic/hooks/useSalesCut";
import { SalesCutPage } from "../../../../../../app/(private)/reports/sales-cut/_blocks/SalesCutPage";

const mockUseCurrentUser = useCurrentUser as jest.MockedFunction<typeof useCurrentUser>;
const mockUseBranchesOptions = useBranchesOptions as jest.MockedFunction<typeof useBranchesOptions>;
const mockUsePaymentMethodsOptions = usePaymentMethodsOptions as jest.MockedFunction<typeof usePaymentMethodsOptions>;
const mockUseCashiersOptions = useCashiersOptions as jest.MockedFunction<typeof useCashiersOptions>;
const mockUseSalesCut = useSalesCut as jest.MockedFunction<typeof useSalesCut>;

function row(label: string, extra: Record<string, string> = {}) {
  return { key: label, label, ticketCount: 1, subtotal: "100.0000", taxTotal: "16.0000", total: "116.0000", ...extra };
}

describe("SalesCutPage — desgloses por departamento y producto", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseCurrentUser.mockReturnValue({
      userId: "u1", email: "admin@test.com", roles: ["admin"], branchId: null,
      isLoading: false, can: () => true, refresh: jest.fn(),
    });
    mockUseBranchesOptions.mockReturnValue({ options: [], isLoading: false });
    mockUsePaymentMethodsOptions.mockReturnValue({ options: [], isLoading: false, refresh: jest.fn() });
    mockUseCashiersOptions.mockReturnValue({ options: [], isLoading: false, refresh: jest.fn() });
  });

  it("renderiza las tablas Por departamento y Por producto con datos", () => {
    mockUseSalesCut.mockReturnValue({
      report: {
        generatedAt: "2026-08-02T00:00:00.000Z",
        generatedBy: { userId: "u1", email: "admin@test.com" },
        filters: { branchId: null, cashierId: null, paymentMethodId: null, from: "2026-08-02", to: "2026-08-02" },
        totals: { grossSales: "116.0000", ticketCount: 1, subtotal: "100.0000", taxTotal: "16.0000", ivaTotal: "16.0000", iepsTotal: "0.0000" },
        cancelled: { count: 0, total: "0.0000" },
        cash: { grossSales: "116.0000", paymentsReceived: "0.0000", returnsRefunded: "0.0000", expensesTotal: "20.0000", netCash: "96.0000" },
        byPaymentMethod: [row("Efectivo")],
        byDay: [row("2026-08-02")],
        byCashier: [row("Admin")],
        byBranch: [row("Matriz")],
        byDepartment: [row("FERTILIZANTES")],
        byProduct: [row("Fertilizante (F1)", { quantitySold: "4.0000" })],
        salesList: [
          { saleId: "sale-1", folioCode: "TK-000001", customerName: "Cliente Uno", total: "116.0000", paymentMethodName: "Efectivo" },
        ],
      },
      isLoading: false,
      error: null,
      isExporting: false,
      isExportingXlsx: false,
      exportError: null,
      refresh: jest.fn(),
      exportPdf: jest.fn(),
      exportXlsx: jest.fn(),
    });

    render(<SalesCutPage />);

    expect(screen.getByText("Por departamento")).toBeInTheDocument();
    expect(screen.getByText("FERTILIZANTES")).toBeInTheDocument();
    expect(screen.getByText("Por producto")).toBeInTheDocument();
    expect(screen.getByText("Fertilizante (F1)")).toBeInTheDocument();
    expect(screen.getByText("Piezas")).toBeInTheDocument();
  });

  it("NetCashCard muestra la línea '− Gastos' antes del neto", () => {
    mockUseSalesCut.mockReturnValue({
      report: {
        generatedAt: "2026-08-02T00:00:00.000Z",
        generatedBy: { userId: "u1", email: "admin@test.com" },
        filters: { branchId: null, cashierId: null, paymentMethodId: null, from: "2026-08-02", to: "2026-08-02" },
        totals: { grossSales: "116.0000", ticketCount: 1, subtotal: "100.0000", taxTotal: "16.0000", ivaTotal: "16.0000", iepsTotal: "0.0000" },
        cancelled: { count: 0, total: "0.0000" },
        cash: { grossSales: "116.0000", paymentsReceived: "0.0000", returnsRefunded: "0.0000", expensesTotal: "20.0000", netCash: "96.0000" },
        byPaymentMethod: [], byDay: [], byCashier: [], byBranch: [], byDepartment: [], byProduct: [], salesList: [],
      },
      isLoading: false,
      error: null,
      isExporting: false,
      isExportingXlsx: false,
      exportError: null,
      refresh: jest.fn(),
      exportPdf: jest.fn(),
      exportXlsx: jest.fn(),
    });

    render(<SalesCutPage />);

    expect(screen.getByText("− Gastos")).toBeInTheDocument();
  });
});
