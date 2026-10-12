"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "../../../_components/atoms/Button/Button";
import { useProductSearch } from "../_logic/hooks/useProductSearch";

interface InventoryAssignModalProps {
  open: boolean;
  branchId: string;
  isSaving: boolean;
  assignError: string | null;
  onAssign: (productId: string, quantity: number, reorderPoint: number) => void;
  onClose: () => void;
}

export function InventoryAssignModal({ open, branchId, isSaving, assignError, onAssign, onClose }: InventoryAssignModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [search, setSearch] = useState("");
  const { productOptions, setProductOptions } = useProductSearch(search);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [quantity, setQuantity] = useState("0");
  const [reorderPoint, setReorderPoint] = useState("0");
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
    if (!open) { setSearch(""); setSelectedProductId(""); setQuantity("0"); setReorderPoint("0"); setErrors({}); }
  }, [open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!selectedProductId) errs.productId = "Selecciona un producto.";
    const qty = parseInt(quantity);
    if (isNaN(qty) || qty < 0) errs.quantity = "La cantidad no puede ser negativa.";
    const rp = parseInt(reorderPoint);
    if (isNaN(rp) || rp < 0) errs.reorderPoint = "El punto de reorden no puede ser negativo.";
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    onAssign(selectedProductId, qty, rp);
  };

  const fieldClass = "w-full px-3 py-2 rounded-md border border-outline-variant bg-surface-container-lowest text-body-md focus:outline-none focus:ring-2 focus:ring-primary";

  return (
    <dialog ref={dialogRef} className="rounded-lg shadow-xl bg-surface p-0 w-full max-w-md backdrop:bg-black/40">
      <form onSubmit={handleSubmit} noValidate>
        <div className="px-6 pt-6 pb-4 border-b border-outline-variant">
          <h2 className="text-title-md font-semibold text-on-surface">Asignar producto</h2>
        </div>
        <div className="px-6 py-4 space-y-4">
          {assignError && <p className="text-label-sm text-error bg-error-container/30 px-3 py-2 rounded-md">{assignError}</p>}

          <div>
            <label className="block text-label-lg text-on-surface-variant mb-1">Buscar producto *</label>
            <input type="text" value={search} onChange={(e) => { setSearch(e.target.value); setSelectedProductId(""); }} placeholder="Escribe el nombre o código (mín. 2 caracteres)" className={fieldClass} />
            {productOptions.length > 0 && !selectedProductId && (
              <ul className="mt-1 border border-outline-variant rounded-md bg-surface shadow-lg max-h-40 overflow-y-auto">
                {productOptions.map((p) => (
                  <li key={p.id}>
                    <Button
                      type="button"
                      variant="text"
                      onClick={() => { setSelectedProductId(p.id); setSearch(`${p.code} - ${p.name}`); setProductOptions([]); }}
                      className="w-full justify-start rounded-none px-3 py-2 text-body-md hover:bg-surface-container-low"
                    >
                      <span className="font-mono text-label-lg">{p.code}</span> — {p.name}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            {errors.productId && <p className="text-label-sm text-error mt-1">{errors.productId}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-label-lg text-on-surface-variant mb-1">Stock inicial</label>
              <input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} min={0} step={1} className={fieldClass} />
              {errors.quantity && <p className="text-label-sm text-error mt-1">{errors.quantity}</p>}
            </div>
            <div>
              <label className="block text-label-lg text-on-surface-variant mb-1">Punto de reorden</label>
              <input type="number" value={reorderPoint} onChange={(e) => setReorderPoint(e.target.value)} min={0} step={1} className={fieldClass} />
              {errors.reorderPoint && <p className="text-label-sm text-error mt-1">{errors.reorderPoint}</p>}
            </div>
          </div>
        </div>
        <div className="px-6 pb-6 pt-2 flex justify-end gap-3 border-t border-outline-variant">
          <Button type="button" variant="text" onClick={onClose} disabled={isSaving} className="rounded-md px-4 py-2 text-label-lg text-on-surface-variant hover:bg-surface-container">Cancelar</Button>
          <Button type="submit" variant="filled" loading={isSaving} className="rounded-md px-4 py-2 text-label-lg hover:opacity-90">Asignar</Button>
        </div>
      </form>
    </dialog>
  );
}
