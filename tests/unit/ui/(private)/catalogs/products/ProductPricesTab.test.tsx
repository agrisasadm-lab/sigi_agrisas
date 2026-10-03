import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = jest.fn(function (this: HTMLDialogElement) {
    this.setAttribute("open", "");
  });
  HTMLDialogElement.prototype.close = jest.fn(function (this: HTMLDialogElement) {
    this.removeAttribute("open");
  });
});

jest.mock(
  "../../../../../../app/(private)/catalogs/products/_logic/hooks/useProductPrices",
  () => ({ useProductPrices: jest.fn() })
);
jest.mock("../../../../../../app/_hooks/useBranchesOptions");
jest.mock("../../../../../../app/_hooks/useCurrentUser");
jest.mock("../../../../../../app/_hooks/useHeadquarters");

import { useProductPrices } from "../../../../../../app/(private)/catalogs/products/_logic/hooks/useProductPrices";
import { useBranchesOptions } from "../../../../../../app/_hooks/useBranchesOptions";
import { useCurrentUser } from "../../../../../../app/_hooks/useCurrentUser";
import { useHeadquarters } from "../../../../../../app/_hooks/useHeadquarters";
import { ProductPricesTab } from "../../../../../../app/(private)/catalogs/products/_blocks/ProductPricesTab";
import type { ProductPrice } from "../../../../../../app/(private)/catalogs/products/_logic/types/domain";

const mockUseProductPrices = useProductPrices as jest.Mock;
const mockUseBranchesOptions = useBranchesOptions as jest.MockedFunction<typeof useBranchesOptions>;
const mockUseCurrentUser = useCurrentUser as jest.MockedFunction<typeof useCurrentUser>;
const mockUseHeadquarters = useHeadquarters as jest.MockedFunction<typeof useHeadquarters>;

const BASE_HOOK = {
  prices: [] as ProductPrice[],
  isLoading: false,
  error: null,
  isSaving: false,
  saveError: null,
  clearSaveError: jest.fn(),
  refresh: jest.fn(),
  createOne: jest.fn(),
  updateOne: jest.fn(),
  deleteOne: jest.fn(),
};

const makePrices = (overrides: Partial<ProductPrice>[] = []): ProductPrice[] => [
  {
    id: "pr1",
    productId: "p1",
    branchId: "b-matriz",
    name: "Menudeo",
    price: 12.0,
    minQuantity: 1,
    discountPct: null,
    isDefault: true,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    ...overrides[0],
  },
  {
    id: "pr2",
    productId: "p1",
    branchId: "b-matriz",
    name: "Mayoreo",
    price: 10.0,
    minQuantity: 10,
    discountPct: 5,
    isDefault: false,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    ...overrides[1],
  },
];

beforeEach(() => {
  jest.clearAllMocks();
  mockUseBranchesOptions.mockReturnValue({
    options: [
      { id: "b-matriz", name: "Matriz" },
      { id: "b-zarioz", name: "Zarioz" },
      { id: "b-huajuapan", name: "Huajuapan" },
    ],
    isLoading: false,
    refresh: jest.fn(),
  });
  mockUseHeadquarters.mockReturnValue({
    hq: { id: "b-matriz", code: "MATRIZ", name: "Matriz" },
    isLoading: false,
    refresh: jest.fn(),
  });
  // Default: usuario con branches:access_all (ej. admin) — arranca en la matriz.
  mockUseCurrentUser.mockReturnValue({
    userId: "u1",
    email: "admin@example.com",
    roles: ["admin"],
    branchId: null,
    isLoading: false,
    can: () => true,
    refresh: jest.fn(),
  });
});

describe("ProductPricesTab — badge Default", () => {
  it("muestra badge 'Default' en la fila del precio marcado como default", () => {
    mockUseProductPrices.mockReturnValue({ ...BASE_HOOK, prices: makePrices() });

    render(<ProductPricesTab productId="p1" canWrite={true} />);

    const allDefault = screen.getAllByText("Default");
    expect(allDefault.some((el) => el.tagName === "SPAN")).toBe(true);
    expect(screen.getAllByRole("row").length).toBeGreaterThan(1);
  });

  it("la fila no-default no muestra badge 'Default'", () => {
    mockUseProductPrices.mockReturnValue({ ...BASE_HOOK, prices: makePrices() });

    render(<ProductPricesTab productId="p1" canWrite={true} />);

    const rows = screen.getAllByRole("row").slice(1);
    const mayoreoRow = rows.find((r) => r.textContent?.includes("Mayoreo"));
    expect(mayoreoRow?.textContent).not.toMatch(/^Default/);
  });
});

describe("ProductPricesTab — gating de permisos", () => {
  it("canWrite=true muestra botón 'Nuevo precio' y acciones de fila", () => {
    mockUseProductPrices.mockReturnValue({ ...BASE_HOOK, prices: makePrices() });

    render(<ProductPricesTab productId="p1" canWrite={true} />);

    expect(screen.getByRole("button", { name: /nuevo precio/i })).toBeInTheDocument();
  });

  it("canWrite=false oculta botón 'Nuevo precio' y muestra caption de solo lectura", () => {
    mockUseProductPrices.mockReturnValue({ ...BASE_HOOK, prices: makePrices() });

    render(<ProductPricesTab productId="p1" canWrite={false} />);

    expect(screen.queryByRole("button", { name: /nuevo precio/i })).not.toBeInTheDocument();
    expect(screen.getByText(/solo lectura/i)).toBeInTheDocument();
  });
});

describe("ProductPricesTab — estado vacío", () => {
  it("muestra mensaje cuando no hay precios", () => {
    mockUseProductPrices.mockReturnValue({ ...BASE_HOOK, prices: [] });

    render(<ProductPricesTab productId="p1" canWrite={true} />);

    expect(screen.getByText(/sin precios configurados/i)).toBeInTheDocument();
  });
});

describe("ProductPricesTab — precio por sucursal (sin herencia)", () => {
  it("con branches:access_all arranca en la matriz y despacha el hook con su branchId", async () => {
    mockUseProductPrices.mockReturnValue({ ...BASE_HOOK, prices: makePrices() });

    render(<ProductPricesTab productId="p1" canWrite={true} />);

    await waitFor(() => {
      expect(screen.getByRole("combobox", { name: /sucursal/i })).toHaveValue("b-matriz");
    });
    expect(mockUseProductPrices).toHaveBeenLastCalledWith("p1", "b-matriz");
  });

  it("no ofrece ninguna opción de 'todas las sucursales'", async () => {
    mockUseProductPrices.mockReturnValue({ ...BASE_HOOK, prices: makePrices() });

    render(<ProductPricesTab productId="p1" canWrite={true} />);

    await waitFor(() => expect(screen.getByRole("combobox", { name: /sucursal/i })).toHaveValue("b-matriz"));
    const options = screen.getAllByRole("option");
    expect(options.map((o) => o.textContent)).not.toContain("Precio base (todas)");
  });

  it("seleccionar otra sucursal despacha el hook con su branchId", async () => {
    mockUseProductPrices.mockReturnValue({ ...BASE_HOOK, prices: makePrices() });

    render(<ProductPricesTab productId="p1" canWrite={true} />);
    await waitFor(() => expect(screen.getByRole("combobox", { name: /sucursal/i })).toHaveValue("b-matriz"));

    fireEvent.change(screen.getByRole("combobox", { name: /sucursal/i }), { target: { value: "b-zarioz" } });

    expect(mockUseProductPrices).toHaveBeenLastCalledWith("p1", "b-zarioz");
  });

  it("no muestra columna Origen ni acción 'Crear override aquí'", async () => {
    mockUseProductPrices.mockReturnValue({ ...BASE_HOOK, prices: makePrices() });

    render(<ProductPricesTab productId="p1" canWrite={true} />);
    await waitFor(() => expect(screen.getByRole("combobox", { name: /sucursal/i })).toHaveValue("b-matriz"));

    expect(screen.queryByText(/^origen$/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /crear override aquí/i })).not.toBeInTheDocument();
    expect(screen.getAllByTitle("Editar").length).toBeGreaterThan(0);
  });
});

describe("ProductPricesTab — filtrado del selector de sucursal por branch scope", () => {
  it("usuario sin branches:access_all y con sucursal propia ve solo esa sucursal, ya seleccionada", async () => {
    mockUseCurrentUser.mockReturnValue({
      userId: "u2",
      email: "operador@example.com",
      roles: ["tienda_zarioz"],
      branchId: "b-zarioz",
      isLoading: false,
      can: () => false,
      refresh: jest.fn(),
    });
    mockUseProductPrices.mockReturnValue({ ...BASE_HOOK, prices: makePrices() });

    render(<ProductPricesTab productId="p1" canWrite={true} />);

    await waitFor(() => expect(screen.getByRole("combobox", { name: /sucursal/i })).toHaveValue("b-zarioz"));
    const options = screen.getAllByRole("option");
    expect(options.map((o) => o.textContent)).toEqual(["Zarioz"]);
  });

  it("usuario con branches:access_all sigue viendo todas las sucursales activas", async () => {
    mockUseProductPrices.mockReturnValue({ ...BASE_HOOK, prices: makePrices() });

    render(<ProductPricesTab productId="p1" canWrite={true} />);

    await waitFor(() => expect(screen.getByRole("combobox", { name: /sucursal/i })).toHaveValue("b-matriz"));
    const options = screen.getAllByRole("option");
    expect(options.map((o) => o.textContent)).toEqual(["Matriz", "Zarioz", "Huajuapan"]);
  });

  it("usuario sin branches:access_all y sin sucursal asignada ve un estado vacío, sin llamar al hook de precios", () => {
    mockUseCurrentUser.mockReturnValue({
      userId: "u3",
      email: "sinsucursal@example.com",
      roles: ["viewer"],
      branchId: null,
      isLoading: false,
      can: () => false,
      refresh: jest.fn(),
    });
    mockUseProductPrices.mockReturnValue({ ...BASE_HOOK, prices: [] });

    render(<ProductPricesTab productId="p1" canWrite={true} />);

    expect(screen.getByText(/necesitas una sucursal asignada/i)).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: /sucursal/i })).not.toBeInTheDocument();
  });
});
