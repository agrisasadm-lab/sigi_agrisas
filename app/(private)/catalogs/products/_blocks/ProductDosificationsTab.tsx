"use client";

import { useState, useRef, useEffect } from "react";
import { useProductDosifications } from "../_logic/hooks/useProductDosifications";
import { usePriceBranchSelection } from "../_logic/hooks/usePriceBranchSelection";
import { useTableKeyboard } from "../../../../_hooks/useTableKeyboard";
import { DuplicateDosificationNameError } from "../_logic/errors";
import { ConfirmDialog } from "../../../../_components/molecules/ConfirmDialog/ConfirmDialog";
import { CatalogStatusBadge } from "../../_blocks/CatalogStatusBadge";
import { Icon } from "../../../../_components/atoms/Icon/Icon";
import { Skeleton } from "../../../../_components/atoms/Skeleton/Skeleton";
import type { ProductDosification } from "../_logic/types/domain";
import type { CreateDosificationBody, UpdateDosificationBody } from "../_logic/types/api";

interface ProductDosificationsTabProps {
  productId: string;
  canWrite: boolean;
}

interface DosifModalState {
  mode: "create" | "edit";
  entity: ProductDosification | null;
}

function DosifModal({
  open, mode, entity, isSaving, nameError, onSave, onClose,
}: {
  open: boolean; mode: "create" | "edit"; entity: ProductDosification | null; isSaving: boolean; nameError: string | null; onSave: (d: CreateDosificationBody | UpdateDosificationBody) => void; onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState("");
  const [numParts, setNumParts] = useState("2");
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) dialog.showModal(); else dialog.close();
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const h = (e: Event) => { e.preventDefault(); onClose(); };
    dialog.addEventListener("cancel", h);
    return () => dialog.removeEventListener("cancel", h);
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    if (mode === "create") { setName(""); setNumParts("2"); }
    else if (entity) { setName(entity.name); setNumParts(String(entity.numParts)); }
    setErrors({});
  }, [open, mode, entity]);

  const buildDiff = (): UpdateDosificationBody => {
    if (!entity) return {};
    const d: UpdateDosificationBody = {};
    if (name !== entity.name) d.name = name;
    const np = parseInt(numParts);
    if (!isNaN(np) && np !== entity.numParts) d.numParts = np;
    return d;
  };

  const isDiffEmpty = mode === "edit" && Object.keys(buildDiff()).length === 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = "El nombre es obligatorio.";
    const np = parseInt(numParts);
    if (isNaN(np) || np < 2) errs.numParts = "El número de partes debe ser al menos 2.";
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    if (mode === "create") onSave({ name: name.trim(), numParts: np });
    else onSave(buildDiff());
  };

  const fieldClass = "w-full px-3 py-2 rounded-md border border-outline-variant bg-surface-container-lowest text-body-md focus:outline-none focus:ring-2 focus:ring-primary";

  return (
    <dialog ref={dialogRef} className="rounded-lg shadow-xl bg-surface p-0 w-full max-w-sm backdrop:bg-black/40">
      <form onSubmit={handleSubmit} noValidate>
        <div className="px-6 pt-6 pb-4 border-b border-outline-variant">
          <h2 className="text-title-md font-semibold text-on-surface">{mode === "create" ? "Nueva dosificación" : "Editar dosificación"}</h2>
        </div>
        <div className="px-6 py-4 space-y-4">
          <div>
            <label className="block text-label-lg text-on-surface-variant mb-1">Nombre *</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} className={fieldClass} />
            {(nameError || errors.name) && <p className="text-label-sm text-error mt-1">{nameError ?? errors.name}</p>}
          </div>
          <div>
            <label className="block text-label-lg text-on-surface-variant mb-1">Número de partes *</label>
            <input type="number" value={numParts} onChange={(e) => setNumParts(e.target.value)} min={2} step={1} className={fieldClass} />
            {errors.numParts && <p className="text-label-sm text-error mt-1">{errors.numParts}</p>}
          </div>
        </div>
        <div className="px-6 pb-6 pt-2 flex justify-end gap-3 border-t border-outline-variant">
          <button type="button" onClick={onClose} disabled={isSaving} className="px-4 py-2 rounded-md text-label-lg text-on-surface-variant hover:bg-surface-container transition-colors">Cancelar</button>
          <button type="submit" disabled={isSaving || isDiffEmpty} className="px-4 py-2 rounded-md bg-primary text-on-primary text-label-lg font-medium hover:opacity-90 disabled:opacity-50">{isSaving ? "Guardando…" : mode === "create" ? "Crear" : "Guardar"}</button>
        </div>
      </form>
    </dialog>
  );
}

export function ProductDosificationsTab({ productId, canWrite }: ProductDosificationsTabProps) {
  const { branches, selectedBranchId, setSelectedBranchId, hasNoBranch } = usePriceBranchSelection();
  const { dosifications, isLoading, error, isSaving, saveError, refresh, createOne, updateOne, softDeleteOne, reactivateOne } = useProductDosifications(productId, selectedBranchId);
  const [modal, setModal] = useState<DosifModalState | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);

  const openEditModal = (d: ProductDosification) => {
    setNameError(null); setModal({ mode: "edit", entity: d });
  };
  const noop = () => {};
  const { getRowProps: getDosifRowProps } = useTableKeyboard(dosifications, canWrite ? openEditModal : noop);

  const handleSave = async (data: CreateDosificationBody | UpdateDosificationBody) => {
    setNameError(null);
    try {
      if (modal?.mode === "create") await createOne(data as CreateDosificationBody);
      else if (modal?.entity) await updateOne(modal.entity.id, data as UpdateDosificationBody);
      setModal(null);
    } catch (err) {
      if (err instanceof DuplicateDosificationNameError) setNameError("Ya existe una dosificación con ese nombre.");
    }
  };

  if (hasNoBranch) {
    return (
      <p className="p-6 text-center text-on-surface-variant text-body-md">
        Necesitas una sucursal asignada para administrar dosificaciones. Pídele a un administrador que te asigne una.
      </p>
    );
  }
  if (isLoading) return <div className="space-y-2 p-4">{Array.from({length:3}).map((_,i) => <Skeleton key={i} className="h-10 w-full rounded-md" />)}</div>;
  if (error) return <p className="p-4 text-error text-label-lg">{error}</p>;

  return (
    <div className="space-y-4">
      {!canWrite && <p className="text-label-sm text-on-surface-variant px-1">Solo lectura — requiere products:write</p>}
      {saveError && <p className="text-label-sm text-error bg-error-container/30 px-3 py-2 rounded-md">{saveError}</p>}

      <div className="flex items-center gap-2 px-1">
        <label htmlFor="dosification-branch-scope" className="text-label-lg text-on-surface-variant">Sucursal</label>
        <select
          id="dosification-branch-scope"
          value={selectedBranchId ?? ""}
          onChange={(e) => setSelectedBranchId(e.target.value || null)}
          disabled={branches.length === 0}
          className="px-3 py-1.5 rounded-md border border-outline-variant bg-surface-container-lowest text-body-md focus:outline-none focus:ring-2 focus:ring-primary"
        >
          {branches.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
      </div>

      <div className="bg-surface-container-low rounded-lg border border-outline-variant overflow-hidden">
        <div className="px-4 py-3 border-b border-outline-variant flex items-center justify-between">
          <span className="text-label-lg font-medium text-on-surface">Dosificaciones</span>
          {canWrite && (
            <button type="button" onClick={() => { setNameError(null); setModal({mode:"create", entity:null}); }} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-primary text-on-primary text-label-sm font-medium hover:opacity-90">
              <Icon name="add" size={14} />Nueva dosificación
            </button>
          )}
        </div>
        {dosifications.length === 0 ? (
          <p className="p-6 text-center text-on-surface-variant text-body-md">Sin dosificaciones configuradas.</p>
        ) : (
          <table className="w-full text-left text-body-md">
            <thead>
              <tr className="text-label-lg text-on-surface-variant border-b border-outline-variant">
                <th className="px-4 py-2 font-medium">Nombre</th>
                <th className="px-4 py-2 font-medium text-right">Partes</th>
                <th className="px-4 py-2 font-medium text-right">Precio unitario</th>
                <th className="px-4 py-2 font-medium">Estado</th>
                {canWrite && <th className="px-4 py-2 font-medium">Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {dosifications.map((d, idx) => (
                <tr
                  key={d.id}
                  {...getDosifRowProps(idx)}
                  className="border-b border-outline-variant hover:bg-surface-container-low focus:bg-surface-container focus:outline-none transition-colors cursor-default"
                >
                  <td className="px-4 py-2">{d.name}</td>
                  <td className="px-4 py-2 text-right">{d.numParts}</td>
                  <td className="px-4 py-2 text-right">
                    {d.requiresDefaultPrice
                      ? <span className="text-on-surface-variant text-label-sm">Requiere precio default en esta sucursal</span>
                      : d.computedUnitPrice != null ? `$${d.computedUnitPrice.toFixed(2)}` : "—"
                    }
                  </td>
                  <td className="px-4 py-2"><CatalogStatusBadge isActive={d.isActive} /></td>
                  {canWrite && (
                    <td className="px-4 py-2">
                      <div className="flex gap-2">
                        <button type="button" onClick={() => { setNameError(null); setModal({mode:"edit", entity:d}); }} className="p-1 rounded hover:bg-surface-container text-on-surface-variant" title="Editar"><Icon name="edit" size={14}/></button>
                        {d.isActive ? (
                          <button type="button" onClick={() => setConfirmDeleteId(d.id)} className="p-1 rounded hover:bg-error/10 text-error" title="Desactivar"><Icon name="block" size={14}/></button>
                        ) : (
                          <button type="button" onClick={() => reactivateOne(d.id)} className="p-1 rounded hover:bg-primary/10 text-primary text-label-sm" title="Reactivar"><Icon name="check_circle" size={14}/></button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modal && (
        <DosifModal open mode={modal.mode} entity={modal.entity} isSaving={isSaving} nameError={nameError} onSave={handleSave} onClose={() => setModal(null)} />
      )}

      <ConfirmDialog
        open={!!confirmDeleteId}
        title="¿Desactivar dosificación?"
        description="La dosificación quedará inactiva."
        confirmLabel="Desactivar"
        onConfirm={async () => { if (confirmDeleteId) { await softDeleteOne(confirmDeleteId); setConfirmDeleteId(null); } }}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </div>
  );
}
