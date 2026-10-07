"use client";

import Link from "next/link";
import { QuoteStatusBadge } from "./QuoteStatusBadge";
import { Skeleton } from "../../../_components/atoms/Skeleton/Skeleton";
import { cn } from "../../../_lib/cn";
import type { Quote } from "../_logic/types/domain";
import { useTableKeyboard } from "../../../_hooks/useTableKeyboard";
import { formatMxCurrency } from "../../../_lib/formatMxCurrency";
import { fmtDateShort } from "../../../_lib/formatDate";

function fmt(n: number) { return formatMxCurrency(n); }
function fmtDate(d: Date | null | undefined) {
  if (!d) return "—";
  return fmtDateShort(d);
}

interface QuotesTableProps {
  items: Quote[];
  isLoading: boolean;
  showBranch: boolean;
  onEnter?: (item: Quote) => void;
}

export function QuotesTable({ items, isLoading, showBranch, onEnter }: QuotesTableProps) {
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
        Sin cotizaciones registradas
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-body-sm">
        <thead>
          <tr className="border-b border-outline-variant text-label-sm text-on-surface-variant uppercase tracking-wide">
            <th className="px-4 py-3 text-left font-medium">Folio</th>
            <th className="px-4 py-3 text-left font-medium">Estado</th>
            <th className="px-4 py-3 text-left font-medium">Cliente</th>
            <th className="px-4 py-3 text-left font-medium">Vendedor</th>
            {showBranch && <th className="px-4 py-3 text-left font-medium">Sucursal</th>}
            <th className="px-4 py-3 text-right font-medium">Total</th>
            <th className="px-4 py-3 text-left font-medium">Vencimiento</th>
            <th className="px-4 py-3 text-left font-medium">Fecha</th>
          </tr>
        </thead>
        <tbody>
          {items.map((q, idx) => {
            const folioLabel = q.folioPrefix
              ? `${q.folioPrefix}-${q.folioNumber}`
              : String(q.folioNumber);
            return (
              <tr
                key={q.id}
                {...getRowProps(idx)}
                className={cn(
                  "border-b border-outline-variant/40 hover:bg-surface-container-low focus:bg-surface-container focus:outline-none transition-colors cursor-default",
                  q.isExpired && "bg-error-container/10",
                )}
              >
                <td className="px-4 py-3">
                  <Link
                    href={`/quotes/${q.id}`}
                    className="font-mono text-primary hover:text-primary/80 underline"
                  >
                    {folioLabel}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-col gap-1">
                    <QuoteStatusBadge status={q.status as "draft" | "authorized" | "converted" | "cancelled"} isExpired={q.isExpired} />
                    {q.status === "converted" && q.convertedSaleId && (
                      <Link
                        href={`/sales/${q.convertedSaleId}`}
                        className="text-label-sm text-primary hover:text-primary/80 underline"
                      >
                        Ver venta
                      </Link>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 max-w-[160px] truncate text-on-surface-variant">
                  {q.customerName ?? "—"}
                </td>
                <td className="px-4 py-3 max-w-[140px] truncate text-on-surface-variant">
                  {q.creatorName ?? q.creatorId?.slice(0, 8) ?? "—"}
                </td>
                {showBranch && (
                  <td className="px-4 py-3 max-w-[140px] truncate text-on-surface-variant">
                    {q.branchName ?? "—"}
                  </td>
                )}
                <td className="px-4 py-3 text-right tabular-nums font-medium">
                  {fmt(q.total)}
                </td>
                <td className="px-4 py-3 text-on-surface-variant tabular-nums">
                  {q.isExpired ? (
                    <span className="text-error font-medium">{fmtDate(q.expiresAt)}</span>
                  ) : (
                    fmtDate(q.expiresAt)
                  )}
                </td>
                <td className="px-4 py-3 text-on-surface-variant tabular-nums">
                  {fmtDate(q.createdAt)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
