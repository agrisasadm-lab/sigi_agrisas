/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CartLine } from "../../../../../../app/(private)/pos/_blocks/CartLine";
import type { CartLine as CartLineType } from "../../../../../../app/(private)/pos/_logic/types/domain";

function makeLine(overrides: Partial<CartLineType> = {}): CartLineType {
  return {
    id: "line-1",
    productId: "prod-1",
    productCode: "P001",
    productName: "Maíz blanco",
    productPriceId: "price-1",
    priceName: "Precio menudeo",
    unitPrice: 100,
    ivaRate: 0.16,
    iepsRate: 0,
    quantity: 5,
    discountType: "pct",
    discountPct: 0,
    discountAmount: 0,
    lineSubtotal: 500,
    lineIva: 80,
    lineIeps: 0,
    lineTotal: 580,
    ...overrides,
  };
}

function noop() {}

describe("CartLine — input de cantidad", () => {
  it("permite borrar la cantidad con backspace sin revertir instantáneamente", async () => {
    render(
      <CartLine line={makeLine()} onUpdateQuantity={noop} onUpdateDiscount={noop} onUpdateDiscountAmount={noop} onChangeTier={noop} onRemove={noop} />
    );
    const input = screen.getByDisplayValue("5") as HTMLInputElement;
    const user = userEvent.setup();
    await user.clear(input);
    expect(input.value).toBe("");
  });

  it("permite reescribir la cantidad dígito por dígito incluyendo decimales", async () => {
    render(
      <CartLine line={makeLine()} onUpdateQuantity={noop} onUpdateDiscount={noop} onUpdateDiscountAmount={noop} onChangeTier={noop} onRemove={noop} />
    );
    const input = screen.getByDisplayValue("5") as HTMLInputElement;
    const user = userEvent.setup();
    await user.clear(input);
    await user.type(input, "2.5");
    expect(input.value).toBe("2.5");
  });

  it("rechaza un 4º decimal", async () => {
    render(
      <CartLine line={makeLine()} onUpdateQuantity={noop} onUpdateDiscount={noop} onUpdateDiscountAmount={noop} onChangeTier={noop} onRemove={noop} />
    );
    const input = screen.getByDisplayValue("5") as HTMLInputElement;
    const user = userEvent.setup();
    await user.clear(input);
    await user.type(input, "2.5678");
    expect(input.value).toBe("2.567");
  });

  it("revierte al último valor válido si queda vacío al perder el foco", async () => {
    render(
      <CartLine line={makeLine()} onUpdateQuantity={noop} onUpdateDiscount={noop} onUpdateDiscountAmount={noop} onChangeTier={noop} onRemove={noop} />
    );
    const input = screen.getByDisplayValue("5") as HTMLInputElement;
    const user = userEvent.setup();
    await user.clear(input);
    await user.tab();
    expect(input.value).toBe("5");
  });

  it("llama onUpdateQuantity con el valor parseado mientras se tipea un número válido", async () => {
    const onUpdateQuantity = jest.fn();
    render(
      <CartLine line={makeLine()} onUpdateQuantity={onUpdateQuantity} onUpdateDiscount={noop} onUpdateDiscountAmount={noop} onChangeTier={noop} onRemove={noop} />
    );
    const input = screen.getByDisplayValue("5") as HTMLInputElement;
    const user = userEvent.setup();
    await user.clear(input);
    await user.type(input, "3");
    expect(onUpdateQuantity).toHaveBeenCalledWith("line-1", 3);
  });
});

describe("CartLine — toggle de descuento %/$", () => {
  it("por defecto muestra el toggle en % y el input vacío de discountPct", () => {
    render(
      <CartLine line={makeLine({ discountPct: 10 })} onUpdateQuantity={noop} onUpdateDiscount={noop} onUpdateDiscountAmount={noop} onChangeTier={noop} onRemove={noop} />
    );
    expect(screen.getByDisplayValue("10")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "%" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "$" })).toHaveAttribute("aria-pressed", "false");
  });

  it("al hacer click en $ muestra discountAmount en el input", () => {
    render(
      <CartLine line={makeLine({ discountType: "amount", discountAmount: 25 })} onUpdateQuantity={noop} onUpdateDiscount={noop} onUpdateDiscountAmount={noop} onChangeTier={noop} onRemove={noop} />
    );
    expect(screen.getByDisplayValue("25")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "$" })).toHaveAttribute("aria-pressed", "true");
  });

  it("tipear en el input con discountType=amount llama a onUpdateDiscountAmount, no a onUpdateDiscount", async () => {
    const onUpdateDiscount = jest.fn();
    const onUpdateDiscountAmount = jest.fn();
    render(
      <CartLine
        line={makeLine({ discountType: "amount", discountAmount: 0 })}
        onUpdateQuantity={noop}
        onUpdateDiscount={onUpdateDiscount}
        onUpdateDiscountAmount={onUpdateDiscountAmount}
        onChangeTier={noop}
        onRemove={noop}
      />
    );
    const input = screen.getByDisplayValue("0") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "40" } });
    expect(onUpdateDiscountAmount).toHaveBeenCalledWith("line-1", 40);
    expect(onUpdateDiscount).not.toHaveBeenCalled();
  });

  it("click en el botón % activa onUpdateDiscount con el discountPct actual (cambia el tipo)", async () => {
    const onUpdateDiscount = jest.fn();
    render(
      <CartLine
        line={makeLine({ discountType: "amount", discountAmount: 20, discountPct: 0 })}
        onUpdateQuantity={noop}
        onUpdateDiscount={onUpdateDiscount}
        onUpdateDiscountAmount={noop}
        onChangeTier={noop}
        onRemove={noop}
      />
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "%" }));
    expect(onUpdateDiscount).toHaveBeenCalledWith("line-1", 0);
  });

  it("no renderiza el toggle %/$ en una línea de dosificación — mantiene el input plano de % de siempre", () => {
    render(
      <CartLine
        line={makeLine({ dosificationId: "dosif-1", productPriceId: undefined, discountPct: 0 })}
        onUpdateQuantity={noop}
        onUpdateDiscount={noop}
        onUpdateDiscountAmount={noop}
        onChangeTier={noop}
        onRemove={noop}
      />
    );
    expect(screen.queryByRole("button", { name: "%" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "$" })).not.toBeInTheDocument();
    expect(screen.getByDisplayValue("0")).toBeInTheDocument();
  });
});
