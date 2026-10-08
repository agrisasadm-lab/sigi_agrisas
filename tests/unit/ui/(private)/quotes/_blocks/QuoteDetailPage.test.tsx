/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen } from "@testing-library/react";

jest.mock("next/link", () => {
  const Link = ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  );
  Link.displayName = "Link";
  return Link;
});
jest.mock("../../../../../../app/_hooks/useCurrentUser");
jest.mock("../../../../../../app/(private)/quotes/_logic/hooks/useQuoteDetail");
jest.mock("../../../../../../app/(private)/quotes/_logic/hooks/useQuoteMutations");
jest.mock("../../../../../../app/(private)/quotes/_blocks/QuoteActionsBar", () => ({
  QuoteActionsBar: () => null,
}));

import { useCurrentUser } from "../../../../../../app/_hooks/useCurrentUser";
import { useQuoteDetail } from "../../../../../../app/(private)/quotes/_logic/hooks/useQuoteDetail";
import { useQuoteMutations } from "../../../../../../app/(private)/quotes/_logic/hooks/useQuoteMutations";
import { QuoteDetailPage } from "../../../../../../app/(private)/quotes/_blocks/QuoteDetailPage";
import type { QuoteDetail } from "../../../../../../app/(private)/quotes/_logic/types/domain";

const mockUseCurrentUser = useCurrentUser as jest.MockedFunction<typeof useCurrentUser>;
const mockUseQuoteDetail = useQuoteDetail as jest.MockedFunction<typeof useQuoteDetail>;
const mockUseQuoteMutations = useQuoteMutations as jest.MockedFunction<typeof useQuoteMutations>;

function makeQuote(overrides: Partial<QuoteDetail> = {}): QuoteDetail {
  return {
    id: "quote-1",
    branchId: "branch-1",
    creatorId: "user-1",
    folioId: "folio-1",
    folioNumber: 7,
    status: "draft",
    isExpired: false,
    subtotal: 200,
    taxTotal: 48,
    total: 248,
    items: [],
    createdAt: new Date("2026-05-30T10:00:00Z"),
    updatedAt: new Date("2026-05-30T10:00:00Z"),
    ...overrides,
  };
}

function setup(quote: QuoteDetail) {
  mockUseCurrentUser.mockReturnValue({
    userId: "u1",
    email: "test@test.com",
    roles: [],
    isLoading: false,
    branchId: null,
    can: jest.fn(() => false),
    refresh: jest.fn(),
  });
  mockUseQuoteDetail.mockReturnValue({ quote, isLoading: false, error: null, refresh: jest.fn() });
  mockUseQuoteMutations.mockReturnValue({
    isSaving: false,
    authorize: jest.fn(),
    cancel: jest.fn(),
    convert: jest.fn(),
    update: jest.fn(),
  });
}

describe("QuoteDetailPage — desglose IVA/IEPS", () => {
  beforeEach(() => jest.clearAllMocks());

  it("muestra filas IVA e IEPS separadas cuando el ítem tiene ambos impuestos", () => {
    setup(
      makeQuote({
        items: [
          {
            id: "item-1",
            productId: "product-1",
            productCodeSnapshot: "SKU-1",
            productNameSnapshot: "Producto 1",
            productPriceId: "price-1",
            priceNameSnapshot: "Default",
            quantity: 2,
            unitPrice: 100,
            discountPct: 0,
            discountAmount: 0,
            ivaRate: 0.16,
            iepsRate: 0.08,
            lineSubtotal: 200,
            lineIva: 32,
            lineIeps: 16,
            lineTotal: 248,
          },
        ],
      }),
    );
    render(<QuoteDetailPage id="quote-1" />);
    expect(screen.getAllByText("IVA").length).toBeGreaterThan(0);
    expect(screen.getAllByText("IEPS").length).toBeGreaterThan(0);
    expect(screen.getByText("$32.00")).toBeInTheDocument();
    expect(screen.getByText("$16.00")).toBeInTheDocument();
  });

  it("muestra las filas IVA/IEPS aunque ningún ítem tenga impuestos (siempre visibles)", () => {
    setup(
      makeQuote({
        items: [
          {
            id: "item-1",
            productId: "product-1",
            productCodeSnapshot: "SKU-1",
            productNameSnapshot: "Producto 1",
            productPriceId: "price-1",
            priceNameSnapshot: "Default",
            quantity: 2,
            unitPrice: 100,
            discountPct: 0,
            discountAmount: 0,
            ivaRate: 0,
            iepsRate: 0,
            lineSubtotal: 200,
            lineIva: 0,
            lineIeps: 0,
            lineTotal: 200,
          },
        ],
      }),
    );
    render(<QuoteDetailPage id="quote-1" />);
    // "IVA"/"IEPS" aparecen en el encabezado de la tabla de ítems Y en el panel de totales (siempre, aunque $0)
    expect(screen.getAllByText("IVA")).toHaveLength(2);
    expect(screen.getAllByText("IEPS")).toHaveLength(2);
    expect(screen.getAllByText("$0.00").length).toBeGreaterThanOrEqual(2);
  });
});
