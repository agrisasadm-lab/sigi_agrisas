/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PriceTierPicker } from "../../../../app/(private)/pos/_blocks/PriceTierPicker";
import type { ProductDto, ProductPriceDto } from "../../../../app/(private)/pos/_logic/types/api";

const product: ProductDto = {
  id: "p1", code: "P001", name: "Producto Test",
  ivaRate: 0.16, iepsRate: null, isActive: true,
  departmentId: "d1", createdAt: new Date(), updatedAt: new Date(),
  stock: null,
};

const prices: ProductPriceDto[] = [
  { id: "pr1", productId: "p1", branchId: "b1", name: "Precio Normal", price: 100, minQuantity: 1, discountPct: 0, isDefault: true },
  { id: "pr2", productId: "p1", branchId: "b1", name: "Precio Mayoreo", price: 80, minQuantity: 10, discountPct: 0, isDefault: false },
];

HTMLDialogElement.prototype.showModal = jest.fn(function (this: HTMLDialogElement) {
  this.setAttribute("open", "");
});
HTMLDialogElement.prototype.close = jest.fn(function (this: HTMLDialogElement) {
  this.removeAttribute("open");
});

describe("PriceTierPicker", () => {
  it("renders product name", () => {
    render(
      <PriceTierPicker
        product={product} prices={prices} isLoading={false}
        onConfirm={jest.fn()} onClose={jest.fn()}
      />
    );
    expect(screen.getByText("Producto Test")).toBeInTheDocument();
  });

  it("calls onClose when cancel button clicked", async () => {
    const onClose = jest.fn();
    const user = userEvent.setup();
    render(
      <PriceTierPicker
        product={product} prices={prices} isLoading={false}
        onConfirm={jest.fn()} onClose={onClose}
      />
    );
    await user.click(screen.getByText("Cancelar"));
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onConfirm with selected price when confirm button clicked", async () => {
    const onConfirm = jest.fn();
    const user = userEvent.setup();
    render(
      <PriceTierPicker
        product={product} prices={prices} isLoading={false}
        onConfirm={onConfirm} onClose={jest.fn()}
      />
    );
    await user.click(screen.getByText("Añadir al carrito"));
    expect(onConfirm).toHaveBeenCalledWith(prices[0], 1, 0);
  });

  it("shows spinner when loading", () => {
    render(
      <PriceTierPicker
        product={product} prices={[]} isLoading={true}
        onConfirm={jest.fn()} onClose={jest.fn()}
      />
    );
    expect(document.querySelector("svg") || screen.queryByRole("status")).toBeTruthy();
  });

  it("shows empty message when no prices", () => {
    render(
      <PriceTierPicker
        product={product} prices={[]} isLoading={false}
        onConfirm={jest.fn()} onClose={jest.fn()}
      />
    );
    expect(screen.getByText(/no tiene precios/i)).toBeInTheDocument();
  });
});
