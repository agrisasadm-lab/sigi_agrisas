/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

jest.mock("next/navigation", () => ({
  useRouter: jest.fn(() => ({ push: jest.fn() })),
}));

jest.mock("../../../../../app/(private)/billing/_logic/services", () => ({
  stampInvoice: jest.fn(),
}));

jest.mock("../../../../../app/(private)/pos/_logic/services/getProductPrices", () => ({
  getProductPrices: jest.fn(),
}));

jest.mock("../../../../../app/(private)/pos/_blocks/CustomerPicker", () => ({
  CustomerPicker: ({ onChange, onOpenQuickAdd }: { onChange: (id: string, dto: unknown) => void; onOpenQuickAdd: () => void }) => (
    <>
      <button
        type="button"
        onClick={() =>
          onChange("cust-null-rfc", {
            id: "cust-null-rfc",
            rfc: null,
            name: "Cliente sin RFC",
            cfdiUse: "G03",
            taxRegime: "601",
            taxZipCode: "45010",
          })
        }
      >
        Seleccionar cliente sin RFC
      </button>
      <button type="button" onClick={onOpenQuickAdd}>
        Abrir alta rápida
      </button>
    </>
  ),
}));

jest.mock("../../../../../app/(private)/pos/_blocks/CustomerQuickAddModal", () => ({
  CustomerQuickAddModal: ({ onCreated }: { onCreated: (dto: unknown) => void }) => (
    <button
      type="button"
      onClick={() =>
        onCreated({
          id: "cust-quickadd-null-rfc",
          rfc: null,
          name: "Cliente nuevo sin RFC",
          cfdiUse: "G03",
          taxRegime: "601",
          taxZipCode: "45010",
        })
      }
    >
      Confirmar alta rápida sin RFC
    </button>
  ),
}));

jest.mock("../../../../../app/(private)/pos/_blocks/ProductCatalogPanel", () => ({
  ProductCatalogPanel: ({ onAddProduct }: { onAddProduct: (p: unknown) => void }) => (
    <button
      type="button"
      onClick={() =>
        onAddProduct({
          id: "prod-1",
          code: "P001",
          name: "Producto de prueba",
          ivaRate: 0.16,
          iepsRate: null,
          isActive: true,
          departmentId: "d1",
          createdAt: new Date(),
          updatedAt: new Date(),
          stock: null,
        })
      }
    >
      Agregar Producto de prueba
    </button>
  ),
}));

import { getProductPrices } from "../../../../../app/(private)/pos/_logic/services/getProductPrices";
import { PartialInvoiceForm } from "../../../../../app/(private)/billing/_blocks/PartialInvoiceForm";

const mockGetProductPrices = getProductPrices as jest.MockedFunction<typeof getProductPrices>;

describe("PartialInvoiceForm — customer selection normalizes null fields", () => {
  it("selecting a customer with rfc: null does not crash, and lists RFC as a missing fiscal field", async () => {
    render(<PartialInvoiceForm />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /seleccionar cliente sin rfc/i }));

    expect(await screen.findByText(/datos fiscales faltantes/i)).toBeInTheDocument();
  });

  it("creating a customer via quick-add with rfc: null does not crash, and lists RFC as a missing fiscal field", async () => {
    render(<PartialInvoiceForm />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /abrir alta rápida/i }));
    await user.click(screen.getByRole("button", { name: /confirmar alta rápida sin rfc/i }));

    expect(await screen.findByText(/datos fiscales faltantes/i)).toBeInTheDocument();
  });
});

describe("PartialInvoiceForm — handleAddProduct preselects default price", () => {
  beforeEach(() => jest.clearAllMocks());

  it("preloads the default price's unitPrice, not 0", async () => {
    mockGetProductPrices.mockResolvedValueOnce([
      { id: "price-1", productId: "prod-1", branchId: "b1", name: "Precio menudeo", price: 50, minQuantity: 1, discountPct: 0, isDefault: false },
      { id: "price-2", productId: "prod-1", branchId: "b1", name: "Precio mayoreo", price: 250, minQuantity: 10, discountPct: 0, isDefault: true },
    ]);
    render(<PartialInvoiceForm />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /\+ catálogo/i }));
    await user.click(screen.getByRole("button", { name: /agregar producto de prueba/i }));

    expect(await screen.findByDisplayValue("250")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /precio mayoreo/i })).toBeInTheDocument();
  });

  it("passes effectiveBranchId to getProductPrices when adding from the catalog (regression: was omitted, causing branch-scoped-only prices to resolve empty)", async () => {
    mockGetProductPrices.mockResolvedValueOnce([
      { id: "price-1", productId: "prod-1", branchId: "b1", name: "Precio sucursal", price: 100, minQuantity: 1, discountPct: 0, isDefault: true },
    ]);
    render(<PartialInvoiceForm />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /\+ catálogo/i }));
    await user.click(screen.getByRole("button", { name: /agregar producto de prueba/i }));

    await screen.findByDisplayValue("100");
    expect(mockGetProductPrices).toHaveBeenCalledWith("prod-1", null);
  });

  it("falls back to the first price when none is marked default", async () => {
    mockGetProductPrices.mockResolvedValueOnce([
      { id: "price-1", productId: "prod-1", branchId: "b1", name: "Único precio", price: 75, minQuantity: 1, discountPct: 0, isDefault: false },
    ]);
    render(<PartialInvoiceForm />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /\+ catálogo/i }));
    await user.click(screen.getByRole("button", { name: /agregar producto de prueba/i }));

    expect(await screen.findByDisplayValue("75")).toBeInTheDocument();
  });

  it("falls back to unitPrice 0 when the product has no prices", async () => {
    mockGetProductPrices.mockResolvedValueOnce([]);
    render(<PartialInvoiceForm />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /\+ catálogo/i }));
    await user.click(screen.getByRole("button", { name: /agregar producto de prueba/i }));

    expect(await screen.findByText("Elegir precio")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("0.00")).toHaveValue("0");
  });
});

describe("PartialInvoiceForm — handleChangeTier passes the same effectiveBranchId as handleAddProduct", () => {
  beforeEach(() => jest.clearAllMocks());

  it("calls getProductPrices with effectiveBranchId on both the initial catalog add and the tier-change click", async () => {
    mockGetProductPrices.mockResolvedValue([
      { id: "price-1", productId: "prod-1", branchId: "b1", name: "Precio menudeo", price: 50, minQuantity: 1, discountPct: 0, isDefault: false },
      { id: "price-2", productId: "prod-1", branchId: "b1", name: "Precio mayoreo", price: 250, minQuantity: 10, discountPct: 0, isDefault: true },
    ]);
    render(<PartialInvoiceForm />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /\+ catálogo/i }));
    await user.click(screen.getByRole("button", { name: /agregar producto de prueba/i }));
    await screen.findByDisplayValue("250");

    await user.click(screen.getByRole("button", { name: /precio mayoreo/i }));

    expect(mockGetProductPrices).toHaveBeenNthCalledWith(1, "prod-1", null);
    expect(mockGetProductPrices).toHaveBeenNthCalledWith(2, "prod-1", null);
  });
});

describe("PartialInvoiceForm — changing branchId does not retroactively re-price existing lines", () => {
  beforeEach(() => jest.clearAllMocks());

  it("a line added under branch A keeps its unitPrice after the branchId prop changes to branch B", async () => {
    mockGetProductPrices.mockResolvedValueOnce([
      { id: "price-a", productId: "prod-1", branchId: "b1", name: "Precio sucursal A", price: 100, minQuantity: 1, discountPct: 0, isDefault: true },
    ]);
    const { rerender } = render(<PartialInvoiceForm branchId="branch-a" />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /\+ catálogo/i }));
    await user.click(screen.getByRole("button", { name: /agregar producto de prueba/i }));
    await screen.findByDisplayValue("100");

    rerender(<PartialInvoiceForm branchId="branch-b" />);

    expect(screen.getByDisplayValue("100")).toBeInTheDocument();
    expect(mockGetProductPrices).toHaveBeenCalledTimes(1);
  });
});
