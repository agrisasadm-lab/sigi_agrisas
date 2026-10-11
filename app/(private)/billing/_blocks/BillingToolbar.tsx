"use client";

import { Button } from "../../../_components/atoms/Button/Button";
import { Select } from "../../../_components/atoms/Select/Select";
import { SearchInput } from "../../../_components/molecules/SearchInput/SearchInput";
import type { InvoiceStatus } from "../_logic/types/domain";

interface BillingToolbarProps {
  search: string;
  onSearchChange: (v: string) => void;
  branchId: string;
  onBranchChange: (v: string) => void;
  branches: { id: string; name: string }[];
  showBranchFilter: boolean;
  statusFilter?: InvoiceStatus;
  onStatusChange: (v: InvoiceStatus | undefined) => void;
  from: string;
  to: string;
  onFromChange: (v: string) => void;
  onToChange: (v: string) => void;
  onReset: () => void;
}

const STATUS_OPTIONS: { value: InvoiceStatus; label: string }[] = [
  { value: "stamped", label: "Vigente" },
  { value: "cancelled", label: "Cancelada" },
];

export function BillingToolbar({
  search,
  onSearchChange,
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
}: BillingToolbarProps) {
  function toggleStatus(val: InvoiceStatus) {
    onStatusChange(statusFilter === val ? undefined : val);
  }

  const hasFilters = !!search || !!branchId || !!statusFilter || !!from || !!to;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex-1 min-w-[200px]">
        <SearchInput
          value={search}
          onChange={onSearchChange}
          placeholder="Buscar por folio fiscal, receptor o RFC... (mín. 2 caracteres)"
        />
        {search.length > 0 && search.length < 2 && (
          <p className="mt-1 text-label-sm text-on-surface-variant">Escribe al menos 2 caracteres para buscar en servidor</p>
        )}
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
              statusFilter === s.value
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
    </div>
  );
}
