"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ReturnStatusBadge } from "./ReturnStatusBadge";
import { Skeleton } from "../../../_components/atoms/Skeleton/Skeleton";
import type { Return } from "../_logic/types/domain";
import { useTableKeyboard } from "../../../_hooks/useTableKeyboard";
import { formatMxCurrency } from "../../../_lib/formatMxCurrency";
import { fmtDateShort } from "../../../_lib/formatDate";

function fmt(n: number) { return formatMxCurrency(n); }

function fmtDate(d: Date) {
  return fmtDateShort(d);
}

function initials(name: string) {
  return name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

interface ReturnsTableProps {
  items: Return[];
  isLoading: boolean;
  showBranch: boolean;
  onEnter?: (item: Return) => void;
}

export function ReturnsTable({ items, isLoading, showBranch, onEnter }: ReturnsTableProps) {
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
        Sin devoluciones registradas
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-body-sm">
        <thead>
          <tr className="border-b border-outline-variant text-label-sm text-on-surface-variant uppercase tracking-wide">
            <th className="px-4 py-3 text-left font-medium">Folio venta</th>
            <th className="px-4 py-3 text-left font-medium">Cliente</th>
            {showBranch && <th className="px-4 py-3 text-left font-medium">Sucursal</th>}
            <th className="px-4 py-3 text-left font-medium">Devuelto por</th>
            <th className="px-4 py-3 text-right font-medium">Reembolso</th>
            <th className="px-4 py-3 text-left font-medium">Fecha</th>
            <th className="px-4 py-3 text-left font-medium">Estado</th>
            <th className="px-4 py-3 text-left font-medium">Acción</th>
          </tr>
        </thead>
        <tbody>
          {items.map((ret, idx) => {
            const folioLabel = ret.salefolioCode
              ? `${ret.salefolioCode}-${ret.salefolioNumber}`
              : ret.salefolioNumber
              ? String(ret.salefolioNumber)
              : ret.saleId.slice(0, 8);
            const customerName = ret.customerName ?? "—";
            return (
              <tr
                key={ret.id}
                {...getRowProps(idx)}
                className="border-b border-outline-variant/40 hover:bg-surface-container-low focus:bg-surface-container focus:outline-none transition-colors cursor-default"
              >
                <td className="px-4 py-3">
                  <Link
                    href={`/sales/${ret.saleId}`}
                    className="font-mono text-primary hover:text-primary/80 underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {folioLabel}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-full bg-secondary-container text-on-secondary-container text-label-sm font-semibold flex items-center justify-center flex-shrink-0">
                      {customerName !== "—" ? initials(customerName) : "?"}
                    </span>
                    <div className="min-w-0">
                      <p className="text-on-surface truncate max-w-[120px]">{customerName}</p>
                      {ret.customerRfc && (
                        <p className="text-label-sm text-on-surface-variant truncate">{ret.customerRfc}</p>
                      )}
                    </div>
                  </div>
                </td>
                {showBranch && (
                  <td className="px-4 py-3 text-on-surface-variant truncate max-w-[120px]">
                    {ret.branchName ?? "—"}
                  </td>
                )}
                <td className="px-4 py-3 text-on-surface-variant truncate max-w-[120px]">
                  {ret.creatorName ?? ret.creatorId.slice(0, 8)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums font-medium">
                  {fmt(ret.refundTotal)}
                </td>
                <td className="px-4 py-3 text-on-surface-variant tabular-nums">
                  {fmtDate(ret.returnedAt)}
                </td>
                <td className="px-4 py-3">
                  <ReturnStatusBadge status={ret.status} />
                </td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => router.push(`/returns/${ret.id}`)}
                    className="text-label-sm text-primary hover:text-primary/80 font-medium transition-colors"
                  >
                    Ver
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
