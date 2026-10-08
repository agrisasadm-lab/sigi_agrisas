/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
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

jest.mock("../../../../../../../../../app/_hooks/useCurrentUser");
jest.mock("../../../../../../../../../app/(private)/sales/_logic/hooks/useSaleDetail");
jest.mock("../../../../../../../../../app/(private)/waybills/_logic/services", () => ({
  createWaybill: jest.fn(),
}));

import { useCurrentUser } from "../../../../../../../../../app/_hooks/useCurrentUser";
import { useSaleDetail } from "../../../../../../../../../app/(private)/sales/_logic/hooks/useSaleDetail";
import { createWaybill } from "../../../../../../../../../app/(private)/waybills/_logic/services";
import { CreateSaleWaybillPage } from "../../../../../../../../../app/(private)/sales/[id]/waybill/new/_blocks/CreateSaleWaybillPage";
import type { SaleDetail } from "../../../../../../../../../app/(private)/sales/_logic/types/domain";

const mockUseCurrentUser = useCurrentUser as jest.MockedFunction<typeof useCurrentUser>;
const mockUseSaleDetail = useSaleDetail as jest.MockedFunction<typeof useSaleDetail>;
const mockCreateWaybill = createWaybill as jest.MockedFunction<typeof createWaybill>;

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

const SALE_UUID = "11111111-1111-1111-1111-111111111111";

function makeSale(overrides: Partial<SaleDetail> = {}): SaleDetail {
  return {
    id: SALE_UUID,
    branchId: "branch-1",
    branchName: "Sucursal Norte",
    cashierId: "user-1",
    folioId: "folio-1",
    folioCode: "A",
    folioNumber: 42,
    folioPrefix: "A",
    paymentMethodId: "pm-1",
    status: "completed",
    subtotal: 100,
    taxTotal: 16,
    total: 116,
    paidAmount: 116,
    paymentStatus: "paid",
    isCredit: false,
    customerId: "c1",
    customerName: "Cliente Uno",
    items: [
      {
        id: "item-1",
        productId: "22222222-2222-2222-2222-222222222222",
        productCodeSnapshot: "P001",
        productNameSnapshot: "Fertilizante",
        productPriceId: "price-1",
        priceNameSnapshot: "Menudeo",
        quantity: 10,
        unitPrice: 100,
        discountPct: 0,
        discountAmount: 0,
        ivaRate: 0.16,
        iepsRate: 0,
        lineSubtotal: 1000,
        lineIva: 160,
        lineIeps: 0,
        lineTotal: 1160,
      },
    ],
    notes: null,
    cancellationReason: null,
    cancelledAt: null,
    editedAt: null,
    createdAt: new Date("2026-05-30T10:00:00Z"),
    updatedAt: new Date("2026-05-30T10:00:00Z"),
    returnedQuantityBySaleItem: {},
    ...overrides,
  };
}

describe("CreateSaleWaybillPage — guards", () => {
  beforeEach(() => jest.clearAllMocks());

  it("shows spinner while loading", () => {
    setupCurrentUser(["waybills:write", "waybills:stamp"]);
    mockUseSaleDetail.mockReturnValue({ sale: null, isLoading: true, error: null, refresh: jest.fn() });
    render(<CreateSaleWaybillPage saleId="sale-1" />);
    expect(screen.queryByText(/generar carta porte/i)).not.toBeInTheDocument();
  });

  it("shows 'Sin acceso' when the user lacks waybills:write", () => {
    setupCurrentUser(["waybills:stamp"]);
    mockUseSaleDetail.mockReturnValue({ sale: makeSale(), isLoading: false, error: null, refresh: jest.fn() });
    render(<CreateSaleWaybillPage saleId="sale-1" />);
    expect(screen.getByText("Sin acceso")).toBeInTheDocument();
  });

  it("shows 'Sin acceso' when the user lacks waybills:stamp", () => {
    setupCurrentUser(["waybills:write"]);
    mockUseSaleDetail.mockReturnValue({ sale: makeSale(), isLoading: false, error: null, refresh: jest.fn() });
    render(<CreateSaleWaybillPage saleId="sale-1" />);
    expect(screen.getByText("Sin acceso")).toBeInTheDocument();
  });

  it("blocks with EmptyState when the sale is not completed", () => {
    setupCurrentUser(["waybills:write", "waybills:stamp"]);
    mockUseSaleDetail.mockReturnValue({
      sale: makeSale({ status: "cancelled" }),
      isLoading: false,
      error: null,
      refresh: jest.fn(),
    });
    render(<CreateSaleWaybillPage saleId="sale-1" />);
    expect(screen.getByText(/no admite carta porte/i)).toBeInTheDocument();
  });

  it("blocks with EmptyState when the sale has no customer", () => {
    setupCurrentUser(["waybills:write", "waybills:stamp"]);
    mockUseSaleDetail.mockReturnValue({
      sale: makeSale({ customerId: null }),
      isLoading: false,
      error: null,
      refresh: jest.fn(),
    });
    render(<CreateSaleWaybillPage saleId="sale-1" />);
    expect(screen.getByText(/no tiene cliente/i)).toBeInTheDocument();
  });
});

describe("CreateSaleWaybillPage — form", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupCurrentUser(["waybills:write", "waybills:stamp"]);
    mockUseSaleDetail.mockReturnValue({ sale: makeSale(), isLoading: false, error: null, refresh: jest.fn() });
  });

  it("pre-fills the line from sale.items with product name and quantity locked", () => {
    render(<CreateSaleWaybillPage saleId="sale-1" />);
    expect(screen.getByDisplayValue("Fertilizante")).toBeDisabled();
    expect(screen.getByText("10")).toBeInTheDocument();
  });

  it("shows origin (branch) and destination (customer) as fixed text", () => {
    render(<CreateSaleWaybillPage saleId="sale-1" />);
    expect(screen.getByText(/sucursal norte/i)).toBeInTheDocument();
    expect(screen.getByText(/cliente uno/i)).toBeInTheDocument();
  });

  it("submits successfully and redirects to the created waybill", async () => {
    mockCreateWaybill.mockResolvedValue({ id: "wb-1" } as Awaited<ReturnType<typeof mockCreateWaybill>>);
    render(<CreateSaleWaybillPage saleId="sale-1" />);
    const user = userEvent.setup();

    await user.type(screen.getByPlaceholderText("Clave SAT"), "10161500");
    await user.type(screen.getByPlaceholderText("Unidad"), "KGM");
    await user.clear(screen.getByPlaceholderText("0"));
    await user.type(screen.getByPlaceholderText("0"), "100");

    await user.type(screen.getByLabelText(/placa/i), "ABC1234");
    await user.type(screen.getByLabelText(/configuración vehicular/i), "C2");
    await user.type(screen.getByLabelText(/tipo de permiso sct/i), "TPAF01");
    await user.type(screen.getByLabelText(/número de permiso sct/i), "SCT-1");
    await user.type(screen.getByLabelText(/aseguradora/i), "Aseguradora SA");
    await user.type(screen.getByLabelText(/póliza/i), "POL-1");
    await user.type(screen.getByLabelText(/^nombre \*/i), "Juan Perez");
    await user.type(screen.getByLabelText(/número de licencia/i), "LIC-1");

    fireEvent.change(screen.getByLabelText(/salida/i), { target: { value: "2026-08-01T08:00" } });
    fireEvent.change(screen.getByLabelText(/llegada/i), { target: { value: "2026-08-01T12:00" } });
    await user.clear(screen.getByLabelText(/distancia/i));
    await user.type(screen.getByLabelText(/distancia/i), "50");

    await user.click(screen.getByRole("button", { name: /timbrar carta porte/i }));

    await waitFor(() => expect(mockCreateWaybill).toHaveBeenCalledTimes(1));
    expect(mockCreateWaybill).toHaveBeenCalledWith(
      expect.objectContaining({ type: "carta_porte", saleId: SALE_UUID })
    );
    expect(mockPush).toHaveBeenCalledWith("/waybills/wb-1");
  });
});
