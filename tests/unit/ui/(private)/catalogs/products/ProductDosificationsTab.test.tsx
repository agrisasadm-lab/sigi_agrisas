import React from "react";
import { render, screen, waitFor } from "@testing-library/react";

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = jest.fn(function (this: HTMLDialogElement) {
    this.setAttribute("open", "");
  });
  HTMLDialogElement.prototype.close = jest.fn(function (this: HTMLDialogElement) {
    this.removeAttribute("open");
  });
});

jest.mock(
  "../../../../../../app/(private)/catalogs/products/_logic/hooks/useProductDosifications",
  () => ({ useProductDosifications: jest.fn() })
);
jest.mock("../../../../../../app/_hooks/useBranchesOptions");
jest.mock("../../../../../../app/_hooks/useCurrentUser");
jest.mock("../../../../../../app/_hooks/useHeadquarters");

import { useProductDosifications } from "../../../../../../app/(private)/catalogs/products/_logic/hooks/useProductDosifications";
import { useBranchesOptions } from "../../../../../../app/_hooks/useBranchesOptions";
import { useCurrentUser } from "../../../../../../app/_hooks/useCurrentUser";
import { useHeadquarters } from "../../../../../../app/_hooks/useHeadquarters";
import { ProductDosificationsTab } from "../../../../../../app/(private)/catalogs/products/_blocks/ProductDosificationsTab";
import type { ProductDosification } from "../../../../../../app/(private)/catalogs/products/_logic/types/domain";

const mockUseDosifications = useProductDosifications as jest.Mock;
const mockUseBranchesOptions = useBranchesOptions as jest.MockedFunction<typeof useBranchesOptions>;
const mockUseCurrentUser = useCurrentUser as jest.MockedFunction<typeof useCurrentUser>;
const mockUseHeadquarters = useHeadquarters as jest.MockedFunction<typeof useHeadquarters>;

const BASE_HOOK = {
  dosifications: [] as ProductDosification[],
  isLoading: false,
  error: null,
  isSaving: false,
  saveError: null,
  clearSaveError: jest.fn(),
  refresh: jest.fn(),
  createOne: jest.fn(),
  updateOne: jest.fn(),
  softDeleteOne: jest.fn(),
  reactivateOne: jest.fn(),
};

const makeDosification = (overrides: Partial<ProductDosification> = {}): ProductDosification => ({
  id: "dos1",
  productId: "p1",
  name: "Por dosis",
  numParts: 10,
  isActive: true,
  computedUnitPrice: 10.7,
  requiresDefaultPrice: false,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockUseBranchesOptions.mockReturnValue({
    options: [{ id: "b-matriz", name: "Matriz" }, { id: "b-zarioz", name: "Zarioz" }],
    isLoading: false,
    refresh: jest.fn(),
  });
  mockUseHeadquarters.mockReturnValue({
    hq: { id: "b-matriz", code: "MATRIZ", name: "Matriz" },
    isLoading: false,
    refresh: jest.fn(),
  });
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

describe("ProductDosificationsTab — computedUnitPrice", () => {
  it("muestra el precio unitario calculado cuando requiresDefaultPrice es false", async () => {
    mockUseDosifications.mockReturnValue({
      ...BASE_HOOK,
      dosifications: [makeDosification({ computedUnitPrice: 10.7, requiresDefaultPrice: false })],
    });

    render(<ProductDosificationsTab productId="p1" canWrite={true} />);

    await waitFor(() => expect(screen.getByText("$10.70")).toBeInTheDocument());
  });

  it("muestra 'Requiere precio default' cuando requiresDefaultPrice es true", async () => {
    mockUseDosifications.mockReturnValue({
      ...BASE_HOOK,
      dosifications: [makeDosification({ computedUnitPrice: null, requiresDefaultPrice: true })],
    });

    render(<ProductDosificationsTab productId="p1" canWrite={true} />);

    await waitFor(() => expect(screen.getByText(/requiere precio default/i)).toBeInTheDocument());
  });
});

describe("ProductDosificationsTab — gating de permisos", () => {
  it("canWrite=true muestra botón 'Nueva dosificación'", async () => {
    mockUseDosifications.mockReturnValue({
      ...BASE_HOOK,
      dosifications: [makeDosification()],
    });

    render(<ProductDosificationsTab productId="p1" canWrite={true} />);

    await waitFor(() => expect(screen.getByRole("button", { name: /nueva dosificación/i })).toBeInTheDocument());
  });

  it("canWrite=false oculta acciones y muestra caption de solo lectura", async () => {
    mockUseDosifications.mockReturnValue({
      ...BASE_HOOK,
      dosifications: [makeDosification()],
    });

    render(<ProductDosificationsTab productId="p1" canWrite={false} />);

    await waitFor(() => expect(screen.getByText(/solo lectura/i)).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: /nueva dosificación/i })).not.toBeInTheDocument();
  });
});

describe("ProductDosificationsTab — estado vacío", () => {
  it("muestra mensaje cuando no hay dosificaciones", async () => {
    mockUseDosifications.mockReturnValue({ ...BASE_HOOK, dosifications: [] });

    render(<ProductDosificationsTab productId="p1" canWrite={true} />);

    await waitFor(() => expect(screen.getByText(/sin dosificaciones configuradas/i)).toBeInTheDocument());
  });
});
