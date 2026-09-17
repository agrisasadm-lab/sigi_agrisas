"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useProductPrices } from "../_logic/hooks/useProductPrices";
import { useBranchesOptions } from "../../../../_hooks/useBranchesOptions";
import { useTableKeyboard } from "../../../../_hooks/useTableKeyboard";
import { useCurrentUser } from "../../../../_hooks/useCurrentUser";
import { DuplicatePriceNameError, DuplicateDefaultPriceError } from "../_logic/errors";
import { ConfirmDialog } from "../../../../_components/molecules/ConfirmDialog/ConfirmDialog";
import { Badge } from "../../../../_components/atoms/Badge/Badge";
import { Icon } from "../../../../_components/atoms/Icon/Icon";
import { Skeleton } from "../../../../_components/atoms/Skeleton/Skeleton";
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
      onSave({ branchId: createBranchId ?? null, name: name.trim(), price: p, minQuantity: parseInt(minQuantity) || 1, discountPct: discountPct.trim() ? parseFloat(discountPct) : null, isDefault });
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
            {mode === "create" ? (createBranchId ? "Nuevo override de sucursal" : "Nuevo precio base") : "Editar precio"}
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
          <button type="button" onClick={onClose} disabled={isSaving} className="px-4 py-2 rounded-md text-label-lg text-on-surface-variant hover:bg-surface-container transition-colors">Cancelar</button>
          <button type="submit" disabled={isSaving || isDiffEmpty} className="px-4 py-2 rounded-md bg-primary text-on-primary text-label-lg font-medium hover:opacity-90 disabled:opacity-50">{isSaving ? "Guardando…" : mode === "create" ? "Crear" : "Guardar"}</button>
        </div>
      </form>
    </dialog>
  );
}

export function ProductPricesTab({ productId, canWrite }: ProductPricesTabProps) {
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const { options: branches } = useBranchesOptions();
  const { branchId: userBranchId, can } = useCurrentUser();
  const canAccessAllBranches = can("branches:access_all");
  const visibleBranches = useMemo(() => {
    if (canAccessAllBranches !== false) return branches;
    return branches.filter((b) => b.id === userBranchId);
  }, [branches, canAccessAllBranches, userBranchId]);
  const branchName = (id: string | null) => (id ? branches.find((b) => b.id === id)?.name ?? id : null);

  const { prices, isLoading, error, isSaving, saveError, clearSaveError, refresh, createOne, updateOne, deleteOne } = useProductPrices(productId, selectedBranchId);
  const [modal, setModal] = useState<PriceModalState | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [defaultError, setDefaultError] = useState<string | null>(null);

  const openEditModal = (p: ProductPrice) => {
    if (selectedBranchId && !p.isOverride) {
      setNameError(null); setDefaultError(null);
      setModal({ mode: "create", entity: null, createBranchId: selectedBranchId, prefillName: p.name });
      return;
    }
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

  if (isLoading) return <div className="space-y-2 p-4">{Array.from({length:3}).map((_,i) => <Skeleton key={i} className="h-10 w-full rounded-md" />)}</div>;
  if (error) return <p className="p-4 text-error text-label-lg">{error}</p>;

  return (
    <div className="space-y-4">
      {!canWrite && <p className="text-label-sm text-on-surface-variant px-1">Solo lectura — requiere products:write</p>}
      {saveError && <p className="text-label-sm text-error bg-error-container/30 px-3 py-2 rounded-md">{saveError}</p>}

      <div className="flex items-center gap-2 px-1">
        <label htmlFor="price-branch-scope" className="text-label-lg text-on-surface-variant">Sucursal</label>
        <select
          id="price-branch-scope"
          value={selectedBranchId ?? ""}
          onChange={(e) => setSelectedBranchId(e.target.value || null)}
          className="px-3 py-1.5 rounded-md border border-outline-variant bg-surface-container-lowest text-body-md focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="">Precio base (todas)</option>
          {visibleBranches.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
      </div>

      <div className="bg-surface-container-low rounded-lg border border-outline-variant overflow-hidden">
        <div className="px-4 py-3 border-b border-outline-variant flex items-center justify-between">
          <span className="text-label-lg font-medium text-on-surface">Precios</span>
          {canWrite && (
            <button type="button" onClick={() => { setNameError(null); setDefaultError(null); setModal({mode:"create", entity:null, createBranchId: selectedBranchId}); }} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-primary text-on-primary text-label-sm font-medium hover:opacity-90">
              <Icon name="add" size={14} />Nuevo precio
            </button>
          )}
        </div>
        {prices.length === 0 ? (
          <p className="p-6 text-center text-on-surface-variant text-body-md">Sin precios configurados.</p>
        ) : (
          <table className="w-full text-left text-body-md">
            <thead>
              <tr className="text-label-lg text-on-surface-variant border-b border-outline-variant">
                <th className="px-4 py-2 font-medium">Nombre</th>
                <th className="px-4 py-2 font-medium text-right">Precio</th>
                <th className="px-4 py-2 font-medium text-right">Cant. mín.</th>
                <th className="px-4 py-2 font-medium text-right">Descuento</th>
                <th className="px-4 py-2 font-medium">Default</th>
                <th className="px-4 py-2 font-medium">Origen</th>
                {canWrite && <th className="px-4 py-2 font-medium">Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {prices.map((p, idx) => {
                const isInheritedUnderBranch = Boolean(selectedBranchId) && !p.isOverride;
                return (
                  <tr
                    key={p.id}
                    {...getPriceRowProps(idx)}
                    className="border-b border-outline-variant hover:bg-surface-container-low focus:bg-surface-container focus:outline-none transition-colors cursor-default"
                  >
                    <td className="px-4 py-2">{p.name}</td>
                    <td className="px-4 py-2 text-right">${p.price.toFixed(2)}</td>
                    <td className="px-4 py-2 text-right">{p.minQuantity}</td>
                    <td className="px-4 py-2 text-right">{p.discountPct != null ? `${p.discountPct}%` : "—"}</td>
                    <td className="px-4 py-2">{p.isDefault && <Badge variant="read">Default</Badge>}</td>
                    <td className="px-4 py-2">
                      <Badge variant={p.isOverride ? "write" : "read"}>
                        {p.isOverride ? `Override ${branchName(p.branchId) ?? ""}` : "Base"}
                      </Badge>
                    </td>
                    {canWrite && (
                      <td className="px-4 py-2">
                        {isInheritedUnderBranch ? (
                          <button
                            type="button"
                            onClick={() => { setNameError(null); setDefaultError(null); setModal({ mode: "create", entity: null, createBranchId: selectedBranchId, prefillName: p.name }); }}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded text-label-sm text-primary hover:bg-primary-container/40"
                          >
                            <Icon name="add" size={14} />Crear override aquí
                          </button>
                        ) : (
                          <div className="flex gap-2">
                            <button type="button" onClick={() => { setNameError(null); setDefaultError(null); setModal({mode:"edit", entity:p}); }} className="p-1 rounded hover:bg-surface-container text-on-surface-variant" title="Editar"><Icon name="edit" size={14}/></button>
                            <button type="button" onClick={() => setConfirmDeleteId(p.id)} className="p-1 rounded hover:bg-error/10 text-error" title="Eliminar"><Icon name="delete" size={14}/></button>
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
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
