"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "../../../_components/atoms/Button/Button";
import { usePurchaseMutations } from "../_logic/hooks/usePurchaseMutations";
import { ProviderPaymentAlreadyCancelledError, PurchasePayCancelForbiddenError } from "../_logic/errors";

interface CancelProviderPaymentModalProps {
  providerPaymentId: string;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function CancelProviderPaymentModal({ providerPaymentId, open, onClose, onSuccess }: CancelProviderPaymentModalProps) {
  const [toast, setToast] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  const { isSaving, cancelPayment } = usePurchaseMutations();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) {
      dialog.showModal();
    } else {
      dialog.close();
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

  async function handleConfirm() {
    try {
      const result = await cancelPayment(providerPaymentId, null);
      if (result) {
        onSuccess();
        onClose();
      }
    } catch (err) {
      if (err instanceof ProviderPaymentAlreadyCancelledError) {
        setToast("El abono ya estaba cancelado");
        onClose();
      } else if (err instanceof PurchasePayCancelForbiddenError) {
        setToast("No tienes permiso para cancelar este abono");
        onClose();
      }
    }
  }

  return (
    <>
      <dialog
        ref={dialogRef}
        aria-labelledby="cancel-provider-payment-title"
        className="rounded-md bg-surface-container p-6 shadow-lg w-full max-w-md backdrop:bg-black/40"
      >
        <h2 id="cancel-provider-payment-title" className="text-title-md font-semibold text-on-surface mb-2">
          Cancelar abono
        </h2>
        <p className="text-body-md text-on-surface-variant mb-4">
          El saldo del proveedor se revertirá al cancelar este abono. Esta acción no se puede deshacer.
        </p>

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
            onClick={handleConfirm}
            loading={isSaving}
            className="text-label-lg"
          >
            Cancelar abono
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
