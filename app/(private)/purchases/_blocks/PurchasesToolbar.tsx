"use client";

import { useState } from "react";
import { Button } from "../../../_components/atoms/Button/Button";
import { Select } from "../../../_components/atoms/Select/Select";
import { Combobox } from "../../../_components/molecules/Combobox/Combobox";
import { CreateButton } from "../../../_components/molecules/CreateButton/CreateButton";
import { useDebounce } from "../../../_hooks/useDebounce";
import { useProviderSearch } from "../_logic/hooks/useProviderSearch";
import type { PurchaseStatus } from "../_logic/types/api";

interface PurchasesToolbarProps {
  providerId: string;
  onProviderChange: (v: string) => void;
  branchId: string;
  onBranchChange: (v: string) => void;
  branches: { id: string; name: string }[];
  showBranchFilter: boolean;
  statusFilter: PurchaseStatus[];
  onStatusChange: (v: PurchaseStatus[]) => void;
  from: string;
  to: string;
  onFromChange: (v: string) => void;
  onToChange: (v: string) => void;
  onReset: () => void;
  canCreate?: boolean;
}

const STATUS_OPTIONS: { value: PurchaseStatus; label: string }[] = [
  { value: "completed", label: "Activa" },
  { value: "cancelled", label: "Cancelada" },
];

export function PurchasesToolbar({
  providerId,
  onProviderChange,
  branchId,
  onBranchChange,
  branches,
  showBranchFilter,
  statusFilter,
  onStatusChange,
  from,
  to,
  onFromChange,
  onToChange,
  onReset,
  canCreate = false,
}: PurchasesToolbarProps) {
  const [providerQuery, setProviderQuery] = useState("");
  const debouncedProviderQuery = useDebounce(providerQuery, 300);
  const { items: providerOptions, isLoading: isLoadingProviders } = useProviderSearch({ search: debouncedProviderQuery });

  const providerComboOptions = providerOptions.map((p) => ({ value: p.id, label: `${p.name} · ${p.rfc}` }));

  function toggleStatus(val: PurchaseStatus) {
    onStatusChange(
      statusFilter.includes(val)
        ? statusFilter.filter((s) => s !== val)
        : [...statusFilter, val]
    );
  }

  const hasFilters = !!providerId || !!branchId || statusFilter.length > 0 || !!from || !!to;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex-1 min-w-[220px]">
        <Combobox
          value={providerId}
          onChange={onProviderChange}
          onSearch={setProviderQuery}
          options={providerComboOptions}
          isLoading={isLoadingProviders}
          placeholder="Buscar proveedor... (mín. 2 caracteres)"
        />
      </div>

      {showBranchFilter && (
        <Select
          value={branchId}
          onChange={(e) => onBranchChange(e.target.value)}
          className="w-auto"
          aria-label="Filtrar por sucursal"
        >
          <option value="">Todas las sucursales</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </Select>
      )}

      <div className="flex gap-1">
        {STATUS_OPTIONS.map((s) => (
          <Button
            key={s.value}
            type="button"
            variant="filled"
            onClick={() => toggleStatus(s.value)}
            className={
              statusFilter.includes(s.value)
                ? "px-3 py-1 text-label-sm"
                : "px-3 py-1 text-label-sm bg-surface-container-low text-on-surface hover:bg-surface-container"
            }
          >
            {s.label}
          </Button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <input
          type="date"
          value={from}
          onChange={(e) => onFromChange(e.target.value)}
          className="rounded border border-outline px-3 py-2 text-body-sm bg-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          aria-label="Desde"
        />
        <span className="text-on-surface-variant text-body-sm">—</span>
        <input
          type="date"
          value={to}
          onChange={(e) => onToChange(e.target.value)}
          className="rounded border border-outline px-3 py-2 text-body-sm bg-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          aria-label="Hasta"
        />
      </div>

      {hasFilters && (
        <Button
          type="button"
          variant="text"
          onClick={onReset}
          className="rounded-none p-0 text-label-sm text-on-surface-variant hover:bg-transparent hover:text-on-surface"
        >
          Limpiar filtros
        </Button>
      )}

      {canCreate && <CreateButton label="Nueva compra" href="/purchases/new" />}
    </div>
  );
}
