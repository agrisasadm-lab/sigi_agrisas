/**
 * @jest-environment jsdom
 *
 * Cierra el gap señalado en la verificación (opsx:verify) de
 * add-billing-partial-invoice-branch-selector, actualizado tras
 * improve-billing-invoice-details: la sucursal usada para resolver precios y
 * filtrar el catálogo ya no viene de un selector — es siempre la sucursal
 * matriz (isHeadquarters=true), resuelta vía useHeadquarters(). Este archivo
 * ejercita NewInvoicePage + PartialInvoiceForm reales (sin mockear) para
 * confirmar que el flujo completo resuelve el precio branch-scoped de la
 * matriz sin depender de verificación manual en Playwright.
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

jest.mock("next/navigation", () => ({
  useRouter: jest.fn(() => ({ push: jest.fn() })),
}));

jest.mock("../../../../../app/_hooks/useCurrentUser");
jest.mock("../../../../../app/_hooks/useHeadquarters");
jest.mock("../../../../../app/(private)/pos/_logic/services/getProductPrices", () => ({
  getProductPrices: jest.fn(),
}));

jest.mock("../../../../../app/(private)/billing/_blocks/StampSaleForm", () => ({
  StampSaleForm: () => <div data-testid="stamp-sale-form" />,
}));
jest.mock("../../../../../app/(private)/pos/_blocks/CustomerPicker", () => ({
  CustomerPicker: () => <div data-testid="customer-picker" />,
}));
jest.mock("../../../../../app/(private)/pos/_blocks/CustomerQuickAddModal", () => ({
  CustomerQuickAddModal: () => null,
}));
jest.mock("../../../../../app/(private)/pos/_blocks/ProductCatalogPanel", () => ({
  ProductCatalogPanel: ({ onAddProduct, branchId }: { onAddProduct: (p: unknown) => void; branchId?: string }) => (
    <div>
      <span data-testid="catalog-branch-id">{branchId ?? "null"}</span>
      <button
        type="button"
        onClick={() =>
          onAddProduct({
            id: "prod-infinito-1l",
            code: "INFINITO_1L",
            name: "INFINITO 1L",
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
        Agregar INFINITO 1L
      </button>
    </div>
  ),
}));

import { useCurrentUser } from "../../../../../app/_hooks/useCurrentUser";
import { useHeadquarters } from "../../../../../app/_hooks/useHeadquarters";
import { getProductPrices } from "../../../../../app/(private)/pos/_logic/services/getProductPrices";
import { NewInvoicePage } from "../../../../../app/(private)/billing/_blocks/NewInvoicePage";

const mockUseCurrentUser = useCurrentUser as jest.MockedFunction<typeof useCurrentUser>;
const mockUseHeadquarters = useHeadquarters as jest.MockedFunction<typeof useHeadquarters>;
const mockGetProductPrices = getProductPrices as jest.MockedFunction<typeof getProductPrices>;

const HQ_ID = "b-matriz";

function setupBypassAdmin() {
  mockUseCurrentUser.mockReturnValue({
    userId: "u1",
    email: "admin@test.com",
    roles: ["admin"],
    branchId: null,
    isLoading: false,
    can: jest.fn((p: string) => (p === "billing:write" ? true : p === "branches:access_all" ? true : false)),
    refresh: jest.fn(),
  });
  mockUseHeadquarters.mockReturnValue({ hq: { id: HQ_ID, code: "MATRIZ", name: "Matriz" }, isLoading: false, refresh: jest.fn() });
}

async function switchToPartialMode(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("tab", { name: /factura parcial/i }));
}

describe("NewInvoicePage + PartialInvoiceForm (real, sin mockear) — sucursal matriz resuelve precio y filtra catálogo", () => {
  beforeEach(() => jest.clearAllMocks());

  it("el catálogo y la resolución de precio usan siempre la sucursal matriz, sin selector", async () => {
    setupBypassAdmin();
    mockGetProductPrices.mockResolvedValueOnce([
      { id: "price-hq", productId: "prod-infinito-1l", branchId: HQ_ID, name: "Precio Publico", price: 1076, minQuantity: 1, discountPct: 0, isDefault: true },
    ]);
    const user = userEvent.setup();
    render(<NewInvoicePage />);
    await switchToPartialMode(user);

    expect(screen.queryByRole("combobox", { name: /sucursal/i })).toBeNull();

    await user.click(await screen.findByRole("button", { name: /\+ catálogo/i }));
    expect(await screen.findByTestId("catalog-branch-id")).toHaveTextContent(HQ_ID);

    await user.click(await screen.findByRole("button", { name: /agregar infinito 1l/i }));

    expect(await screen.findByDisplayValue("1076")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /precio publico/i })).toBeInTheDocument();
    expect(mockGetProductPrices).toHaveBeenCalledWith("prod-infinito-1l", HQ_ID);
  });
});
