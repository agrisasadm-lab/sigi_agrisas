/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SaleConfirmedModal } from "../../../../app/(private)/pos/_blocks/SaleConfirmedModal";
import type { SaleDetailDto } from "../../../../app/(private)/pos/_logic/types/api";

const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

HTMLDialogElement.prototype.showModal = jest.fn(function (this: HTMLDialogElement) {
  this.setAttribute("open", "");
});
HTMLDialogElement.prototype.close = jest.fn(function (this: HTMLDialogElement) {
  this.removeAttribute("open");
});

const stubSale: SaleDetailDto = {
  id: "s1",
  branchId: "b1",
  cashierId: "u1",
  folioId: "f1",
  folioNumber: 42,
  folioPrefix: "TK",
  paymentMethodId: "pm1",
  status: "completed",
  subtotal: 100,
  taxTotal: 16,
  total: 116,
  items: [
    {
      id: "si1",
      productId: "p1",
      productCodeSnapshot: "P001",
      productNameSnapshot: "Prod",
      productPriceId: "pr1",
      priceNameSnapshot: "Normal",
      quantity: 1,
      unitPrice: 100,
      discountPct: 0,
      discountAmount: 0,
      ivaRate: 0.16,
      iepsRate: 0,
      lineSubtotal: 100,
      lineIva: 16,
      lineIeps: 0,
      lineTotal: 116,
    },
  ],
  createdAt: "2026-06-15T00:00:00Z",
  updatedAt: "2026-06-15T00:00:00Z",
};

describe("SaleConfirmedModal", () => {
  beforeEach(() => {
    mockPush.mockReset();
  });

  it("renders folio label", () => {
    render(<SaleConfirmedModal sale={stubSale} onNewSale={jest.fn()} />);
    expect(screen.getByText(/TK-42/)).toBeInTheDocument();
  });

  it("renders folio number only when no prefix", () => {
    render(
      <SaleConfirmedModal
        sale={{ ...stubSale, folioPrefix: null }}
        onNewSale={jest.fn()}
      />
    );
    expect(screen.getByText("42")).toBeInTheDocument();
  });

  it("shows Esc/Enter hint", () => {
    render(<SaleConfirmedModal sale={stubSale} onNewSale={jest.fn()} />);
    expect(screen.getByText(/Esc o Enter para nueva venta/i)).toBeInTheDocument();
  });

  it("calls onNewSale when 'Nueva venta' button clicked", async () => {
    const onNewSale = jest.fn();
    const user = userEvent.setup();
    render(<SaleConfirmedModal sale={stubSale} onNewSale={onNewSale} />);
    await user.click(screen.getByText("Nueva venta"));
    expect(onNewSale).toHaveBeenCalled();
  });

  it("navigates to sale detail when 'Ver ticket' clicked", async () => {
    const user = userEvent.setup();
    render(<SaleConfirmedModal sale={stubSale} onNewSale={jest.fn()} />);
    await user.click(screen.getByText("Ver ticket"));
    expect(mockPush).toHaveBeenCalledWith("/sales/s1");
  });

  it("Enter key invokes onNewSale", () => {
    const onNewSale = jest.fn();
    render(<SaleConfirmedModal sale={stubSale} onNewSale={onNewSale} />);
    const dialog = document.querySelector("dialog")!;
    fireEvent.keyDown(dialog, { key: "Enter", code: "Enter" });
    expect(onNewSale).toHaveBeenCalled();
  });

  it("Esc fires onNewSale via cancel event", () => {
    const onNewSale = jest.fn();
    render(<SaleConfirmedModal sale={stubSale} onNewSale={onNewSale} />);
    const dialog = document.querySelector("dialog")!;
    const cancelEvent = new Event("cancel", { cancelable: true });
    dialog.dispatchEvent(cancelEvent);
    expect(onNewSale).toHaveBeenCalled();
  });

  it("auto-focuses 'Nueva venta' button on mount", () => {
    render(<SaleConfirmedModal sale={stubSale} onNewSale={jest.fn()} />);
    expect(screen.getByText("Nueva venta")).toHaveFocus();
  });
});
