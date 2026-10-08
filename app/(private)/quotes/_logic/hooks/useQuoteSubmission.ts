"use client";

import { useState, useCallback } from "react";
import { createQuote } from "../services/createQuote";
import type { CreateQuoteBody } from "../types/api";
import type { QuoteDetail } from "../types/domain";
import type { CartLine } from "../../../pos/_logic/types/domain";
import { NetworkError } from "../../../../_lib/authFetch";
import { isOnline } from "../../../../_lib/offline/connectivity";
import { enqueueQuote } from "../../../../_lib/offline/outbox";
import type { OutboxQuoteRecord } from "../../../../_lib/offline/db";
import { useOfflineSync } from "../../../_blocks/OfflineSyncProvider";

type SubmitStatus = "idle" | "submitting" | "succeeded" | "queued-offline" | "offline-disabled" | "failed";

interface UseQuoteSubmissionResult {
  status: SubmitStatus;
  quote: QuoteDetail | null;
  queuedQuote: OutboxQuoteRecord | null;
  error: Error | null;
  submit: (draft: {
    branchId: string;
    customerId?: string | null;
    folioId: string;
    lines: CartLine[];
    expiresAt?: string | null;
    notes?: string | null;
  }) => Promise<void>;
  reset: () => void;
}

export function useQuoteSubmission(): UseQuoteSubmissionResult {
  const { offlineEnabled, ownerBranchId } = useOfflineSync();
  const [status, setStatus] = useState<SubmitStatus>("idle");
  const [quote, setQuote] = useState<QuoteDetail | null>(null);
  const [queuedQuote, setQueuedQuote] = useState<OutboxQuoteRecord | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const submit = useCallback(async (draft: {
    branchId: string;
    customerId?: string | null;
    folioId: string;
    lines: CartLine[];
    expiresAt?: string | null;
    notes?: string | null;
  }) => {
    setStatus("submitting");
    setError(null);

    const body: CreateQuoteBody = {
      branchId: draft.branchId,
      customerId: draft.customerId ?? null,
      folioId: draft.folioId,
      expiresAt: draft.expiresAt ?? null,
      notes: draft.notes ?? null,
      items: draft.lines.map((l) => ({
        productId: l.productId,
        // Dosification lines are never offered in quote mode (see PosPage.handleAddProduct).
        productPriceId: l.productPriceId!,
        quantity: l.quantity,
        discountPctOverride: l.discountPct > 0 ? l.discountPct : undefined,
        discountAmount: l.discountAmount > 0 ? l.discountAmount : undefined,
      })),
    };

    const localTotal = draft.lines.reduce((sum, l) => sum + l.lineSubtotal + l.lineIva + l.lineIeps, 0);

    async function enqueueOffline(): Promise<void> {
      if (!offlineEnabled || ownerBranchId !== draft.branchId) {
        setError(new Error("Fija tu sucursal de trabajo antes de cotizar offline."));
        setStatus("offline-disabled");
        return;
      }
      const record = await enqueueQuote({
        ownerBranchId,
        payload: body as unknown as Record<string, unknown>,
        localTotal,
      });
      setQueuedQuote(record);
      setStatus("queued-offline");
    }

    if (!isOnline()) {
      await enqueueOffline();
      return;
    }

    try {
      const result = await createQuote(body);
      setQuote(result);
      setStatus("succeeded");
    } catch (err) {
      if (err instanceof NetworkError) {
        await enqueueOffline();
        return;
      }
      setError(err as Error);
      setStatus("failed");
    }
  }, []);

  const reset = useCallback(() => {
    setStatus("idle");
    setQuote(null);
    setQueuedQuote(null);
    setError(null);
  }, []);

  return { status, quote, queuedQuote, error, submit, reset };
}
