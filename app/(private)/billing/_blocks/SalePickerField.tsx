"use client";

import { useState } from "react";
import { useSaleSearch } from "../_logic/hooks/useSaleSearch";
import type { SaleOption } from "../_logic/services/searchSales";
import { formatMxCurrency } from "../../../_lib/formatMxCurrency";

interface SalePickerFieldProps {
  value: string;
  label: string;
  onSelect: (id: string, label: string, customerId: string | null) => void;
}

export function SalePickerField({ value, label, onSelect }: SalePickerFieldProps) {
  const [query, setQuery] = useState(label);
  const { results, open, setOpen, isLoading } = useSaleSearch(query);

  function handleSelect(opt: SaleOption) {
    const lbl = `${opt.folioLabel} · ${opt.customerName ?? "Sin cliente"} · ${formatMxCurrency(opt.total)}`;
    setQuery(lbl);
    setOpen(false);
    onSelect(opt.id, lbl, opt.customerId);
  }

  return (
    <div className="relative">
      <input
        type="text"
        value={query}
        placeholder="Buscar venta por folio o cliente (mín. 2 caracteres)..."
        onChange={(e) => { setQuery(e.target.value); if (value) onSelect("", "", null); }}
        onFocus={() => { if (results.length > 0) setOpen(true); }}
        className="w-full rounded border border-outline px-3 py-2 text-body-sm bg-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
      />
      {isLoading && (
        <span className="absolute right-3 top-2.5 text-label-sm text-on-surface-variant">Buscando…</span>
      )}
      {open && results.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-surface border border-outline rounded-md shadow-lg max-h-60 overflow-y-auto">
          {results.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => handleSelect(opt)}
              className="w-full px-4 py-3 text-left hover:bg-surface-container-low transition-colors border-b border-outline-variant/40 last:border-0"
            >
              <p className="text-body-sm font-medium text-on-surface font-mono">{opt.folioLabel}</p>
              <p className="text-label-sm text-on-surface-variant">{opt.customerName ?? "Sin cliente"} · {formatMxCurrency(opt.total)}</p>
            </button>
          ))}
        </div>
      )}
      {!open && query.length >= 2 && !isLoading && !value && (
        <p className="mt-1 text-label-sm text-on-surface-variant">Sin resultados para &quot;{query}&quot;</p>
      )}
    </div>
  );
}
