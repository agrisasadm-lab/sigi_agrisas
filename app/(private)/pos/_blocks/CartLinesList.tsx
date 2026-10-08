"use client";

import { useCallback } from "react";
import { CartLine } from "./CartLine";
import { useListKeyboard } from "../../../_hooks/useListKeyboard";
import type { CartLine as CartLineType } from "../_logic/types/domain";

interface CartLinesListProps {
  lines: CartLineType[];
  onUpdateQuantity: (id: string, qty: number) => void;
  onUpdateDiscount: (id: string, pct: number) => void;
  onUpdateDiscountAmount: (id: string, amount: number) => void;
  onChangeTier: (id: string) => void;
  onRemove: (id: string) => void;
}

export function CartLinesList({
  lines,
  onUpdateQuantity,
  onUpdateDiscount,
  onUpdateDiscountAmount,
  onChangeTier,
  onRemove,
}: CartLinesListProps) {
  const onEnter = useCallback(
    (line: CartLineType) => onChangeTier(line.id),
    [onChangeTier],
  );
  const onPlus = useCallback(
    (line: CartLineType) => onUpdateQuantity(line.id, line.quantity + 1),
    [onUpdateQuantity],
  );
  const onMinus = useCallback(
    (line: CartLineType) => onUpdateQuantity(line.id, Math.max(0.01, line.quantity - 1)),
    [onUpdateQuantity],
  );
  const onDelete = useCallback(
    (_line: CartLineType, index: number) => {
      onRemove(_line.id);
    },
    [onRemove],
  );

  const { getItemProps, itemRefs } = useListKeyboard(lines, onEnter, { onPlus, onMinus, onDelete });

  if (lines.length === 0) {
    return (
      <div className="py-8 text-center text-body-sm text-on-surface-variant">
        El carrito está vacío
      </div>
    );
  }

  return (
    <div className="divide-y divide-outline-variant">
      {lines.map((line, idx) => (
        <CartLine
          key={line.id}
          line={line}
          itemProps={getItemProps(idx)}
          onUpdateQuantity={onUpdateQuantity}
          onUpdateDiscount={onUpdateDiscount}
          onUpdateDiscountAmount={onUpdateDiscountAmount}
          onChangeTier={onChangeTier}
          onRemove={onRemove}
        />
      ))}
    </div>
  );
}
