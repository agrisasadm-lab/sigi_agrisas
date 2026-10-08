/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

jest.mock("next/link", () => {
  const Link = ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  );
  Link.displayName = "Link";
  return Link;
});

const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: jest.fn(() => ({ push: mockPush })),
}));

jest.mock("../../../../../../app/_hooks/useCurrentUser");
jest.mock("../../../../../../app/(private)/returns/_logic/hooks/useSaleReturns");

import { useCurrentUser } from "../../../../../../app/_hooks/useCurrentUser";
import * as useSaleReturnsModule from "../../../../../../app/(private)/returns/_logic/hooks/useSaleReturns";
import { SaleReturnsSection } from "../../../../../../app/(private)/sales/_blocks/SaleReturnsSection";
import type { SaleItem } from "../../../../../../app/(private)/sales/_logic/types/domain";

const mockUseCurrentUser = useCurrentUser as jest.MockedFunction<typeof useCurrentUser>;

function setupCurrentUser(permissions: string[]) {
  mockUseCurrentUser.mockReturnValue({
    userId: "u1",
    email: "test@test.com",
    roles: [],
    branchId: null,
    isLoading: false,
    can: (p: string) => permissions.includes(p),
    refresh: jest.fn(),
  });
}

const NOW = new Date("2026-06-01T10:00:00Z");

function makeReturn(overrides = {}) {
  return {
    id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0001",
    saleId: "s1",
    branchId: "b1",
    creatorId: "u1",
    status: "completed" as const,
    reason: "Producto en mal estado",
    refundTotal: 100,
    returnedAt: NOW,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function makeSaleItem(id = "si1", quantity = 5): SaleItem {
  return {
    id,
    productId: "p1",
    productPriceId: "pp1",
    productCodeSnapshot: "COD",
    productNameSnapshot: "Prod",
    priceNameSnapshot: "P1",
    unitPrice: 10,
    quantity,
    discountPct: 0,
    discountAmount: 0,
    ivaRate: 0.16,
    iepsRate: 0,
    lineSubtotal: 50,
    lineIva: 8,
    lineIeps: 0,
    lineTotal: 58,
  };
}

function setupReturns(returns: ReturnType<typeof makeReturn>[], isLoading = false) {
  jest.spyOn(useSaleReturnsModule, "useSaleReturns").mockReturnValue({
    returns,
    isLoading,
    error: null,
    refresh: jest.fn(),
  });
}

const defaultProps = {
  saleId: "s1",
  saleStatus: "completed" as const,
  saleItems: [makeSaleItem()],
  returnedQuantityBySaleItem: {},
};

describe("SaleReturnsSection — cuando renderiza null", () => {
  beforeEach(() => jest.clearAllMocks());

  it("sin devoluciones y sin permiso → renderiza null", () => {
    setupCurrentUser([]);
    setupReturns([]);
    const { container } = render(<SaleReturnsSection {...defaultProps} />);
    expect(container.firstChild).toBeNull();
  });

  it("sin devoluciones, con permiso pero sale cancelada → renderiza null", () => {
    setupCurrentUser(["returns:create"]);
    setupReturns([]);
    const { container } = render(
      <SaleReturnsSection {...defaultProps} saleStatus="cancelled" />
    );
    expect(container.firstChild).toBeNull();
  });

  it("todas las líneas totalmente devueltas → no muestra CTA", () => {
    setupCurrentUser(["returns:create"]);
    setupReturns([]);
    const { container } = render(
      <SaleReturnsSection
        {...defaultProps}
        returnedQuantityBySaleItem={{ si1: 5 }} // cantidad devuelta = quantity → remaining = 0
      />
    );
    expect(container.firstChild).toBeNull();
  });
});

describe("SaleReturnsSection — cuando muestra CTA", () => {
  beforeEach(() => jest.clearAllMocks());

  it("sin devoluciones, con permiso returns:create y sale completed → muestra CTA y mensaje vacío", () => {
    setupCurrentUser(["returns:create"]);
    setupReturns([]);
    render(<SaleReturnsSection {...defaultProps} />);
    expect(screen.getByRole("button", { name: /Registrar devolución/i })).toBeInTheDocument();
    expect(screen.getByText(/Aún no hay devoluciones registradas/i)).toBeInTheDocument();
  });

  it("CTA navega a /sales/[id]/returns/new", async () => {
    const user = userEvent.setup();
    setupCurrentUser(["returns:create"]);
    setupReturns([]);
    render(<SaleReturnsSection {...defaultProps} />);
    await user.click(screen.getByRole("button", { name: /Registrar devolución/i }));
    expect(mockPush).toHaveBeenCalledWith("/sales/s1/returns/new");
  });
});

describe("SaleReturnsSection — con devoluciones", () => {
  beforeEach(() => jest.clearAllMocks());

  it("muestra la lista de devoluciones con datos correctos", () => {
    setupCurrentUser(["returns:create"]);
    setupReturns([makeReturn()]);
    render(<SaleReturnsSection {...defaultProps} />);
    expect(screen.getByText(/Devoluciones/i)).toBeInTheDocument();
    expect(screen.getByText(/Producto en mal estado/i)).toBeInTheDocument();
  });

  it("header muestra cuenta N de devoluciones", () => {
    setupCurrentUser([]);
    setupReturns([makeReturn(), makeReturn({ id: "r2" })]);
    render(<SaleReturnsSection {...defaultProps} />);
    expect(screen.getByText(/Devoluciones \(2\)/i)).toBeInTheDocument();
  });

  it("click en fila de devolución navega a /returns/[id]", async () => {
    const user = userEvent.setup();
    setupCurrentUser([]);
    setupReturns([makeReturn()]);
    render(<SaleReturnsSection {...defaultProps} />);
    const rows = screen.getAllByRole("link", { name: /Ver/i });
    // The row has a "Ver" link
    await user.click(rows[0]);
    expect(rows[0]).toHaveAttribute("href", "/returns/aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0001");
  });
});
