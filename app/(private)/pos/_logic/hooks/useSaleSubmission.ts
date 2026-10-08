"use client";

import { useState, useCallback } from "react";
import { createSale } from "../services/createSale";
import type { SaleDetailDto, CreateSaleBody } from "../types/api";
import type { CartLine } from "../types/domain";
import { NetworkError } from "../../../../_lib/authFetch";
import { isOnline } from "../../../../_lib/offline/connectivity";
import { enqueueSale, makeProvisionalCode } from "../../../../_lib/offline/outbox";
import type { OutboxSaleRecord } from "../../../../_lib/offline/db";
import { useOfflineSync } from "../../../_blocks/OfflineSyncProvider";

type SubmitStatus = "idle" | "submitting" | "succeeded" | "queued-offline" | "offline-disabled" | "failed";

interface UseSaleSubmissionResult {
  status: SubmitStatus;
  sale: SaleDetailDto | null;
  queuedSale: OutboxSaleRecord | null;
  error: Error | null;
  submit: (draft: {
    branchId: string;
    customerId?: string;
    folioId: string;
    paymentMethodId: string;
    lines: CartLine[];
    notes?: string;
  }) => Promise<void>;
  reset: () => void;
}

export function useSaleSubmission(): UseSaleSubmissionResult {
  const { offlineEnabled, ownerBranchId } = useOfflineSync();
  const [status, setStatus] = useState<SubmitStatus>("idle");
  const [sale, setSale] = useState<SaleDetailDto | null>(null);
  const [queuedSale, setQueuedSale] = useState<OutboxSaleRecord | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const submit = useCallback(async (draft: {
    branchId: string;
    customerId?: string;
    folioId: string;
    paymentMethodId: string;
    lines: CartLine[];
    notes?: string;
  }) => {
    setStatus("submitting");
    setError(null);

    const body: CreateSaleBody = {
      branchId: draft.branchId,
      customerId: draft.customerId,
      folioId: draft.folioId,
      paymentMethodId: draft.paymentMethodId,
      notes: draft.notes,
      items: draft.lines.map((l) => ({
        productId: l.productId,
        ...(l.dosificationId ? { dosificationId: l.dosificationId } : { productPriceId: l.productPriceId }),
        quantity: l.quantity,
        discountPctOverride: l.discountPct > 0 ? l.discountPct : undefined,
        discountAmount: l.discountAmount > 0 ? l.discountAmount : undefined,
      })),
    };

    const localTotal = draft.lines.reduce((sum, l) => sum + l.lineSubtotal + l.lineIva + l.lineIeps, 0);

    async function enqueueOffline(): Promise<void> {
      if (!offlineEnabled || ownerBranchId !== draft.branchId) {
        setError(new Error("Fija tu sucursal de trabajo antes de vender offline."));
        setStatus("offline-disabled");
        return;
      }
      const record = await enqueueSale({
        ownerBranchId,
        payload: body as unknown as Record<string, unknown>,
        localTotal,
      });
      setQueuedSale(record);
      setStatus("queued-offline");
    }

    if (!isOnline()) {
      await enqueueOffline();
      return;
    }

    try {
      const result = await createSale(body);
      setSale(result);
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
    setSale(null);
    setQueuedSale(null);
    setError(null);
  }, []);

  return { status, sale, queuedSale, error, submit, reset };
}

export { makeProvisionalCode };
