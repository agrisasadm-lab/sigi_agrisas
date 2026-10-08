"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "../../../_components/atoms/Icon/Icon";
import { formatMxCurrency } from "../_logic/lib/formatMxCurrency";
import type { CartLine as CartLineType } from "../_logic/types/domain";

const QUANTITY_DRAFT_PATTERN = /^\d*\.?\d{0,3}$/;

interface ListItemProps {
  tabIndex: number;
  ref: (el: HTMLElement | null) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onFocus: () => void;
  "aria-selected": boolean;
}

interface CartLineProps {
  line: CartLineType;
  itemProps?: ListItemProps;
  onUpdateQuantity: (id: string, qty: number) => void;
  onUpdateDiscount: (id: string, pct: number) => void;
  onUpdateDiscountAmount: (id: string, amount: number) => void;
  onChangeTier: (id: string) => void;
  onRemove: (id: string) => void;
}

function stopShortcutKeys(e: React.KeyboardEvent) {
  if (e.key === "+" || e.key === "=" || e.key === "-" || e.key === "Delete" || e.key === "Backspace") {
    e.stopPropagation();
  }
}

export function CartLine({
  line,
  itemProps,
  onUpdateQuantity,
  onUpdateDiscount,
  onUpdateDiscountAmount,
  onChangeTier,
  onRemove,
}: CartLineProps) {
  const [quantityDraft, setQuantityDraft] = useState(String(line.quantity));
  const quantityFocusedRef = useRef(false);

  useEffect(() => {
    if (!quantityFocusedRef.current) {
      setQuantityDraft(String(line.quantity));
    }
  }, [line.quantity]);

  return (
    <div
      {...itemProps}
      aria-keyshortcuts="+ - Delete Enter"
      className="flex flex-col gap-2 py-3 border-b border-outline-variant last:border-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary rounded-sm"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-body-sm font-medium text-on-surface truncate">{line.productName}</p>
          <p className="text-label-sm text-on-surface-variant font-mono">{line.productCode}</p>
        </div>
        <button
          type="button"
          onClick={() => onRemove(line.id)}
          className="shrink-0 text-error hover:text-error/80 transition-colors"
          aria-label="Quitar del carrito"
        >
          <Icon name="close" size={18} />
        </button>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChangeTier(line.id)}
          className="text-label-sm text-primary hover:text-primary/80 underline"
        >
          {line.priceName}
        </button>
        <span className="text-label-sm text-on-surface-variant">
          {formatMxCurrency(line.unitPrice)} c/u
        </span>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1">
          <label className="text-label-sm text-on-surface-variant">Cant.</label>
          <input
            type="text"
            inputMode="decimal"
            value={quantityDraft}
            onFocus={() => { quantityFocusedRef.current = true; }}
            onBlur={() => {
              quantityFocusedRef.current = false;
              const v = parseFloat(quantityDraft);
              if (isNaN(v) || v <= 0) {
                setQuantityDraft(String(line.quantity));
              } else {
                setQuantityDraft(String(v));
              }
            }}
            onKeyDown={stopShortcutKeys}
            onChange={(e) => {
              const raw = e.target.value;
              if (!QUANTITY_DRAFT_PATTERN.test(raw)) return;
              setQuantityDraft(raw);
              const v = parseFloat(raw);
              if (!isNaN(v) && v > 0) onUpdateQuantity(line.id, v);
            }}
            className="w-20 rounded-sm border border-outline px-2 py-1 text-body-sm tabular-nums focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        {line.dosificationId ? (
          <div className="flex items-center gap-1">
            <label className="text-label-sm text-on-surface-variant">Desc. %</label>
            <input
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={line.discountPct}
              onKeyDown={stopShortcutKeys}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                if (!isNaN(v)) onUpdateDiscount(line.id, v);
              }}
              className="w-16 rounded-sm border border-outline px-2 py-1 text-body-sm tabular-nums focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <div className="flex rounded-sm border border-outline overflow-hidden" role="group" aria-label="Tipo de descuento">
              <button
                type="button"
                onClick={() => onUpdateDiscount(line.id, line.discountPct)}
                aria-pressed={line.discountType === "pct"}
                className={[
                  "px-2 py-1 text-label-sm font-medium",
                  line.discountType === "pct"
                    ? "bg-primary text-on-primary"
                    : "bg-surface text-on-surface-variant hover:bg-surface-variant",
                ].join(" ")}
              >
                %
              </button>
              <button
                type="button"
                onClick={() => onUpdateDiscountAmount(line.id, line.discountAmount)}
                aria-pressed={line.discountType === "amount"}
                className={[
                  "px-2 py-1 text-label-sm font-medium border-l border-outline",
                  line.discountType === "amount"
                    ? "bg-primary text-on-primary"
                    : "bg-surface text-on-surface-variant hover:bg-surface-variant",
                ].join(" ")}
              >
                $
              </button>
            </div>
            <input
              type="number"
              min="0"
              max="100"
              step={line.discountType === "pct" ? "0.01" : "0.01"}
              value={line.discountType === "pct" ? line.discountPct : line.discountAmount}
              onKeyDown={stopShortcutKeys}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                if (isNaN(v)) return;
                if (line.discountType === "pct") onUpdateDiscount(line.id, v);
                else onUpdateDiscountAmount(line.id, v);
              }}
              className="w-16 rounded-sm border border-outline px-2 py-1 text-body-sm tabular-nums focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        )}
        <span className="ml-auto text-body-sm font-medium tabular-nums text-on-surface">
          {formatMxCurrency(line.lineTotal)}
        </span>
      </div>
    </div>
  );
}
