"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "../../../_components/atoms/Button/Button";
import { usePurchaseMutations } from "../_logic/hooks/usePurchaseMutations";
import { PurchaseAlreadyCancelledError, PurchaseCancelForbiddenError, PurchaseHasActiveProviderPaymentsError } from "../_logic/errors";

interface CancelPurchaseModalProps {
  purchaseId: string;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function CancelPurchaseModal({ purchaseId, open, onClose, onSuccess }: CancelPurchaseModalProps) {
  const [reason, setReason] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  const { isSaving, cancel } = usePurchaseMutations();

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
    const handleCancel = (e: Event) => { e.preventDefault(); onClose(); };
    dialog.addEventListener("cancel", handleCancel);
    return () => dialog.removeEventListener("cancel", handleCancel);
  }, [onClose]);

  const trimmedReason = reason.trim();

  async function handleSubmit() {
    if (!trimmedReason) return;
    try {
      const result = await cancel(purchaseId, trimmedReason);
      if (result) {
        onSuccess();
        onClose();
      }
    } catch (err) {
      if (err instanceof PurchaseAlreadyCancelledError) {
        setToast("La compra ya estaba cancelada");
        onClose();
      } else if (err instanceof PurchaseCancelForbiddenError) {
        setToast("No tienes permiso para cancelar esta compra");
        onClose();
      } else if (err instanceof PurchaseHasActiveProviderPaymentsError) {
        setToast("Esta compra tiene abonos activos; cancélalos primero");
        onClose();
      }
    }
  }

  return (
    <>
      <dialog
        ref={dialogRef}
        aria-labelledby="cancel-purchase-modal-title"
        className="rounded-md bg-surface-container p-6 shadow-lg w-full max-w-md backdrop:bg-black/40"
      >
        <h2 id="cancel-purchase-modal-title" className="text-title-md font-semibold text-on-surface mb-2">
          Cancelar compra
        </h2>
        <p className="text-body-md text-on-surface-variant mb-3">
          Al cancelar esta compra, el inventario incrementado será revertido.
        </p>

        <div className="mb-4">
          <label htmlFor="cancel-purchase-reason" className="block text-label-md text-on-surface mb-1">
            Motivo *
          </label>
          <textarea
            id="cancel-purchase-reason"
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
            className="rounded px-4 py-2 text-label-lg text-on-surface hover:bg-surface-container-highest"
          >
            Volver
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleSubmit}
            disabled={!trimmedReason}
            loading={isSaving}
            className="text-label-lg"
          >
            Cancelar compra
          </Button>
        </div>
      </dialog>

      {toast && (
        <div role="status" className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-inverse-surface text-inverse-on-surface px-5 py-3 rounded-full text-body-sm shadow-lg z-50">
          {toast}
        </div>
      )}
    </>
  );
}
