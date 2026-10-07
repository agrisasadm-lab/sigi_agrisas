"use client";

import { useRef, useEffect, useState } from "react";
import { useFoliosOptions } from "../../../_hooks/useFoliosOptions";
import { usePaymentMethodsOptions } from "../../../_hooks/usePaymentMethodsOptions";
import { registerPayment } from "../_logic/services/registerPayment";
import { formatMxCurrency } from "../../../_lib/formatMxCurrency";
import {
  PaymentExceedsDueAmountError,
  PaymentExceedsLineDueAmountError,
  PaymentItemsAmountMismatchError,
  SaleItemNotFoundError,
  SaleNotPayableError,
  FolioScopeMismatchError,
} from "../_logic/errors";
import { Spinner } from "../../../_components/atoms/Spinner/Spinner";
import type { LineBalance } from "../_logic/types/domain";

function fmt(n: number) { return formatMxCurrency(n); }

interface RegisterPaymentModalProps {
  saleId: string;
  dueAmount: number;
  lineBalances: LineBalance[];
  onSuccess: () => void;
  onClose: () => void;
}

export function RegisterPaymentModal({ saleId, dueAmount, lineBalances, onSuccess, onClose }: RegisterPaymentModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const { options: folioOptions, isLoading: foliosLoading } = useFoliosOptions({ scope: "OPERATIONS" });
  const { options: methodOptions, isLoading: methodsLoading } = usePaymentMethodsOptions();

  const [byLine, setByLine] = useState(false);
  const [amount, setAmount] = useState("");
  const [lineAmounts, setLineAmounts] = useState<Record<string, string>>({});
  const [lineErrors, setLineErrors] = useState<Record<string, string>>({});
  const [paymentMethodId, setPaymentMethodId] = useState("");
  const [folioId, setFolioId] = useState("");
  const [notes, setNotes] = useState("");
  const [amountError, setAmountError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

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

  useEffect(() => {
    if (!foliosLoading && folioOptions.length > 0 && !folioId) {
      const rb = folioOptions.find((f) => f.code === "RB");
      setFolioId(rb?.id ?? folioOptions[0].id);
    }
  }, [foliosLoading, folioOptions, folioId]);

  useEffect(() => {
    if (!methodsLoading && methodOptions.length > 0 && !paymentMethodId) {
      setPaymentMethodId(methodOptions[0].id);
    }
  }, [methodsLoading, methodOptions, paymentMethodId]);

  function lineAmountsToItems(): { items: { saleItemId: string; amount: number }[]; sum: number } {
    const items: { saleItemId: string; amount: number }[] = [];
    let sum = 0;
    for (const lb of lineBalances) {
      const raw = lineAmounts[lb.saleItemId];
      const n = raw ? parseFloat(raw) : 0;
      if (n > 0) {
        items.push({ saleItemId: lb.saleItemId, amount: n });
        sum += n;
      }
    }
    return { items, sum };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setAmountError(null);
    setFormError(null);
    setLineErrors({});

    let numAmount: number;
    let items: { saleItemId: string; amount: number }[] | undefined;

    if (byLine) {
      const { items: lineItems, sum } = lineAmountsToItems();
      if (lineItems.length === 0) {
        setFormError("Captura al menos un monto por línea");
        return;
      }
      numAmount = sum;
      items = lineItems;
    } else {
      numAmount = parseFloat(amount);
      if (!amount || isNaN(numAmount) || numAmount <= 0) {
        setAmountError("El monto debe ser mayor a 0");
        return;
      }
    }

    if (!paymentMethodId) {
      setFormError("Selecciona un método de pago");
      return;
    }
    if (!folioId) {
      setFormError("Selecciona un folio");
      return;
    }

    setIsSaving(true);
    try {
      await registerPayment({
        saleId,
        amount: numAmount,
        paymentMethodId,
        folioId,
        notes: notes || undefined,
        items,
      });
      onSuccess();
    } catch (err) {
      if (err instanceof PaymentExceedsLineDueAmountError) {
        setLineErrors({ [err.saleItemId]: err.message });
      } else if (err instanceof PaymentExceedsDueAmountError) {
        setAmountError(err.message);
      } else if (err instanceof PaymentItemsAmountMismatchError) {
        setFormError(err.message);
      } else if (err instanceof SaleItemNotFoundError) {
        setFormError(err.message);
      } else if (err instanceof SaleNotPayableError) {
        setFormError(err.message);
      } else if (err instanceof FolioScopeMismatchError) {
        setFormError(err.message);
      } else if (err instanceof Error) {
        setFormError(err.message);
      }
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="rounded-lg bg-surface shadow-elevation-3 p-0 w-full max-w-md backdrop:bg-black/40"
      onClose={onClose}
    >
      <div className="px-6 py-4 border-b border-outline-variant">
        <h2 className="text-title-md font-semibold text-on-surface">Registrar abono</h2>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-6">
        {lineBalances.length > 0 && (
          <label className="flex items-center gap-2 text-body-sm text-on-surface-variant">
            <input
              type="checkbox"
              checked={byLine}
              onChange={(e) => { setByLine(e.target.checked); setAmountError(null); setLineErrors({}); }}
              className="rounded-sm border-outline"
            />
            Repartir por producto
          </label>
        )}

        {!byLine ? (
          <div className="flex flex-col gap-1">
            <label className="text-label-md text-on-surface-variant" htmlFor="reg-amount">
              Monto
            </label>
            <p className="text-body-sm text-on-surface-variant">
              Saldo pendiente: <span className="font-medium text-on-surface">{fmt(dueAmount)}</span>
            </p>
            <input
              id="reg-amount"
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => { setAmount(e.target.value); setAmountError(null); }}
              className="rounded-md border border-outline bg-surface px-3 py-2 text-body-md text-on-surface focus:outline-none focus:border-primary"
              placeholder="0.00"
            />
            {amountError && <p className="text-body-sm text-error">{amountError}</p>}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="text-label-md text-on-surface-variant">Monto por producto</p>
            {lineBalances.map((lb) => {
              const disabled = lb.dueAmount <= 0;
              const err = lineErrors[lb.saleItemId];
              return (
                <div key={lb.saleItemId} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-body-sm text-on-surface truncate">{lb.productNameSnapshot}</span>
                    <span className="text-label-sm text-on-surface-variant shrink-0">
                      Pendiente: {fmt(lb.dueAmount)}
                    </span>
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max={lb.dueAmount > 0 ? lb.dueAmount : undefined}
                    disabled={disabled}
                    value={lineAmounts[lb.saleItemId] ?? ""}
                    onChange={(e) => {
                      setLineAmounts((prev) => ({ ...prev, [lb.saleItemId]: e.target.value }));
                      setLineErrors((prev) => { const next = { ...prev }; delete next[lb.saleItemId]; return next; });
                    }}
                    placeholder="0.00"
                    className="rounded-md border border-outline bg-surface px-3 py-2 text-body-md text-on-surface focus:outline-none focus:border-primary disabled:opacity-50 disabled:bg-surface-container-low"
                  />
                  {err && <p className="text-body-sm text-error">{err}</p>}
                </div>
              );
            })}
          </div>
        )}

        {/* Payment method */}
        <div className="flex flex-col gap-1">
          <label className="text-label-md text-on-surface-variant" htmlFor="reg-method">
            Método de pago
          </label>
          <select
            id="reg-method"
            value={paymentMethodId}
            onChange={(e) => setPaymentMethodId(e.target.value)}
            className="rounded-md border border-outline bg-surface px-3 py-2 text-body-md text-on-surface focus:outline-none focus:border-primary"
            disabled={methodsLoading}
          >
            {methodOptions.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>

        {/* Folio */}
        <div className="flex flex-col gap-1">
          <label className="text-label-md text-on-surface-variant" htmlFor="reg-folio">
            Folio de recibo
          </label>
          <select
            id="reg-folio"
            value={folioId}
            onChange={(e) => setFolioId(e.target.value)}
            className="rounded-md border border-outline bg-surface px-3 py-2 text-body-md text-on-surface focus:outline-none focus:border-primary"
            disabled={foliosLoading}
          >
            {folioOptions.map((f) => (
              <option key={f.id} value={f.id}>{f.name} ({f.code})</option>
            ))}
          </select>
        </div>

        {/* Notes */}
        <div className="flex flex-col gap-1">
          <label className="text-label-md text-on-surface-variant" htmlFor="reg-notes">
            Notas <span className="text-on-surface-variant/60">(opcional)</span>
          </label>
          <textarea
            id="reg-notes"
            rows={2}
            maxLength={1000}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="rounded-md border border-outline bg-surface px-3 py-2 text-body-md text-on-surface focus:outline-none focus:border-primary resize-none"
            placeholder="Comentarios adicionales..."
          />
        </div>

        {formError && (
          <p className="text-body-sm text-error bg-error-container/20 rounded px-3 py-2">{formError}</p>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            className="rounded-full border border-outline px-5 py-2 text-body-sm font-medium text-on-surface hover:bg-surface-container-low transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="rounded-full bg-primary text-on-primary px-5 py-2 text-body-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center gap-2"
          >
            {isSaving && <Spinner size="sm" />}
            Registrar abono
          </button>
        </div>
      </form>
    </dialog>
  );
}
