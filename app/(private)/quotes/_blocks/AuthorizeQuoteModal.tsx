"use client";

import { useState } from "react";
import { Button } from "../../../_components/atoms/Button/Button";
import { QuoteExpiredError, QuoteNotEditableError } from "../_logic/errors";
import type { AuthorizeQuoteBody } from "../_logic/types/api";
import type { QuoteDetail } from "../_logic/types/domain";

interface AuthorizeQuoteModalProps {
  quote: QuoteDetail;
  isSaving: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onError: (msg: string) => void;
  authorize: (id: string, body: AuthorizeQuoteBody, onChange?: (q: QuoteDetail) => void) => Promise<void>;
}

export function AuthorizeQuoteModal({
  quote,
  isSaving,
  onClose,
  onSuccess,
  onError,
  authorize,
}: AuthorizeQuoteModalProps) {
  const [notes, setNotes] = useState("");
  const [inlineError, setInlineError] = useState<string | null>(null);

  async function handleSubmit() {
    setInlineError(null);
    try {
      await authorize(quote.id, { notes: notes.trim() || null }, () => onSuccess());
    } catch (err) {
      if (err instanceof QuoteExpiredError) {
        setInlineError("Esta cotización ha vencido y no puede autorizarse.");
      } else if (err instanceof QuoteNotEditableError) {
        onError(`La cotización no está en estado borrador (estado: ${err.status}).`);
        onClose();
      } else {
        onError((err as Error).message);
      }
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-surface rounded-lg shadow-xl w-full max-w-md mx-4 p-6 space-y-4">
        <h2 className="text-title-lg font-semibold text-on-surface">Autorizar cotización</h2>

        {inlineError && (
          <div className="bg-error-container text-on-error-container rounded-md px-3 py-2 text-body-sm">
            {inlineError}
          </div>
        )}

        <div>
          <label className="text-label-sm text-on-surface-variant mb-1 block">
            Notas <span className="text-on-surface-variant/60">(opcional)</span>
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={1000}
            rows={3}
            className="w-full rounded border border-outline px-3 py-2 text-body-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary resize-none"
          />
        </div>

        <div className="flex gap-3 justify-end">
          <Button type="button" variant="outlined" onClick={onClose} disabled={isSaving} className="text-on-surface-variant">
            Cancelar
          </Button>
          <Button type="button" variant="filled" onClick={handleSubmit} loading={isSaving}>
            Autorizar
          </Button>
        </div>
      </div>
    </div>
  );
}
