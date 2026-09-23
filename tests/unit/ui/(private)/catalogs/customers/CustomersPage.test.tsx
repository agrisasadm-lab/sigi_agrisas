import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

jest.mock("../../../../../../app/_hooks/useCurrentUser", () => ({ useCurrentUser: jest.fn() }));
jest.mock("../../../../../../app/_hooks/useBranchesOptions", () => ({ useBranchesOptions: jest.fn() }));
jest.mock("../../../../../../app/_hooks/useHeadquarters", () => ({ useHeadquarters: jest.fn() }));
jest.mock("../../../../../../app/(private)/catalogs/customers/_logic/hooks/useCustomers", () => ({ useCustomers: jest.fn() }));
jest.mock("../../../../../../app/(private)/catalogs/customers/_logic/hooks/useCustomerMutations", () => ({ useCustomerMutations: jest.fn() }));

import { useCurrentUser } from "../../../../../../app/_hooks/useCurrentUser";
import { useBranchesOptions } from "../../../../../../app/_hooks/useBranchesOptions";
import { useHeadquarters } from "../../../../../../app/_hooks/useHeadquarters";
import * as useCustomersModule from "../../../../../../app/(private)/catalogs/customers/_logic/hooks/useCustomers";
import * as useCustomerMutationsModule from "../../../../../../app/(private)/catalogs/customers/_logic/hooks/useCustomerMutations";
import { CustomersPage } from "../../../../../../app/(private)/catalogs/customers/_blocks/CustomersPage";
import type { Customer } from "../../../../../../app/(private)/catalogs/customers/_logic/types/domain";

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = jest.fn();
  HTMLDialogElement.prototype.close = jest.fn();
});

const mockCan = jest.fn();

const defaultMutations = {
  isSaving: false,
  mutationError: null,
  clearError: jest.fn(),
  createOne: jest.fn(),
  updateOne: jest.fn(),
  softDeleteOne: jest.fn(),
  reactivateOne: jest.fn(),
};

const defaultCustomers = {
  items: [] as Customer[],
  total: 0,
  isLoading: false,
  error: null as string | null,
  refresh: jest.fn(),
};

describe("CustomersPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useCurrentUser as jest.Mock).mockReturnValue({
      userId: "admin-id",
      email: "admin@test.com",
      roles: ["admin"],
      isLoading: false,
      branchId: null,
      can: mockCan,
      refresh: jest.fn(),
    });
    jest.spyOn(useCustomersModule, "useCustomers").mockReturnValue(defaultCustomers);
    jest.spyOn(useCustomerMutationsModule, "useCustomerMutations").mockReturnValue(defaultMutations);
    (useBranchesOptions as jest.Mock).mockReturnValue({ options: [], isLoading: false, refresh: jest.fn() });
    (useHeadquarters as jest.Mock).mockReturnValue({ hq: null, isLoading: false, refresh: jest.fn() });
  });

  it("shows skeletons when canRead='loading'", () => {
    mockCan.mockReturnValue("loading");
    const { container } = render(<CustomersPage />);
    expect(container.querySelectorAll('[aria-busy="true"]').length).toBeGreaterThan(0);
  });

  it("shows 'Sin acceso' state when canRead=false", () => {
    mockCan.mockReturnValue(false);
    render(<CustomersPage />);
    expect(screen.getByText("Sin acceso a este catálogo")).toBeInTheDocument();
  });

  it("renders header when canRead=true", () => {
    mockCan.mockReturnValue(true);
    render(<CustomersPage />);
    expect(screen.getByText("Clientes")).toBeInTheDocument();
  });

  it("renders the server-side search hint in the toolbar", () => {
    mockCan.mockReturnValue(true);
    render(<CustomersPage />);
    expect(screen.getByText(/búsqueda en servidor/i)).toBeInTheDocument();
  });

  it("'Nuevo cliente' button NOT visible when canWrite=false", () => {
    mockCan.mockImplementation((p: string) => (p === "customers:read" ? true : false));
    render(<CustomersPage />);
    expect(screen.queryByRole("button", { name: /nuevo cliente/i })).not.toBeInTheDocument();
  });

  it("'Nuevo cliente' button visible when canWrite=true", () => {
    mockCan.mockReturnValue(true);
    render(<CustomersPage />);
    expect(screen.getByRole("button", { name: /nuevo cliente/i })).toBeInTheDocument();
  });

  it("clicking 'Nuevo cliente' opens the modal and clears errors", async () => {
    mockCan.mockReturnValue(true);
    const clearError = jest.fn();
    jest.spyOn(useCustomerMutationsModule, "useCustomerMutations").mockReturnValue({
      ...defaultMutations,
      clearError,
    });
    render(<CustomersPage />);
    await userEvent.setup().click(screen.getByRole("button", { name: /nuevo cliente/i }));
    expect(clearError).toHaveBeenCalled();
  });

  it("toggling 'Mostrar inactivos' triggers a re-fetch with includeInactive", async () => {
    mockCan.mockReturnValue(true);
    render(<CustomersPage />);
    const toggle = screen.getByRole("switch");
    await userEvent.setup().click(toggle);
    expect(useCustomersModule.useCustomers).toHaveBeenLastCalledWith(
      expect.objectContaining({ includeInactive: true }),
    );
  });

  it("renders the customers table when items exist", () => {
    mockCan.mockReturnValue(true);
    const sample: Customer = {
      id: "c1",
      code: "CLI_001",
      name: "Cliente ACME",
      rfc: "SAC120101A12",
      legalName: null,
      taxRegime: null,
      cfdiUse: null,
      taxZipCode: null,
      email: null,
      phone: null,
      address: null,
      contactName: null,
      notes: null,
      creditLimit: null,
      currentBalance: 0,
      initialBalance: 0,
      creditDays: 30,
      isActive: true,
      addressStreet: null,
      addressExteriorNumber: null,
      addressInteriorNumber: null,
      addressNeighborhood: null,
      addressMunicipality: null,
      addressState: null,
      addressCountry: null,
      addressZipCode: null,
  branchIds: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    jest.spyOn(useCustomersModule, "useCustomers").mockReturnValue({
      ...defaultCustomers,
      items: [sample],
      total: 1,
    });
    render(<CustomersPage />);
    expect(screen.getByText("Cliente ACME")).toBeInTheDocument();
    expect(screen.getByText("SAC120101A12")).toBeInTheDocument();
  });
});
