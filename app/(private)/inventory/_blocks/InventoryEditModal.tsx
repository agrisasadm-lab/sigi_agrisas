"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "../../../_components/atoms/Button/Button";
import type { InventoryItem } from "../_logic/types/domain";
import type { UpdateInventoryBody } from "../_logic/types/api";

interface InventoryEditModalProps {
  open: boolean;
  item: InventoryItem;
  isSaving: boolean;
  onSave: (body: UpdateInventoryBody) => void;
  onClose: () => void;
}

export function InventoryEditModal({ open, item, isSaving, onSave, onClose }: InventoryEditModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [quantity, setQuantity] = useState("");
  const [reservedQuantity, setReservedQuantity] = useState("");
  const [reorderPoint, setReorderPoint] = useState("");
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
    setQuantity(String(item.quantity));
    setReservedQuantity(String(item.reservedQuantity));
    setReorderPoint(String(item.reorderPoint));
    setErrors({});
  }, [open, item]);

  const buildDiff = (): UpdateInventoryBody => {
    const diff: UpdateInventoryBody = {};
    const qty = parseInt(quantity);
    if (!isNaN(qty) && qty !== item.quantity) diff.quantity = qty;
    const rq = parseInt(reservedQuantity);
    if (!isNaN(rq) && rq !== item.reservedQuantity) diff.reservedQuantity = rq;
    const rp = parseInt(reorderPoint);
    if (!isNaN(rp) && rp !== item.reorderPoint) diff.reorderPoint = rp;
    return diff;
  };

  const isDiffEmpty = Object.keys(buildDiff()).length === 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    const qty = parseInt(quantity);
    if (isNaN(qty) || qty < 0) errs.quantity = "El valor no puede ser negativo.";
    const rq = parseInt(reservedQuantity);
    if (isNaN(rq) || rq < 0) errs.reservedQuantity = "El valor no puede ser negativo.";
    const rp = parseInt(reorderPoint);
    if (isNaN(rp) || rp < 0) errs.reorderPoint = "El valor no puede ser negativo.";
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    const diff = buildDiff();
    if (Object.keys(diff).length === 0) return;
    onSave(diff);
  };

  const fieldClass = "w-full px-3 py-2 rounded-md border border-outline-variant bg-surface-container-lowest text-body-md focus:outline-none focus:ring-2 focus:ring-primary";

  return (
    <dialog ref={dialogRef} className="rounded-lg shadow-xl bg-surface p-0 w-full max-w-sm backdrop:bg-black/40">
      <form onSubmit={handleSubmit} noValidate>
        <div className="px-6 pt-6 pb-4 border-b border-outline-variant">
          <h2 className="text-title-md font-semibold text-on-surface">Editar registro de inventario</h2>
          <p className="text-body-md text-on-surface-variant mt-0.5">{item.productCode} — {item.productName}</p>
        </div>
        <div className="px-6 py-4 space-y-4">
          <div>
            <label className="block text-label-lg text-on-surface-variant mb-1">Cantidad</label>
            <input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} min={0} step={1} className={fieldClass} />
            {errors.quantity && <p className="text-label-sm text-error mt-1">{errors.quantity}</p>}
          </div>
          <div>
            <label className="block text-label-lg text-on-surface-variant mb-1">Cantidad reservada</label>
            <input type="number" value={reservedQuantity} onChange={(e) => setReservedQuantity(e.target.value)} min={0} step={1} className={fieldClass} />
            {errors.reservedQuantity && <p className="text-label-sm text-error mt-1">{errors.reservedQuantity}</p>}
          </div>
          <div>
            <label className="block text-label-lg text-on-surface-variant mb-1">Punto de reorden</label>
            <input type="number" value={reorderPoint} onChange={(e) => setReorderPoint(e.target.value)} min={0} step={1} className={fieldClass} />
            {errors.reorderPoint && <p className="text-label-sm text-error mt-1">{errors.reorderPoint}</p>}
          </div>
        </div>
        <div className="px-6 pb-6 pt-2 flex justify-end gap-3 border-t border-outline-variant">
          <Button type="button" variant="text" onClick={onClose} disabled={isSaving} className="rounded-md px-4 py-2 text-label-lg text-on-surface-variant hover:bg-surface-container">Cancelar</Button>
          <Button type="submit" variant="filled" disabled={isDiffEmpty} loading={isSaving} className="rounded-md px-4 py-2 text-label-lg hover:opacity-90">Guardar</Button>
        </div>
      </form>
    </dialog>
  );
}
