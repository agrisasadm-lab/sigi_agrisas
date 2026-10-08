/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, within } from "@testing-library/react";

jest.mock("next/link", () => {
  const Link = ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  );
  Link.displayName = "Link";
  return Link;
});
const mockSearchParamsGet = jest.fn<string | null, [string]>(() => null);
jest.mock("next/navigation", () => ({
  useSearchParams: () => ({ get: mockSearchParamsGet }),
}));
jest.mock("../../../../../../app/_hooks/useCurrentUser");
jest.mock("../../../../../../app/_hooks/useHeadquarters");
jest.mock("../../../../../../app/(private)/sales/_logic/hooks/useSaleDetail");
jest.mock("../../../../../../app/(private)/sales/_logic/hooks/useSaleMutations");
jest.mock("../../../../../../app/(private)/returns/_logic/hooks/useSaleReturns", () => ({
  useSaleReturns: () => ({ returns: [], isLoading: false, error: null, refresh: jest.fn() }),
}));
jest.mock("../../../../../../app/(private)/sales/_blocks/SaleReturnsSection", () => ({
  SaleReturnsSection: () => null,
}));
jest.mock("../../../../../../app/(private)/sales/_blocks/SalePaymentsSection", () => ({
  SalePaymentsSection: () => null,
}));

import { useCurrentUser } from "../../../../../../app/_hooks/useCurrentUser";
import { useHeadquarters } from "../../../../../../app/_hooks/useHeadquarters";
import { useSaleDetail } from "../../../../../../app/(private)/sales/_logic/hooks/useSaleDetail";
import { useSaleMutations } from "../../../../../../app/(private)/sales/_logic/hooks/useSaleMutations";
import { SaleDetailPage } from "../../../../../../app/(private)/sales/_blocks/SaleDetailPage";
import type { SaleDetail } from "../../../../../../app/(private)/sales/_logic/types/domain";

const mockUseCurrentUser = useCurrentUser as jest.MockedFunction<typeof useCurrentUser>;
const mockUseHeadquarters = useHeadquarters as jest.MockedFunction<typeof useHeadquarters>;
const mockUseSaleDetail = useSaleDetail as jest.MockedFunction<typeof useSaleDetail>;
const mockUseSaleMutations = useSaleMutations as jest.MockedFunction<typeof useSaleMutations>;

function makeSale(status: "completed" | "cancelled" | "edited" = "completed"): SaleDetail {
  return {
    id: "sale-1",
    branchId: "branch-1",
    cashierId: "user-1",
    cashierName: "Cajero Test",
    folioId: "folio-1",
    folioCode: "A",
    folioNumber: 42,
    folioPrefix: "A",
    paymentMethodId: "pm-1",
    paymentMethodName: "Efectivo",
    status,
    subtotal: 100,
    taxTotal: 16,
    total: 116,
    paidAmount: 116,
    paymentStatus: "paid",
    isCredit: false,
    customerName: "Cliente Test",
    branchName: "Sucursal Norte",
    items: [],
    notes: null,
    cancellationReason: null,
    cancelledAt: status === "cancelled" ? new Date() : null,
    editedAt: null,
    createdAt: new Date("2026-05-30T10:00:00Z"),
    updatedAt: new Date("2026-05-30T10:00:00Z"),
    returnedQuantityBySaleItem: {},
  };
}

function setup({
  can = jest.fn(() => false as boolean | "loading"),
  branchId = null as string | null,
  hq = null as { id: string; code: string; name: string } | null,
  sale = makeSale(),
}: {
  can?: jest.Mock;
  branchId?: string | null;
  hq?: { id: string; code: string; name: string } | null;
  sale?: SaleDetail;
} = {}) {
  mockUseCurrentUser.mockReturnValue({
    userId: "u1",
    email: "test@test.com",
    roles: [],
    isLoading: false,
    branchId,
    can,
    refresh: jest.fn(),
  });
  mockUseHeadquarters.mockReturnValue({ hq, isLoading: false, refresh: jest.fn() });
  mockUseSaleDetail.mockReturnValue({ sale, isLoading: false, error: null, refresh: jest.fn() });
  mockUseSaleMutations.mockReturnValue({
    isSaving: false,
    mutationError: null,
    clearError: jest.fn(),
    cancel: jest.fn(),
    edit: jest.fn(),
  });
}

describe("SaleDetailPage — botón 'Editar venta' oculto en UI (SALE_EDIT_UI_ENABLED=false)", () => {
  beforeEach(() => jest.clearAllMocks());

  it("oculta 'Editar venta' cuando sales:edit_completed=false", () => {
    setup({
      can: jest.fn(() => false),
      hq: { id: "hq-1", code: "HQ", name: "Matriz" },
      branchId: "hq-1",
    });
    render(<SaleDetailPage id="sale-1" />);
    expect(screen.queryByRole("link", { name: /Editar venta/i })).not.toBeInTheDocument();
  });

  it("oculta 'Editar venta' cuando edit=true pero el usuario no está en HQ y no tiene bypass", () => {
    setup({
      can: jest.fn((perm: string) => perm === "sales:edit_completed"),
      hq: { id: "hq-1", code: "HQ", name: "Matriz" },
      branchId: "otra-sucursal",
    });
    render(<SaleDetailPage id="sale-1" />);
    expect(screen.queryByRole("link", { name: /Editar venta/i })).not.toBeInTheDocument();
  });

  it("oculta 'Editar venta' aunque el usuario esté asignado a la sucursal HQ y el guard pase (UI deshabilitada a propósito)", () => {
    setup({
      can: jest.fn((perm: string) => perm === "sales:edit_completed"),
      hq: { id: "hq-1", code: "HQ", name: "Matriz" },
      branchId: "hq-1",
    });
    render(<SaleDetailPage id="sale-1" />);
    expect(screen.queryByRole("link", { name: /Editar venta/i })).not.toBeInTheDocument();
  });

  it("oculta 'Editar venta' aunque el usuario tenga branches:access_all (bypass) (UI deshabilitada a propósito)", () => {
    setup({
      can: jest.fn(
        (perm: string) => perm === "sales:edit_completed" || perm === "branches:access_all",
      ),
      hq: { id: "hq-1", code: "HQ", name: "Matriz" },
      branchId: "otra-sucursal",
    });
    render(<SaleDetailPage id="sale-1" />);
    expect(screen.queryByRole("link", { name: /Editar venta/i })).not.toBeInTheDocument();
  });

  it("oculta 'Editar venta' cuando la venta está cancelada aunque el usuario pueda editar y esté en HQ", () => {
    setup({
      can: jest.fn(() => true),
      hq: { id: "hq-1", code: "HQ", name: "Matriz" },
      branchId: "hq-1",
      sale: makeSale("cancelled"),
    });
    render(<SaleDetailPage id="sale-1" />);
    expect(screen.queryByRole("link", { name: /Editar venta/i })).not.toBeInTheDocument();
  });
});

describe("SaleDetailPage — aviso de límite de crédito excedido", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSearchParamsGet.mockReturnValue(null);
  });

  it("muestra el banner cuando ?creditLimitExceeded=1", () => {
    mockSearchParamsGet.mockImplementation((key: string) => (key === "creditLimitExceeded" ? "1" : null));
    setup({ can: jest.fn(() => false) });
    render(<SaleDetailPage id="sale-1" />);
    expect(screen.getByText(/excedido el límite de crédito/i)).toBeInTheDocument();
  });

  it("no muestra el banner sin el query param", () => {
    setup({ can: jest.fn(() => false) });
    render(<SaleDetailPage id="sale-1" />);
    expect(screen.queryByText(/excedido el límite de crédito/i)).not.toBeInTheDocument();
  });
});

describe("SaleDetailPage — acciones de ticket (Ver Ticket única entrada, sin Imprimir ticket redundante)", () => {
  beforeEach(() => jest.clearAllMocks());

  it("muestra el enlace 'Ver Ticket' hacia /sales/:id/ticket", () => {
    setup({ can: jest.fn(() => false) });
    render(<SaleDetailPage id="sale-1" />);
    expect(screen.getByRole("link", { name: /Ver Ticket/i })).toHaveAttribute(
      "href",
      "/sales/sale-1/ticket",
    );
  });

  it("no muestra el botón 'Imprimir ticket' redundante", () => {
    setup({ can: jest.fn(() => false) });
    render(<SaleDetailPage id="sale-1" />);
    expect(screen.queryByRole("button", { name: /Imprimir ticket/i })).not.toBeInTheDocument();
  });
});

describe("SaleDetailPage — desglose IVA/IEPS", () => {
  beforeEach(() => jest.clearAllMocks());

  it("muestra filas IVA e IEPS separadas cuando el ítem tiene ambos impuestos", () => {
    const sale = makeSale();
    sale.items = [
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
    ];
    setup({ sale });
    render(<SaleDetailPage id="sale-1" />);
    expect(screen.getAllByText("IVA").length).toBeGreaterThan(0);
    expect(screen.getAllByText("IEPS").length).toBeGreaterThan(0);
    const totals = within(screen.getByTestId("sale-totals"));
    expect(totals.getByText("$32.00")).toBeInTheDocument();
    expect(totals.getByText("$16.00")).toBeInTheDocument();
  });

  it("muestra la fila IEPS en $0.00 aunque ningún ítem tenga IEPS (siempre visible)", () => {
    const sale = makeSale();
    sale.items = [
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
        iepsRate: 0,
        lineSubtotal: 200,
        lineIva: 32,
        lineIeps: 0,
        lineTotal: 232,
      },
    ];
    setup({ sale });
    render(<SaleDetailPage id="sale-1" />);
    const totals = within(screen.getByTestId("sale-totals"));
    expect(totals.getByText("$32.00")).toBeInTheDocument();
    expect(totals.getByText("IEPS")).toBeInTheDocument();
    expect(totals.getByText("$0.00")).toBeInTheDocument();
  });
});

describe("SaleDetailPage — gutter global de 10px izq/top/der vía layout (sales-screens-padding)", () => {
  beforeEach(() => jest.clearAllMocks());

  it("el contenedor raíz NO duplica el padding top en el estado normal", () => {
    setup({ can: jest.fn(() => false) });
    const { container } = render(<SaleDetailPage id="sale-1" />);
    const root = container.firstElementChild;
    expect(root).not.toBeNull();
    expect(root!.className).not.toContain("pt-2.5");
  });

  it("el contenedor raíz NO duplica el padding en el estado de carga", () => {
    setup({ can: jest.fn(() => false) });
    mockUseSaleDetail.mockReturnValue({ sale: null, isLoading: true, error: null, refresh: jest.fn() });
    const { container } = render(<SaleDetailPage id="sale-1" />);
    expect(container.firstElementChild!.className).not.toContain("pt-2.5");
  });

  it("el contenedor raíz NO duplica el padding en el estado de error", () => {
    setup({ can: jest.fn(() => false) });
    mockUseSaleDetail.mockReturnValue({ sale: null, isLoading: false, error: new Error("boom"), refresh: jest.fn() });
    const { container } = render(<SaleDetailPage id="sale-1" />);
    expect(container.firstElementChild!.className).not.toContain("pt-2.5");
  });
});
