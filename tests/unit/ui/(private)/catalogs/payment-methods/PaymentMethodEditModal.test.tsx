import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PaymentMethodEditModal } from "../../../../../../app/(private)/catalogs/payment-methods/_blocks/PaymentMethodEditModal";
import type { PaymentMethod } from "../../../../../../app/(private)/catalogs/payment-methods/_logic/types/domain";

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = jest.fn(function(this: HTMLDialogElement) {
    this.setAttribute("open", "");
  });
  HTMLDialogElement.prototype.close = jest.fn(function(this: HTMLDialogElement) {
    this.removeAttribute("open");
  });
});

const BASE_ENTITY: PaymentMethod = {
  id: "pm1",
  code: "CASH",
  name: "Efectivo",
  description: "Pago en efectivo",
  isActive: true,
  isCredit: false,
  createdAt: new Date("2026-05-01"),
  updatedAt: new Date("2026-05-01"),
};

const CREDIT_ENTITY: PaymentMethod = {
  ...BASE_ENTITY,
  id: "pm2",
  code: "CREDITO",
  name: "Crédito",
  isCredit: true,
};

const defaultProps = {
  open: true,
  isSaving: false,
  codeError: null,
  mutationError: null,
  onSave: jest.fn(),
  onClose: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("PaymentMethodEditModal — modo create", () => {
  it("renderiza título 'Nueva Forma de Pago'", () => {
    render(<PaymentMethodEditModal {...defaultProps} mode="create" entity={null} />);
    expect(screen.getByText("Nueva Forma de Pago")).toBeInTheDocument();
  });

  it("campo code habilitado en modo create", () => {
    render(<PaymentMethodEditModal {...defaultProps} mode="create" entity={null} />);
    expect(screen.getByLabelText("Código")).not.toBeDisabled();
  });

  it("botón Guardar deshabilitado cuando los campos están vacíos", () => {
    render(<PaymentMethodEditModal {...defaultProps} mode="create" entity={null} />);
    expect(screen.getByRole("button", { name: /guardar/i })).toBeDisabled();
  });

  it("código con caracteres inválidos no permite guardar", async () => {
    render(<PaymentMethodEditModal {...defaultProps} mode="create" entity={null} />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Código"), "INVALID-CODE");
    await user.type(screen.getByLabelText("Nombre"), "Test");
    await user.click(screen.getByRole("button", { name: /guardar/i }));
    expect(screen.getByText(/código inválido/i)).toBeInTheDocument();
    expect(defaultProps.onSave).not.toHaveBeenCalled();
  });

  it("código 409 muestra error inline en campo code", () => {
    render(
      <PaymentMethodEditModal
        {...defaultProps}
        mode="create"
        entity={null}
        codeError="Ese código ya está en uso"
      />
    );
    expect(screen.getByText("Ese código ya está en uso")).toBeInTheDocument();
  });

  it("submit válido llama onSave con los datos", async () => {
    const onSave = jest.fn();
    render(<PaymentMethodEditModal {...defaultProps} mode="create" entity={null} onSave={onSave} />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Código"), "NUEVO");
    await user.type(screen.getByLabelText("Nombre"), "Nuevo método");
    await user.click(screen.getByRole("button", { name: /guardar/i }));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ code: "NUEVO", name: "Nuevo método", isCredit: false })
    );
  });

  it("switch 'Es crédito' habilitado en modo create", () => {
    render(<PaymentMethodEditModal {...defaultProps} mode="create" entity={null} />);
    expect(screen.getByRole("switch", { name: "Es crédito" })).not.toBeDisabled();
  });

  it("togglear 'Es crédito' e incluirlo en onSave como true", async () => {
    const onSave = jest.fn();
    render(<PaymentMethodEditModal {...defaultProps} mode="create" entity={null} onSave={onSave} />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Código"), "NUEVO");
    await user.type(screen.getByLabelText("Nombre"), "Nuevo método");
    await user.click(screen.getByRole("switch", { name: "Es crédito" }));
    await user.click(screen.getByRole("button", { name: /guardar/i }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ isCredit: true }));
  });
});

describe("PaymentMethodEditModal — modo edit", () => {
  it("renderiza título 'Editar Forma de Pago'", () => {
    render(<PaymentMethodEditModal {...defaultProps} mode="edit" entity={BASE_ENTITY} />);
    expect(screen.getByText("Editar Forma de Pago")).toBeInTheDocument();
  });

  it("campo code deshabilitado en modo edit", () => {
    render(<PaymentMethodEditModal {...defaultProps} mode="edit" entity={BASE_ENTITY} />);
    expect(screen.getByLabelText("Código")).toBeDisabled();
  });

  it("campos pre-rellenos con los datos del entity", () => {
    render(<PaymentMethodEditModal {...defaultProps} mode="edit" entity={BASE_ENTITY} />);
    expect(screen.getByLabelText("Nombre")).toHaveValue("Efectivo");
  });

  it("botón Guardar deshabilitado cuando no hay diff", () => {
    render(<PaymentMethodEditModal {...defaultProps} mode="edit" entity={BASE_ENTITY} />);
    expect(screen.getByRole("button", { name: /guardar/i })).toBeDisabled();
  });

  it("botón Guardar habilitado cuando hay cambios", async () => {
    render(<PaymentMethodEditModal {...defaultProps} mode="edit" entity={BASE_ENTITY} />);
    const user = userEvent.setup();
    await user.clear(screen.getByLabelText("Nombre"));
    await user.type(screen.getByLabelText("Nombre"), "Efectivo actualizado");
    expect(screen.getByRole("button", { name: /guardar/i })).not.toBeDisabled();
  });

  it("onSave recibe solo el diff cuando hay cambios", async () => {
    const onSave = jest.fn();
    render(
      <PaymentMethodEditModal {...defaultProps} mode="edit" entity={BASE_ENTITY} onSave={onSave} />
    );
    const user = userEvent.setup();
    await user.clear(screen.getByLabelText("Nombre"));
    await user.type(screen.getByLabelText("Nombre"), "Efectivo 2");
    await user.click(screen.getByRole("button", { name: /guardar/i }));
    expect(onSave).toHaveBeenCalledWith({ name: "Efectivo 2" });
  });

  it("switch 'Es crédito' deshabilitado y refleja el valor del entity", () => {
    render(<PaymentMethodEditModal {...defaultProps} mode="edit" entity={CREDIT_ENTITY} />);
    const switchEl = screen.getByRole("switch", { name: "Es crédito" });
    expect(switchEl).toBeDisabled();
    expect(switchEl).toHaveAttribute("aria-checked", "true");
  });

  it("isCredit nunca aparece en el diff enviado a onSave", async () => {
    const onSave = jest.fn();
    render(
      <PaymentMethodEditModal {...defaultProps} mode="edit" entity={CREDIT_ENTITY} onSave={onSave} />
    );
    const user = userEvent.setup();
    await user.clear(screen.getByLabelText("Nombre"));
    await user.type(screen.getByLabelText("Nombre"), "Crédito renombrado");
    await user.click(screen.getByRole("button", { name: /guardar/i }));
    expect(onSave).toHaveBeenCalledWith({ name: "Crédito renombrado" });
    expect(onSave.mock.calls[0][0]).not.toHaveProperty("isCredit");
  });
});
