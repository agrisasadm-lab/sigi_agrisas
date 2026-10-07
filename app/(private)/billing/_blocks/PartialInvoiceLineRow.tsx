"use client";

import { useState, useEffect } from "react";
import type { PartialLine } from "../_logic/types/domain";
import { formatMxCurrency } from "../../../_lib/formatMxCurrency";

const NUM_DRAFT_PATTERN = /^\d*\.?\d*$/;
const SAT_PRODUCT_CODE_PATTERN = /^\d{8}$/;

interface PartialInvoiceLineRowProps {
  line: PartialLine;
  lineTotal: number;
  onUpdate: (patch: Partial<PartialLine>) => void;
  onRemove: () => void;
  onChangePriceTier?: () => void;
}

function NumField({ value, onChange, min = 0, step = "any", placeholder = "" }: { value: number; onChange: (v: number) => void; min?: number; step?: string; placeholder?: string }) {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  return (
    <input
      type="text"
      inputMode="decimal"
      value={draft}
      step={step}
      placeholder={placeholder}
      onChange={(e) => {
        const raw = e.target.value;
        if (!NUM_DRAFT_PATTERN.test(raw)) return;
        setDraft(raw);
        const v = parseFloat(raw);
        // No min-clamping while typing: clamping here would fight the draft (e.g. typing
        // "0" toward "0.5" on a field with min=0.001 would jump to "0.001" mid-keystroke).
        // min is only enforced on blur, once the user has finished editing.
        if (!isNaN(v)) onChange(v);
      }}
      onBlur={() => {
        const v = parseFloat(draft);
        const normalized = isNaN(v) ? 0 : Math.max(min, v);
        setDraft(String(normalized));
        onChange(normalized);
      }}
      className="w-full rounded-sm border border-outline px-2 py-1 text-body-sm bg-surface focus:outline-none focus:border-primary tabular-nums"
    />
  );
}

export function PartialInvoiceLineRow({ line, lineTotal, onUpdate, onRemove, onChangePriceTier }: PartialInvoiceLineRowProps) {
  const satProductCodeInvalid = !line.productId && !!line.satProductCode && !SAT_PRODUCT_CODE_PATTERN.test(line.satProductCode);

  return (
    <tr className="border-b border-outline-variant/40 align-top">
      <td className="px-2 py-2">
        <div className="space-y-1">
          <input
            type="text"
            value={line.description}
            onChange={(e) => onUpdate({ description: e.target.value })}
            placeholder="Descripción *"
            className="w-full rounded-sm border border-outline px-2 py-1 text-body-sm bg-surface focus:outline-none focus:border-primary"
          />
          {!line.productId && (
            <>
              <input
                type="text"
                value={line.satProductCode}
                onChange={(e) => onUpdate({ satProductCode: e.target.value })}
                placeholder="Clave SAT (8 dígitos)"
                maxLength={8}
                className={`w-full rounded-sm border px-2 py-1 text-body-sm bg-surface focus:outline-none focus:border-primary font-mono ${satProductCodeInvalid ? "border-error" : "border-outline"}`}
              />
              {satProductCodeInvalid && (
                <p className="text-label-sm text-error">Debe ser 8 dígitos o dejarse vacío</p>
              )}
            </>
          )}
          <p className="text-label-sm text-on-surface-variant font-mono">{line.productCode}</p>
        </div>
      </td>
      <td className="px-2 py-2 w-20">
        <NumField value={line.quantity} onChange={(v) => onUpdate({ quantity: v })} min={0.001} step="0.001" placeholder="1" />
      </td>
      <td className="px-2 py-2 w-28">
        <div className="space-y-1">
          {onChangePriceTier && (
            <button
              type="button"
              onClick={onChangePriceTier}
              className="w-full text-left text-label-sm text-primary hover:underline truncate"
              title="Cambiar lista de precios"
            >
              {line.priceName ?? "Elegir precio"}
            </button>
          )}
          <NumField value={line.unitPrice} onChange={(v) => onUpdate({ unitPrice: v })} step="0.01" placeholder="0.00" />
        </div>
      </td>
      <td className="px-2 py-2 w-20">
        <NumField value={line.discountPct} onChange={(v) => onUpdate({ discountPct: Math.min(100, Math.max(0, v)) })} min={0} step="0.01" placeholder="0" />
      </td>
      <td className="px-2 py-2 w-20">
        <NumField value={line.ivaRate * 100} onChange={(v) => onUpdate({ ivaRate: Math.min(1, v / 100) })} min={0} step="1" placeholder="16" />
      </td>
      <td className="px-2 py-2 w-20">
        <NumField value={line.iepsRate * 100} onChange={(v) => onUpdate({ iepsRate: Math.min(1, v / 100) })} min={0} step="1" placeholder="0" />
      </td>
      <td className="px-2 py-2 text-right tabular-nums text-body-sm font-medium">
        {formatMxCurrency(lineTotal)}
      </td>
      <td className="px-2 py-2">
        <button
          type="button"
          onClick={onRemove}
          title="Quitar línea"
          className="text-error hover:text-error/70 text-label-sm transition-colors"
        >
          ×
        </button>
      </td>
    </tr>
  );
}
