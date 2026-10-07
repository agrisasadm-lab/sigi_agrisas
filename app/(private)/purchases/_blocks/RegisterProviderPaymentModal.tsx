"use client";

import { useState, useEffect, useRef } from "react";
import { usePurchaseMutations } from "../_logic/hooks/usePurchaseMutations";
import { ProviderPaymentExceedsDueAmountError, PurchasePayForbiddenError } from "../_logic/errors";
import { formatMxCurrency } from "../../../_lib/formatMxCurrency";

function fmt(n: number) { return formatMxCurrency(n); }

interface RegisterProviderPaymentModalProps {
  purchaseId: string;
  dueAmount: number;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function RegisterProviderPaymentModal({ purchaseId, dueAmount, open, onClose, onSuccess }: RegisterProviderPaymentModalProps) {
  const [amountInput, setAmountInput] = useState("");
  const [clientError, setClientError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  const { isSaving, registerPayment } = usePurchaseMutations();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) {
      dialog.showModal();
    } else {
      dialog.close();
      setAmountInput("");
      setClientError(null);
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

  async function handleSubmit() {
    setClientError(null);
    const amount = parseFloat(amountInput);
    if (isNaN(amount) || amount <= 0) {
      setClientError("Ingresa un monto válido mayor a 0.");
      return;
    }
    if (amount > dueAmount) {
      setClientError(`El monto excede el saldo pendiente (${fmt(dueAmount)}).`);
      return;
    }

    try {
      const result = await registerPayment(purchaseId, amount);
      if (result) {
        onSuccess();
        onClose();
      }
    } catch (err) {
      if (err instanceof ProviderPaymentExceedsDueAmountError) {
        setClientError(`El monto excede el saldo pendiente (${fmt(err.due)}).`);
      } else if (err instanceof PurchasePayForbiddenError) {
        setToast("No tienes permiso para registrar abonos");
        onClose();
      }
    }
  }

  return (
    <>
      <dialog
        ref={dialogRef}
        aria-labelledby="register-provider-payment-title"
        className="rounded-md bg-surface-container p-6 shadow-lg w-full max-w-md backdrop:bg-black/40"
      >
        <h2 id="register-provider-payment-title" className="text-title-md font-semibold text-on-surface mb-2">
          Registrar abono
        </h2>
        <p className="text-body-md text-on-surface-variant mb-4">
          Saldo pendiente: <span className="font-medium text-on-surface">{fmt(dueAmount)}</span>
        </p>

        <div className="mb-4">
          <label htmlFor="payment-amount" className="block text-label-md text-on-surface mb-1">
            Monto
          </label>
          <input
            id="payment-amount"
            type="text"
            inputMode="decimal"
            value={amountInput}
            onChange={(e) => {
              setAmountInput(e.target.value);
              setClientError(null);
            }}
            placeholder="0.00"
            className={`w-full rounded border px-3 py-2 text-body-sm tabular-nums focus:outline-none focus:ring-1 ${clientError ? "border-error focus:ring-error" : "border-outline focus:border-primary focus:ring-primary"}`}
          />
          {clientError && <p className="text-label-sm text-error mt-1">{clientError}</p>}
        </div>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 rounded text-label-lg text-on-surface hover:bg-surface-container-highest transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSaving}
            className="px-4 py-2 rounded text-label-lg bg-primary text-on-primary hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? "Registrando..." : "Registrar abono"}
          </button>
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
