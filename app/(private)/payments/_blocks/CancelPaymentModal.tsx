"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "../../../_components/atoms/Button/Button";
import { usePaymentMutations } from "../_logic/hooks/usePaymentMutations";
import { PaymentAlreadyCancelledError } from "../_logic/errors";

interface CancelPaymentModalProps {
  paymentId: string;
  onSuccess: () => void;
  onClose: () => void;
}

export function CancelPaymentModal({ paymentId, onSuccess, onClose }: CancelPaymentModalProps) {
  const [reason, setReason] = useState("");
  const [inlineError, setInlineError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  const { isSaving, cancel } = usePaymentMutations();

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

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

  async function handleConfirm() {
    setInlineError(null);
    const ok = await cancel(paymentId, reason.trim() || undefined);
    if (ok) {
      onSuccess();
    } else {
      setInlineError("No se pudo cancelar el abono. Intenta de nuevo.");
    }
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="cancel-payment-modal-title"
      className="rounded-md bg-surface-container p-6 shadow-lg w-full max-w-md backdrop:bg-black/40"
      onClose={onClose}
    >
      <h2 id="cancel-payment-modal-title" className="text-title-md font-semibold text-on-surface mb-2">
        Cancelar abono
      </h2>
      <p className="text-body-md text-on-surface-variant mb-4">
        Esta acción revertirá el abono y actualizará el saldo pendiente de la venta.
      </p>

      <div className="mb-4">
        <label htmlFor="cancel-reason" className="block text-label-md text-on-surface mb-1">
          Motivo <span className="text-on-surface-variant/60">(opcional)</span>
        </label>
        <textarea
          id="cancel-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value.slice(0, 500))}
          rows={3}
          maxLength={500}
          className="w-full rounded border border-outline px-3 py-2 text-body-sm bg-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary resize-none"
          placeholder="Describe el motivo de cancelación..."
        />
        <p className="text-right text-label-sm text-on-surface-variant mt-1">{reason.length}/500</p>
      </div>

      {inlineError && (
        <p className="text-body-sm text-error mb-3">{inlineError}</p>
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
        <Button type="button" variant="destructive" onClick={handleConfirm} loading={isSaving}>
          Confirmar cancelación
        </Button>
      </div>
    </dialog>
  );
}
