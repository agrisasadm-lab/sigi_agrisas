/**
 * @jest-environment jsdom
 */
// Integration: real useCreateReturnForm + computeReturnTotalsClient + ReturnLineRow + CreateReturnFooter.
// Covers spec returns-ui scenario "Real-time refund total preview".
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";

jest.mock("next/link", () => {
  const Link = ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  );
  Link.displayName = "Link";
  return Link;
});

jest.mock("next/navigation", () => ({
  useRouter: jest.fn(() => ({ push: jest.fn() })),
}));

jest.mock("../../../../../../../../../app/_hooks/useCurrentUser");
jest.mock("../../../../../../../../../app/(private)/sales/_logic/hooks/useSaleDetail");

import { useCurrentUser } from "../../../../../../../../../app/_hooks/useCurrentUser";
import * as useSaleDetailModule from "../../../../../../../../../app/(private)/sales/_logic/hooks/useSaleDetail";
import { CreateReturnPage } from "../../../../../../../../../app/(private)/sales/[id]/returns/new/_blocks/CreateReturnPage";
import type { SaleDetail } from "../../../../../../../../../app/(private)/sales/_logic/types/domain";

const mockUseCurrentUser = useCurrentUser as jest.MockedFunction<typeof useCurrentUser>;

const NOW = new Date("2026-06-01T10:00:00Z");

// item: unitPrice=100, ivaRate=0.16, qty=10 → qty=3 → IVA extraído del precio final (tax-inclusive):
// lineGross=300, subtotal≈258.62, tax≈41.38, total=300
const SALE: SaleDetail = {
  id: "sale-rt",
  branchId: "b1",
  cashierId: "u1",
  cashierName: "Cajero",
  folioId: "f1",
  folioCode: "VNT",
  folioNumber: 10,
  folioPrefix: "VNT",
  paymentMethodId: "pm1",
  paymentMethodName: "Efectivo",
  status: "completed",
  subtotal: 1000,
  taxTotal: 160,
  total: 1160,
  paidAmount: 1160,
  paymentStatus: "paid",
  isCredit: false,
  customerName: "Cliente",
  branchName: "Sucursal",
  notes: null,
  cancelledAt: null,
  cancellationReason: null,
  editedAt: null,
  createdAt: NOW,
  updatedAt: NOW,
  returnedQuantityBySaleItem: {},
  items: [
    {
      id: "si-rt",
      productId: "prod-1",
      productCodeSnapshot: "P001",
      productNameSnapshot: "Fertilizante",
      productPriceId: "price-1",
      priceNameSnapshot: "Base",
      quantity: 10,
      unitPrice: 100,
      discountPct: 0,
      discountAmount: 0,
      ivaRate: 0.16,
      iepsRate: 0,
      lineSubtotal: 1000,
      lineIva: 160,
      lineIeps: 0,
      lineTotal: 1160,
    },
  ],
};

describe("CreateReturnPage — real-time totals (integration)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseCurrentUser.mockReturnValue({
      userId: "u1",
      email: "test@test.com",
      roles: [],
      branchId: null,
      isLoading: false,
      can: () => true,
      refresh: jest.fn(),
    });
    jest.spyOn(useSaleDetailModule, "useSaleDetail").mockReturnValue({
      sale: SALE,
      isLoading: false,
      error: null,
      refresh: jest.fn(),
    });
  });

  it("totales se actualizan en tiempo real al ingresar cantidad", () => {
    render(<CreateReturnPage saleId="sale-rt" />);

    // Initially all quantities are 0 → submit disabled, total shows 0
    const submitBtn = screen.getByRole("button", { name: /Registrar devolución/i });
    expect(submitBtn).toBeDisabled();
    const totalLabel = screen.getByText("Total reembolso");
    expect(totalLabel.nextElementSibling?.textContent).toMatch(/\b0\b/);

    // User enters quantity=3 → total should update to 348 without a server call
    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "3" } });

    expect(submitBtn).toBeEnabled();
    expect(totalLabel.nextElementSibling?.textContent).toMatch(/300/);
  });

  it("subtotal y tax también se actualizan al ingresar cantidad", () => {
    render(<CreateReturnPage saleId="sale-rt" />);

    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "3" } });

    const subtotalLabel = screen.getByText("Subtotal reembolso");
    expect(subtotalLabel.nextElementSibling?.textContent).toMatch(/258\.6/);

    const taxLabel = screen.getByText("Impuestos");
    expect(taxLabel.nextElementSibling?.textContent).toMatch(/41\.3/);
  });

  it("botón vuelve a deshabilitarse si se borra la cantidad", () => {
    render(<CreateReturnPage saleId="sale-rt" />);

    const input = screen.getByRole("spinbutton");
    fireEvent.change(input, { target: { value: "3" } });
    expect(screen.getByRole("button", { name: /Registrar devolución/i })).toBeEnabled();

    fireEvent.change(input, { target: { value: "" } });
    expect(screen.getByRole("button", { name: /Registrar devolución/i })).toBeDisabled();
  });
});
