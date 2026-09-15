import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { UserEditModal } from "../../../../../app/(private)/users/_blocks/UserEditModal";
import type { User } from "../../../../../app/(private)/users/_logic/types/domain";

jest.mock("../../../../../app/_hooks/useBranchesOptions", () => ({
  useBranchesOptions: () => ({
    options: [{ id: "b1", name: "Matriz" }, { id: "b2", name: "Sucursal Norte" }],
    isLoading: false,
    refresh: jest.fn(),
  }),
}));

const USER: User = {
  id: "u1",
  name: "Alice",
  email: "alice@test.com",
  avatarUrl: "https://gravatar.com/avatar/abc",
  branchId: null,
  branchName: null,
  roles: ["viewer"],
  createdAt: new Date(),
  updatedAt: new Date(),
};
const CATALOG = [
  { id: "r1", name: "admin" },
  { id: "r2", name: "viewer" },
];

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = jest.fn(function(this: HTMLDialogElement) {
    this.setAttribute("open", "");
  });
  HTMLDialogElement.prototype.close = jest.fn(function(this: HTMLDialogElement) {
    this.removeAttribute("open");
  });
});

describe("UserEditModal", () => {
  function setup(overrides?: Partial<React.ComponentProps<typeof UserEditModal>>) {
    const props = {
      open: true,
      mode: "edit" as const,
      user: USER,
      catalog: CATALOG,
      catalogLoading: false,
      isSaving: false,
      mutationError: null,
      onSave: jest.fn(),
      onClose: jest.fn(),
      ...overrides,
    };
    render(<UserEditModal {...props} />);
    return props;
  }

  describe("modo edit", () => {
    it("pre-llena nombre y email con datos del usuario", () => {
      setup();
      expect((screen.getByLabelText("Nombre") as HTMLInputElement).value).toBe("Alice");
      expect((screen.getByLabelText("Email") as HTMLInputElement).value).toBe("alice@test.com");
    });

    it("marca el rol actual del usuario en la lista", () => {
      setup();
      const viewerCheckbox = screen.getByRole("checkbox", { name: "Visor" });
      expect(viewerCheckbox).toBeChecked();
      const adminCheckbox = screen.getByRole("checkbox", { name: "Administrador" });
      expect(adminCheckbox).not.toBeChecked();
    });

    it("no muestra campo de contraseña", () => {
      setup();
      expect(screen.queryByLabelText("Contraseña")).not.toBeInTheDocument();
    });

    it("muestra selector de sucursal con las opciones cargadas", () => {
      setup();
      const select = screen.getByLabelText("Sucursal") as HTMLSelectElement;
      expect(select.value).toBe("");
      expect(screen.getByRole("option", { name: "Matriz" })).toBeInTheDocument();
      expect(screen.getByRole("option", { name: "Sucursal Norte" })).toBeInTheDocument();
    });

    it("Guardar Cambios deshabilitado si no hay cambios", () => {
      setup();
      expect(screen.getByRole("button", { name: "Guardar Cambios" })).toBeDisabled();
    });

    it("habilita Guardar al cambiar nombre", () => {
      setup();
      fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "Nuevo Nombre" } });
      expect(screen.getByRole("button", { name: "Guardar Cambios" })).not.toBeDisabled();
    });

    it("habilita Guardar al cambiar la sucursal", () => {
      setup();
      fireEvent.change(screen.getByLabelText("Sucursal"), { target: { value: "b1" } });
      expect(screen.getByRole("button", { name: "Guardar Cambios" })).not.toBeDisabled();
    });

    it("muestra error de validación para email inválido", () => {
      setup();
      fireEvent.change(screen.getByLabelText("Email"), { target: { value: "no-email" } });
      fireEvent.click(screen.getByRole("button", { name: "Guardar Cambios" }));
      expect(screen.getByText("Email inválido")).toBeInTheDocument();
    });

    it("resetear a Gravatar limpia el input de avatar", () => {
      setup();
      const resetBtn = screen.getByText("Resetear a Gravatar");
      fireEvent.click(resetBtn);
      const avatarInput = screen.getByPlaceholderText("https://example.com/photo.jpg") as HTMLInputElement;
      expect(avatarInput.value).toBe("");
    });

    it("muestra mutationError cuando está presente", () => {
      setup({ mutationError: "Ese email ya está en uso" });
      expect(screen.getByText("Ese email ya está en uso")).toBeInTheDocument();
    });

    it("botón Cancelar llama onClose", () => {
      const { onClose } = setup();
      fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
      expect(onClose).toHaveBeenCalled();
    });

    it("dispara onSave con el diff cuando se guarda", () => {
      const { onSave } = setup();
      fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "Nuevo" } });
      fireEvent.click(screen.getByRole("button", { name: "Guardar Cambios" }));
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({ name: "Nuevo", email: "alice@test.com", branchId: null })
      );
    });

    it("dispara onSave con branchId cuando se cambia la sucursal", () => {
      const { onSave } = setup();
      fireEvent.change(screen.getByLabelText("Sucursal"), { target: { value: "b1" } });
      fireEvent.click(screen.getByRole("button", { name: "Guardar Cambios" }));
      expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ branchId: "b1" }));
    });

    it("muestra el botón de reenvío de correo de contraseña", () => {
      setup();
      expect(
        screen.getByRole("button", { name: "Enviar correo para establecer/restablecer contraseña" })
      ).toBeInTheDocument();
    });

    it("pide confirmación y llama onResendSetPasswordEmail con el id del usuario al confirmar", () => {
      const onResendSetPasswordEmail = jest.fn();
      setup({ onResendSetPasswordEmail });
      fireEvent.click(
        screen.getByRole("button", { name: "Enviar correo para establecer/restablecer contraseña" })
      );
      expect(onResendSetPasswordEmail).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole("button", { name: "Enviar" }));
      expect(onResendSetPasswordEmail).toHaveBeenCalledWith("u1");
    });

    it("no llama onResendSetPasswordEmail si se cancela la confirmación", () => {
      const onResendSetPasswordEmail = jest.fn();
      setup({ onResendSetPasswordEmail });
      fireEvent.click(
        screen.getByRole("button", { name: "Enviar correo para establecer/restablecer contraseña" })
      );
      const cancelButtons = screen.getAllByRole("button", { name: "Cancelar" });
      fireEvent.click(cancelButtons[cancelButtons.length - 1]);
      expect(onResendSetPasswordEmail).not.toHaveBeenCalled();
    });

    it("muestra mensaje de éxito del reenvío", () => {
      setup({ setPasswordEmailSuccess: "Correo enviado a alice@test.com" });
      expect(screen.getByText("Correo enviado a alice@test.com")).toBeInTheDocument();
    });

    it("muestra mensaje de error del reenvío", () => {
      setup({ setPasswordEmailError: "Failed to deliver the set-password email" });
      expect(screen.getByText("Failed to deliver the set-password email")).toBeInTheDocument();
    });
  });

  describe("modo create", () => {
    function setupCreate(overrides?: Partial<React.ComponentProps<typeof UserEditModal>>) {
      return setup({ mode: "create", user: null, ...overrides });
    }

    it("muestra título 'Crear usuario'", () => {
      setupCreate();
      expect(screen.getByRole("heading", { name: "Crear usuario" })).toBeInTheDocument();
    });

    it("no muestra campo de contraseña, sólo el copy informativo", () => {
      setupCreate();
      expect(screen.queryByLabelText("Contraseña")).not.toBeInTheDocument();
      expect(
        screen.getByText("Se enviará un correo al nuevo usuario para que establezca su propia contraseña.")
      ).toBeInTheDocument();
    });

    it("no muestra botón 'Resetear a Gravatar'", () => {
      setupCreate();
      expect(screen.queryByText("Resetear a Gravatar")).not.toBeInTheDocument();
    });

    it("campos vacíos por defecto y botón deshabilitado", () => {
      setupCreate();
      expect((screen.getByLabelText("Nombre") as HTMLInputElement).value).toBe("");
      expect(screen.getByRole("button", { name: "Crear usuario" })).toBeDisabled();
    });

    it("habilita el botón cuando name/email son válidos", () => {
      setupCreate();
      fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "Ana" } });
      fireEvent.change(screen.getByLabelText("Email"), { target: { value: "ana@test.com" } });
      expect(screen.getByRole("button", { name: "Crear usuario" })).not.toBeDisabled();
    });

    it("dispara onSave con los datos del nuevo usuario, incluida la sucursal", () => {
      const { onSave } = setupCreate();
      fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "Ana" } });
      fireEvent.change(screen.getByLabelText("Email"), { target: { value: "ana@test.com" } });
      fireEvent.change(screen.getByLabelText("Sucursal"), { target: { value: "b2" } });
      fireEvent.click(screen.getByRole("button", { name: "Crear usuario" }));
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Ana",
          email: "ana@test.com",
          branchId: "b2",
        })
      );
    });
  });
});
