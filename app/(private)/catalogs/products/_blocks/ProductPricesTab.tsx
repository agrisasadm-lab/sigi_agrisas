"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useProductPrices } from "../_logic/hooks/useProductPrices";

import { useTableKeyboard } from "../../../../_hooks/useTableKeyboard";
import { usePriceBranchSelection } from "../_logic/hooks/usePriceBranchSelection";
import { DuplicatePriceNameError, DuplicateDefaultPriceError } from "../_logic/errors";
import { ConfirmDialog } from "../../../../_components/molecules/ConfirmDialog/ConfirmDialog";
import { Badge } from "../../../../_components/atoms/Badge/Badge";
import { Icon } from "../../../../_components/atoms/Icon/Icon";
import { Skeleton } from "../../../../_components/atoms/Skeleton/Skeleton";
import { Button } from "../../../../_components/atoms/Button/Button";
import { IconButton } from "../../../../_components/atoms/IconButton/IconButton";
import { Select } from "../../../../_components/atoms/Select/Select";
import { Table, THead, TBody, Tr, Th, Td } from "../../../../_components/molecules/DataTable/DataTable";
import type { ProductPrice } from "../_logic/types/domain";
import type { CreatePriceBody, UpdatePriceBody } from "../_logic/types/api";

interface ProductPricesTabProps {
  productId: string;
  canWrite: boolean;
}

interface PriceModalState {
  mode: "create" | "edit";
  entity: ProductPrice | null;
  /** create-mode only: sucursal a la que pertenecerá el nuevo precio (null = base). */
  createBranchId?: string | null;
  /** create-mode only: nombre pre-cargado al crear un override desde una fila heredada. */
  prefillName?: string;
}

function PriceModal({
  open,
  mode,
  entity,
  prefillName,
  createBranchId,
  createBranchName,
  isSaving,
  nameError,
  defaultError,
  onSave,
  onClose,
}: {
  open: boolean;
  mode: "create" | "edit";
  entity: ProductPrice | null;
  prefillName?: string;
  createBranchId?: string | null;
  createBranchName?: string;
  isSaving: boolean;
  nameError: string | null;
  defaultError: string | null;
  onSave: (data: CreatePriceBody | UpdatePriceBody) => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [minQuantity, setMinQuantity] = useState("1");
  const [discountPct, setDiscountPct] = useState("");
  const [isDefault, setIsDefault] = useState(false);
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
    if (mode === "create") { setName(prefillName ?? ""); setPrice(""); setMinQuantity("1"); setDiscountPct(""); setIsDefault(false); }
    else if (entity) {
      setName(entity.name);
      setPrice(String(entity.price));
      setMinQuantity(String(entity.minQuantity));
      setDiscountPct(entity.discountPct != null ? String(entity.discountPct) : "");
      setIsDefault(entity.isDefault);
    }
    setErrors({});
  }, [open, mode, entity, prefillName]);

  const buildDiff = (): UpdatePriceBody => {
    if (!entity) return {};
    const d: UpdatePriceBody = {};
    if (name !== entity.name) d.name = name;
    const p = parseFloat(price);
    if (!isNaN(p) && p !== entity.price) d.price = p;
    const mq = parseInt(minQuantity);
    if (!isNaN(mq) && mq !== entity.minQuantity) d.minQuantity = mq;
    const dp = discountPct.trim() ? parseFloat(discountPct) : null;
    if (dp !== entity.discountPct) d.discountPct = dp;
    if (isDefault !== entity.isDefault) d.isDefault = isDefault;
    return d;
  };

  const isDiffEmpty = mode === "edit" && Object.keys(buildDiff()).length === 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = "El nombre es obligatorio.";
    const p = parseFloat(price);
    if (isNaN(p) || p < 0) errs.price = "El precio debe ser 0 o mayor.";
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    if (mode === "create") {
      onSave({ branchId: createBranchId!, name: name.trim(), price: p, minQuantity: parseInt(minQuantity) || 1, discountPct: discountPct.trim() ? parseFloat(discountPct) : null, isDefault });
    } else {
      onSave(buildDiff());
    }
  };

  const fieldClass = "w-full px-3 py-2 rounded-md border border-outline-variant bg-surface-container-lowest text-body-md focus:outline-none focus:ring-2 focus:ring-primary";

  return (
    <dialog ref={dialogRef} className="rounded-lg shadow-xl bg-surface p-0 w-full max-w-md backdrop:bg-black/40">
      <form onSubmit={handleSubmit} noValidate>
        <div className="px-6 pt-6 pb-4 border-b border-outline-variant">
          <h2 className="text-title-md font-semibold text-on-surface">
            {mode === "create" ? "Nuevo precio" : "Editar precio"}
          </h2>
          {mode === "create" && createBranchId && (
            <p className="text-label-sm text-on-surface-variant mt-1">Sólo aplica a {createBranchName ?? "esta sucursal"}.</p>
          )}
        </div>
        <div className="px-6 py-4 space-y-4">
          <div>
            <label className="block text-label-lg text-on-surface-variant mb-1">Nombre *</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} className={fieldClass} />
            {(nameError || errors.name) && <p className="text-label-sm text-error mt-1">{nameError ?? errors.name}</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-label-lg text-on-surface-variant mb-1">Precio *</label>
              <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} min={0} step={0.01} className={fieldClass} />
              {errors.price && <p className="text-label-sm text-error mt-1">{errors.price}</p>}
            </div>
            <div>
              <label className="block text-label-lg text-on-surface-variant mb-1">Cant. mín.</label>
              <input type="number" value={minQuantity} onChange={(e) => setMinQuantity(e.target.value)} min={1} step={1} className={fieldClass} />
            </div>
          </div>
          <div>
            <label className="block text-label-lg text-on-surface-variant mb-1">Descuento (%)</label>
            <input type="number" value={discountPct} onChange={(e) => setDiscountPct(e.target.value)} min={0} max={100} placeholder="—" className={fieldClass} />
          </div>
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} className="w-4 h-4 rounded-sm" />
            <span className="text-label-lg text-on-surface-variant">Precio default</span>
          </label>
          {defaultError && <p className="text-label-sm text-error">{defaultError}</p>}
        </div>
        <div className="px-6 pb-6 pt-2 flex justify-end gap-3 border-t border-outline-variant">
          <Button type="button" variant="text" onClick={onClose} disabled={isSaving}>Cancelar</Button>
          <Button type="submit" variant="filled" disabled={isSaving || isDiffEmpty} loading={isSaving}>{isSaving ? "Guardando…" : mode === "create" ? "Crear" : "Guardar"}</Button>
        </div>
      </form>
    </dialog>
  );
}

export function ProductPricesTab({ productId, canWrite }: ProductPricesTabProps) {
  const { branches: visibleBranches, selectedBranchId, setSelectedBranchId, hasNoBranch, branchName } =
    usePriceBranchSelection();

  const { prices, isLoading, error, isSaving, saveError, clearSaveError, refresh, createOne, updateOne, deleteOne } = useProductPrices(productId, selectedBranchId);
  const [modal, setModal] = useState<PriceModalState | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [defaultError, setDefaultError] = useState<string | null>(null);

  const openEditModal = (p: ProductPrice) => {
    setNameError(null); setDefaultError(null); setModal({ mode: "edit", entity: p });
  };
  const noop = () => {};
  const { getRowProps: getPriceRowProps } = useTableKeyboard(prices, canWrite ? openEditModal : noop);

  const handleSave = async (data: CreatePriceBody | UpdatePriceBody) => {
    setNameError(null); setDefaultError(null);
    try {
      if (modal?.mode === "create") await createOne(data as CreatePriceBody);
      else if (modal?.entity) await updateOne(modal.entity.id, data as UpdatePriceBody);
      setModal(null);
    } catch (err) {
      if (err instanceof DuplicatePriceNameError) setNameError("Ya existe un precio con ese nombre.");
      else if (err instanceof DuplicateDefaultPriceError) setDefaultError("El producto ya tiene un precio default.");
    }
  };

  if (hasNoBranch) {
    return (
      <p className="p-6 text-center text-on-surface-variant text-body-md">
        Necesitas una sucursal asignada para administrar precios. Pídele a un administrador que te asigne una.
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
        <label htmlFor="price-branch-scope" className="text-label-lg text-on-surface-variant">Sucursal</label>
        <Select
          id="price-branch-scope"
          value={selectedBranchId ?? ""}
          onChange={(e) => setSelectedBranchId(e.target.value || null)}
          disabled={visibleBranches.length === 0}
          className="w-auto py-1.5"
        >
          {visibleBranches.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </Select>
      </div>

      <div className="bg-surface-container-low rounded-lg border border-outline-variant overflow-hidden">
        <div className="px-4 py-3 border-b border-outline-variant flex items-center justify-between">
          <span className="text-label-lg font-medium text-on-surface">Precios</span>
          {canWrite && (
            <Button
              type="button"
              variant="filled"
              size="sm"
              icon="add"
              onClick={() => { setNameError(null); setDefaultError(null); setModal({mode:"create", entity:null, createBranchId: selectedBranchId}); }}
            >
              Nuevo precio
            </Button>
          )}
        </div>
        {prices.length === 0 ? (
          <p className="p-6 text-center text-on-surface-variant text-body-md">Sin precios configurados.</p>
        ) : (
          <Table className="text-left">
            <THead>
              <Tr hoverable={false}>
                <Th>Nombre</Th>
                <Th align="right">Precio</Th>
                <Th align="right">Cant. mín.</Th>
                <Th align="right">Descuento</Th>
                <Th>Default</Th>
                {canWrite && <Th>Acciones</Th>}
              </Tr>
            </THead>
            <TBody>
              {prices.map((p, idx) => {
                return (
                  <Tr
                    key={p.id}
                    {...getPriceRowProps(idx)}
                    className="focus:bg-surface-container focus:outline-none cursor-default"
                  >
                    <Td>{p.name}</Td>
                    <Td align="right">${p.price.toFixed(2)}</Td>
                    <Td align="right">{p.minQuantity}</Td>
                    <Td align="right">{p.discountPct != null ? `${p.discountPct}%` : "—"}</Td>
                    <Td>{p.isDefault && <Badge variant="read">Default</Badge>}</Td>
                    {canWrite && (
                      <Td>
                        <div className="flex gap-2">
                          <IconButton
                            icon="edit"
                            iconSize={14}
                            ariaLabel="Editar"
                            title="Editar"
                            variant="ghost"
                            onClick={() => { setNameError(null); setDefaultError(null); setModal({mode:"edit", entity:p}); }}
                            className="rounded p-1"
                          />
                          <IconButton
                            icon="delete"
                            iconSize={14}
                            ariaLabel="Eliminar"
                            title="Eliminar"
                            variant="ghost"
                            onClick={() => setConfirmDeleteId(p.id)}
                            className="rounded p-1 hover:bg-error/10 hover:text-error"
                          />
                        </div>
                      </Td>
                    )}
                  </Tr>
                );
              })}
            </TBody>
          </Table>
        )}
      </div>

      {modal && (
        <PriceModal
          open
          mode={modal.mode}
          entity={modal.entity}
          prefillName={modal.prefillName}
          createBranchId={modal.createBranchId}
          createBranchName={branchName(modal.createBranchId ?? null) ?? undefined}
          isSaving={isSaving}
          nameError={nameError}
          defaultError={defaultError}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}

      <ConfirmDialog
        open={!!confirmDeleteId}
        title="¿Eliminar precio?"
        description="Esta acción es permanente."
        confirmLabel="Eliminar"
        onConfirm={async () => { if (confirmDeleteId) { await deleteOne(confirmDeleteId); setConfirmDeleteId(null); } }}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </div>
  );
}
