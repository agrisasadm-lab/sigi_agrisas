"use client";

import Link from "next/link";
import { SaleStatusBadge } from "./SaleStatusBadge";
import { SalePaymentStatusBadge } from "./SalePaymentStatusBadge";
import { Skeleton } from "../../../_components/atoms/Skeleton/Skeleton";
import type { SaleSummary } from "../_logic/types/domain";
import { useTableKeyboard } from "../../../_hooks/useTableKeyboard";
import { formatMxCurrency } from "../../../_lib/formatMxCurrency";
import { fmtDateTimeShort } from "../../../_lib/formatDate";

function fmt(n: number) { return formatMxCurrency(n); }

function fmtDate(d: Date) {
  return fmtDateTimeShort(d);
}

interface SalesTableProps {
  items: SaleSummary[];
  isLoading: boolean;
  onEnter?: (item: SaleSummary) => void;
}

export function SalesTable({ items, isLoading, onEnter }: SalesTableProps) {
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
        Sin ventas registradas
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
            <th className="px-4 py-3 text-left font-medium">Cobro</th>
            <th className="px-4 py-3 text-left font-medium">Cliente</th>
            <th className="px-4 py-3 text-left font-medium">Cajero</th>
            <th className="px-4 py-3 text-left font-medium">Sucursal</th>
            <th className="px-4 py-3 text-right font-medium">Total</th>
            <th className="px-4 py-3 text-left font-medium">Fecha</th>
          </tr>
        </thead>
        <tbody>
          {items.map((sale, idx) => {
            const folioLabel = sale.folioPrefix
              ? `${sale.folioPrefix}-${sale.folioNumber}`
              : String(sale.folioNumber);
            return (
              <tr
                key={sale.id}
                {...getRowProps(idx)}
                className="border-b border-outline-variant/40 hover:bg-surface-container-low focus:bg-surface-container focus:outline-none transition-colors cursor-default"
              >
                <td className="px-4 py-3">
                  <Link
                    href={`/sales/${sale.id}`}
                    className="font-mono text-primary hover:text-primary/80 underline"
                  >
                    {folioLabel}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <SaleStatusBadge status={sale.status} />
                </td>
                <td className="px-4 py-3">
                  <SalePaymentStatusBadge status={sale.paymentStatus} isCredit={sale.isCredit} />
                </td>
                <td className="px-4 py-3 max-w-[160px] truncate text-on-surface-variant">
                  {sale.customerName ?? "—"}
                </td>
                <td className="px-4 py-3 max-w-[140px] truncate text-on-surface-variant">
                  {sale.cashierName ?? sale.cashierId.slice(0, 8)}
                </td>
                <td className="px-4 py-3 max-w-[140px] truncate text-on-surface-variant">
                  {sale.branchName ?? "—"}
                </td>
                <td className="px-4 py-3 text-right tabular-nums font-medium">
                  {fmt(sale.total)}
                </td>
                <td className="px-4 py-3 text-on-surface-variant tabular-nums">
                  {fmtDate(sale.createdAt)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
