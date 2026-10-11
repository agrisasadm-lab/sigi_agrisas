"use client";

import { Button } from "../../../_components/atoms/Button/Button";
import { Select } from "../../../_components/atoms/Select/Select";
import { SearchInput } from "../../../_components/molecules/SearchInput/SearchInput";
import { CreateButton } from "../../../_components/molecules/CreateButton/CreateButton";

interface BranchOption {
  id: string;
  name: string;
}

interface QuotesToolbarProps {
  search: string;
  onSearchChange: (v: string) => void;
  branchId: string;
  onBranchChange: (v: string) => void;
  branches: BranchOption[];
  showBranchFilter: boolean;
  status: string;
  onStatusChange: (v: string) => void;
  from: string;
  to: string;
  onFromChange: (v: string) => void;
  onToChange: (v: string) => void;
  onReset: () => void;
  canCreate?: boolean;
}

export function QuotesToolbar({
  search,
  onSearchChange,
  branchId,
  onBranchChange,
  branches,
  showBranchFilter,
  status,
  onStatusChange,
  from,
  to,
  onFromChange,
  onToChange,
  onReset,
  canCreate = false,
}: QuotesToolbarProps) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[200px]">
          <SearchInput
            value={search}
            onChange={onSearchChange}
            placeholder="Buscar por folio, cliente, RFC..."
          />
          <p className="text-label-sm text-on-surface-variant mt-1">
            Búsqueda en servidor · 2+ caracteres
          </p>
        </div>

        <Select value={status} onChange={(e) => onStatusChange(e.target.value)} className="w-auto">
          <option value="">Todos los estados</option>
          <option value="draft">Borrador</option>
          <option value="authorized">Autorizada</option>
          <option value="converted">Convertida</option>
          <option value="cancelled">Cancelada</option>
          <option value="expired">Vencida</option>
        </Select>

        {showBranchFilter && (
          <Select value={branchId} onChange={(e) => onBranchChange(e.target.value)} className="w-auto">
            <option value="">Todas las sucursales</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </Select>
        )}

        <input
          type="date"
          value={from}
          onChange={(e) => onFromChange(e.target.value)}
          title="Desde"
          className="rounded border border-outline px-3 py-2 text-body-sm bg-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
        />
        <input
          type="date"
          value={to}
          onChange={(e) => onToChange(e.target.value)}
          title="Hasta"
          className="rounded border border-outline px-3 py-2 text-body-sm bg-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
        />

        <Button
          type="button"
          variant="outlined"
          onClick={onReset}
          className="rounded px-3 py-2 text-body-sm text-on-surface-variant"
        >
          Limpiar
        </Button>

        {canCreate && <CreateButton label="Nueva cotización" href="/quotes/new" />}
      </div>
    </div>
  );
}
