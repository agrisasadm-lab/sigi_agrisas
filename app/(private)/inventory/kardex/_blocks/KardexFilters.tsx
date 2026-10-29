"use client";

import { useState } from "react";
import { Button } from "../../../../_components/atoms/Button/Button";
import { Select } from "../../../../_components/atoms/Select/Select";
import { Combobox } from "../../../../_components/molecules/Combobox/Combobox";
import { Icon } from "../../../../_components/atoms/Icon/Icon";
import { useDebounce } from "../../../../_hooks/useDebounce";
import { useProductSearch } from "../_logic/hooks/useProductSearch";
import type { ProductOptionDto } from "../_logic/types/api";

interface BranchOption {
  id: string;
  name: string;
}

interface KardexFiltersProps {
  productId: string;
  onProductChange: (productId: string, product: ProductOptionDto | null) => void;
  branchId: string;
  onBranchIdChange: (v: string) => void;
  productSearchBranchId?: string;
  branches: BranchOption[];
  showAllBranchesOption: boolean;
  from: string;
  onFromChange: (v: string) => void;
  to: string;
  onToChange: (v: string) => void;
  onSubmit: () => void;
  isSubmitDisabled: boolean;
}

const inputCls =
  "rounded-md border border-outline-variant bg-surface px-3 py-2 text-body-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40";

export function KardexFilters({
  productId,
  onProductChange,
  branchId,
  onBranchIdChange,
  productSearchBranchId,
  branches,
  showAllBranchesOption,
  from,
  onFromChange,
  to,
  onToChange,
  onSubmit,
  isSubmitDisabled,
}: KardexFiltersProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery, 300);
  const { items, isLoading } = useProductSearch(debouncedSearch, productSearchBranchId);

  const options = items.map((p) => ({ value: p.id, label: `${p.code} · ${p.name}`, product: p }));

  function handleProductChange(id: string) {
    const found = items.find((p) => p.id === id) ?? null;
    onProductChange(id, found);
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="min-w-[260px]">
        <label className="text-label-sm text-on-surface-variant mb-1 block">Clave</label>
        <Combobox
          value={productId}
          onChange={handleProductChange}
          onSearch={setSearchQuery}
          options={options}
          isLoading={isLoading}
          placeholder="Buscar por clave o nombre..."
        />
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-label-sm text-on-surface-variant">Almacén</span>
        <Select value={branchId} onChange={(e) => onBranchIdChange(e.target.value)} className="w-auto">
          {showAllBranchesOption && <option value="">Todos</option>}
          {branches.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </Select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-label-sm text-on-surface-variant">Desde</span>
        <input type="date" value={from} onChange={(e) => onFromChange(e.target.value)} className={inputCls} />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-label-sm text-on-surface-variant">Hasta</span>
        <input type="date" value={to} onChange={(e) => onToChange(e.target.value)} className={inputCls} />
      </label>

      <Button
        type="button"
        variant="filled"
        onClick={onSubmit}
        disabled={isSubmitDisabled}
        className="gap-1.5 rounded-md text-label-lg hover:opacity-90"
      >
        <Icon name="search" size={18} />
        Mostrar información
      </Button>
    </div>
  );
}
