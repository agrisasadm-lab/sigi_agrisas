"use client";
import { formatMxCurrency } from "../../../../../../_lib/formatMxCurrency";

interface CreateReturnFooterProps {
  reason: string;
  onReasonChange: (v: string) => void;
  returnedAt: string;
  onReturnedAtChange: (v: string) => void;
  notes: string;
  onNotesChange: (v: string) => void;
  validationError: string | null;
  reasonError?: string | null;
  isSubmitting: boolean;
  onSubmit: () => void;
  refundSubtotal: number;
  refundTax: number;
  refundTotal: number;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function fmt(n: number) { return formatMxCurrency(n); }

export function CreateReturnFooter({
  reason,
  onReasonChange,
  returnedAt,
  onReturnedAtChange,
  notes,
  onNotesChange,
  validationError,
  reasonError,
  isSubmitting,
  onSubmit,
  refundSubtotal,
  refundTax,
  refundTotal,
}: CreateReturnFooterProps) {
  return (
    <div className="space-y-4 bg-surface-container-low rounded-lg p-4">
      <div>
        <label htmlFor="return-reason" className="block text-label-md text-on-surface mb-1">
          Motivo <span className="text-error">*</span>
        </label>
        <textarea
          id="return-reason"
          value={reason}
          onChange={(e) => onReasonChange(e.target.value.slice(0, 500))}
          rows={3}
          maxLength={500}
          required
          className="w-full rounded border border-outline px-3 py-2 text-body-sm bg-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary resize-none"
          placeholder="Describe el motivo de la devolución (mín. 3 caracteres)..."
        />
        <p className="text-right text-label-sm text-on-surface-variant mt-1">{reason.length}/500</p>
        {reasonError && (
          <p className="text-label-sm text-error mt-1">{reasonError}</p>
        )}
      </div>

      <div>
        <label htmlFor="return-date" className="block text-label-md text-on-surface mb-1">
          Fecha de devolución <span className="text-error">*</span>
        </label>
        <input
          id="return-date"
          type="date"
          value={returnedAt}
          max={todayIso()}
          onChange={(e) => onReturnedAtChange(e.target.value)}
          className="rounded border border-outline px-3 py-2 text-body-sm bg-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
        />
      </div>

      <div>
        <label htmlFor="return-notes" className="block text-label-md text-on-surface mb-1">
          Notas <span className="text-on-surface-variant text-label-sm">(opcional)</span>
        </label>
        <textarea
          id="return-notes"
          value={notes}
          onChange={(e) => onNotesChange(e.target.value.slice(0, 1000))}
          rows={2}
          maxLength={1000}
          className="w-full rounded border border-outline px-3 py-2 text-body-sm bg-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary resize-none"
          placeholder="Observaciones adicionales..."
        />
        <p className="text-right text-label-sm text-on-surface-variant mt-1">{notes.length}/1000</p>
      </div>

      {/* Real-time refund preview */}
      <div className="border-t border-outline-variant pt-3 space-y-1.5">
        <div className="flex justify-between text-body-sm">
          <span className="text-on-surface-variant">Subtotal reembolso</span>
          <span className="tabular-nums">{fmt(refundSubtotal)}</span>
        </div>
        <div className="flex justify-between text-body-sm">
          <span className="text-on-surface-variant">Impuestos</span>
          <span className="tabular-nums">{fmt(refundTax)}</span>
        </div>
        <div className="flex justify-between text-title-sm font-semibold border-t border-outline-variant pt-1.5">
          <span>Total reembolso</span>
          <span className="tabular-nums">{fmt(refundTotal)}</span>
        </div>
      </div>

      <div className="flex flex-col items-end gap-2">
        <button
          type="button"
          onClick={onSubmit}
          disabled={!!validationError || isSubmitting}
          className="rounded-full bg-primary text-on-primary px-6 py-2 text-label-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? "Registrando..." : "Registrar devolución"}
        </button>
        {validationError && (
          <p className="text-label-sm text-error">{validationError}</p>
        )}
      </div>
    </div>
  );
}
