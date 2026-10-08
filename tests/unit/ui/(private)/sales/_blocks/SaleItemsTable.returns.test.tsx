/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import { SaleItemsTable } from "../../../../../../app/(private)/sales/_blocks/SaleItemsTable";
import type { SaleItem } from "../../../../../../app/(private)/sales/_logic/types/domain";

function makeItem(overrides: Partial<SaleItem> = {}): SaleItem {
  return {
    id: "si1",
    productId: "p1",
    productPriceId: "pp1",
    productCodeSnapshot: "COD1",
    productNameSnapshot: "Producto Test",
    priceNameSnapshot: "Precio Normal",
    unitPrice: 50,
    quantity: 5,
    discountPct: 0,
    discountAmount: 0,
    ivaRate: 0.16,
    iepsRate: 0,
    lineSubtotal: 250,
    lineIva: 40,
    lineIeps: 0,
    lineTotal: 290,
    ...overrides,
  };
}

describe("SaleItemsTable — backwards compatibility", () => {
  it("sin props opcionales renderiza igual que antes — muestra cantidad original", () => {
    render(<SaleItemsTable items={[makeItem()]} />);
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.queryByText(/Devuelto/i)).not.toBeInTheDocument();
  });

  it("con returnedQuantityBySaleItem vacío ({}) sigue sin mostrar subnota", () => {
    render(<SaleItemsTable items={[makeItem()]} returnedQuantityBySaleItem={{}} />);
    expect(screen.queryByText(/Devuelto/i)).not.toBeInTheDocument();
  });
});

describe("SaleItemsTable — con returnedQuantityBySaleItem", () => {
  it("muestra subnota 'Devuelto: X' cuando returnedQty > 0", () => {
    render(
      <SaleItemsTable
        items={[makeItem()]}
        returnedQuantityBySaleItem={{ si1: 2 }}
      />
    );
    expect(screen.getByText("Devuelto: 2")).toBeInTheDocument();
    // cantidad original también sigue visible
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("no muestra subnota cuando el item no tiene devoluciones", () => {
    render(
      <SaleItemsTable
        items={[makeItem({ id: "si2" })]}
        returnedQuantityBySaleItem={{ si1: 3 }}
      />
    );
    expect(screen.queryByText(/Devuelto/i)).not.toBeInTheDocument();
  });
});

describe("SaleItemsTable — con renderQuantityCell", () => {
  it("renderQuantityCell reemplaza la celda completa", () => {
    const renderQuantityCell = jest.fn(() => <span>custom-cell</span>);
    render(
      <SaleItemsTable
        items={[makeItem()]}
        returnedQuantityBySaleItem={{ si1: 1 }}
        renderQuantityCell={renderQuantityCell}
      />
    );
    expect(screen.getByText("custom-cell")).toBeInTheDocument();
    expect(renderQuantityCell).toHaveBeenCalledWith(
      expect.objectContaining({ id: "si1" }),
      1,
      4, // remaining = 5 - 1
    );
  });

  it("renderQuantityCell recibe remaining = quantity - returnedQty", () => {
    const renderQuantityCell = jest.fn<React.ReactNode, [SaleItem, number, number]>(() => null);
    render(
      <SaleItemsTable
        items={[makeItem({ quantity: 10 })]}
        returnedQuantityBySaleItem={{ si1: 3 }}
        renderQuantityCell={renderQuantityCell}
      />
    );
    const [, returnedQty, remaining] = renderQuantityCell.mock.calls[0];
    expect(returnedQty).toBe(3);
    expect(remaining).toBe(7);
  });
});
