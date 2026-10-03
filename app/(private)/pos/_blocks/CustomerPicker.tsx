"use client";

import { useState, useCallback } from "react";
import { Combobox } from "../../../_components/molecules/Combobox/Combobox";
import { useCurrentUser } from "../../../_hooks/useCurrentUser";
import { useDebounce } from "../../../_hooks/useDebounce";
import { useCustomerSearch } from "../_logic/hooks/useCustomerSearch";
import { formatMxCurrency } from "../_logic/lib/formatMxCurrency";
import type { CustomerDto } from "../_logic/types/api";

interface CustomerPickerProps {
  value: string;
  onChange: (customerId: string, customer: CustomerDto | null) => void;
  onOpenQuickAdd: () => void;
  branchId?: string;
}

export function CustomerPicker({ value, onChange, onOpenQuickAdd, branchId }: CustomerPickerProps) {
  const { can } = useCurrentUser();
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery, 300);
  const { items, isLoading } = useCustomerSearch({ search: debouncedSearch, branchId });

  const canWrite = can("customers:write");

  const options = items.map((c) => ({
    value: c.id,
    label: `${c.name} · ${c.rfc}`,
    customer: c,
  }));

  function renderOption(opt: { value: string; label: string; customer: CustomerDto }) {
    const c = opt.customer;
    return (
      <div className="flex items-center justify-between w-full">
        <div>
          <p className="text-body-sm font-medium">{c.name}</p>
          <p className="text-label-sm text-on-surface-variant font-mono">{c.rfc}</p>
        </div>
        {c.currentBalance > 0 && (
          <span className="text-label-sm bg-error-container text-on-error-container rounded-full px-2 py-0.5">
            Adeudo {formatMxCurrency(c.currentBalance)}
          </span>
        )}
      </div>
    );
  }

  const footerSlot =
    canWrite === true ? (
      <button
        type="button"
        onMouseDown={(e) => { e.preventDefault(); onOpenQuickAdd(); }}
        className="w-full px-3 py-2 text-left text-label-sm text-primary hover:bg-primary/5 flex items-center gap-2 transition-colors"
      >
        + Nuevo cliente
      </button>
    ) : null;

  function handleChange(id: string) {
    const found = items.find((c) => c.id === id) ?? null;
    onChange(id, found);
  }

  return (
    <div>
      <label className="text-label-sm text-on-surface-variant mb-1 block">Cliente (opcional)</label>
      <Combobox
        value={value}
        onChange={handleChange}
        onSearch={setSearchQuery}
        options={options}
        isLoading={isLoading}
        placeholder="Buscar por nombre o RFC..."
        renderOption={renderOption}
        footerSlot={footerSlot}
      />
    </div>
  );
}
