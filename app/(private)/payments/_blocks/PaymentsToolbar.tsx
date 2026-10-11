"use client";

import Link from "next/link";
import { useCurrentUser } from "../../../_hooks/useCurrentUser";
import { Button } from "../../../_components/atoms/Button/Button";
import { Select } from "../../../_components/atoms/Select/Select";
import type { PaymentStatus } from "../_logic/types/domain";

interface PaymentsToolbarProps {
  search: string;
  onSearchChange: (v: string) => void;
  branchId: string;
  onBranchChange: (v: string) => void;
  branches: { id: string; name: string }[];
  showBranchFilter: boolean;
  status: PaymentStatus | "";
  onStatusChange: (v: PaymentStatus | "") => void;
  from: string;
  to: string;
  onFromChange: (v: string) => void;
  onToChange: (v: string) => void;
  onReset: () => void;
}

export function PaymentsToolbar({
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
}: PaymentsToolbarProps) {
  const { can } = useCurrentUser();
  const canReport = can("payments:report_read");

  const hasFilters = !!search || !!branchId || !!status || !!from || !!to;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex-1 min-w-[200px] relative">
        <input
          type="search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Buscar por folio de venta o cliente... (mín. 2)"
          className="w-full rounded-md border border-outline bg-surface px-3 py-2 text-body-sm text-on-surface focus:outline-none focus:border-primary"
        />
        {search.length > 0 && search.length < 2 && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-secondary-container text-on-secondary-container px-2 py-0.5 text-label-sm">
            Búsqueda en servidor · 2+ caracteres
          </span>
        )}
      </div>

      <Select
        value={status}
        onChange={(e) => onStatusChange(e.target.value as PaymentStatus | "")}
        className="w-auto"
        aria-label="Estado"
      >
        <option value="">Todos</option>
        <option value="completed">Completados</option>
        <option value="cancelled">Cancelados</option>
      </Select>

      {showBranchFilter && (
        <Select
          value={branchId}
          onChange={(e) => onBranchChange(e.target.value)}
          className="w-auto"
          aria-label="Sucursal"
        >
          <option value="">Todas las sucursales</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </Select>
      )}

      <div className="flex items-center gap-2">
        <input
          type="date"
          value={from}
          onChange={(e) => onFromChange(e.target.value)}
          className="rounded-md border border-outline px-3 py-2 text-body-sm bg-surface focus:outline-none focus:border-primary"
          aria-label="Desde"
        />
        <span className="text-on-surface-variant text-body-sm">—</span>
        <input
          type="date"
          value={to}
          onChange={(e) => onToChange(e.target.value)}
          className="rounded-md border border-outline px-3 py-2 text-body-sm bg-surface focus:outline-none focus:border-primary"
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
          Limpiar
        </Button>
      )}

      {(canReport === true || canReport === "loading") && (
        <Link
          href="/payments/history"
          className="rounded-full border border-outline px-4 py-2 text-label-sm font-medium text-on-surface hover:bg-surface-container-low transition-colors"
        >
          Historial
        </Link>
      )}
    </div>
  );
}
