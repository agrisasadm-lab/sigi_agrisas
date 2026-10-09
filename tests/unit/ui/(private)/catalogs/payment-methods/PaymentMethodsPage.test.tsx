import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

jest.mock("../../../../../../app/_hooks/useCurrentUser", () => ({ useCurrentUser: jest.fn() }));
jest.mock("../../../../../../app/(private)/catalogs/payment-methods/_logic/hooks/usePaymentMethods", () => ({ usePaymentMethods: jest.fn() }));
jest.mock("../../../../../../app/(private)/catalogs/payment-methods/_logic/hooks/usePaymentMethodMutations", () => ({ usePaymentMethodMutations: jest.fn() }));

import { useCurrentUser } from "../../../../../../app/_hooks/useCurrentUser";
import * as usePaymentMethodsModule from "../../../../../../app/(private)/catalogs/payment-methods/_logic/hooks/usePaymentMethods";
import * as usePaymentMethodMutationsModule from "../../../../../../app/(private)/catalogs/payment-methods/_logic/hooks/usePaymentMethodMutations";
import { PaymentMethodsPage } from "../../../../../../app/(private)/catalogs/payment-methods/_blocks/PaymentMethodsPage";

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

const defaultPaymentMethods = {
  items: [],
  total: 0,
  isLoading: false,
  error: null,
  refresh: jest.fn(),
};

describe("PaymentMethodsPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useCurrentUser as jest.Mock).mockReturnValue({
      userId: "admin-id",
      email: "admin@test.com",
      roles: ["admin"],
      isLoading: false,
      can: mockCan,
      refresh: jest.fn(),
    });
    jest.spyOn(usePaymentMethodsModule, "usePaymentMethods").mockReturnValue(defaultPaymentMethods);
    jest.spyOn(usePaymentMethodMutationsModule, "usePaymentMethodMutations").mockReturnValue(defaultMutations);
  });

  it("muestra skeletons cuando canRead='loading'", () => {
    mockCan.mockReturnValue("loading");
    const { container } = render(<PaymentMethodsPage />);
    expect(container.querySelectorAll('[aria-busy="true"]').length).toBeGreaterThan(0);
  });

  it("muestra Sin acceso cuando canRead=false", () => {
    mockCan.mockReturnValue(false);
    render(<PaymentMethodsPage />);
    expect(screen.getByText("Sin acceso a este catálogo")).toBeInTheDocument();
  });

  it("muestra el contenido cuando canRead=true y no hay items", () => {
    mockCan.mockReturnValue(true);
    render(<PaymentMethodsPage />);
    expect(screen.getByText("Formas de Pago")).toBeInTheDocument();
  });

  it("muestra tabla cuando canRead=true y hay items", () => {
    mockCan.mockReturnValue(true);
    jest.spyOn(usePaymentMethodsModule, "usePaymentMethods").mockReturnValue({
      items: [
        {
          id: "pm1",
          code: "CASH",
          name: "Efectivo",
          description: null,
          isActive: true,
          isCredit: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      total: 1,
      isLoading: false,
      error: null,
      refresh: jest.fn(),
    });
    render(<PaymentMethodsPage />);
    expect(screen.getByText("Efectivo")).toBeInTheDocument();
  });

  it("botón Nuevo NO visible cuando canWrite=false", () => {
    mockCan.mockImplementation((p: string) => p === "payment_methods:read" ? true : false);
    render(<PaymentMethodsPage />);
    expect(screen.queryByRole("button", { name: /nuevo/i })).not.toBeInTheDocument();
  });

  it("botón Nuevo VISIBLE cuando canWrite=true", () => {
    mockCan.mockReturnValue(true);
    render(<PaymentMethodsPage />);
    expect(screen.getByRole("button", { name: /nuevo/i })).toBeInTheDocument();
  });

  it("botón Nuevo abre el modal", async () => {
    mockCan.mockReturnValue(true);
    const clearError = jest.fn();
    jest.spyOn(usePaymentMethodMutationsModule, "usePaymentMethodMutations").mockReturnValue({
      ...defaultMutations,
      clearError,
    });
    render(<PaymentMethodsPage />);
    await userEvent.setup().click(screen.getByRole("button", { name: /nuevo/i }));
    expect(clearError).toHaveBeenCalled();
  });
});
