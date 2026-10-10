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
import { Button } from "../../../../_components/atoms/Button/Button";
import { IconButton } from "../../../../_components/atoms/IconButton/IconButton";
import { Select } from "../../../../_components/atoms/Select/Select";
import { Table, THead, TBody, Tr, Th, Td } from "../../../../_components/molecules/DataTable/DataTable";
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
          <Button type="button" variant="text" onClick={onClose} disabled={isSaving}>Cancelar</Button>
          <Button type="submit" variant="filled" disabled={isSaving || isDiffEmpty} loading={isSaving}>{isSaving ? "Guardando…" : mode === "create" ? "Crear" : "Guardar"}</Button>
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
        <Select
          id="dosification-branch-scope"
          value={selectedBranchId ?? ""}
          onChange={(e) => setSelectedBranchId(e.target.value || null)}
          disabled={branches.length === 0}
          className="w-auto py-1.5"
        >
          {branches.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </Select>
      </div>

      <div className="bg-surface-container-low rounded-lg border border-outline-variant overflow-hidden">
        <div className="px-4 py-3 border-b border-outline-variant flex items-center justify-between">
          <span className="text-label-lg font-medium text-on-surface">Dosificaciones</span>
          {canWrite && (
            <Button
              type="button"
              variant="filled"
              size="sm"
              icon="add"
              onClick={() => { setNameError(null); setModal({mode:"create", entity:null}); }}
            >
              Nueva dosificación
            </Button>
          )}
        </div>
        {dosifications.length === 0 ? (
          <p className="p-6 text-center text-on-surface-variant text-body-md">Sin dosificaciones configuradas.</p>
        ) : (
          <Table className="text-left">
            <THead>
              <Tr hoverable={false}>
                <Th>Nombre</Th>
                <Th align="right">Partes</Th>
                <Th align="right">Precio unitario</Th>
                <Th>Estado</Th>
                {canWrite && <Th>Acciones</Th>}
              </Tr>
            </THead>
            <TBody>
              {dosifications.map((d, idx) => (
                <Tr
                  key={d.id}
                  {...getDosifRowProps(idx)}
                  className="focus:bg-surface-container focus:outline-none cursor-default"
                >
                  <Td>{d.name}</Td>
                  <Td align="right">{d.numParts}</Td>
                  <Td align="right">
                    {d.requiresDefaultPrice
                      ? <span className="text-on-surface-variant text-label-sm">Requiere precio default en esta sucursal</span>
                      : d.computedUnitPrice != null ? `$${d.computedUnitPrice.toFixed(2)}` : "—"
                    }
                  </Td>
                  <Td><CatalogStatusBadge isActive={d.isActive} /></Td>
                  {canWrite && (
                    <Td>
                      <div className="flex gap-2">
                        <IconButton
                          icon="edit"
                          iconSize={14}
                          ariaLabel="Editar"
                          title="Editar"
                          variant="ghost"
                          onClick={() => { setNameError(null); setModal({mode:"edit", entity:d}); }}
                          className="rounded p-1"
                        />
                        {d.isActive ? (
                          <IconButton
                            icon="block"
                            iconSize={14}
                            ariaLabel="Desactivar"
                            title="Desactivar"
                            variant="ghost"
                            onClick={() => setConfirmDeleteId(d.id)}
                            className="rounded p-1 hover:bg-error/10 hover:text-error"
                          />
                        ) : (
                          <IconButton
                            icon="check_circle"
                            iconSize={14}
                            ariaLabel="Reactivar"
                            title="Reactivar"
                            variant="ghost"
                            onClick={() => reactivateOne(d.id)}
                            className="rounded p-1 hover:bg-primary/10 hover:text-primary"
                          />
                        )}
                      </div>
                    </Td>
                  )}
                </Tr>
              ))}
            </TBody>
          </Table>
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
