import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";

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

import { useProductPrices } from "../../../../../../app/(private)/catalogs/products/_logic/hooks/useProductPrices";
import { useBranchesOptions } from "../../../../../../app/_hooks/useBranchesOptions";
import { useCurrentUser } from "../../../../../../app/_hooks/useCurrentUser";
import { ProductPricesTab } from "../../../../../../app/(private)/catalogs/products/_blocks/ProductPricesTab";
import type { ProductPrice } from "../../../../../../app/(private)/catalogs/products/_logic/types/domain";

const mockUseProductPrices = useProductPrices as jest.Mock;
const mockUseBranchesOptions = useBranchesOptions as jest.MockedFunction<typeof useBranchesOptions>;
const mockUseCurrentUser = useCurrentUser as jest.MockedFunction<typeof useCurrentUser>;

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
    branchId: null,
    isOverride: false,
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
    branchId: null,
    isOverride: false,
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
    options: [{ id: "b-zarioz", name: "Zarioz" }, { id: "b-huajuapan", name: "Huajuapan" }],
    isLoading: false,
    refresh: jest.fn(),
  });
  // Default: usuario con branches:access_all (ej. admin) — comportamiento previo sin filtrar.
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

    // La columna header también dice "Default"; verificamos que al menos un <span> badge esté presente
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

describe("ProductPricesTab — precio por sucursal", () => {
  it("selector inicia en 'Precio base (todas)' y despacha sin branchId", () => {
    mockUseProductPrices.mockReturnValue({ ...BASE_HOOK, prices: makePrices() });

    render(<ProductPricesTab productId="p1" canWrite={true} />);

    expect(screen.getByRole("combobox", { name: /sucursal/i })).toHaveValue("");
    expect(mockUseProductPrices).toHaveBeenCalledWith("p1", null);
  });

  it("seleccionar una sucursal despacha el hook con su branchId", () => {
    mockUseProductPrices.mockReturnValue({ ...BASE_HOOK, prices: makePrices() });

    render(<ProductPricesTab productId="p1" canWrite={true} />);
    fireEvent.change(screen.getByRole("combobox", { name: /sucursal/i }), { target: { value: "b-zarioz" } });

    expect(mockUseProductPrices).toHaveBeenLastCalledWith("p1", "b-zarioz");
  });

  it("muestra badge 'Override <sucursal>' en una fila override y 'Base' en una heredada", () => {
    mockUseProductPrices.mockReturnValue({
      ...BASE_HOOK,
      prices: makePrices([{ branchId: "b-zarioz", isOverride: true }, {}]),
    });

    render(<ProductPricesTab productId="p1" canWrite={true} />);

    expect(screen.getByText(/override zarioz/i)).toBeInTheDocument();
    expect(screen.getByText(/^base$/i)).toBeInTheDocument();
  });

  it("con sucursal seleccionada, una fila heredada muestra 'Crear override aquí' en vez de Editar/Eliminar", () => {
    mockUseProductPrices.mockReturnValue({
      ...BASE_HOOK,
      prices: makePrices([{ branchId: null, isOverride: false }, {}]),
    });

    render(<ProductPricesTab productId="p1" canWrite={true} />);
    fireEvent.change(screen.getByRole("combobox", { name: /sucursal/i }), { target: { value: "b-zarioz" } });

    expect(screen.getAllByRole("button", { name: /crear override aquí/i }).length).toBeGreaterThan(0);
    expect(screen.queryByTitle("Editar")).not.toBeInTheDocument();
  });

  it("crear override aquí abre el modal de creación con branchId y nombre pre-cargados", () => {
    mockUseProductPrices.mockReturnValue({
      ...BASE_HOOK,
      prices: makePrices([{ branchId: null, isOverride: false, name: "Precio Publico" }, {}]),
    });

    render(<ProductPricesTab productId="p1" canWrite={true} />);
    fireEvent.change(screen.getByRole("combobox", { name: /sucursal/i }), { target: { value: "b-zarioz" } });
    fireEvent.click(screen.getAllByRole("button", { name: /crear override aquí/i })[0]);

    expect(screen.getByText(/nuevo override de sucursal/i)).toBeInTheDocument();
    expect(screen.getByText(/sólo aplica a zarioz/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue("Precio Publico")).toBeInTheDocument();
  });
});

describe("ProductPricesTab — filtrado del selector de sucursal por branch scope", () => {
  it("usuario sin branches:access_all y con sucursal propia ve solo esa sucursal + Precio base", () => {
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

    const options = screen.getAllByRole("option", { name: /.+/ });
    const optionLabels = options.map((o) => o.textContent);
    expect(optionLabels).toEqual(["Precio base (todas)", "Zarioz"]);
  });

  it("usuario con branches:access_all sigue viendo todas las sucursales activas", () => {
    mockUseCurrentUser.mockReturnValue({
      userId: "u1",
      email: "admin@example.com",
      roles: ["admin"],
      branchId: null,
      isLoading: false,
      can: () => true,
      refresh: jest.fn(),
    });
    mockUseProductPrices.mockReturnValue({ ...BASE_HOOK, prices: makePrices() });

    render(<ProductPricesTab productId="p1" canWrite={true} />);

    const options = screen.getAllByRole("option", { name: /.+/ });
    const optionLabels = options.map((o) => o.textContent);
    expect(optionLabels).toEqual(["Precio base (todas)", "Zarioz", "Huajuapan"]);
  });

  it("usuario sin branches:access_all y sin sucursal asignada ve solo Precio base", () => {
    mockUseCurrentUser.mockReturnValue({
      userId: "u3",
      email: "sinsucursal@example.com",
      roles: ["viewer"],
      branchId: null,
      isLoading: false,
      can: () => false,
      refresh: jest.fn(),
    });
    mockUseProductPrices.mockReturnValue({ ...BASE_HOOK, prices: makePrices() });

    render(<ProductPricesTab productId="p1" canWrite={true} />);

    const options = screen.getAllByRole("option", { name: /.+/ });
    const optionLabels = options.map((o) => o.textContent);
    expect(optionLabels).toEqual(["Precio base (todas)"]);
  });
});
