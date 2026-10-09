"use client";

import { useState, useEffect, useRef } from "react";
import { Icon } from "../../../../_components/atoms/Icon/Icon";
import { Switch } from "../../../../_components/atoms/Switch/Switch";
import { createPaymentMethodSchema, updatePaymentMethodSchema } from "../_logic/schemas/paymentMethod.schema";
import type { PaymentMethod } from "../_logic/types/domain";
import type { CreatePaymentMethodBody, UpdatePaymentMethodBody } from "../_logic/types/api";

interface PaymentMethodEditModalProps {
  open: boolean;
  mode: "create" | "edit";
  entity: PaymentMethod | null;
  isSaving: boolean;
  codeError: string | null;
  mutationError: string | null;
  onSave: (data: CreatePaymentMethodBody | UpdatePaymentMethodBody) => void;
  onClose: () => void;
}

export function PaymentMethodEditModal({
  open,
  mode,
  entity,
  isSaving,
  codeError,
  mutationError,
  onSave,
  onClose,
}: PaymentMethodEditModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [isCredit, setIsCredit] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) dialog.showModal();
    else dialog.close();
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handleCancel = (e: Event) => {
      e.preventDefault();
      onClose();
    };
    dialog.addEventListener("cancel", handleCancel);
    return () => dialog.removeEventListener("cancel", handleCancel);
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    if (mode === "create") {
      setCode("");
      setName("");
      setDescription("");
      setIsActive(true);
      setIsCredit(false);
    } else if (entity) {
      setCode(entity.code);
      setName(entity.name);
      setDescription(entity.description ?? "");
      setIsActive(entity.isActive);
      setIsCredit(entity.isCredit);
    }
    setValidationErrors({});
  }, [open, mode, entity]);

  function validate(): boolean {
    if (mode === "create") {
      const result = createPaymentMethodSchema.safeParse({
        code,
        name,
        description: description || null,
        isActive,
        isCredit,
      });
      if (!result.success) {
        const errs: Record<string, string> = {};
        for (const issue of result.error.issues) {
          const key = String(issue.path[0]);
          errs[key] = issue.message;
        }
        setValidationErrors(errs);
        return false;
      }
    } else {
      const result = updatePaymentMethodSchema.safeParse({
        name,
        description: description || null,
        isActive,
      });
      if (!result.success) {
        const errs: Record<string, string> = {};
        for (const issue of result.error.issues) {
          const key = String(issue.path[0]);
          errs[key] = issue.message;
        }
        setValidationErrors(errs);
        return false;
      }
    }
    setValidationErrors({});
    return true;
  }

  function getDiff(): UpdatePaymentMethodBody {
    if (!entity) return {};
    // isCredit es inmutable tras creación (el backend lo ignora en PATCH) — nunca entra al diff.
    const diff: UpdatePaymentMethodBody = {};
    if (name !== entity.name) diff.name = name;
    const desc = description || null;
    if (desc !== entity.description) diff.description = desc;
    if (isActive !== entity.isActive) diff.isActive = isActive;
    return diff;
  }

  const isDirty =
    mode === "create"
      ? code !== "" || name !== "" || description !== "" || !isActive || isCredit
      : entity !== null &&
        (name !== entity.name ||
          (description || null) !== entity.description ||
          isActive !== entity.isActive);

  const isDiffEmpty = mode === "edit" && Object.keys(getDiff()).length === 0;

  function handleSave() {
    if (!validate()) return;
    if (mode === "create") {
      onSave({ code, name, description: description || null, isActive, isCredit });
    } else {
      const diff = getDiff();
      if (Object.keys(diff).length === 0) return;
      onSave(diff);
    }
  }

  const isCreateMode = mode === "create";
  const title = isCreateMode ? "Nueva Forma de Pago" : "Editar Forma de Pago";

  return (
    <dialog
      ref={dialogRef}
      className="rounded-lg bg-surface-container p-0 shadow-lg w-full max-w-lg backdrop:bg-black/40"
    >
      <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant">
        <h2 className="text-title-md font-semibold text-on-surface">{title}</h2>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded text-on-surface-variant hover:bg-surface-container-high"
        >
          <Icon name="close" size={20} />
        </button>
      </div>

      <div className="px-6 py-5 space-y-5 max-h-[65vh] overflow-y-auto">
        <div>
          <label className="block text-label-lg text-on-surface-variant mb-1" htmlFor="pm-code">
            Código
          </label>
          <input
            id="pm-code"
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            disabled={!isCreateMode}
            placeholder="EJ. EFECTIVO"
            className="w-full px-3 py-2 rounded-md border border-outline-variant bg-surface-container-lowest text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-40 disabled:cursor-not-allowed disabled:bg-surface-container"
          />
          {(validationErrors.code || codeError) && (
            <p className="text-label-sm text-error mt-1">
              {validationErrors.code ?? codeError}
            </p>
          )}
        </div>

        <div>
          <label className="block text-label-lg text-on-surface-variant mb-1" htmlFor="pm-name">
            Nombre
          </label>
          <input
            id="pm-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nombre de la forma de pago"
            className="w-full px-3 py-2 rounded-md border border-outline-variant bg-surface-container-lowest text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
          />
          {validationErrors.name && (
            <p className="text-label-sm text-error mt-1">{validationErrors.name}</p>
          )}
        </div>

        <div>
          <label className="block text-label-lg text-on-surface-variant mb-1" htmlFor="pm-description">
            Descripción
          </label>
          <textarea
            id="pm-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Descripción opcional"
            rows={3}
            className="w-full px-3 py-2 rounded-md border border-outline-variant bg-surface-container-lowest text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary resize-none"
          />
          {validationErrors.description && (
            <p className="text-label-sm text-error mt-1">{validationErrors.description}</p>
          )}
        </div>

        <div className="flex items-center gap-3">
          <Switch
            checked={isActive}
            onChange={setIsActive}
            aria-label="Activo"
            id="pm-isActive"
          />
          <label htmlFor="pm-isActive" className="text-label-lg text-on-surface-variant cursor-pointer">
            Activo
          </label>
        </div>

        <div className="flex items-center gap-3">
          <Switch
            checked={isCredit}
            onChange={setIsCredit}
            disabled={!isCreateMode}
            aria-label="Es crédito"
            id="pm-isCredit"
          />
          <label
            htmlFor="pm-isCredit"
            className={
              isCreateMode
                ? "text-label-lg text-on-surface-variant cursor-pointer"
                : "text-label-lg text-on-surface-variant opacity-40 cursor-not-allowed"
            }
          >
            Es crédito
          </label>
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
          disabled={isSaving}
          className="px-5 py-2.5 rounded-md border border-outline text-label-lg text-on-surface font-medium hover:bg-surface-container-high transition-colors disabled:opacity-40"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={!isDirty || isDiffEmpty || isSaving || Object.keys(validationErrors).length > 0}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md bg-primary text-on-primary text-label-lg font-medium hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isSaving ? (
            <>
              <Icon name="progress_activity" size={16} className="animate-spin" />
              Guardando...
            </>
          ) : (
            "Guardar"
          )}
        </button>
      </div>
    </dialog>
  );
}
