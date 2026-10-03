/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen } from "@testing-library/react";

jest.mock("../../../../../../app/_hooks/useCurrentUser");
jest.mock("../../../../../../app/_hooks/useBranchesOptions", () => ({
  useBranchesOptions: () => ({
    options: [
      { id: "branch-zarioz", name: "Zarioz" },
      { id: "branch-pradera", name: "Pradera" },
    ],
    isLoading: false,
  }),
}));
jest.mock("../../../../../../app/_hooks/usePaymentMethodsOptions", () => ({
  usePaymentMethodsOptions: () => ({
    options: [{ id: "pm1", name: "Efectivo", isCredit: false }],
    isLoading: false,
  }),
}));
jest.mock("../../../../../../app/(private)/purchases/_logic/hooks/useProductSearch");
jest.mock("../../../../../../app/(private)/purchases/_logic/hooks/useCreatePurchaseForm");
jest.mock("../../../../../../app/(private)/purchases/_blocks/ProviderPicker", () => ({
  ProviderPicker: () => <div data-testid="provider-picker" />,
}));
jest.mock("../../../../../../app/(private)/purchases/_blocks/ProviderQuickAddModal", () => ({
  ProviderQuickAddModal: () => null,
}));
jest.mock("../../../../../../app/(private)/purchases/_blocks/SatInvoiceUploader", () => ({
  SatInvoiceUploader: () => <div data-testid="sat-uploader" />,
}));
jest.mock("../../../../../../app/(private)/purchases/_blocks/PurchaseLineRow", () => ({
  PurchaseLineRow: () => <div data-testid="purchase-line-row" />,
}));

import { useCurrentUser } from "../../../../../../app/_hooks/useCurrentUser";
import { useProductSearch } from "../../../../../../app/(private)/purchases/_logic/hooks/useProductSearch";
import { useCreatePurchaseForm } from "../../../../../../app/(private)/purchases/_logic/hooks/useCreatePurchaseForm";
import { CreatePurchasePage } from "../../../../../../app/(private)/purchases/_blocks/CreatePurchasePage";

const mockUseCurrentUser = useCurrentUser as jest.MockedFunction<typeof useCurrentUser>;
const mockUseProductSearch = useProductSearch as jest.MockedFunction<typeof useProductSearch>;
const mockUseCreatePurchaseForm = useCreatePurchaseForm as jest.MockedFunction<typeof useCreatePurchaseForm>;

function makeCan(permissions: string[]) {
  return (perm: string): boolean | "loading" => permissions.includes(perm);
}

function setupCurrentUser({ branchId, bypass }: { branchId: string | null; bypass: boolean }) {
  const perms = ["purchases:create", ...(bypass ? ["branches:access_all"] : [])];
  mockUseCurrentUser.mockReturnValue({
    userId: "u1",
    email: "test@test.com",
    roles: [],
    branchId,
    isLoading: false,
    can: makeCan(perms),
    refresh: jest.fn(),
  });
}

function setupProductSearch(overrides = {}) {
  mockUseProductSearch.mockReturnValue({
    items: [],
    total: 0,
    isLoading: false,
    error: null,
    refresh: jest.fn(),
    ...overrides,
  });
}

function setupCreatePurchaseForm(overrides = {}) {
  mockUseCreatePurchaseForm.mockReturnValue({
    providerId: "",
    provider: null,
    newProvider: null,
    setProvider: jest.fn(),
    branchId: "",
    paymentMethodId: "",
    setPaymentMethodId: jest.fn(),
    isCredit: false,
    notes: "",
    setNotes: jest.fn(),
    lines: [],
    addLine: jest.fn(),
    setLinesFromSat: jest.fn(),
    applySatResult: jest.fn(),
    clearSat: jest.fn(),
    updateQuantity: jest.fn(),
    updateUnitCost: jest.fn(),
    updateDiscount: jest.fn(),
    updateLot: jest.fn(),
    updateExpiration: jest.fn(),
    updateManufactureDate: jest.fn(),
    removeLine: jest.fn(),
    totals: { subtotal: 0, ivaTotal: 0, iepsTotal: 0, total: 0 },
    satMetadata: {},
    setSatMetadata: jest.fn(),
    isSubmitting: false,
    submitError: null,
    clearSubmitError: jest.fn(),
    canSubmit: false,
    submit: jest.fn(),
    ...overrides,
  } as never);
}

describe("CreatePurchasePage — filtro de productos por sucursal", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupProductSearch();
    setupCreatePurchaseForm();
  });

  it("un operador con sucursal propia busca productos con su branchId", () => {
    setupCurrentUser({ branchId: "branch-zarioz", bypass: false });

    render(<CreatePurchasePage />);

    expect(mockUseProductSearch).toHaveBeenCalledWith(
      expect.objectContaining({ branchId: "branch-zarioz" })
    );
  });

  it("un admin (bypass) sin sucursal seleccionada ve el hint y no dispara búsqueda con branchId", () => {
    setupCurrentUser({ branchId: null, bypass: true });

    render(<CreatePurchasePage />);

    expect(mockUseProductSearch).toHaveBeenCalledWith(
      expect.objectContaining({ branchId: undefined })
    );
    expect(screen.getByText(/selecciona una sucursal para buscar productos/i)).toBeInTheDocument();
  });

  it("un admin (bypass) que selecciona sucursal activa el buscador con ese branchId", () => {
    setupCurrentUser({ branchId: null, bypass: true });

    render(<CreatePurchasePage />);

    const select = screen.getByDisplayValue("Selecciona una sucursal");
    require("@testing-library/react").fireEvent.change(select, { target: { value: "branch-pradera" } });

    expect(mockUseProductSearch).toHaveBeenLastCalledWith(
      expect.objectContaining({ branchId: "branch-pradera" })
    );
    expect(screen.queryByText(/selecciona una sucursal para buscar productos/i)).not.toBeInTheDocument();
  });
});
