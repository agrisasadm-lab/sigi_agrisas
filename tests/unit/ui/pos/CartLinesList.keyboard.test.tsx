/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CartLinesList } from "../../../../app/(private)/pos/_blocks/CartLinesList";
import type { CartLine } from "../../../../app/(private)/pos/_logic/types/domain";

const makeLine = (n: number): CartLine => ({
  id: `line-${n}`,
  productId: `prod-${n}`,
  productCode: `P00${n}`,
  productName: `Producto ${n}`,
  productPriceId: `price-${n}`,
  priceName: "Normal",
  unitPrice: 100,
  quantity: 2,
  discountType: "pct",
  discountPct: 0,
  discountAmount: 0,
  ivaRate: 0.16,
  iepsRate: 0,
  lineSubtotal: 200,
  lineIva: 32,
  lineIeps: 0,
  lineTotal: 232,
});

const lines = [makeLine(1), makeLine(2), makeLine(3)];

describe("CartLinesList keyboard navigation", () => {
  it("renders cart lines", () => {
    render(
      <CartLinesList
        lines={lines}
        onUpdateQuantity={jest.fn()} onUpdateDiscount={jest.fn()} onUpdateDiscountAmount={jest.fn()}
        onChangeTier={jest.fn()} onRemove={jest.fn()}
      />
    );
    expect(screen.getByText("Producto 1")).toBeInTheDocument();
    expect(screen.getByText("Producto 3")).toBeInTheDocument();
  });

  it("shows empty message when no lines", () => {
    render(
      <CartLinesList
        lines={[]}
        onUpdateQuantity={jest.fn()} onUpdateDiscount={jest.fn()} onUpdateDiscountAmount={jest.fn()}
        onChangeTier={jest.fn()} onRemove={jest.fn()}
      />
    );
    expect(screen.getByText(/vacío/i)).toBeInTheDocument();
  });

  it("calls onRemove when remove button clicked", async () => {
    const onRemove = jest.fn();
    const user = userEvent.setup();
    render(
      <CartLinesList
        lines={lines}
        onUpdateQuantity={jest.fn()} onUpdateDiscount={jest.fn()} onUpdateDiscountAmount={jest.fn()}
        onChangeTier={jest.fn()} onRemove={onRemove}
      />
    );
    const closeButtons = screen.getAllByRole("button", { name: /quitar/i });
    await user.click(closeButtons[0]);
    expect(onRemove).toHaveBeenCalledWith("line-1");
  });

  it("Delete key on line div calls onRemove", () => {
    const onRemove = jest.fn();
    const { container } = render(
      <CartLinesList
        lines={lines}
        onUpdateQuantity={jest.fn()} onUpdateDiscount={jest.fn()} onUpdateDiscountAmount={jest.fn()}
        onChangeTier={jest.fn()} onRemove={onRemove}
      />
    );
    const lineDivs = container.querySelectorAll("[aria-keyshortcuts]");
    const firstDiv = lineDivs[0] as HTMLElement;
    act(() => { firstDiv.dispatchEvent(new KeyboardEvent("keydown", { key: "Delete", bubbles: true })); });
    expect(onRemove).toHaveBeenCalledWith("line-1");
  });

  it("+ key on line div calls onUpdateQuantity(id, qty+1)", () => {
    const onUpdateQuantity = jest.fn();
    const { container } = render(
      <CartLinesList
        lines={lines}
        onUpdateQuantity={onUpdateQuantity} onUpdateDiscount={jest.fn()} onUpdateDiscountAmount={jest.fn()}
        onChangeTier={jest.fn()} onRemove={jest.fn()}
      />
    );
    const lineDivs = container.querySelectorAll("[aria-keyshortcuts]");
    const firstDiv = lineDivs[0] as HTMLElement;
    act(() => { firstDiv.dispatchEvent(new KeyboardEvent("keydown", { key: "+", bubbles: true })); });
    expect(onUpdateQuantity).toHaveBeenCalledWith("line-1", 3);
  });
});
