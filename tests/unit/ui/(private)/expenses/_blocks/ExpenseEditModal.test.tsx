import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const BRANCH_OWN = "11111111-1111-1111-1111-111111111111";
const BRANCH_OTHER = "22222222-2222-2222-2222-222222222222";

const mockCan = jest.fn().mockReturnValue(false);
let mockUserBranchId: string | null = BRANCH_OWN;

jest.mock("../../../../../../app/_hooks/useCurrentUser", () => ({
  useCurrentUser: () => ({ branchId: mockUserBranchId, can: mockCan }),
}));

jest.mock("../../../../../../app/_hooks/useBranchesOptions", () => ({
  useBranchesOptions: () => ({
    options: [
      { id: BRANCH_OWN, name: "Sucursal Propia" },
      { id: BRANCH_OTHER, name: "Sucursal Otra" },
    ],
    isLoading: false,
  }),
}));

jest.mock("../../../../../../app/(private)/expenses/_logic/services/uploadExpensePhoto", () => ({
  uploadExpensePhoto: jest.fn(),
}));
jest.mock("../../../../../../app/(private)/expenses/_logic/services/deleteExpensePhoto", () => ({
  deleteExpensePhoto: jest.fn(),
}));

import { ExpenseEditModal } from "../../../../../../app/(private)/expenses/_blocks/ExpenseEditModal";
import type { Expense } from "../../../../../../app/(private)/expenses/_logic/types/domain";

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = jest.fn(function (this: HTMLDialogElement) {
    this.setAttribute("open", "");
  });
  HTMLDialogElement.prototype.close = jest.fn(function (this: HTMLDialogElement) {
    this.removeAttribute("open");
  });
});

const BASE_ENTITY: Expense = {
  id: "e1",
  branchId: BRANCH_OWN,
  branchName: "Sucursal Propia",
  concept: "Gasolina",
  amount: "500",
  notes: "Notas previas",
  photoUrl: null,
  expenseDate: "2026-09-01",
  creatorId: "u1",
  creatorName: "Operador",
  isActive: true,
  createdAt: new Date("2026-09-01"),
  updatedAt: new Date("2026-09-01"),
};

const defaultProps = {
  open: true,
  isSaving: false,
  mutationError: null,
  onSave: jest.fn(),
  onClose: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
  mockCan.mockReturnValue(false);
  mockUserBranchId = BRANCH_OWN;
});

describe("ExpenseEditModal — modo create", () => {
  it("renderiza título 'Nuevo Gasto'", () => {
    render(<ExpenseEditModal {...defaultProps} mode="create" entity={null} />);
    expect(screen.getByText("Nuevo Gasto")).toBeInTheDocument();
  });

  it("botón Guardar deshabilitado cuando los campos están vacíos", () => {
    render(<ExpenseEditModal {...defaultProps} mode="create" entity={null} />);
    expect(screen.getByRole("button", { name: /guardar/i })).toBeDisabled();
  });

  it("sin bypass: no muestra selector de sucursal", () => {
    mockCan.mockReturnValue(false);
    render(<ExpenseEditModal {...defaultProps} mode="create" entity={null} />);
    expect(screen.queryByLabelText(/sucursal/i)).not.toBeInTheDocument();
  });

  it("con bypass (branches:access_all): muestra selector de sucursal", () => {
    mockCan.mockImplementation((perm: string) => perm === "branches:access_all");
    render(<ExpenseEditModal {...defaultProps} mode="create" entity={null} />);
    expect(screen.getByLabelText(/sucursal/i)).toBeInTheDocument();
  });

  it("concepto vacío bloquea el guardado con error inline", async () => {
    mockCan.mockImplementation((perm: string) => perm === "branches:access_all");
    const onSave = jest.fn();
    render(<ExpenseEditModal {...defaultProps} mode="create" entity={null} onSave={onSave} />);
    const user = userEvent.setup();
    await user.selectOptions(screen.getByLabelText(/sucursal/i), BRANCH_OWN);
    await user.type(screen.getByLabelText("Cantidad"), "100");
    await user.click(screen.getByRole("button", { name: /guardar/i }));
    expect(screen.getByText(/concepto es obligatorio/i)).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("cantidad <= 0 bloquea el guardado con error inline", async () => {
    mockCan.mockImplementation((perm: string) => perm === "branches:access_all");
    const onSave = jest.fn();
    render(<ExpenseEditModal {...defaultProps} mode="create" entity={null} onSave={onSave} />);
    const user = userEvent.setup();
    await user.selectOptions(screen.getByLabelText(/sucursal/i), BRANCH_OWN);
    await user.type(screen.getByLabelText("Concepto"), "Gasolina");
    await user.type(screen.getByLabelText("Cantidad"), "0");
    await user.click(screen.getByRole("button", { name: /guardar/i }));
    expect(screen.getByText(/cantidad debe ser mayor a cero/i)).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("submit válido llama onSave con el body y branchId propio (sin bypass)", async () => {
    mockCan.mockReturnValue(false);
    mockUserBranchId = BRANCH_OWN;
    const onSave = jest.fn();
    render(<ExpenseEditModal {...defaultProps} mode="create" entity={null} onSave={onSave} />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Concepto"), "Gasolina");
    await user.type(screen.getByLabelText("Cantidad"), "850.5");
    await user.click(screen.getByRole("button", { name: /guardar/i }));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ branchId: BRANCH_OWN, concept: "Gasolina", amount: 850.5 }),
      null
    );
  });

  it("mutationError se muestra inline", () => {
    render(<ExpenseEditModal {...defaultProps} mode="create" entity={null} mutationError="Error al crear" />);
    expect(screen.getByText("Error al crear")).toBeInTheDocument();
  });
});

describe("ExpenseEditModal — modo edit", () => {
  it("renderiza título 'Editar Gasto'", () => {
    render(<ExpenseEditModal {...defaultProps} mode="edit" entity={BASE_ENTITY} />);
    expect(screen.getByText("Editar Gasto")).toBeInTheDocument();
  });

  it("precarga los campos con los datos del entity", () => {
    render(<ExpenseEditModal {...defaultProps} mode="edit" entity={BASE_ENTITY} />);
    expect(screen.getByLabelText("Concepto")).toHaveValue("Gasolina");
    expect(screen.getByLabelText("Cantidad")).toHaveValue(500);
    expect(screen.getByLabelText("Fecha")).toHaveValue("2026-09-01");
    expect(screen.getByLabelText("Notas")).toHaveValue("Notas previas");
  });

  it("no muestra selector de sucursal en modo edit (inmutable)", () => {
    mockCan.mockImplementation((perm: string) => perm === "branches:access_all");
    render(<ExpenseEditModal {...defaultProps} mode="edit" entity={BASE_ENTITY} />);
    expect(screen.queryByLabelText(/sucursal/i)).not.toBeInTheDocument();
  });

  it("botón Guardar deshabilitado cuando no hay diff", () => {
    render(<ExpenseEditModal {...defaultProps} mode="edit" entity={BASE_ENTITY} />);
    expect(screen.getByRole("button", { name: /guardar/i })).toBeDisabled();
  });

  it("botón Guardar habilitado cuando hay cambios", async () => {
    render(<ExpenseEditModal {...defaultProps} mode="edit" entity={BASE_ENTITY} />);
    const user = userEvent.setup();
    await user.clear(screen.getByLabelText("Concepto"));
    await user.type(screen.getByLabelText("Concepto"), "Diesel");
    expect(screen.getByRole("button", { name: /guardar/i })).not.toBeDisabled();
  });

  it("onSave recibe sólo el diff (diff-only)", async () => {
    const onSave = jest.fn();
    render(<ExpenseEditModal {...defaultProps} mode="edit" entity={BASE_ENTITY} onSave={onSave} />);
    const user = userEvent.setup();
    await user.clear(screen.getByLabelText("Concepto"));
    await user.type(screen.getByLabelText("Concepto"), "Diesel");
    await user.click(screen.getByRole("button", { name: /guardar/i }));
    expect(onSave).toHaveBeenCalledWith({ concept: "Diesel" });
  });
});
