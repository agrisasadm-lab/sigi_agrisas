"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "../../../_components/atoms/Button/Button";
import { useWaybillMutations } from "../_logic/hooks/useWaybillMutations";
import { cancelWaybillSchema } from "../_logic/schemas/cancelWaybill";
import { WaybillAlreadyCancelledError, WaybillCancelForbiddenError } from "../_logic/errors";
import type { WaybillDetail } from "../_logic/types/domain";
import type { WaybillType } from "../_logic/types/api";

interface CancelWaybillModalProps {
  waybillId: string;
  type: WaybillType;
  open: boolean;
  onClose: () => void;
  onSuccess: (updated: WaybillDetail) => void;
}

export function CancelWaybillModal({ waybillId, type, open, onClose, onSuccess }: CancelWaybillModalProps) {
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  const { isSaving, cancel } = useWaybillMutations();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) {
      dialog.showModal();
    } else {
      dialog.close();
      setReason("");
      setReasonError(null);
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
    const parsed = cancelWaybillSchema.safeParse({ reason });
    if (!parsed.success) {
      setReasonError(parsed.error.issues[0]?.message ?? "Motivo inválido");
      return;
    }
    setReasonError(null);
    try {
      const updated = await cancel(waybillId, { reason: parsed.data.reason });
      if (updated) {
        onSuccess(updated);
        onClose();
      }
    } catch (err) {
      if (err instanceof WaybillAlreadyCancelledError) {
        setToast("El traspaso ya estaba cancelado");
        onClose();
      } else if (err instanceof WaybillCancelForbiddenError) {
        setToast("No tienes permiso para cancelar este traspaso");
        onClose();
      }
    }
  }

  return (
    <>
      <dialog
        ref={dialogRef}
        aria-labelledby="cancel-waybill-modal-title"
        className="rounded-md bg-surface-container p-6 shadow-lg w-full max-w-md backdrop:bg-black/40"
      >
        <h2 id="cancel-waybill-modal-title" className="text-title-md font-semibold text-on-surface mb-2">
          Cancelar traspaso
        </h2>
        <p className="text-body-md text-on-surface-variant mb-3">
          {type === "carta_porte"
            ? "Al cancelar este traspaso, el inventario afectado será revertido y el CFDI se cancelará ante el SAT."
            : "Al cancelar este traspaso, el inventario afectado será revertido."}
        </p>
        <div className="bg-tertiary-container/30 rounded p-3 mb-4 text-body-sm text-on-surface-variant">
          ⚠️ El stock de destino podría quedar negativo si ya se consumió parte de la mercancía transferida.
        </div>

        <div className="mb-4">
          <label htmlFor="cancel-waybill-reason" className="block text-label-md text-on-surface mb-1">
            Motivo <span className="text-error">*</span>
          </label>
          <textarea
            id="cancel-waybill-reason"
            value={reason}
            onChange={(e) => {
              setReason(e.target.value.slice(0, 500));
              setReasonError(null);
            }}
            rows={3}
            maxLength={500}
            className="w-full rounded border border-outline px-3 py-2 text-body-sm bg-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary resize-none"
            placeholder="Describe el motivo de cancelación..."
          />
          <div className="flex justify-between mt-1">
            {reasonError && <p className="text-label-sm text-error">{reasonError}</p>}
            <p className="text-right text-label-sm text-on-surface-variant ml-auto">{reason.length}/500</p>
          </div>
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
            loading={isSaving}
            className="text-label-lg"
          >
            Cancelar traspaso
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
