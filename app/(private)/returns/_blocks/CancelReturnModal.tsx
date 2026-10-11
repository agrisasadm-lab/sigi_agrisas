"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "../../../_components/atoms/Button/Button";
import { useReturnMutations } from "../_logic/hooks/useReturnMutations";
import { ReturnAlreadyCancelledError, ReturnCancelForbiddenError } from "../_logic/errors";
import type { ReturnDetail } from "../_logic/types/domain";

interface CancelReturnModalProps {
  returnId: string;
  open: boolean;
  onClose: () => void;
  onSuccess: (updated: ReturnDetail) => void;
}

export function CancelReturnModal({ returnId, open, onClose, onSuccess }: CancelReturnModalProps) {
  const [reason, setReason] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  const { isSaving, cancel } = useReturnMutations();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) {
      dialog.showModal();
    } else {
      dialog.close();
      setReason("");
      setToast(null);
    }
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

  async function handleSubmit() {
    try {
      const updated = await cancel(returnId, reason.trim() || null);
      if (updated) {
        onSuccess(updated);
        onClose();
      }
    } catch (err) {
      if (err instanceof ReturnAlreadyCancelledError) {
        setToast("La devolución ya estaba cancelada");
        onClose();
      } else if (err instanceof ReturnCancelForbiddenError) {
        setToast("No tienes permiso para cancelar esta devolución");
        onClose();
      }
    }
  }

  return (
    <>
      <dialog
        ref={dialogRef}
        aria-labelledby="cancel-return-modal-title"
        className="rounded-md bg-surface-container p-6 shadow-lg w-full max-w-md backdrop:bg-black/40"
      >
        <h2 id="cancel-return-modal-title" className="text-title-md font-semibold text-on-surface mb-2">
          Cancelar devolución
        </h2>
        <p className="text-body-md text-on-surface-variant mb-3">
          Al cancelar esta devolución, el inventario afectado será revertido.
        </p>
        <div className="bg-tertiary-container/30 rounded p-3 mb-4 text-body-sm text-on-surface-variant">
          ⚠️ El stock de algunos productos podría quedar negativo si se han realizado movimientos posteriores.
        </div>

        <div className="mb-4">
          <label htmlFor="cancel-reason" className="block text-label-md text-on-surface mb-1">
            Motivo (opcional)
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
          <Button type="button" variant="destructive" onClick={handleSubmit} loading={isSaving}>
            Cancelar devolución
          </Button>
        </div>
      </dialog>

      {toast && (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-inverse-surface text-inverse-on-surface px-5 py-3 rounded-full text-body-sm shadow-lg z-50"
        >
          {toast}
        </div>
      )}
    </>
  );
}
