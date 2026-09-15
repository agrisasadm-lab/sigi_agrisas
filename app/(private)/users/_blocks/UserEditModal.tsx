"use client";

import { useState, useEffect, useRef } from "react";
import { Avatar } from "../../../_components/atoms/Avatar/Avatar";
import { Icon } from "../../../_components/atoms/Icon/Icon";
import { Skeleton } from "../../../_components/atoms/Skeleton/Skeleton";
import { ConfirmDialog } from "../../../_components/molecules/ConfirmDialog";
import { useBranchesOptions } from "../../../_hooks/useBranchesOptions";
import { getRoleNameLabel } from "../../../_lib/rbacLabels";
import { updateUserSchema } from "../_logic/schemas/updateUser.schema";
import { createUserSchema } from "../_logic/schemas/createUser.schema";
import type { User } from "../_logic/types/domain";
import type { RoleOption } from "../_logic/services/listAvailableRoles";

interface UserEditModalProps {
  open: boolean;
  mode: "create" | "edit";
  user: User | null;
  catalog: RoleOption[];
  catalogLoading: boolean;
  isSaving: boolean;
  mutationError: string | null;
  onSave: (params: {
    name: string;
    email: string;
    avatarUrlInput: string;
    avatarReset: boolean;
    branchId: string | null;
    stagedRoleIds: Set<string>;
  }) => void;
  onClose: () => void;
  onResendSetPasswordEmail?: (userId: string) => void;
  isSendingSetPasswordEmail?: boolean;
  setPasswordEmailError?: string | null;
  setPasswordEmailSuccess?: string | null;
}

interface ValidationErrors {
  name?: string;
  email?: string;
  avatarUrl?: string;
}

export function UserEditModal({
  open,
  mode,
  user,
  catalog,
  catalogLoading,
  isSaving,
  mutationError,
  onSave,
  onClose,
  onResendSetPasswordEmail,
  isSendingSetPasswordEmail,
  setPasswordEmailError,
  setPasswordEmailSuccess,
}: UserEditModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const { options: branchOptions } = useBranchesOptions();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [avatarUrlInput, setAvatarUrlInput] = useState("");
  const [avatarReset, setAvatarReset] = useState(false);
  const [branchId, setBranchId] = useState<string | null>(null);
  const [stagedRoleIds, setStagedRoleIds] = useState<Set<string>>(new Set());
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});
  const [confirmResendOpen, setConfirmResendOpen] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) dialog.showModal();
    else dialog.close();
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handleCancel = (e: Event) => { e.preventDefault(); onClose(); };
    dialog.addEventListener("cancel", handleCancel);
    return () => dialog.removeEventListener("cancel", handleCancel);
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    setAvatarUrlInput("");
    setAvatarReset(false);
    setValidationErrors({});
    setConfirmResendOpen(false);
    if (mode === "edit" && user) {
      setName(user.name ?? "");
      setEmail(user.email);
      setBranchId(user.branchId);
      const initialRoleIds = new Set(
        catalog.filter((r) => user.roles.includes(r.name)).map((r) => r.id)
      );
      setStagedRoleIds(initialRoleIds);
    } else if (mode === "create") {
      setName("");
      setEmail("");
      setBranchId(null);
      setStagedRoleIds(new Set());
    }
  }, [user, open, catalog, mode]);

  if (mode === "edit" && !user) return null;

  const originalRoleIds =
    mode === "edit" && user
      ? new Set(catalog.filter((r) => user.roles.includes(r.name)).map((r) => r.id))
      : new Set<string>();

  const isEditDirty =
    mode === "edit" &&
    user !== null &&
    (name !== (user.name ?? "") ||
      email !== user.email ||
      avatarReset ||
      avatarUrlInput !== "" ||
      branchId !== user.branchId ||
      stagedRoleIds.size !== originalRoleIds.size ||
      [...stagedRoleIds].some((id) => !originalRoleIds.has(id)));

  const isCreateValid = name.trim() !== "" && email.trim() !== "";

  function validate(): boolean {
    if (mode === "create") {
      const result = createUserSchema.safeParse({
        name,
        email,
        avatarUrl: avatarUrlInput || undefined,
      });
      if (!result.success) {
        const errs: ValidationErrors = {};
        for (const issue of result.error.issues) {
          const key = issue.path[0];
          if (key === "email") errs.email = issue.message;
          if (key === "avatarUrl") errs.avatarUrl = issue.message;
          if (key === "name") errs.name = issue.message;
        }
        setValidationErrors(errs);
        return false;
      }
      setValidationErrors({});
      return true;
    }

    const partial = {
      name: name || undefined,
      email: email !== user!.email ? email : undefined,
      avatarUrl: avatarUrlInput || undefined,
    };
    const result = updateUserSchema.safeParse(partial);
    if (!result.success) {
      const errs: ValidationErrors = {};
      for (const issue of result.error.issues) {
        if (issue.path[0] === "email") errs.email = issue.message;
        if (issue.path[0] === "avatarUrl") errs.avatarUrl = issue.message;
      }
      setValidationErrors(errs);
      return false;
    }
    setValidationErrors({});
    return true;
  }

  function handleSave() {
    if (!validate()) return;
    onSave({ name, email, avatarUrlInput, avatarReset, branchId, stagedRoleIds });
  }

  function handleConfirmResend() {
    setConfirmResendOpen(false);
    if (user) onResendSetPasswordEmail?.(user.id);
  }

  function toggleRole(roleId: string) {
    setStagedRoleIds((prev) => {
      const next = new Set(prev);
      if (next.has(roleId)) next.delete(roleId);
      else next.add(roleId);
      return next;
    });
  }

  const avatarSrc = mode === "edit" ? (avatarReset ? undefined : (avatarUrlInput || user?.avatarUrl)) : (avatarUrlInput || undefined);
  const avatarFallback = (name || email || user?.name || user?.email || "?")[0]?.toUpperCase() ?? "?";
  const isBusy = isSaving;
  const isSubmitDisabled = mode === "create"
    ? !isCreateValid || isBusy || Object.keys(validationErrors).length > 0
    : !isEditDirty || isBusy || Object.keys(validationErrors).length > 0;

  return (
    <>
    <dialog
      ref={dialogRef}
      className="rounded-lg bg-surface-container p-0 shadow-lg w-full max-w-lg backdrop:bg-black/40"
    >
      <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant">
        <h2 className="text-title-md font-semibold text-on-surface">
          {mode === "create" ? "Crear usuario" : "Editar Usuario"}
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded text-on-surface-variant hover:bg-surface-container-high"
        >
          <Icon name="close" size={20} />
        </button>
      </div>

      <div className="px-6 py-5 space-y-5 max-h-[65vh] overflow-y-auto">
        {/* Avatar preview */}
        <div className="flex items-center gap-4">
          <Avatar
            src={avatarSrc}
            alt={name || email || user?.email || ""}
            size="lg"
            fallbackInitials={avatarFallback}
          />
          <div className="flex-1">
            <p className="text-label-lg text-on-surface-variant mb-1">Foto de perfil (URL)</p>
            <input
              type="url"
              value={avatarUrlInput}
              onChange={(e) => { setAvatarUrlInput(e.target.value); setAvatarReset(false); }}
              placeholder="https://example.com/photo.jpg"
              className="w-full px-3 py-2 rounded-md border border-outline-variant bg-surface-container-lowest text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
            />
            {validationErrors.avatarUrl && (
              <p className="text-label-sm text-error mt-1">{validationErrors.avatarUrl}</p>
            )}
            {mode === "edit" && (
              <button
                type="button"
                onClick={() => { setAvatarUrlInput(""); setAvatarReset(true); }}
                className="mt-1.5 text-label-sm text-primary underline underline-offset-2"
              >
                Resetear a Gravatar
              </button>
            )}
          </div>
        </div>

        {/* Name */}
        <div>
          <label className="block text-label-lg text-on-surface-variant mb-1" htmlFor="edit-name">
            Nombre
          </label>
          <input
            id="edit-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 rounded-md border border-outline-variant bg-surface-container-lowest text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
          />
          {validationErrors.name && (
            <p className="text-label-sm text-error mt-1">{validationErrors.name}</p>
          )}
        </div>

        {/* Email */}
        <div>
          <label className="block text-label-lg text-on-surface-variant mb-1" htmlFor="edit-email">
            Email
          </label>
          <input
            id="edit-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2 rounded-md border border-outline-variant bg-surface-container-lowest text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
          />
          {validationErrors.email && (
            <p className="text-label-sm text-error mt-1">{validationErrors.email}</p>
          )}
        </div>

        {/* Aviso de contraseña (solo creación): informativo, no se captura */}
        {mode === "create" && (
          <p className="text-body-sm text-on-surface-variant bg-surface-container-low px-3 py-2 rounded-md">
            Se enviará un correo al nuevo usuario para que establezca su propia contraseña.
          </p>
        )}

        {/* Reenvío de contraseña (solo edición): nunca edición directa */}
        {mode === "edit" && user && (
          <div>
            <p className="block text-label-lg text-on-surface-variant mb-1">Contraseña</p>
            <button
              type="button"
              onClick={() => setConfirmResendOpen(true)}
              disabled={isSendingSetPasswordEmail}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-outline text-label-lg text-on-surface font-medium hover:bg-surface-container-high transition-colors disabled:opacity-40"
            >
              {isSendingSetPasswordEmail ? (
                <>
                  <Icon name="progress_activity" size={16} className="animate-spin" />
                  Enviando...
                </>
              ) : (
                "Enviar correo para establecer/restablecer contraseña"
              )}
            </button>
            {setPasswordEmailSuccess && (
              <p className="text-label-sm text-primary mt-1">{setPasswordEmailSuccess}</p>
            )}
            {setPasswordEmailError && (
              <p className="text-label-sm text-error mt-1">{setPasswordEmailError}</p>
            )}
          </div>
        )}

        {/* Sucursal */}
        <div>
          <label className="block text-label-lg text-on-surface-variant mb-1" htmlFor="branch-select">
            Sucursal
          </label>
          <select
            id="branch-select"
            value={branchId ?? ""}
            onChange={(e) => setBranchId(e.target.value === "" ? null : e.target.value)}
            className="w-full px-3 py-2 rounded-md border border-outline-variant bg-surface-container-lowest text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">Sin sucursal</option>
            {branchOptions.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>

        {/* Roles */}
        <div>
          <p className="text-label-lg text-on-surface-variant mb-2">Roles</p>
          {catalogLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} height={36} className="w-full" />)}
            </div>
          ) : (
            <div className="space-y-2">
              {catalog.map((role) => (
                <label
                  key={role.id}
                  className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-surface-container-low cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={stagedRoleIds.has(role.id)}
                    onChange={() => toggleRole(role.id)}
                    className="w-4 h-4 accent-primary"
                  />
                  <span className="text-body-md text-on-surface">{getRoleNameLabel(role.name)}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        {mutationError && (
          <p className="text-body-md text-error bg-error-container px-4 py-2 rounded">
            {mutationError}
          </p>
        )}
      </div>

      <div className="flex justify-end gap-3 px-6 py-4 border-t border-outline-variant bg-surface-container-lowest">
        <button
          type="button"
          onClick={onClose}
          disabled={isBusy}
          className="px-5 py-2.5 rounded-md border border-outline text-label-lg text-on-surface font-medium hover:bg-surface-container-high transition-colors disabled:opacity-40"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={isSubmitDisabled}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md bg-primary text-on-primary text-label-lg font-medium hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isBusy ? (
            <>
              <Icon name="progress_activity" size={16} className="animate-spin" />
              {mode === "create" ? "Creando..." : "Guardando..."}
            </>
          ) : mode === "create" ? (
            "Crear usuario"
          ) : (
            "Guardar Cambios"
          )}
        </button>
      </div>
    </dialog>
    {mode === "edit" && user && (
      <ConfirmDialog
        open={confirmResendOpen}
        title="Enviar correo de contraseña"
        description={`Se enviará un correo a ${user.email} con un enlace para establecer/restablecer su contraseña. El enlace anterior (si existía) dejará de funcionar.`}
        confirmLabel="Enviar"
        onConfirm={handleConfirmResend}
        onCancel={() => setConfirmResendOpen(false)}
      />
    )}
    </>
  );
}
