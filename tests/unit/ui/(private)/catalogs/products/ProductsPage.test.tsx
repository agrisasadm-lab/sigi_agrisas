/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";

jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock("../../../../../../app/_hooks/useCurrentUser");
jest.mock("../../../../../../app/(private)/catalogs/products/_logic/hooks/useProducts");
jest.mock("../../../../../../app/(private)/catalogs/products/_logic/hooks/useProductMutations");
jest.mock("../../../../../../app/_hooks/useDepartmentsOptions");
jest.mock("../../../../../../app/_hooks/useProvidersOptions");
jest.mock("../../../../../../app/_hooks/useInventoryScopeMode");
jest.mock("../../../../../../app/(private)/catalogs/products/_blocks/ProductEditModal", () => ({
  ProductEditModal: ({ mode, onSave }: { mode: "create" | "edit"; onSave: (data: unknown) => void }) => (
    <button type="button" onClick={() => onSave({ code: "PROD1", name: "Producto Uno", unit: "kg", departmentId: "d1" })}>
      Guardar (mock, {mode})
    </button>
  ),
}));

import { useCurrentUser } from "../../../../../../app/_hooks/useCurrentUser";
import * as useProductsModule from "../../../../../../app/(private)/catalogs/products/_logic/hooks/useProducts";
import * as useProductMutationsModule from "../../../../../../app/(private)/catalogs/products/_logic/hooks/useProductMutations";
import * as useDepartmentsOptionsModule from "../../../../../../app/_hooks/useDepartmentsOptions";
import * as useProvidersOptionsModule from "../../../../../../app/_hooks/useProvidersOptions";
import * as useInventoryScopeModeModule from "../../../../../../app/_hooks/useInventoryScopeMode";
import { ProductsPage } from "../../../../../../app/(private)/catalogs/products/_blocks/ProductsPage";

const mockUseCurrentUser = useCurrentUser as jest.MockedFunction<typeof useCurrentUser>;

const createdProduct = {
  id: "p1", code: "PROD1", name: "Producto Uno", unit: "kg", unitDescription: null,
  satProductCode: null, departmentId: "d1", departmentName: "Depto", taxRateId: null,
  taxRateCode: null, providerId: null, providerName: null, ivaRate: null, iepsRate: null,
  imageUrl: null, manufactureDate: null, acquisitionPrice: null, isTaxable: false,
  isActive: true, createdAt: new Date("2026-01-01"), updatedAt: new Date("2026-01-01"),
  autoAssignedBranchId: null as string | null,
};

function setup(mode: "general" | "branch", overrides: { can?: (perm: string) => boolean | "loading"; createOne?: jest.Mock } = {}) {
  mockUseCurrentUser.mockReturnValue({
    userId: "u1", email: "test@test.com", roles: [], branchId: null, isLoading: false,
    can: overrides.can ?? (() => true), refresh: jest.fn(),
  });
  jest.spyOn(useProductsModule, "useProducts").mockReturnValue({
    items: [], total: 0, isLoading: false, error: null, refresh: jest.fn(),
  });
  jest.spyOn(useProductMutationsModule, "useProductMutations").mockReturnValue({
    isSaving: false, error: null, clearError: jest.fn(),
    createOne: overrides.createOne ?? jest.fn(), updateOne: jest.fn(), softDeleteOne: jest.fn(), reactivateOne: jest.fn(),
  });
  jest.spyOn(useDepartmentsOptionsModule, "useDepartmentsOptions").mockReturnValue({ options: [], isLoading: false });
  jest.spyOn(useProvidersOptionsModule, "useProvidersOptions").mockReturnValue({ options: [], isLoading: false });
  jest.spyOn(useInventoryScopeModeModule, "useInventoryScopeMode").mockReturnValue({ mode, isLoading: false, refresh: jest.fn() });
}

describe("ProductsPage — nota de modo de inventario por sucursal", () => {
  beforeEach(() => jest.clearAllMocks());

  it("muestra la nota informativa cuando el modo es branch", () => {
    setup("branch");
    render(<ProductsPage />);
    expect(screen.getByText(/deben asignarse a cada sucursal desde Inventario/i)).toBeInTheDocument();
  });

  it("no muestra la nota cuando el modo es general", () => {
    setup("general");
    render(<ProductsPage />);
    expect(screen.queryByText(/deben asignarse a cada sucursal desde Inventario/i)).not.toBeInTheDocument();
  });
});

describe("ProductsPage — banner de éxito post-creación", () => {
  beforeEach(() => jest.clearAllMocks());

  it("en modo branch con inventory:write, muestra el banner con link a Inventario", async () => {
    setup("branch", { createOne: jest.fn().mockResolvedValue(createdProduct) });
    render(<ProductsPage />);

    fireEvent.click(screen.getByRole("button", { name: /nuevo producto/i }));
    fireEvent.click(screen.getByRole("button", { name: /guardar \(mock, create\)/i }));

    const link = await screen.findByRole("link", { name: /asignar a sucursal/i });
    expect(link).toHaveAttribute("href", "/inventory");
    expect(screen.getByText(/PROD1/)).toBeInTheDocument();
  });

  it("en modo branch con autoAssignedBranchId presente, muestra el banner con link 'Gestionar producto' y no 'Asignar a sucursal'", async () => {
    setup("branch", {
      createOne: jest.fn().mockResolvedValue({ ...createdProduct, autoAssignedBranchId: "branch-1" }),
    });
    render(<ProductsPage />);

    fireEvent.click(screen.getByRole("button", { name: /nuevo producto/i }));
    fireEvent.click(screen.getByRole("button", { name: /guardar \(mock, create\)/i }));

    const link = await screen.findByRole("link", { name: /gestionar producto/i });
    expect(link).toHaveAttribute("href", "/catalogs/products/p1");
    expect(screen.queryByRole("link", { name: /asignar a sucursal/i })).not.toBeInTheDocument();
  });

  it("en modo branch sin inventory:write, muestra el banner sin el link", async () => {
    setup("branch", {
      createOne: jest.fn().mockResolvedValue(createdProduct),
      can: (perm: string) => perm !== "inventory:write",
    });
    render(<ProductsPage />);

    fireEvent.click(screen.getByRole("button", { name: /nuevo producto/i }));
    fireEvent.click(screen.getByRole("button", { name: /guardar \(mock, create\)/i }));

    expect(await screen.findByText(/PROD1/)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /asignar a sucursal/i })).not.toBeInTheDocument();
  });

  it("en modo general, crear un producto no muestra el banner", async () => {
    setup("general", { createOne: jest.fn().mockResolvedValue(createdProduct) });
    render(<ProductsPage />);

    fireEvent.click(screen.getByRole("button", { name: /nuevo producto/i }));
    fireEvent.click(screen.getByRole("button", { name: /guardar \(mock, create\)/i }));

    await screen.findByRole("button", { name: /nuevo producto/i });
    expect(screen.queryByText(/PROD1/)).not.toBeInTheDocument();
  });

  it("editar un producto existente no muestra el banner post-creación", async () => {
    const updateOne = jest.fn().mockResolvedValue(createdProduct);
    mockUseCurrentUser.mockReturnValue({
      userId: "u1", email: "test@test.com", roles: [], branchId: null, isLoading: false,
      can: () => true, refresh: jest.fn(),
    });
    jest.spyOn(useProductsModule, "useProducts").mockReturnValue({
      items: [createdProduct], total: 1, isLoading: false, error: null, refresh: jest.fn(),
    });
    jest.spyOn(useProductMutationsModule, "useProductMutations").mockReturnValue({
      isSaving: false, error: null, clearError: jest.fn(),
      createOne: jest.fn(), updateOne, softDeleteOne: jest.fn(), reactivateOne: jest.fn(),
    });
    jest.spyOn(useDepartmentsOptionsModule, "useDepartmentsOptions").mockReturnValue({ options: [], isLoading: false });
    jest.spyOn(useProvidersOptionsModule, "useProvidersOptions").mockReturnValue({ options: [], isLoading: false });
    jest.spyOn(useInventoryScopeModeModule, "useInventoryScopeMode").mockReturnValue({ mode: "branch", isLoading: false, refresh: jest.fn() });

    render(<ProductsPage />);
    fireEvent.click(screen.getAllByTitle("Editar")[0]);
    fireEvent.click(screen.getByRole("button", { name: /guardar \(mock, edit\)/i }));

    await screen.findByRole("button", { name: /nuevo producto/i });
    expect(screen.queryByText(/PROD1 — Producto Uno creado/)).not.toBeInTheDocument();
  });
});
