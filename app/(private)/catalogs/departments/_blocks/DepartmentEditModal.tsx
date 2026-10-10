"use client";

import { useState, useEffect, useRef } from "react";
import { Icon } from "../../../../_components/atoms/Icon/Icon";
import { IconButton } from "../../../../_components/atoms/IconButton/IconButton";
import { Button } from "../../../../_components/atoms/Button/Button";
import { Select } from "../../../../_components/atoms/Select/Select";
import { Switch } from "../../../../_components/atoms/Switch/Switch";
import { createDepartmentSchema, updateDepartmentSchema } from "../_logic/schemas/department.schema";
import { useProvidersOptions } from "../../../../_hooks/useProvidersOptions";
import type { Department } from "../_logic/types/domain";
import type { CreateDepartmentBody, UpdateDepartmentBody } from "../_logic/types/api";

interface DepartmentEditModalProps {
  open: boolean;
  mode: "create" | "edit";
  entity: Department | null;
  isSaving: boolean;
  codeError: string | null;
  mutationError: string | null;
  onSave: (data: CreateDepartmentBody | UpdateDepartmentBody) => void;
  onClose: () => void;
}

export function DepartmentEditModal({
  open,
  mode,
  entity,
  isSaving,
  codeError,
  mutationError,
  onSave,
  onClose,
}: DepartmentEditModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const { options: providerOptions } = useProvidersOptions();

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [providerId, setProviderId] = useState("");
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
    const handleCancel = (e: Event) => { e.preventDefault(); onClose(); };
    dialog.addEventListener("cancel", handleCancel);
    return () => dialog.removeEventListener("cancel", handleCancel);
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    if (mode === "create") {
      setCode(""); setName(""); setDescription(""); setProviderId(""); setIsActive(true);
    } else if (entity) {
      setCode(entity.code);
      setName(entity.name);
      setDescription(entity.description ?? "");
      setProviderId(entity.providerId ?? "");
      setIsActive(entity.isActive);
    }
    setValidationErrors({});
  }, [open, mode, entity]);

  function validate(): boolean {
    if (mode === "create") {
      const result = createDepartmentSchema.safeParse({ code, name, description: description || null, providerId, isActive });
      if (!result.success) {
        const errs: Record<string, string> = {};
        for (const issue of result.error.issues) { const key = String(issue.path[0]); errs[key] = issue.message; }
        setValidationErrors(errs);
        return false;
      }
    } else {
      const result = updateDepartmentSchema.safeParse({ name, description: description || null, providerId: providerId || null, isActive });
      if (!result.success) {
        const errs: Record<string, string> = {};
        for (const issue of result.error.issues) { const key = String(issue.path[0]); errs[key] = issue.message; }
        setValidationErrors(errs);
        return false;
      }
    }
    setValidationErrors({});
    return true;
  }

  function getDiff(): UpdateDepartmentBody {
    if (!entity) return {};
    const diff: UpdateDepartmentBody = {};
    if (name !== entity.name) diff.name = name;
    const desc = description || null;
    if (desc !== entity.description) diff.description = desc;
    const newProviderId = providerId || null;
    if (newProviderId !== entity.providerId) diff.providerId = newProviderId;
    if (isActive !== entity.isActive) diff.isActive = isActive;
    return diff;
  }

  const isCreateMode = mode === "create";
  const isDirty = isCreateMode
    ? code !== "" || name !== "" || description !== "" || providerId !== "" || !isActive
    : entity !== null && (
        name !== entity.name ||
        (description || null) !== entity.description ||
        (providerId || null) !== entity.providerId ||
        isActive !== entity.isActive
      );

  const isDiffEmpty = mode === "edit" && Object.keys(getDiff()).length === 0;

  function handleSave() {
    if (!validate()) return;
    if (isCreateMode) {
      onSave({ code, name, description: description || null, providerId, isActive });
    } else {
      const diff = getDiff();
      if (Object.keys(diff).length === 0) return;
      onSave(diff);
    }
  }

  const title = isCreateMode ? "Nuevo Departamento" : "Editar Departamento";

  return (
    <dialog
      ref={dialogRef}
      className="rounded-lg bg-surface-container p-0 shadow-lg w-full max-w-lg backdrop:bg-black/40"
    >
      <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant">
        <h2 className="text-title-md font-semibold text-on-surface">{title}</h2>
        <IconButton icon="close" iconSize={20} ariaLabel="Cerrar" variant="ghost" onClick={onClose} className="rounded p-1.5" />
      </div>

      <div className="px-6 py-5 space-y-5 max-h-[65vh] overflow-y-auto">
        <div>
          <label className="block text-label-lg text-on-surface-variant mb-1" htmlFor="dept-code">Código</label>
          <input
            id="dept-code"
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            disabled={!isCreateMode}
            placeholder="EJ. VENTAS"
            className="w-full px-3 py-2 rounded-md border border-outline-variant bg-surface-container-lowest text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-40 disabled:cursor-not-allowed disabled:bg-surface-container"
          />
          {(validationErrors.code || codeError) && (
            <p className="text-label-sm text-error mt-1">{validationErrors.code ?? codeError}</p>
          )}
        </div>

        <div>
          <label className="block text-label-lg text-on-surface-variant mb-1" htmlFor="dept-name">Nombre</label>
          <input
            id="dept-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nombre del departamento"
            className="w-full px-3 py-2 rounded-md border border-outline-variant bg-surface-container-lowest text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
          />
          {validationErrors.name && <p className="text-label-sm text-error mt-1">{validationErrors.name}</p>}
        </div>

        <div>
          <label className="block text-label-lg text-on-surface-variant mb-1" htmlFor="dept-provider">
            Proveedor {isCreateMode && <span className="text-error">*</span>}
          </label>
          <Select
            id="dept-provider"
            value={providerId}
            onChange={(e) => setProviderId(e.target.value)}
            error={validationErrors.providerId}
          >
            <option value="">Sin proveedor</option>
            {providerOptions.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </Select>
          {validationErrors.providerId && <p className="text-label-sm text-error mt-1">{validationErrors.providerId}</p>}
          {!isCreateMode && !entity?.providerId && (
            <p className="flex items-center gap-1.5 text-label-sm text-on-surface-variant mt-1.5">
              <Icon name="info" size={14} />
              Este departamento no tiene proveedor asignado. Se recomienda asignar uno.
            </p>
          )}
        </div>

        <div>
          <label className="block text-label-lg text-on-surface-variant mb-1" htmlFor="dept-description">Descripción</label>
          <textarea
            id="dept-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Descripción opcional"
            rows={3}
            className="w-full px-3 py-2 rounded-md border border-outline-variant bg-surface-container-lowest text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary resize-none"
          />
          {validationErrors.description && <p className="text-label-sm text-error mt-1">{validationErrors.description}</p>}
        </div>

        <div className="flex items-center gap-3">
          <Switch checked={isActive} onChange={setIsActive} aria-label="Activo" id="dept-isActive" />
          <label htmlFor="dept-isActive" className="text-label-lg text-on-surface-variant cursor-pointer">Activo</label>
        </div>

        {mutationError && (
          <p className="text-body-md text-error bg-error-container px-4 py-2 rounded">{mutationError}</p>
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
