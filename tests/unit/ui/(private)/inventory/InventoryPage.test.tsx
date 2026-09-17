/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";

jest.mock("../../../../../app/_hooks/useCurrentUser");
jest.mock("../../../../../app/(private)/inventory/_logic/hooks/useBranchInventory");
jest.mock("../../../../../app/_hooks/useBranchesOptions");
jest.mock("../../../../../app/(private)/inventory/_logic/hooks/useInventoryMutations");
jest.mock("../../../../../app/_hooks/useInventoryScopeMode");
jest.mock("../../../../../app/(private)/inventory/_blocks/InventoryAssignModal", () => ({
  InventoryAssignModal: ({ onAssign }: { onAssign: (productId: string, quantity: number, reorderPoint: number) => void }) => (
    <button type="button" onClick={() => onAssign("prod-1", 10, 5)}>Confirmar asignación (mock)</button>
  ),
}));
jest.mock("../../../../../app/(private)/_blocks/OfflineSyncProvider", () => ({
  useOfflineSync: () => ({
    isOnline: true,
    offlineEnabled: false,
    ownerBranchId: null,
    blockedByPendingOutbox: false,
    pendingCount: 0,
    syncing: false,
    catalogStalenessMs: null,
    refreshCatalogNow: jest.fn(),
    fixWorkingBranch: jest.fn(),
  }),
}));

import { useCurrentUser } from "../../../../../app/_hooks/useCurrentUser";
import * as useBranchInventoryModule from "../../../../../app/(private)/inventory/_logic/hooks/useBranchInventory";
import * as useBranchesOptionsModule from "../../../../../app/_hooks/useBranchesOptions";
import * as useInventoryMutationsModule from "../../../../../app/(private)/inventory/_logic/hooks/useInventoryMutations";
import * as useInventoryScopeModeModule from "../../../../../app/_hooks/useInventoryScopeMode";
import { InventoryPage } from "../../../../../app/(private)/inventory/_blocks/InventoryPage";

const mockUseCurrentUser = useCurrentUser as jest.MockedFunction<typeof useCurrentUser>;

function makeCan(permissions: string[]) {
  return (perm: string): boolean | "loading" => permissions.includes(perm);
}

function setupCurrentUser(permissions: string[], branchId: string | null) {
  mockUseCurrentUser.mockReturnValue({
    userId: "u1",
    email: "test@test.com",
    roles: [],
    branchId,
    isLoading: false,
    can: makeCan(permissions),
    refresh: jest.fn(),
  });
}

function setupBranchInventory(overrides = {}) {
  jest.spyOn(useBranchInventoryModule, "useBranchInventory").mockReturnValue({
    items: [],
    total: 0,
    isLoading: false,
    error: null,
    refresh: jest.fn(),
    ...overrides,
  });
}

function setupBranchesOptions(options: { id: string; name: string }[] = []) {
  jest.spyOn(useBranchesOptionsModule, "useBranchesOptions").mockReturnValue({
    options,
    isLoading: false,
  });
}

function setupInventoryMutations(overrides: Partial<ReturnType<typeof useInventoryMutationsModule.useInventoryMutations>> = {}) {
  jest.spyOn(useInventoryMutationsModule, "useInventoryMutations").mockReturnValue({
    isSaving: false,
    mutationError: null,
    clearError: jest.fn(),
    assignOne: jest.fn(),
    updateOne: jest.fn(),
    adjustOne: jest.fn(),
    removeOne: jest.fn(),
    ...overrides,
  });
}

function setupInventoryScopeMode(mode: "general" | "branch" = "general") {
  jest.spyOn(useInventoryScopeModeModule, "useInventoryScopeMode").mockReturnValue({
    mode,
    isLoading: false,
    refresh: jest.fn(),
  });
}

describe("InventoryPage — gating del selector de sucursal", () => {
  beforeEach(() => jest.clearAllMocks());

  it("operador con sucursal asignada → sin select, carga directo su stock", () => {
    setupCurrentUser(["inventory:read"], "branch-1");
    setupBranchesOptions([{ id: "branch-1", name: "Sucursal Centro" }]);
    const useBranchInventorySpy = jest.spyOn(useBranchInventoryModule, "useBranchInventory");
    setupBranchInventory();
    setupInventoryMutations();
    setupInventoryScopeMode();

    render(<InventoryPage />);

    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.getByText("Sucursal Centro")).toBeInTheDocument();
    expect(useBranchInventorySpy).toHaveBeenCalledWith(
      expect.objectContaining({ branchId: "branch-1" })
    );
  });

  it("operador sin sucursal asignada → EmptyState 'Sin sucursal asignada'", () => {
    setupCurrentUser(["inventory:read"], null);
    setupBranchesOptions([]);
    setupBranchInventory();
    setupInventoryMutations();
    setupInventoryScopeMode();

    render(<InventoryPage />);

    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.getByText("Sin sucursal asignada")).toBeInTheDocument();
  });

  it("admin con branches:access_all → select visible, comportamiento sin cambios", () => {
    setupCurrentUser(["inventory:read", "branches:access_all"], null);
    setupBranchesOptions([
      { id: "branch-1", name: "Sucursal Centro" },
      { id: "branch-2", name: "Sucursal Norte" },
    ]);
    setupBranchInventory();
    setupInventoryMutations();
    setupInventoryScopeMode();

    render(<InventoryPage />);

    const select = screen.getByRole("combobox");
    expect(select).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Selecciona una sucursal" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Sucursal Norte" })).toBeInTheDocument();
  });

  it("sin inventory:read → EmptyState 'Sin acceso'", () => {
    setupCurrentUser([], "branch-1");
    setupBranchesOptions([]);
    setupBranchInventory();
    setupInventoryMutations();
    setupInventoryScopeMode();

    render(<InventoryPage />);

    expect(screen.getByText("Sin acceso")).toBeInTheDocument();
  });
});

describe("InventoryPage — badge de modo de inventario", () => {
  beforeEach(() => jest.clearAllMocks());

  it("muestra el badge 'Inventario por sucursal' cuando el modo es branch", () => {
    setupCurrentUser(["inventory:read"], "branch-1");
    setupBranchesOptions([{ id: "branch-1", name: "Sucursal Centro" }]);
    setupBranchInventory();
    setupInventoryMutations();
    setupInventoryScopeMode("branch");

    render(<InventoryPage />);

    expect(screen.getByText("Inventario por sucursal")).toBeInTheDocument();
  });

  it("no muestra el badge cuando el modo es general", () => {
    setupCurrentUser(["inventory:read"], "branch-1");
    setupBranchesOptions([{ id: "branch-1", name: "Sucursal Centro" }]);
    setupBranchInventory();
    setupInventoryMutations();
    setupInventoryScopeMode("general");

    render(<InventoryPage />);

    expect(screen.queryByText("Inventario por sucursal")).not.toBeInTheDocument();
  });
});

describe("InventoryPage — banner de éxito post-asignación", () => {
  beforeEach(() => jest.clearAllMocks());

  const assignedItem = {
    id: "inv-1",
    branchId: "branch-1",
    productId: "prod-1",
    productCode: "PROD1",
    productName: "Producto Uno",
    quantity: 10,
    reservedQuantity: 0,
    reorderPoint: 5,
    updatedAt: new Date("2026-01-01"),
    nearestExpirationDate: null,
    nearestExpirationLotNumber: null,
    expiryStatus: null,
  };

  it("con products:write, muestra el banner con el link a la tab Precios", async () => {
    setupCurrentUser(["inventory:read", "inventory:write", "products:write"], "branch-1");
    setupBranchesOptions([{ id: "branch-1", name: "Sucursal Centro" }]);
    setupBranchInventory();
    setupInventoryMutations({ assignOne: jest.fn().mockResolvedValue(assignedItem) });
    setupInventoryScopeMode("branch");

    render(<InventoryPage />);
    fireEvent.click(screen.getByRole("button", { name: /asignar producto/i }));
    fireEvent.click(screen.getByRole("button", { name: /confirmar asignación \(mock\)/i }));

    const link = await screen.findByRole("link", { name: /asignar precio de venta/i });
    expect(link).toHaveAttribute("href", "/catalogs/products/prod-1?tab=prices");
    expect(screen.getByText(/PROD1/)).toBeInTheDocument();
  });

  it("sin products:write, muestra el banner sin el link", async () => {
    setupCurrentUser(["inventory:read", "inventory:write"], "branch-1");
    setupBranchesOptions([{ id: "branch-1", name: "Sucursal Centro" }]);
    setupBranchInventory();
    setupInventoryMutations({ assignOne: jest.fn().mockResolvedValue(assignedItem) });
    setupInventoryScopeMode("branch");

    render(<InventoryPage />);
    fireEvent.click(screen.getByRole("button", { name: /asignar producto/i }));
    fireEvent.click(screen.getByRole("button", { name: /confirmar asignación \(mock\)/i }));

    expect(await screen.findByText(/PROD1/)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /asignar precio de venta/i })).not.toBeInTheDocument();
  });

  it("el banner se limpia al abrir 'Asignar producto' de nuevo", async () => {
    setupCurrentUser(["inventory:read", "inventory:write", "products:write"], "branch-1");
    setupBranchesOptions([{ id: "branch-1", name: "Sucursal Centro" }]);
    setupBranchInventory();
    setupInventoryMutations({ assignOne: jest.fn().mockResolvedValue(assignedItem) });
    setupInventoryScopeMode("branch");

    render(<InventoryPage />);
    fireEvent.click(screen.getByRole("button", { name: /asignar producto/i }));
    fireEvent.click(screen.getByRole("button", { name: /confirmar asignación \(mock\)/i }));
    await screen.findByText(/PROD1/);

    fireEvent.click(screen.getByRole("button", { name: /asignar producto/i }));
    expect(screen.queryByText(/PROD1/)).not.toBeInTheDocument();
  });
});
