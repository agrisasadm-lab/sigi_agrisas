/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen } from "@testing-library/react";

jest.mock("../../../../../../app/_components/atoms/Spinner/Spinner", () => ({
  Spinner: () => <span data-testid="spinner" />,
}));
jest.mock("../../../../../../app/(private)/pos/_blocks/CartLinesList", () => ({
  CartLinesList: () => <div data-testid="cart-lines" />,
}));
jest.mock("../../../../../../app/(private)/pos/_blocks/CartTotals", () => ({
  CartTotals: () => <div data-testid="cart-totals" />,
}));
jest.mock("../../../../../../app/(private)/pos/_blocks/CustomerPicker", () => ({
  CustomerPicker: () => <div data-testid="customer-picker" />,
}));

import { QuoteEmitPanel } from "../../../../../../app/(private)/quotes/_blocks/QuoteEmitPanel";

const baseProps = {
  mode: "create" as const,
  lines: [
    {
      id: "line-1",
      productId: "p1",
      productCode: "P1",
      productName: "Producto 1",
      productPriceId: "price-1",
      quantity: 1,
      unitPrice: 100,
      discountPct: 0,
      ivaRate: 0.16,
      iepsRate: 0,
      lineSubtotal: 100,
      lineIva: 16,
      lineIeps: 0,
    },
  ] as never,
  totals: { subtotal: 100, taxTotal: 16, total: 116 } as never,
  folios: [],
  branches: [],
  selectedFolioId: "folio-1",
  selectedBranchId: "branch-1",
  selectedCustomerId: "",
  expiresAt: "",
  notes: "",
  isLoadingOptions: false,
  isSubmitting: false,
  canSubmitCreate: true as const,
  onFolioChange: jest.fn(),
  onBranchChange: jest.fn(),
  onCustomerChange: jest.fn(),
  onExpiresAtChange: jest.fn(),
  onNotesChange: jest.fn(),
  onOpenQuickAdd: jest.fn(),
  onUpdateQuantity: jest.fn(),
  onUpdateDiscount: jest.fn(),
  onUpdateDiscountAmount: jest.fn(),
  onChangeTier: jest.fn(),
  onRemoveLine: jest.fn(),
  onSubmit: jest.fn(),
};

describe("QuoteEmitPanel — gating offline", () => {
  it("botón habilitado cuando offlineBlocked no se pasa (default false)", () => {
    render(<QuoteEmitPanel {...baseProps} />);
    expect(screen.getByRole("button", { name: "Crear cotización" })).not.toBeDisabled();
  });

  it("botón deshabilitado cuando offlineBlocked=true", () => {
    render(<QuoteEmitPanel {...baseProps} offlineBlocked={true} />);
    expect(screen.getByRole("button", { name: "Crear cotización" })).toBeDisabled();
  });
});
