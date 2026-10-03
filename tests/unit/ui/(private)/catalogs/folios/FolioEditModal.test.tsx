import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FolioEditModal } from "../../../../../../app/(private)/catalogs/folios/_blocks/FolioEditModal";
import type { Folio } from "../../../../../../app/(private)/catalogs/folios/_logic/types/domain";

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = jest.fn(function(this: HTMLDialogElement) {
    this.setAttribute("open", "");
  });
  HTMLDialogElement.prototype.close = jest.fn(function(this: HTMLDialogElement) {
    this.removeAttribute("open");
  });
});

const BASE_ENTITY: Folio = {
  id: "f1",
  code: "FACT_A",
  name: "Factura A",
  prefix: "FA",
  scope: "OPERATIONS",
  currentNumber: 100,
  isActive: true,
  createdAt: new Date("2026-05-01"),
  updatedAt: new Date("2026-05-01"), branchCurrentNumber: null, nextFolioCode: null,
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

describe("FolioEditModal — modo create", () => {
  it("renderiza título 'Nuevo Folio'", () => {
    render(<FolioEditModal {...defaultProps} mode="create" entity={null} />);
    expect(screen.getByText("Nuevo Folio")).toBeInTheDocument();
  });

  it("campo code habilitado en modo create", () => {
    render(<FolioEditModal {...defaultProps} mode="create" entity={null} />);
    expect(screen.getByLabelText("Código")).not.toBeDisabled();
  });

  it("botón Guardar deshabilitado cuando los campos están vacíos", () => {
    render(<FolioEditModal {...defaultProps} mode="create" entity={null} />);
    expect(screen.getByRole("button", { name: /guardar/i })).toBeDisabled();
  });

  it("código con caracteres inválidos no permite guardar", async () => {
    render(<FolioEditModal {...defaultProps} mode="create" entity={null} />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Código"), "INVALID-CODE");
    await user.type(screen.getByLabelText("Nombre"), "Test");
    await user.click(screen.getByRole("button", { name: /guardar/i }));
    expect(screen.getByText(/código inválido/i)).toBeInTheDocument();
    expect(defaultProps.onSave).not.toHaveBeenCalled();
  });

  it("prefijo demasiado largo muestra error de validación", async () => {
    render(<FolioEditModal {...defaultProps} mode="create" entity={null} />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Código"), "VALID");
    await user.type(screen.getByLabelText("Nombre"), "Nombre válido");
    await user.type(screen.getByLabelText("Prefijo"), "TOOLONG123");
    await user.click(screen.getByRole("button", { name: /guardar/i }));
    expect(defaultProps.onSave).not.toHaveBeenCalled();
  });

  it("código 409 muestra error inline en campo code", () => {
    render(
      <FolioEditModal
        {...defaultProps}
        mode="create"
        entity={null}
        codeError="Ese código ya está en uso"
      />
    );
    expect(screen.getByText("Ese código ya está en uso")).toBeInTheDocument();
  });

  it("submit válido llama onSave con los datos incluyendo currentNumber", async () => {
    const onSave = jest.fn();
    render(<FolioEditModal {...defaultProps} mode="create" entity={null} onSave={onSave} />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Código"), "NUEVO");
    await user.type(screen.getByLabelText("Nombre"), "Nuevo folio");
    await user.click(screen.getByRole("button", { name: /guardar/i }));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ code: "NUEVO", name: "Nuevo folio", currentNumber: 0 })
    );
  });
});

describe("FolioEditModal — modo edit", () => {
  it("renderiza título 'Editar Folio'", () => {
    render(<FolioEditModal {...defaultProps} mode="edit" entity={BASE_ENTITY} />);
    expect(screen.getByText("Editar Folio")).toBeInTheDocument();
  });

  it("campo code deshabilitado en modo edit", () => {
    render(<FolioEditModal {...defaultProps} mode="edit" entity={BASE_ENTITY} />);
    expect(screen.getByLabelText("Código")).toBeDisabled();
  });

  it("campos pre-rellenos con los datos del entity", () => {
    render(<FolioEditModal {...defaultProps} mode="edit" entity={BASE_ENTITY} />);
    expect(screen.getByLabelText("Nombre")).toHaveValue("Factura A");
    expect(screen.getByLabelText("Prefijo")).toHaveValue("FA");
  });

  it("botón Guardar deshabilitado cuando no hay diff", () => {
    render(<FolioEditModal {...defaultProps} mode="edit" entity={BASE_ENTITY} />);
    expect(screen.getByRole("button", { name: /guardar/i })).toBeDisabled();
  });

  it("botón Guardar habilitado cuando hay cambios", async () => {
    render(<FolioEditModal {...defaultProps} mode="edit" entity={BASE_ENTITY} />);
    const user = userEvent.setup();
    await user.clear(screen.getByLabelText("Nombre"));
    await user.type(screen.getByLabelText("Nombre"), "Factura actualizada");
    expect(screen.getByRole("button", { name: /guardar/i })).not.toBeDisabled();
  });

  it("onSave recibe solo el diff cuando hay cambios", async () => {
    const onSave = jest.fn();
    render(
      <FolioEditModal {...defaultProps} mode="edit" entity={BASE_ENTITY} onSave={onSave} />
    );
    const user = userEvent.setup();
    await user.clear(screen.getByLabelText("Nombre"));
    await user.type(screen.getByLabelText("Nombre"), "Factura B");
    await user.click(screen.getByRole("button", { name: /guardar/i }));
    expect(onSave).toHaveBeenCalledWith({ name: "Factura B" });
  });
});
