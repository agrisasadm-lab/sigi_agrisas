/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CustomerQuickAddModal } from "../../../../app/(private)/pos/_blocks/CustomerQuickAddModal";
import { CustomerCodeAlreadyInUseError, CustomerRfcAlreadyInUseError } from "../../../../app/(private)/pos/_logic/errors";
import type { CustomerDto } from "../../../../app/(private)/pos/_logic/types/api";

jest.mock("../../../../app/(private)/pos/_logic/services/createCustomer", () => ({
  createCustomer: jest.fn(),
}));

jest.mock("../../../../app/_hooks/useSatCatalogSearch");

import { createCustomer } from "../../../../app/(private)/pos/_logic/services/createCustomer";
import { useSatCatalogSearch } from "../../../../app/_hooks/useSatCatalogSearch";
const mockCreateCustomer = createCustomer as jest.Mock;
const mockUseSatCatalogSearch = useSatCatalogSearch as jest.MockedFunction<typeof useSatCatalogSearch>;

HTMLDialogElement.prototype.showModal = jest.fn(function (this: HTMLDialogElement) {
  this.setAttribute("open", "");
});
HTMLDialogElement.prototype.close = jest.fn(function (this: HTMLDialogElement) {
  this.removeAttribute("open");
});

const stubCustomer: CustomerDto = {
  id: "c1", code: "CLI001", name: "Test Cliente", rfc: "XAXX010101000",
  currentBalance: 0, isActive: true,
};

function fillRequired(user: ReturnType<typeof userEvent.setup>) {
  return async () => {
    await user.type(screen.getByPlaceholderText("CLI001"), "CLI001");
    await user.type(screen.getByPlaceholderText("XAXX010101000"), "XAXX010101000");
    await user.type(screen.getByPlaceholderText("Nombre del cliente"), "Test Cliente");
  };
}

describe("CustomerQuickAddModal", () => {
  beforeEach(() => {
    mockCreateCustomer.mockReset();
    mockUseSatCatalogSearch.mockReturnValue({ options: [], isLoading: false });
  });

  it("renders form with title", () => {
    render(<CustomerQuickAddModal onCreated={jest.fn()} onClose={jest.fn()} />);
    expect(screen.getByText("Nuevo cliente")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("CLI001")).toBeInTheDocument();
  });

  it("invokes onClose when cancel button clicked", async () => {
    const onClose = jest.fn();
    const user = userEvent.setup();
    render(<CustomerQuickAddModal onCreated={jest.fn()} onClose={onClose} />);
    await user.click(screen.getByText("Cancelar"));
    expect(onClose).toHaveBeenCalled();
  });

  it("invokes onClose via close (X) button", async () => {
    const onClose = jest.fn();
    const user = userEvent.setup();
    render(<CustomerQuickAddModal onCreated={jest.fn()} onClose={onClose} />);
    const closeBtn = screen.getAllByRole("button").find(
      (b) => b.getAttribute("type") === "button" && b.closest("div.flex.items-center")
    );
    if (closeBtn) await user.click(closeBtn);
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onCreated after successful submit", async () => {
    mockCreateCustomer.mockResolvedValue(stubCustomer);
    const onCreated = jest.fn();
    const user = userEvent.setup();
    render(<CustomerQuickAddModal onCreated={onCreated} onClose={jest.fn()} />);
    await fillRequired(user)();
    await user.click(screen.getByText("Crear cliente"));
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(stubCustomer));
  });

  it("shows field error on duplicate code (409)", async () => {
    mockCreateCustomer.mockRejectedValue(new CustomerCodeAlreadyInUseError());
    const user = userEvent.setup();
    render(<CustomerQuickAddModal onCreated={jest.fn()} onClose={jest.fn()} />);
    await fillRequired(user)();
    await user.click(screen.getByText("Crear cliente"));
    await waitFor(() =>
      expect(screen.getByText(/código ya está en uso/i)).toBeInTheDocument()
    );
  });

  it("shows field error on duplicate RFC (409)", async () => {
    mockCreateCustomer.mockRejectedValue(new CustomerRfcAlreadyInUseError());
    const user = userEvent.setup();
    render(<CustomerQuickAddModal onCreated={jest.fn()} onClose={jest.fn()} />);
    await fillRequired(user)();
    await user.click(screen.getByText("Crear cliente"));
    await waitFor(() =>
      expect(screen.getByText(/RFC ya está en uso/i)).toBeInTheDocument()
    );
  });

  it("shows global error on unexpected failure", async () => {
    mockCreateCustomer.mockRejectedValue(new Error("network error"));
    const user = userEvent.setup();
    render(<CustomerQuickAddModal onCreated={jest.fn()} onClose={jest.fn()} />);
    await fillRequired(user)();
    await user.click(screen.getByText("Crear cliente"));
    await waitFor(() =>
      expect(screen.getByText(/error al crear/i)).toBeInTheDocument()
    );
  });

  it("Esc fires onClose via cancel event", () => {
    const onClose = jest.fn();
    render(<CustomerQuickAddModal onCreated={jest.fn()} onClose={onClose} />);
    const dialog = document.querySelector("dialog")!;
    const cancelEvent = new Event("cancel", { cancelable: true });
    dialog.dispatchEvent(cancelEvent);
    expect(onClose).toHaveBeenCalled();
  });

  it("auto-focuses first input on mount", () => {
    render(<CustomerQuickAddModal onCreated={jest.fn()} onClose={jest.fn()} />);
    expect(screen.getByPlaceholderText("CLI001")).toHaveFocus();
  });

  it("shows validation error when code is empty on submit", async () => {
    const user = userEvent.setup();
    render(<CustomerQuickAddModal onCreated={jest.fn()} onClose={jest.fn()} />);
    await user.click(screen.getByText("Crear cliente"));
    expect(mockCreateCustomer).not.toHaveBeenCalled();
  });
});

describe("CustomerQuickAddModal — catálogos SAT en datos fiscales", () => {
  beforeEach(() => {
    mockCreateCustomer.mockReset();
    mockUseSatCatalogSearch.mockReturnValue({ options: [], isLoading: false });
  });

  it("expone comboboxes de régimen fiscal y uso CFDI al expandir datos fiscales", async () => {
    const user = userEvent.setup();
    render(<CustomerQuickAddModal onCreated={jest.fn()} onClose={jest.fn()} />);
    await user.click(screen.getByText(/datos fiscales/i));
    expect(screen.getByPlaceholderText("601")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("G03")).toBeInTheDocument();
  });

  it("seleccionar un régimen fiscal guarda el código en el payload", async () => {
    mockUseSatCatalogSearch.mockReturnValue({
      options: [
        {
          code: "612",
          description: "Personas Físicas con Actividades Empresariales y Profesionales",
        },
      ],
      isLoading: false,
    });
    mockCreateCustomer.mockResolvedValue(stubCustomer);
    const user = userEvent.setup();
    render(<CustomerQuickAddModal onCreated={jest.fn()} onClose={jest.fn()} />);
    await user.click(screen.getByText(/datos fiscales/i));
    const regimeInput = screen.getByPlaceholderText("601");
    await user.click(regimeInput);
    await user.click(screen.getByText(/Personas Físicas/));
    await fillRequired(user)();
    await user.click(screen.getByText("Crear cliente"));
    await waitFor(() => expect(mockCreateCustomer).toHaveBeenCalled());
    expect(mockCreateCustomer.mock.calls[0][0]).toEqual(
      expect.objectContaining({ taxRegime: "612" })
    );
  });

  it("acepta uso CFDI de 4 caracteres (CP01) vía catálogo", async () => {
    mockUseSatCatalogSearch.mockReturnValue({
      options: [
        { code: "CP01", description: "Pagos" },
        { code: "G03", description: "Gastos en general." },
      ],
      isLoading: false,
    });
    mockCreateCustomer.mockResolvedValue(stubCustomer);
    const user = userEvent.setup();
    render(<CustomerQuickAddModal onCreated={jest.fn()} onClose={jest.fn()} />);
    await user.click(screen.getByText(/datos fiscales/i));
    const cfdiInput = screen.getByPlaceholderText("G03");
    await user.click(cfdiInput);
    await user.click(screen.getByText(/Pagos/));
    await fillRequired(user)();
    await user.click(screen.getByText("Crear cliente"));
    await waitFor(() => expect(mockCreateCustomer).toHaveBeenCalled());
    expect(mockCreateCustomer.mock.calls[0][0]).toEqual(
      expect.objectContaining({ cfdiUse: "CP01" })
    );
  });
});

describe("CustomerQuickAddModal — branchIds", () => {
  beforeEach(() => {
    mockCreateCustomer.mockReset();
    mockUseSatCatalogSearch.mockReturnValue({ options: [], isLoading: false });
    mockCreateCustomer.mockResolvedValue(stubCustomer);
  });

  it("envía branchIds: [branchId] cuando se provee la prop branchId", async () => {
    const user = userEvent.setup();
    render(<CustomerQuickAddModal onCreated={jest.fn()} onClose={jest.fn()} branchId="b-zarioz" />);
    await fillRequired(user)();
    await user.click(screen.getByText("Crear cliente"));
    await waitFor(() => expect(mockCreateCustomer).toHaveBeenCalled());
    expect(mockCreateCustomer.mock.calls[0][0]).toEqual(
      expect.objectContaining({ branchIds: ["b-zarioz"] })
    );
  });

  it("no envía branchIds cuando no se provee la prop branchId", async () => {
    const user = userEvent.setup();
    render(<CustomerQuickAddModal onCreated={jest.fn()} onClose={jest.fn()} />);
    await fillRequired(user)();
    await user.click(screen.getByText("Crear cliente"));
    await waitFor(() => expect(mockCreateCustomer).toHaveBeenCalled());
    expect(mockCreateCustomer.mock.calls[0][0]).not.toHaveProperty("branchIds");
  });
});
