"use client";

import type { TaxRateOption } from "../../../../_hooks/useTaxRatesOptions";
import { Select } from "../../../../_components/atoms/Select/Select";

interface TaxRateSelectProps {
  value: string | null;
  onChange: (value: string | null) => void;
  options: TaxRateOption[];
  disabled?: boolean;
  className?: string;
}

export function TaxRateSelect({ value, onChange, options, disabled, className }: TaxRateSelectProps) {
  return (
    <Select
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value || null)}
      disabled={disabled}
      className={className}
    >
      <option value="">Sin tasa asignada</option>
      {options.map((tr) => (
        <option key={tr.id} value={tr.id}>
          {tr.code} — {tr.name} ({(tr.rate * 100).toFixed(2)}%)
        </option>
      ))}
    </Select>
  );
}
