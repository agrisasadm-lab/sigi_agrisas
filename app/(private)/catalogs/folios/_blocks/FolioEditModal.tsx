"use client";

import { useState, useEffect, useRef } from "react";
import { IconButton } from "../../../../_components/atoms/IconButton/IconButton";
import { Button } from "../../../../_components/atoms/Button/Button";
import { Select } from "../../../../_components/atoms/Select/Select";
import { Switch } from "../../../../_components/atoms/Switch/Switch";
import { createFolioSchema, updateFolioSchema } from "../_logic/schemas/folio.schema";
import type { Folio, FolioScope } from "../_logic/types/domain";
import type { CreateFolioBody, UpdateFolioBody } from "../_logic/types/api";
import { SCOPE_LABEL } from "../_logic/scopeLabels";

const SCOPE_OPTIONS = (Object.entries(SCOPE_LABEL) as [FolioScope, string][]).map(
  ([value, label]) => ({ value, label }),
);

interface FolioEditModalProps {
  open: boolean;
  mode: "create" | "edit";
  entity: Folio | null;
  isSaving: boolean;
  codeError: string | null;
  mutationError: string | null;
  onSave: (data: CreateFolioBody | UpdateFolioBody) => void;
  onClose: () => void;
}

export function FolioEditModal({
  open,
  mode,
  entity,
  isSaving,
  codeError,
  mutationError,
  onSave,
  onClose,
}: FolioEditModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [prefix, setPrefix] = useState("");
  const [scope, setScope] = useState<FolioScope>("OPERATIONS");
  const [currentNumber, setCurrentNumber] = useState(0);
  const [isActive, setIsActive] = useState(true);
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
      setPrefix("");
      setScope("OPERATIONS");
      setCurrentNumber(0);
      setIsActive(true);
    } else if (entity) {
      setCode(entity.code);
      setName(entity.name);
      setPrefix(entity.prefix ?? "");
      setScope(entity.scope);
      setCurrentNumber(entity.currentNumber);
      setIsActive(entity.isActive);
    }
    setValidationErrors({});
  }, [open, mode, entity]);

  function validate(): boolean {
    if (mode === "create") {
      const result = createFolioSchema.safeParse({
        code,
        name,
        prefix: prefix || null,
        scope,
        currentNumber,
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
    } else {
      const result = updateFolioSchema.safeParse({
        name,
        prefix: prefix || null,
        scope,
        currentNumber,
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

  function getDiff(): UpdateFolioBody {
    if (!entity) return {};
    const diff: UpdateFolioBody = {};
    if (name !== entity.name) diff.name = name;
    const pfx = prefix || null;
    if (pfx !== entity.prefix) diff.prefix = pfx;
    if (scope !== entity.scope) diff.scope = scope;
    if (currentNumber !== entity.currentNumber) diff.currentNumber = currentNumber;
    if (isActive !== entity.isActive) diff.isActive = isActive;
    return diff;
  }

  const isCreateMode = mode === "create";
  const isDirty =
    isCreateMode
      ? code !== "" ||
        name !== "" ||
        prefix !== "" ||
        scope !== "OPERATIONS" ||
        currentNumber !== 0 ||
        !isActive
      : entity !== null &&
        (name !== entity.name ||
          (prefix || null) !== entity.prefix ||
          scope !== entity.scope ||
          currentNumber !== entity.currentNumber ||
          isActive !== entity.isActive);

  const isDiffEmpty = mode === "edit" && Object.keys(getDiff()).length === 0;

  function handleSave() {
    if (!validate()) return;
    if (isCreateMode) {
      onSave({ code, name, prefix: prefix || null, scope, currentNumber, isActive });
    } else {
      const diff = getDiff();
      if (Object.keys(diff).length === 0) return;
      onSave(diff);
    }
  }

  const title = isCreateMode ? "Nuevo Folio" : "Editar Folio";

  return (
    <dialog
      ref={dialogRef}
      className="rounded-lg bg-surface-container p-0 shadow-lg w-full max-w-lg backdrop:bg-black/40"
    >
      <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant">
        <h2 className="text-title-md font-semibold text-on-surface">{title}</h2>
        <IconButton
          icon="close"
          iconSize={20}
          ariaLabel="Cerrar"
          variant="ghost"
          onClick={onClose}
          className="rounded p-1.5"
        />
      </div>

      <div className="px-6 py-5 space-y-5 max-h-[65vh] overflow-y-auto">
        <div>
          <label className="block text-label-lg text-on-surface-variant mb-1" htmlFor="folio-code">
            Código
          </label>
          <input
            id="folio-code"
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            disabled={!isCreateMode}
            placeholder="EJ. FACTURA_A"
            className="w-full px-3 py-2 rounded-md border border-outline-variant bg-surface-container-lowest text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-40 disabled:cursor-not-allowed disabled:bg-surface-container"
          />
          {(validationErrors.code || codeError) && (
            <p className="text-label-sm text-error mt-1">
              {validationErrors.code ?? codeError}
            </p>
          )}
        </div>

        <div>
          <label className="block text-label-lg text-on-surface-variant mb-1" htmlFor="folio-name">
            Nombre
          </label>
          <input
            id="folio-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nombre del folio"
            className="w-full px-3 py-2 rounded-md border border-outline-variant bg-surface-container-lowest text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
          />
          {validationErrors.name && (
            <p className="text-label-sm text-error mt-1">{validationErrors.name}</p>
          )}
        </div>

        <div>
          <label className="block text-label-lg text-on-surface-variant mb-1" htmlFor="folio-prefix">
            Prefijo
          </label>
          <input
            id="folio-prefix"
            type="text"
            value={prefix}
            onChange={(e) => setPrefix(e.target.value.toUpperCase())}
            placeholder="Ej. FA (opcional)"
            className="w-full px-3 py-2 rounded-md border border-outline-variant bg-surface-container-lowest text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
          />
          {validationErrors.prefix && (
            <p className="text-label-sm text-error mt-1">{validationErrors.prefix}</p>
          )}
        </div>

        <div>
          <label className="block text-label-lg text-on-surface-variant mb-1" htmlFor="folio-scope">
            Ámbito
          </label>
          <Select
            id="folio-scope"
            value={scope}
            onChange={(e) => setScope(e.target.value as FolioScope)}
            error={validationErrors.scope}
          >
            {SCOPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
          {validationErrors.scope && (
            <p className="text-label-sm text-error mt-1">{validationErrors.scope}</p>
          )}
        </div>

        <div>
          <label className="block text-label-lg text-on-surface-variant mb-1" htmlFor="folio-currentNumber">
            Número actual
          </label>
          <input
            id="folio-currentNumber"
            type="number"
            value={currentNumber}
            onChange={(e) => setCurrentNumber(Math.max(0, parseInt(e.target.value, 10) || 0))}
            min={0}
            className="w-full px-3 py-2 rounded-md border border-outline-variant bg-surface-container-lowest text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
          />
          {validationErrors.currentNumber && (
            <p className="text-label-sm text-error mt-1">{validationErrors.currentNumber}</p>
          )}
        </div>

        <div className="flex items-center gap-3">
          <Switch
            checked={isActive}
            onChange={setIsActive}
            aria-label="Activo"
            id="folio-isActive"
          />
          <label htmlFor="folio-isActive" className="text-label-lg text-on-surface-variant cursor-pointer">
            Activo
          </label>
        </div>

        {mutationError && (
          <p className="text-body-md text-error bg-error-container px-4 py-2 rounded">
            {mutationError}
          </p>
        )}
      </div>

      <div className="flex justify-end gap-3 px-6 py-4 border-t border-outline-variant bg-surface-container-lowest">
        <Button type="button" variant="outlined" onClick={onClose} disabled={isSaving}>
          Cancelar
        </Button>
        <Button
          type="button"
          variant="filled"
          onClick={handleSave}
          disabled={!isDirty || isDiffEmpty || isSaving || Object.keys(validationErrors).length > 0}
          loading={isSaving}
        >
          {isSaving ? "Guardando..." : "Guardar"}
        </Button>
      </div>
    </dialog>
  );
}
