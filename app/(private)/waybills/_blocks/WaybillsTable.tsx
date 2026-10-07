"use client";

import { useRouter } from "next/navigation";
import { WaybillStatusBadge } from "./WaybillStatusBadge";
import { WaybillTypeBadge } from "./WaybillTypeBadge";
import { Skeleton } from "../../../_components/atoms/Skeleton/Skeleton";
import type { WaybillSummary } from "../_logic/types/domain";
import { useTableKeyboard } from "../../../_hooks/useTableKeyboard";
import { fmtDateShort } from "../../../_lib/formatDate";

function fmtDate(d: Date) {
  return fmtDateShort(d);
}

interface WaybillsTableProps {
  items: WaybillSummary[];
  isLoading: boolean;
  branchNameById: Record<string, string>;
  onEnter?: (item: WaybillSummary) => void;
}

export function WaybillsTable({ items, isLoading, branchNameById, onEnter }: WaybillsTableProps) {
  const router = useRouter();
  const noop = () => {};
  const { getRowProps } = useTableKeyboard(items, onEnter ?? noop);

  if (isLoading) {
    return (
      <div className="p-4 space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} height={40} width="100%" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="py-8 text-center text-body-sm text-on-surface-variant">
        Sin traspasos registrados
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-body-sm">
        <thead>
          <tr className="border-b border-outline-variant text-label-sm text-on-surface-variant uppercase tracking-wide">
            <th className="px-4 py-3 text-left font-medium">Folio</th>
            <th className="px-4 py-3 text-left font-medium">Tipo</th>
            <th className="px-4 py-3 text-left font-medium">Origen</th>
            <th className="px-4 py-3 text-left font-medium">Destino</th>
            <th className="px-4 py-3 text-left font-medium">Estado</th>
            <th className="px-4 py-3 text-left font-medium">Fecha</th>
            <th className="px-4 py-3 text-left font-medium">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {items.map((w, idx) => (
            <tr
              key={w.id}
              {...getRowProps(idx)}
              className="border-b border-outline-variant/40 hover:bg-surface-container-low focus:bg-surface-container focus:outline-none transition-colors cursor-default"
            >
              <td className="px-4 py-3 font-mono text-on-surface">{w.folioCode}</td>
              <td className="px-4 py-3">
                <WaybillTypeBadge type={w.type} />
              </td>
              <td className="px-4 py-3 text-on-surface-variant truncate max-w-[140px]">
                {branchNameById[w.originBranchId] ?? w.originBranchId.slice(0, 8)}
              </td>
              <td className="px-4 py-3 text-on-surface-variant truncate max-w-[140px]">
                {w.type === "carta_porte"
                  ? w.destinationCustomerName ?? "Cliente"
                  : w.destinationBranchId
                    ? branchNameById[w.destinationBranchId] ?? w.destinationBranchId.slice(0, 8)
                    : "—"}
              </td>
              <td className="px-4 py-3">
                <WaybillStatusBadge status={w.status} />
              </td>
              <td className="px-4 py-3 text-on-surface-variant tabular-nums">{fmtDate(w.createdAt)}</td>
              <td className="px-4 py-3">
                <button
                  type="button"
                  onClick={() => router.push(`/waybills/${w.id}`)}
                  className="text-label-sm text-primary hover:text-primary/80 font-medium transition-colors"
                >
                  Ver
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
