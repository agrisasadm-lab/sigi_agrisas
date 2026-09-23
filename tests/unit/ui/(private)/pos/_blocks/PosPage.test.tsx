/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, act } from "@testing-library/react";

// --- router mock (must be defined before imports that call it) ---
const mockRouterPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockRouterPush }),
}));

// --- useCurrentUser ---
const mockCan = jest.fn<boolean | "loading", [string]>(() => false);
jest.mock("../../../../../../app/_hooks/useCurrentUser", () => ({
  useCurrentUser: () => ({
    can: (perm: string) => mockCan(perm),
    branchId: "b1",
    userId: "u1",
    email: "test@test.com",
    roles: [],
    isLoading: false,
    refresh: jest.fn(),
  }),
}));

// --- useCart ---
const mockSubmitSale = jest.fn();
const mockSubmitQuote = jest.fn();
jest.mock("../../../../../../app/(private)/pos/_logic/hooks/useCart", () => ({
  useCart: () => ({
    lines: [],
    totals: { subtotal: 0, taxTotal: 0, total: 0 },
    addLine: jest.fn(),
    updateQuantity: jest.fn(),
    updateDiscountPct: jest.fn(),
    changeTier: jest.fn(),
    removeLine: jest.fn(),
    clear: jest.fn(),
  }),
}));

// --- options hooks ---
jest.mock("../../../../../../app/_hooks/useFoliosOptions", () => ({
  useFoliosOptions: () => ({ options: [], isLoading: false, refresh: jest.fn() }),
}));
jest.mock("../../../../../../app/_hooks/usePaymentMethodsOptions", () => ({
  usePaymentMethodsOptions: () => ({ options: [], isLoading: false }),
}));

// --- submission hooks (controllable via module-level variables) ---
let saleMockState = { status: "idle" as string, sale: null as null | { id: string }, error: null };
let quoteMockState = { status: "idle" as string, quote: null as null | { id: string }, error: null };

jest.mock("../../../../../../app/(private)/pos/_logic/hooks/useSaleSubmission", () => ({
  useSaleSubmission: () => ({
    ...saleMockState,
    submit: mockSubmitSale,
    reset: jest.fn(),
  }),
}));
jest.mock("../../../../../../app/(private)/pos/_logic/hooks/useQuoteSubmission", () => ({
  useQuoteSubmission: () => ({
    ...quoteMockState,
    submit: mockSubmitQuote,
    reset: jest.fn(),
  }),
}));

// --- heavy UI blocks ---
jest.mock("../../../../../../app/(private)/pos/_blocks/PosHeader", () => ({
  PosHeader: ({ mode }: { mode: string }) => <div data-testid="pos-header" data-mode={mode} />,
}));
jest.mock("../../../../../../app/(private)/pos/_blocks/ProductCatalogPanel", () => ({
  ProductCatalogPanel: () => <div data-testid="catalog" />,
}));
jest.mock("../../../../../../app/(private)/pos/_blocks/CartPanel", () => ({
  CartPanel: ({ onSubmit }: { onSubmit: () => void }) => (
    <button data-testid="cart-submit" onClick={onSubmit}>Submit</button>
  ),
}));
jest.mock("../../../../../../app/(private)/pos/_blocks/SaleConfirmedModal", () => ({
  SaleConfirmedModal: ({ sale }: { sale: { id: string } }) => (
    <div data-testid="sale-confirmed" data-sale-id={sale.id} />
  ),
}));
jest.mock("../../../../../../app/_components/molecules/EmptyState/EmptyState", () => ({
  EmptyState: ({ title }: { title: string }) => <div data-testid="empty-state">{title}</div>,
}));
jest.mock("../../../../../../app/_components/atoms/Spinner/Spinner", () => ({
  Spinner: () => <div data-testid="spinner" />,
}));
jest.mock("../../../../../../app/(private)/pos/_logic/services/getProductPrices", () => ({
  getProductPrices: jest.fn().mockResolvedValue([]),
}));
jest.mock("../../../../../../app/_lib/authFetch", () => ({
  authFetch: jest.fn().mockResolvedValue({ json: () => Promise.resolve({ items: [] }) }),
}));
jest.mock("../../../../../../app/(private)/_blocks/OfflineSyncProvider", () => ({
  useOfflineSync: () => ({ isOnline: true, offlineEnabled: false, ownerBranchId: null }),
}));

import { PosPage } from "../../../../../../app/(private)/pos/_blocks/PosPage";

beforeEach(() => {
  mockRouterPush.mockClear();
  mockSubmitSale.mockClear();
  mockSubmitQuote.mockClear();
  mockCan.mockClear();
  saleMockState = { status: "idle", sale: null, error: null };
  quoteMockState = { status: "idle", quote: null, error: null };
});

describe("PosPage — modo quote", () => {
  beforeEach(() => {
    // Usuario con solo quotes:create (no sales:create) → mode forzado a "quote"
    mockCan.mockImplementation((perm) => {
      if (perm === "quotes:create") return true;
      if (perm === "sales:create") return false;
      return false;
    });
  });

  it("monta en mode='quote' cuando usuario no tiene sales:create", () => {
    render(<PosPage />);
    expect(screen.getByTestId("pos-header")).toHaveAttribute("data-mode", "quote");
  });

  it("al hacer submit en mode='quote', llama submitQuote (no submitSale)", async () => {
    mockSubmitQuote.mockResolvedValue(undefined);
    render(<PosPage />);
    await act(async () => {
      screen.getByTestId("cart-submit").click();
    });
    expect(mockSubmitQuote).toHaveBeenCalledTimes(1);
    expect(mockSubmitSale).not.toHaveBeenCalled();
  });

  it("cuando quoteStatus='succeeded' y quote.id, navega a /quotes/[id]", () => {
    quoteMockState = { status: "succeeded", quote: { id: "q42" }, error: null };
    render(<PosPage />);
    expect(mockRouterPush).toHaveBeenCalledWith("/quotes/q42");
  });

  it("NO muestra SaleConfirmedModal cuando quoteStatus='succeeded'", () => {
    quoteMockState = { status: "succeeded", quote: { id: "q42" }, error: null };
    render(<PosPage />);
    expect(screen.queryByTestId("sale-confirmed")).not.toBeInTheDocument();
  });
});

describe("PosPage — modo sale", () => {
  beforeEach(() => {
    mockCan.mockImplementation((perm) => {
      if (perm === "sales:create") return true;
      if (perm === "quotes:create") return false;
      return false;
    });
  });

  it("monta en mode='sale' cuando usuario tiene sales:create", () => {
    render(<PosPage />);
    expect(screen.getByTestId("pos-header")).toHaveAttribute("data-mode", "sale");
  });

  it("al hacer submit en mode='sale', llama submitSale (no submitQuote)", async () => {
    mockSubmitSale.mockResolvedValue(undefined);
    render(<PosPage />);
    await act(async () => {
      screen.getByTestId("cart-submit").click();
    });
    expect(mockSubmitSale).toHaveBeenCalledTimes(1);
    expect(mockSubmitQuote).not.toHaveBeenCalled();
  });

  it("cuando saleStatus='succeeded' muestra SaleConfirmedModal (no navega a /quotes)", () => {
    saleMockState = { status: "succeeded", sale: { id: "s10" }, error: null };
    render(<PosPage />);
    expect(screen.getByTestId("sale-confirmed")).toBeInTheDocument();
    expect(mockRouterPush).not.toHaveBeenCalledWith(expect.stringContaining("/quotes/"));
  });
});

describe("PosPage — sin permisos", () => {
  it("muestra EmptyState cuando usuario no tiene sales:create ni quotes:create", () => {
    mockCan.mockReturnValue(false);
    render(<PosPage />);
    expect(screen.getByTestId("empty-state")).toBeInTheDocument();
  });
});

describe("PosPage — gutter global de 10px izq/top/der vía layout (sales-screens-padding)", () => {
  beforeEach(() => {
    mockCan.mockImplementation((perm) => {
      if (perm === "sales:create") return true;
      return false;
    });
  });

  it("el contenedor raíz NO duplica el padding top y mantiene altura sin overflow", () => {
    const { container } = render(<PosPage />);
    expect(container.firstElementChild!.className).not.toContain("pt-2.5");
    expect(container.firstElementChild!.className).toContain("h-[calc(100vh-64px)]");
  });

  it("el contenedor raíz NO duplica el padding en el estado de carga", () => {
    mockCan.mockReturnValue("loading");
    const { container } = render(<PosPage />);
    expect(container.firstElementChild!.className).not.toContain("pt-2.5");
  });

  it("el contenedor raíz NO duplica el padding en el estado sin permisos", () => {
    mockCan.mockReturnValue(false);
    const { container } = render(<PosPage />);
    expect(container.firstElementChild!.className).not.toContain("pt-2.5");
  });
});
