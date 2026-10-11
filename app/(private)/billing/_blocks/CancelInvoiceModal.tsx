"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "../../../_components/atoms/Button/Button";
import { Select } from "../../../_components/atoms/Select/Select";
import { useInvoiceMutations } from "../_logic/hooks/useInvoiceMutations";
import { InvoiceAlreadyCancelledError, FacturamaCancelError } from "../_logic/errors";
import type { CancellationMotive } from "../_logic/types/domain";

const MOTIVES: { value: CancellationMotive; label: string; requiresReplacement: boolean }[] = [
  { value: "01", label: "01 - Comprobante emitido con errores con relación", requiresReplacement: true },
  { value: "02", label: "02 - Comprobante emitido con errores sin relación", requiresReplacement: false },
  { value: "03", label: "03 - No se llevó a cabo la operación", requiresReplacement: false },
  { value: "04", label: "04 - Operación nominativa relacionada en factura global", requiresReplacement: false },
];

interface CancelInvoiceModalProps {
  invoiceId: string;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function CancelInvoiceModal({ invoiceId, open, onClose, onSuccess }: CancelInvoiceModalProps) {
  const [motive, setMotive] = useState<CancellationMotive | "">("");
  const [uuidReplacement, setUuidReplacement] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  const { isSaving, cancel } = useInvoiceMutations();

  const selectedMotive = MOTIVES.find((m) => m.value === motive);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) dialog.showModal();
    else { dialog.close(); setMotive(""); setUuidReplacement(""); setLocalError(null); }
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handleCancel = (e: Event) => { e.preventDefault(); onClose(); };
    dialog.addEventListener("cancel", handleCancel);
    return () => dialog.removeEventListener("cancel", handleCancel);
  }, [onClose]);

  async function handleSubmit() {
    setLocalError(null);
    if (!motive) { setLocalError("Selecciona un motivo"); return; }
    if (selectedMotive?.requiresReplacement && !uuidReplacement.trim()) {
      setLocalError("El motivo 01 requiere el UUID del comprobante de sustitución");
      return;
    }
    try {
      const result = await cancel(invoiceId, motive as CancellationMotive, uuidReplacement.trim() || null);
      if (result) onSuccess();
    } catch (err) {
      if (err instanceof InvoiceAlreadyCancelledError) {
        setLocalError("La factura ya estaba cancelada");
        onClose();
      } else if (err instanceof FacturamaCancelError) {
        setLocalError(`Error Facturama: ${err.detail}`);
      } else {
        setLocalError("Error inesperado al cancelar");
      }
    }
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="cancel-invoice-modal-title"
      className="rounded-md bg-surface-container p-6 shadow-lg w-full max-w-md backdrop:bg-black/40"
    >
      <h2 id="cancel-invoice-modal-title" className="text-title-md font-semibold text-on-surface mb-2">
        Cancelar CFDI
      </h2>
      <p className="text-body-md text-on-surface-variant mb-4">
        La cancelación se notifica al SAT vía Facturama. Esta acción no puede deshacerse.
      </p>

      {localError && (
        <div className="mb-4 rounded bg-error-container/30 px-3 py-2 text-body-sm text-error">
          {localError}
        </div>
      )}

      <div className="mb-4">
        <label htmlFor="cancel-motive" className="block text-label-md text-on-surface mb-1">
          Motivo de cancelación <span className="text-error">*</span>
        </label>
        <Select id="cancel-motive" value={motive} onChange={(e) => setMotive(e.target.value as CancellationMotive | "")}>
          <option value="">Seleccionar motivo…</option>
          {MOTIVES.map((m) => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </Select>
      </div>

      {selectedMotive?.requiresReplacement && (
        <div className="mb-4">
          <label htmlFor="uuid-replacement" className="block text-label-md text-on-surface mb-1">
            UUID del CFDI de sustitución <span className="text-error">*</span>
          </label>
          <input
            id="uuid-replacement"
            type="text"
            value={uuidReplacement}
            onChange={(e) => setUuidReplacement(e.target.value.slice(0, 40))}
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            className="w-full rounded border border-outline px-3 py-2 text-body-sm bg-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary font-mono"
          />
        </div>
      )}

      <div className="flex justify-end gap-3">
        <Button
          type="button"
          variant="text"
          onClick={onClose}
          disabled={isSaving}
          className="rounded px-4 py-2 text-on-surface hover:bg-surface-container-highest"
        >
          Volver
        </Button>
        <Button type="button" variant="destructive" onClick={handleSubmit} disabled={!motive} loading={isSaving}>
          Cancelar CFDI
        </Button>
      </div>
    </dialog>
  );
}
