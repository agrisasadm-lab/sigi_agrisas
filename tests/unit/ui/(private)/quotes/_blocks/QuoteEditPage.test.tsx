/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, act } from "@testing-library/react";

const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock("../../../../../../app/_hooks/useCurrentUser", () => ({
  useCurrentUser: () => ({ can: () => true, userId: "u1", email: "t@t.com", roles: [], branchId: null, isLoading: false, refresh: jest.fn() }),
}));
jest.mock("../../../../../../app/(private)/quotes/_logic/hooks/useQuoteDetail");
jest.mock("../../../../../../app/(private)/quotes/_logic/hooks/useQuoteMutations");
const mockAddLine = jest.fn();
const mockUseCart = jest.fn().mockReturnValue({
  lines: [],
  totals: { subtotal: 0, taxTotal: 0, total: 0 },
  addLine: mockAddLine,
  updateQuantity: jest.fn(),
  updateDiscountPct: jest.fn(),
  changeTier: jest.fn(),
  removeLine: jest.fn(),
  clear: jest.fn(),
});
jest.mock("../../../../../../app/(private)/pos/_logic/hooks/useCart", () => ({
  useCart: (...args: unknown[]) => mockUseCart(...args),
}));
jest.mock("../../../../../../app/_hooks/useFoliosOptions", () => ({
  useFoliosOptions: () => ({ options: [], isLoading: false }),
}));
jest.mock("../../../../../../app/_hooks/usePricingSettingsOptions", () => ({
  usePricingSettingsOptions: () => ({ dosificationSurchargePct: 7, isLoading: false }),
}));
jest.mock("../../../../../../app/(private)/pos/_blocks/ProductCatalogPanel", () => ({
  ProductCatalogPanel: () => <div data-testid="catalog-panel" />,
}));
jest.mock("../../../../../../app/(private)/quotes/_blocks/QuoteEmitPanel", () => ({
  QuoteEmitPanel: ({ onSubmit }: { onSubmit: () => void }) => (
    <div data-testid="emit-panel">
      <button onClick={onSubmit}>Guardar cambios</button>
    </div>
  ),
}));
jest.mock("../../../../../../app/_components/atoms/Spinner/Spinner", () => ({
  Spinner: () => <span data-testid="spinner" />,
}));
jest.mock("../../../../../../app/_components/molecules/EmptyState/EmptyState", () => ({
  EmptyState: ({ title }: { title: string }) => <div data-testid="empty-state">{title}</div>,
}));

import { useQuoteDetail } from "../../../../../../app/(private)/quotes/_logic/hooks/useQuoteDetail";
import { useQuoteMutations } from "../../../../../../app/(private)/quotes/_logic/hooks/useQuoteMutations";
import { QuoteEditPage } from "../../../../../../app/(private)/quotes/_blocks/QuoteEditPage";
import { QuoteNotEditableError } from "../../../../../../app/(private)/quotes/_logic/errors";
import type { QuoteDetail } from "../../../../../../app/(private)/quotes/_logic/types/domain";

const mockUseQuoteDetail = useQuoteDetail as jest.MockedFunction<typeof useQuoteDetail>;
const mockUseQuoteMutations = useQuoteMutations as jest.MockedFunction<typeof useQuoteMutations>;

const draftQuote: QuoteDetail = {
  id: "q1",
  branchId: "b1",
  branchName: "Main",
  customerId: null,
  customerName: null,
  creatorId: "u1",
  creatorName: null,
  folioId: "f1",
  folioNumber: 1,
  folioPrefix: "COT",
  status: "draft",
  isExpired: false,
  subtotal: 0,
  taxTotal: 0,
  total: 0,
  expiresAt: null,
  createdAt: new Date("2026-06-01"),
  updatedAt: new Date("2026-06-01"),
  items: [],
};

const mutationsBase = {
  isSaving: false,
  authorize: jest.fn(),
  cancel: jest.fn(),
  convert: jest.fn(),
  update: jest.fn(),
};

beforeEach(() => {
  mockPush.mockReset();
  mockAddLine.mockReset();
  jest.useFakeTimers();
  mockUseQuoteMutations.mockReturnValue({ ...mutationsBase });
});

afterEach(() => {
  jest.useRealTimers();
});

describe("QuoteEditPage — redirect si status no es draft", () => {
  it("muestra toast y redirige a /quotes/[id] si quote.status es 'authorized'", async () => {
    const authorizedQuote = { ...draftQuote, status: "authorized" as const };
    mockUseQuoteDetail.mockReturnValue({
      quote: authorizedQuote, isLoading: false, error: null, refresh: jest.fn(),
    });

    render(<QuoteEditPage id="q1" />);

    // Toast message should appear
    expect(screen.getByText(/La cotización no puede editarse/i)).toBeInTheDocument();

    // After 2s, router.push should fire
    await act(async () => { jest.advanceTimersByTime(2000); });
    expect(mockPush).toHaveBeenCalledWith("/quotes/q1");
  });

  it("muestra toast y redirige si quote.status es 'cancelled'", async () => {
    mockUseQuoteDetail.mockReturnValue({
      quote: { ...draftQuote, status: "cancelled" as const },
      isLoading: false, error: null, refresh: jest.fn(),
    });
    render(<QuoteEditPage id="q1" />);
    expect(screen.getByText(/La cotización no puede editarse/i)).toBeInTheDocument();
    await act(async () => { jest.advanceTimersByTime(2000); });
    expect(mockPush).toHaveBeenCalledWith("/quotes/q1");
  });

  it("NO redirige si quote.status es 'draft'", async () => {
    mockUseQuoteDetail.mockReturnValue({
      quote: draftQuote, isLoading: false, error: null, refresh: jest.fn(),
    });
    render(<QuoteEditPage id="q1" />);
    expect(screen.queryByText(/La cotización no puede editarse/i)).not.toBeInTheDocument();
    await act(async () => { jest.advanceTimersByTime(2000); });
    expect(mockPush).not.toHaveBeenCalled();
  });
});

describe("QuoteEditPage — recargo de dosificación", () => {
  it("pasa el dosificationSurchargePct vigente a useCart", () => {
    mockUseQuoteDetail.mockReturnValue({
      quote: draftQuote, isLoading: false, error: null, refresh: jest.fn(),
    });
    render(<QuoteEditPage id="q1" />);
    expect(mockUseCart).toHaveBeenCalledWith(7);
  });

  it("revierte el recargo ya aplicado en el snapshot para una línea de cantidad fraccionaria", () => {
    // unitPrice=105 ya incluye el recargo mockeado de 7% sobre un precio base de 100.
    const fractionalItem = {
      id: "i1",
      productId: "p1",
      productCodeSnapshot: "COD1",
      productNameSnapshot: "Producto 1",
      productPriceId: "pp1",
      priceNameSnapshot: "General",
      quantity: 0.5,
      unitPrice: 105,
      discountPct: 0,
      discountAmount: 0,
      ivaRate: 0.16,
      iepsRate: 0,
      lineSubtotal: 0,
      lineIva: 0,
      lineIeps: 0,
      lineTotal: 0,
    };
    mockUseQuoteDetail.mockReturnValue({
      quote: { ...draftQuote, items: [fractionalItem] }, isLoading: false, error: null, refresh: jest.fn(),
    });

    render(<QuoteEditPage id="q1" />);

    expect(mockAddLine).toHaveBeenCalledTimes(1);
    const [, fakePrice, quantity] = mockAddLine.mock.calls[0];
    expect(quantity).toBe(0.5);
    expect(fakePrice.price).toBeCloseTo(105 / 1.07, 10);
  });

  it("no modifica el precio de una línea de cantidad entera (sin división)", () => {
    const integerItem = {
      id: "i2",
      productId: "p2",
      productCodeSnapshot: "COD2",
      productNameSnapshot: "Producto 2",
      productPriceId: "pp2",
      priceNameSnapshot: "General",
      quantity: 2,
      unitPrice: 50,
      discountPct: 0,
      discountAmount: 0,
      ivaRate: 0.16,
      iepsRate: 0,
      lineSubtotal: 0,
      lineIva: 0,
      lineIeps: 0,
      lineTotal: 0,
    };
    mockUseQuoteDetail.mockReturnValue({
      quote: { ...draftQuote, items: [integerItem] }, isLoading: false, error: null, refresh: jest.fn(),
    });

    render(<QuoteEditPage id="q1" />);

    expect(mockAddLine).toHaveBeenCalledTimes(1);
    const [, fakePrice] = mockAddLine.mock.calls[0];
    expect(fakePrice.price).toBe(50);
  });
});

describe("QuoteEditPage — error 409 mid-flight", () => {
  it("muestra toast y redirige al detalle si update lanza QuoteNotEditableError", async () => {
    mockUseQuoteDetail.mockReturnValue({
      quote: draftQuote, isLoading: false, error: null, refresh: jest.fn(),
    });
    mockUseQuoteMutations.mockReturnValue({
      ...mutationsBase,
      update: jest.fn().mockRejectedValue(new QuoteNotEditableError("authorized")),
    });

    const { getByRole } = render(<QuoteEditPage id="q1" />);
    const submitBtn = getByRole("button", { name: /Guardar cambios/i });

    await act(async () => { submitBtn.click(); });

    expect(screen.getByText(/La cotización cambió de estado/i)).toBeInTheDocument();
    await act(async () => { jest.advanceTimersByTime(2000); });
    expect(mockPush).toHaveBeenCalledWith("/quotes/q1");
  });
});
