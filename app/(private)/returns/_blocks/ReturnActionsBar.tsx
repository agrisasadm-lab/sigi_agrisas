"use client";

import { Button } from "../../../_components/atoms/Button/Button";
import type { ReturnDetail } from "../_logic/types/domain";

interface ReturnActionsBarProps {
  ret: ReturnDetail;
  canCancel: boolean | "loading";
  onCancelClick: () => void;
}

export function ReturnActionsBar({ ret, canCancel, onCancelClick }: ReturnActionsBarProps) {
  if (ret.status !== "completed") return null;
  if (canCancel === false) return null;

  return (
    <div className="flex justify-end">
      <Button
        type="button"
        variant="destructive"
        onClick={onCancelClick}
        loading={canCancel === "loading"}
        className="text-body-sm"
      >
        Cancelar devolución
      </Button>
    </div>
  );
}
