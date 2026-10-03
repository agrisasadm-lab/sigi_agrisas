/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

jest.mock("../../../../../../app/_hooks/useCurrentUser");
jest.mock("../../../../../../app/_hooks/useDebounce", () => ({
  useDebounce: (v: unknown) => v,
}));
jest.mock("../../../../../../app/(private)/pos/_logic/hooks/useCustomerSearch");

import { useCurrentUser } from "../../../../../../app/_hooks/useCurrentUser";
import * as useCustomerSearchModule from "../../../../../../app/(private)/pos/_logic/hooks/useCustomerSearch";
import { CustomerPicker } from "../../../../../../app/(private)/pos/_blocks/CustomerPicker";
import type { CustomerDto } from "../../../../../../app/(private)/pos/_logic/types/api";

const mockUseCurrentUser = useCurrentUser as jest.MockedFunction<typeof useCurrentUser>;
mockUseCurrentUser.mockReturnValue({
  userId: "u1",
  email: "op@test.com",
  roles: ["operator"],
  branchId: "b1",
  isLoading: false,
  can: () => true,
  refresh: jest.fn(),
});

const customerWithDebt: CustomerDto = {
  id: "c1",
  code: "CLI001",
  name: "Cliente Moroso",
  rfc: "XAXX010101000",
  isActive: true,
  currentBalance: 5000,
  creditLimit: null,
};

const customerNoDebt: CustomerDto = {
  id: "c2",
  code: "CLI002",
  name: "Cliente Sano",
  rfc: "XAXX010101000",
  isActive: true,
  currentBalance: 0,
  creditLimit: null,
};

describe("CustomerPicker — badge de adeudo", () => {
  beforeEach(() => jest.clearAllMocks());

  it("muestra badge de adeudo para cliente con saldo > 0", async () => {
    jest.spyOn(useCustomerSearchModule, "useCustomerSearch").mockReturnValue({
      items: [customerWithDebt],
      isLoading: false,
      total: 1,
      error: null,
      refresh: jest.fn(),
    });

    render(<CustomerPicker value="" onChange={jest.fn()} onOpenQuickAdd={jest.fn()} />);

    await userEvent.setup().click(screen.getByPlaceholderText(/Buscar por nombre o RFC/i));
    expect(screen.getByText(/Adeudo/i)).toBeInTheDocument();
    expect(screen.getByText(/\$5,000/)).toBeInTheDocument();
  });

  it("NO muestra badge de adeudo para cliente con saldo = 0", async () => {
    jest.spyOn(useCustomerSearchModule, "useCustomerSearch").mockReturnValue({
      items: [customerNoDebt],
      isLoading: false,
      total: 1,
      error: null,
      refresh: jest.fn(),
    });

    render(<CustomerPicker value="" onChange={jest.fn()} onOpenQuickAdd={jest.fn()} />);

    await userEvent.setup().click(screen.getByPlaceholderText(/Buscar por nombre o RFC/i));
    expect(screen.queryByText(/Adeudo/i)).not.toBeInTheDocument();
  });

  it("muestra botón '+ Nuevo cliente' cuando can('customers:write')=true", async () => {
    jest.spyOn(useCustomerSearchModule, "useCustomerSearch").mockReturnValue({
      items: [],
      isLoading: false,
      total: 0,
      error: null,
      refresh: jest.fn(),
    });

    render(<CustomerPicker value="" onChange={jest.fn()} onOpenQuickAdd={jest.fn()} />);

    await userEvent.setup().click(screen.getByPlaceholderText(/Buscar por nombre o RFC/i));
    expect(screen.getByText("+ Nuevo cliente")).toBeInTheDocument();
  });

  it("NO muestra botón '+ Nuevo cliente' cuando can('customers:write')=false", async () => {
    mockUseCurrentUser.mockReturnValue({
      userId: "u1",
      email: "viewer@test.com",
      roles: ["viewer"],
      branchId: "b1",
      isLoading: false,
      can: () => false,
      refresh: jest.fn(),
    });
    jest.spyOn(useCustomerSearchModule, "useCustomerSearch").mockReturnValue({
      items: [],
      isLoading: false,
      total: 0,
      error: null,
      refresh: jest.fn(),
    });

    render(<CustomerPicker value="" onChange={jest.fn()} onOpenQuickAdd={jest.fn()} />);

    await userEvent.setup().click(screen.getByPlaceholderText(/Buscar por nombre o RFC/i));
    expect(screen.queryByText("+ Nuevo cliente")).not.toBeInTheDocument();
  });

  it("pasa branchId al hook de búsqueda cuando se provee", () => {
    const spy = jest.spyOn(useCustomerSearchModule, "useCustomerSearch").mockReturnValue({
      items: [],
      isLoading: false,
      total: 0,
      error: null,
      refresh: jest.fn(),
    });

    render(<CustomerPicker value="" onChange={jest.fn()} onOpenQuickAdd={jest.fn()} branchId="b-zarioz" />);

    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ branchId: "b-zarioz" }));
  });
});
