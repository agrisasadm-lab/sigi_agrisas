/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";

jest.mock("next/link", () => {
  const Link = ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  );
  Link.displayName = "Link";
  return Link;
});

jest.mock("../../../../../../app/_hooks/useCurrentUser");
jest.mock("../../../../../../app/(private)/payments/_logic/hooks/usePaymentsHistory");
jest.mock("../../../../../../app/_hooks/useBranchesOptions", () => ({
  useBranchesOptions: () => ({ options: [] }),
}));
jest.mock("../../../../../../app/_hooks/usePaymentMethodsOptions", () => ({
  usePaymentMethodsOptions: () => ({ options: [], isLoading: false, refresh: jest.fn() }),
}));
jest.mock("../../../../../../app/(private)/payments/_logic/hooks/useCashiersOptions", () => ({
  useCashiersOptions: () => ({ options: [], isLoading: false, refresh: jest.fn() }),
}));
jest.mock("../../../../../../app/(private)/payments/_logic/hooks/useCustomerSearch", () => ({
  useCustomerSearch: () => ({ items: [], total: 0, isLoading: false, error: null, refresh: jest.fn() }),
}));
jest.mock("../../../../../../app/(private)/payments/_logic/hooks/useProductSearch", () => ({
  useProductSearch: () => ({ items: [], total: 0, isLoading: false, error: null, refresh: jest.fn() }),
}));
jest.mock("../../../../../../app/(private)/catalogs/_blocks/CatalogPagination", () => ({
  CatalogPagination: () => <div data-testid="pagination" />,
}));

import { useCurrentUser } from "../../../../../../app/_hooks/useCurrentUser";
import { usePaymentsHistory } from "../../../../../../app/(private)/payments/_logic/hooks/usePaymentsHistory";
import { PaymentsHistoryPage } from "../../../../../../app/(private)/payments/_blocks/PaymentsHistoryPage";

const mockUseCurrentUser = useCurrentUser as jest.MockedFunction<typeof useCurrentUser>;
const mockUsePaymentsHistory = usePaymentsHistory as jest.MockedFunction<typeof usePaymentsHistory>;

function setupUser(canReport: boolean | "loading", isBypass = false) {
  mockUseCurrentUser.mockReturnValue({
    userId: "u1",
    email: "test@test.com",
    roles: [],
    branchId: "b1",
    isLoading: false,
    can: jest.fn((perm: string) => {
      if (perm === "payments:report_read") return canReport;
      if (perm === "branches:access_all") return isBypass;
      return false;
    }),
    refresh: jest.fn(),
  });
}

const ITEM = {
  id: "pay-1",
  saleId: "s1",
  saleFolioCode: "VNT-000001",
  customerId: "c1",
  customerName: "Cliente A",
  userId: "u1",
  userName: "Cobrador",
  branchId: "b1",
  branchName: "Central",
  paymentMethodCode: "EFECTIVO",
  folioCode: "RB-000001",
  amount: 300,
  status: "completed" as const,
  createdAt: "2026-06-01T10:00:00Z",
  saleTotal: "1000.0000",
  salePaidAmount: "300.0000",
  salePaymentStatus: "partial" as const,
  saleDueAmount: "700.0000",
};

function setupHistory(overrides: Partial<ReturnType<typeof usePaymentsHistory>> = {}) {
  mockUsePaymentsHistory.mockReturnValue({
    report: {
      items: [ITEM],
      totals: {
        rowCount: 5,
        completedCount: 4,
        cancelledCount: 1,
        totalAmountCompleted: "1200.0000",
        totalAmountCancelled: "50.0000",
      },
      page: 1,
      pageSize: 50,
      total: 5,
    },
    isLoading: false,
    error: null,
    isExporting: false,
    exportError: null,
    refresh: jest.fn(),
    exportPdf: jest.fn(),
    exportXlsx: jest.fn(),
    ...overrides,
  });
}

describe("PaymentsHistoryPage", () => {
  beforeEach(() => jest.clearAllMocks());

  it("muestra 'Sin acceso' cuando canReport=false", () => {
    setupUser(false);
    setupHistory();
    render(<PaymentsHistoryPage />);
    expect(screen.getByText("Sin acceso")).toBeInTheDocument();
  });

  it("muestra el pie de totales con valores correctos, sin NaN (Historia #4)", () => {
    setupUser(true);
    setupHistory();
    render(<PaymentsHistoryPage />);
    expect(screen.getByText(/Total registros: 5/)).toBeInTheDocument();
    expect(screen.getByText(/4 completados \/ 1 cancelados/)).toBeInTheDocument();
    expect(screen.queryByText(/NaN/)).not.toBeInTheDocument();
  });

  it("alterna a vista agrupada al hacer click en el toggle (Historia #2)", () => {
    setupUser(true);
    setupHistory();
    render(<PaymentsHistoryPage />);
    fireEvent.click(screen.getByRole("tab", { name: "Vista agrupada" }));
    expect(screen.getByText("VNT-000001")).toBeInTheDocument();
  });

  it("invoca exportXlsx al hacer click en 'Exportar Excel'", () => {
    setupUser(true);
    const exportXlsx = jest.fn().mockResolvedValue(undefined);
    setupHistory({ exportXlsx });
    render(<PaymentsHistoryPage />);
    fireEvent.click(screen.getByRole("button", { name: /Exportar Excel/i }));
    expect(exportXlsx).toHaveBeenCalled();
  });

  it("invoca exportPdf al hacer click en 'Descargar PDF'", () => {
    setupUser(true);
    const exportPdf = jest.fn().mockResolvedValue(undefined);
    setupHistory({ exportPdf });
    render(<PaymentsHistoryPage />);
    fireEvent.click(screen.getByRole("button", { name: /Descargar PDF/i }));
    expect(exportPdf).toHaveBeenCalled();
  });

  it("muestra 'Sin resultados' y el pie de totales en 0 / $0.00 cuando no hay registros", () => {
    setupUser(true);
    setupHistory({
      report: {
        items: [],
        totals: {
          rowCount: 0,
          completedCount: 0,
          cancelledCount: 0,
          totalAmountCompleted: "0.0000",
          totalAmountCancelled: "0.0000",
        },
        page: 1,
        pageSize: 50,
        total: 0,
      },
    });
    render(<PaymentsHistoryPage />);
    expect(screen.getByText("Sin resultados")).toBeInTheDocument();
    expect(screen.getByText(/Total registros: 0/)).toBeInTheDocument();
    expect(screen.getByText(/0 completados \/ 0 cancelados/)).toBeInTheDocument();
    expect(screen.getAllByText(/\$0\.00/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/NaN/)).not.toBeInTheDocument();
  });
});
