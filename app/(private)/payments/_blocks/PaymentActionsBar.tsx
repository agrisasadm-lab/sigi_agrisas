"use client";

import { useState } from "react";
import { Button } from "../../../_components/atoms/Button/Button";
import { useCurrentUser } from "../../../_hooks/useCurrentUser";
import { CancelPaymentModal } from "./CancelPaymentModal";
import type { PaymentDetail } from "../_logic/types/domain";

interface PaymentActionsBarProps {
  payment: PaymentDetail;
  onCancelled: () => void;
}

export function PaymentActionsBar({ payment, onCancelled }: PaymentActionsBarProps) {
  const { can } = useCurrentUser();
  const canCancel = can("payments:cancel");
  const [showCancel, setShowCancel] = useState(false);

  if (payment.status !== "completed" || canCancel !== true) return null;

  return (
    <div className="flex gap-3">
      <Button type="button" variant="outlined" onClick={() => setShowCancel(true)} className="border-error text-error hover:bg-error/5">
        Cancelar abono
      </Button>

      {showCancel && (
        <CancelPaymentModal
          paymentId={payment.id}
          onSuccess={() => {
            setShowCancel(false);
            onCancelled();
          }}
          onClose={() => setShowCancel(false)}
        />
      )}
    </div>
  );
}
