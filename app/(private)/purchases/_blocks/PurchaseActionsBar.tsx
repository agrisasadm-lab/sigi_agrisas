"use client";

import { Button } from "../../../_components/atoms/Button/Button";
import type { PurchaseDetail } from "../_logic/types/domain";

interface PurchaseActionsBarProps {
  purchase: PurchaseDetail;
  canCancel: boolean | "loading";
  onCancelClick: () => void;
}

export function PurchaseActionsBar({ purchase, canCancel, onCancelClick }: PurchaseActionsBarProps) {
  if (purchase.status !== "completed") return null;
  if (canCancel === false) return null;

  const hasActiveProviderPayments = purchase.providerPayments.some((pp) => pp.status === "completed");

  return (
    <div className="flex flex-col items-end gap-2">
      <Button
        type="button"
        variant="destructive"
        onClick={onCancelClick}
        disabled={hasActiveProviderPayments}
        loading={canCancel === "loading"}
        title={hasActiveProviderPayments ? "Cancela primero los abonos activos de esta compra" : undefined}
        className="px-4 py-2 text-body-sm hover:opacity-90"
      >
        Cancelar compra
      </Button>
      {hasActiveProviderPayments && (
        <p className="text-label-sm text-on-surface-variant">
          Esta compra tiene abonos activos; cancélalos primero.
        </p>
      )}
    </div>
  );
}
