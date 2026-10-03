"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "../../../_components/atoms/Spinner/Spinner";
import { useFoliosOptions } from "../../../_hooks/useFoliosOptions";
import { usePaymentMethodsOptions } from "../../../_hooks/usePaymentMethodsOptions";
import { QuoteExpiredError, QuoteNotEditableError, FolioInactiveError, FolioScopeMismatchError, PaymentMethodInactiveError } from "../_logic/errors";
import type { ConvertQuoteBody } from "../_logic/types/api";
import type { QuoteDetail } from "../_logic/types/domain";
import type { SaleDetail } from "../../sales/_logic/types/domain";

interface ConvertQuoteModalProps {
  quote: QuoteDetail;
  isSaving: boolean;
  onClose: () => void;
  onError: (msg: string) => void;
  convert: (id: string, body: ConvertQuoteBody, onChange?: (s: SaleDetail) => void) => Promise<void>;
}

export function ConvertQuoteModal({
  quote,
  isSaving,
  onClose,
  onError,
  convert,
}: ConvertQuoteModalProps) {
  const router = useRouter();
  const { options: folios, isLoading: foliosLoading } = useFoliosOptions({ scope: "POS", branchId: quote.branchId });
  const { options: paymentMethods, isLoading: pmLoading } = usePaymentMethodsOptions();

  const [folioId, setFolioId] = useState("");
  const [paymentMethodId, setPaymentMethodId] = useState("");
  const [notes, setNotes] = useState("");
  const [inlineError, setInlineError] = useState<string | null>(null);

  const canSubmit = !!folioId && !!paymentMethodId && !isSaving;

  async function handleSubmit() {
    setInlineError(null);
    try {
      await convert(
        quote.id,
        { folioId, paymentMethodId, ...(notes.trim() ? { notes: notes.trim() } : {}) },
        (sale) => {
          router.push(`/sales/${sale.id}${sale.creditLimitExceeded === true ? "?creditLimitExceeded=1" : ""}`);
        },
      );
    } catch (err) {
      if (err instanceof QuoteExpiredError) {
        setInlineError("La cotización ha vencido y no puede convertirse.");
      } else if (err instanceof QuoteNotEditableError) {
        onError(`La cotización no está autorizada (estado: ${err.status}).`);
        onClose();
      } else if (err instanceof FolioInactiveError) {
        setInlineError("El folio fiscal seleccionado está inactivo.");
      } else if (err instanceof FolioScopeMismatchError) {
        setInlineError(err.message);
      } else if (err instanceof PaymentMethodInactiveError) {
        setInlineError("La forma de pago seleccionada está inactiva.");
      } else {
        onError((err as Error).message);
      }
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-surface rounded-lg shadow-xl w-full max-w-md mx-4 p-6 space-y-4">
        <h2 className="text-title-lg font-semibold text-on-surface">Convertir a venta</h2>

        {inlineError && (
          <div className="bg-error-container text-on-error-container rounded-md px-3 py-2 text-body-sm">
            {inlineError}
          </div>
        )}

        <div>
          <label className="text-label-sm text-on-surface-variant mb-1 block">Folio fiscal *</label>
          {foliosLoading ? (
            <Spinner size="sm" />
          ) : (
            <select
              value={folioId}
              onChange={(e) => setFolioId(e.target.value)}
              className="w-full rounded border border-outline px-3 py-2 text-body-sm bg-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            >
              <option value="">— Selecciona folio fiscal —</option>
              {folios.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nextFolioCode ?? `${f.prefix ? `${f.prefix}-` : ""}${f.currentNumber + 1}`} ({f.name})
                </option>
              ))}
            </select>
          )}
        </div>

        <div>
          <label className="text-label-sm text-on-surface-variant mb-1 block">Forma de pago *</label>
          {pmLoading ? (
            <Spinner size="sm" />
          ) : (
            <select
              value={paymentMethodId}
              onChange={(e) => setPaymentMethodId(e.target.value)}
              className="w-full rounded border border-outline px-3 py-2 text-body-sm bg-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            >
              <option value="">— Selecciona forma de pago —</option>
              {paymentMethods.map((pm) => (
                <option key={pm.id} value={pm.id}>{pm.name}</option>
              ))}
            </select>
          )}
        </div>

        <div>
          <label className="text-label-sm text-on-surface-variant mb-1 block">
            Notas <span className="text-on-surface-variant/60">(opcional — sobreescribe las de la cotización)</span>
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={1000}
            rows={2}
            className="w-full rounded border border-outline px-3 py-2 text-body-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary resize-none"
          />
        </div>

        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="rounded-full border border-outline px-4 py-2 text-label-lg text-on-surface-variant hover:bg-surface-container-low transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="rounded-full bg-primary text-on-primary px-4 py-2 text-label-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isSaving && <Spinner size="sm" />}
            Convertir
          </button>
        </div>
      </div>
    </div>
  );
}
