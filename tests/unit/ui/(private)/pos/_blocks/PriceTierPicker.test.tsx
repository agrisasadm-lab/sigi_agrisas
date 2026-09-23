/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PriceTierPicker } from "../../../../../../app/(private)/pos/_blocks/PriceTierPicker";
import type { ProductDto, ProductPriceDto, DosificationOptionDto } from "../../../../../../app/(private)/pos/_logic/types/api";

HTMLDialogElement.prototype.showModal = jest.fn(function (this: HTMLDialogElement) {
  this.setAttribute("open", "");
});
HTMLDialogElement.prototype.close = jest.fn(function (this: HTMLDialogElement) {
  this.removeAttribute("open");
});

const product: ProductDto = {
  id: "prod-1",
  code: "P001",
  name: "Maíz blanco",
  ivaRate: 0.16,
  iepsRate: 0,
  isActive: true,
  departmentId: "dep-1",
  createdAt: new Date(),
  updatedAt: new Date(),
  stock: null,
};

const prices: ProductPriceDto[] = [
  { id: "price-1", productId: "prod-1", branchId: "b1", name: "Precio menudeo", price: 100, minQuantity: 1, discountPct: 0, isDefault: true },
  { id: "price-2", productId: "prod-1", branchId: "b1", name: "Precio mayoreo", price: 80, minQuantity: 10, discountPct: 0, isDefault: false },
];

const dosifications: DosificationOptionDto[] = [
  { id: "dosif-1", productId: "prod-1", name: "1/4", numParts: 4, isActive: true, computedUnitPrice: 26.75, requiresDefaultPrice: false },
  { id: "dosif-2", productId: "prod-1", name: "1/2 sin default", numParts: 2, isActive: true, computedUnitPrice: null, requiresDefaultPrice: true },
];

describe("PriceTierPicker", () => {
  it("renderiza el nombre del producto", () => {
    render(
      <PriceTierPicker
        product={product}
        prices={prices}
        isLoading={false}
        onConfirm={jest.fn()}
        onClose={jest.fn()}
      />
    );
    expect(screen.getByText("Maíz blanco")).toBeInTheDocument();
    expect(screen.getByText("P001")).toBeInTheDocument();
  });

  it("preselecciona el precio default (isDefault=true)", () => {
    render(
      <PriceTierPicker
        product={product}
        prices={prices}
        isLoading={false}
        onConfirm={jest.fn()}
        onClose={jest.fn()}
      />
    );
    const menudeoBtn = screen.getByText("Precio menudeo").closest("button")!;
    expect(menudeoBtn.className).toContain("border-primary");
  });

  it("cambia la selección al hacer click en otro precio", async () => {
    render(
      <PriceTierPicker
        product={product}
        prices={prices}
        isLoading={false}
        onConfirm={jest.fn()}
        onClose={jest.fn()}
      />
    );
    await userEvent.setup().click(screen.getByText("Precio mayoreo").closest("button")!);
    const mayoreoBtn = screen.getByText("Precio mayoreo").closest("button")!;
    expect(mayoreoBtn.className).toContain("border-primary");
  });

  it("llama onConfirm con precio, cantidad y descuento al confirmar", async () => {
    const onConfirm = jest.fn();
    render(
      <PriceTierPicker
        product={product}
        prices={prices}
        isLoading={false}
        initialQuantity={2}
        initialDiscountPct={5}
        onConfirm={onConfirm}
        onClose={jest.fn()}
      />
    );
    await userEvent.setup().click(screen.getByRole("button", { name: /Añadir al carrito/i }));
    expect(onConfirm).toHaveBeenCalledWith(prices[0], 2, 5);
  });

  it("llama onClose al hacer click en Cancelar", async () => {
    const onClose = jest.fn();
    render(
      <PriceTierPicker
        product={product}
        prices={prices}
        isLoading={false}
        onConfirm={jest.fn()}
        onClose={onClose}
      />
    );
    await userEvent.setup().click(screen.getByRole("button", { name: /Cancelar/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("muestra spinner cuando isLoading=true", () => {
    render(
      <PriceTierPicker
        product={product}
        prices={[]}
        isLoading={true}
        onConfirm={jest.fn()}
        onClose={jest.fn()}
      />
    );
    expect(screen.queryByRole("button", { name: /Añadir al carrito/i })).not.toBeInTheDocument();
  });

  it("muestra mensaje cuando no hay precios", () => {
    render(
      <PriceTierPicker
        product={product}
        prices={[]}
        isLoading={false}
        onConfirm={jest.fn()}
        onClose={jest.fn()}
      />
    );
    expect(screen.getByText(/no tiene precios configurados/i)).toBeInTheDocument();
  });

  it("permite borrar la cantidad con backspace sin revertir instantáneamente", async () => {
    render(
      <PriceTierPicker
        product={product}
        prices={prices}
        isLoading={false}
        initialQuantity={5}
        onConfirm={jest.fn()}
        onClose={jest.fn()}
      />
    );
    const input = screen.getByDisplayValue("5") as HTMLInputElement;
    const user = userEvent.setup();
    await user.clear(input);
    expect(input.value).toBe("");
  });

  it("permite reescribir la cantidad dígito por dígito incluyendo decimales", async () => {
    render(
      <PriceTierPicker
        product={product}
        prices={prices}
        isLoading={false}
        initialQuantity={1}
        onConfirm={jest.fn()}
        onClose={jest.fn()}
      />
    );
    const input = screen.getByDisplayValue("1") as HTMLInputElement;
    const user = userEvent.setup();
    await user.clear(input);
    await user.type(input, "2.5");
    expect(input.value).toBe("2.5");
  });

  it("rechaza un 4º decimal", async () => {
    render(
      <PriceTierPicker
        product={product}
        prices={prices}
        isLoading={false}
        initialQuantity={1}
        onConfirm={jest.fn()}
        onClose={jest.fn()}
      />
    );
    const input = screen.getByDisplayValue("1") as HTMLInputElement;
    const user = userEvent.setup();
    await user.clear(input);
    await user.type(input, "2.5678");
    expect(input.value).toBe("2.567");
  });

  it("revierte al último valor válido si el input queda vacío al perder el foco", async () => {
    render(
      <PriceTierPicker
        product={product}
        prices={prices}
        isLoading={false}
        initialQuantity={5}
        onConfirm={jest.fn()}
        onClose={jest.fn()}
      />
    );
    const input = screen.getByDisplayValue("5") as HTMLInputElement;
    const user = userEvent.setup();
    await user.clear(input);
    await user.tab();
    expect(input.value).toBe("5");
  });

  describe("dosificaciones", () => {
    it("lista dosificaciones activas junto a los precios de catálogo", () => {
      render(
        <PriceTierPicker
          product={product}
          prices={prices}
          dosifications={dosifications}
          isLoading={false}
          onConfirm={jest.fn()}
          onConfirmDosification={jest.fn()}
          onClose={jest.fn()}
        />
      );
      expect(screen.getByText("Precio menudeo")).toBeInTheDocument();
      expect(screen.getByText("1/4")).toBeInTheDocument();
      expect(screen.getByText("1/2 sin default")).toBeInTheDocument();
    });

    it("deshabilita una dosificación con requiresDefaultPrice=true", () => {
      render(
        <PriceTierPicker
          product={product}
          prices={prices}
          dosifications={dosifications}
          isLoading={false}
          onConfirm={jest.fn()}
          onConfirmDosification={jest.fn()}
          onClose={jest.fn()}
        />
      );
      const disabledBtn = screen.getByText("1/2 sin default").closest("button")!;
      expect(disabledBtn).toBeDisabled();
      expect(screen.getByText(/Requiere precio default/i)).toBeInTheDocument();
    });

    it("al confirmar una dosificación seleccionada, invoca onConfirmDosification con la cantidad", async () => {
      const onConfirmDosification = jest.fn();
      render(
        <PriceTierPicker
          product={product}
          prices={prices}
          dosifications={dosifications}
          isLoading={false}
          initialQuantity={3}
          onConfirm={jest.fn()}
          onConfirmDosification={onConfirmDosification}
          onClose={jest.fn()}
        />
      );
      await userEvent.setup().click(screen.getByText("1/4").closest("button")!);
      await userEvent.setup().click(screen.getByRole("button", { name: /Añadir al carrito/i }));
      expect(onConfirmDosification).toHaveBeenCalledWith(dosifications[0], 3);
    });

    it("un producto sin dosificaciones se comporta igual que antes (sin regresión)", () => {
      render(
        <PriceTierPicker
          product={product}
          prices={prices}
          isLoading={false}
          onConfirm={jest.fn()}
          onClose={jest.fn()}
        />
      );
      expect(screen.queryByText(/Dosificaciones/i)).not.toBeInTheDocument();
    });
  });
});
