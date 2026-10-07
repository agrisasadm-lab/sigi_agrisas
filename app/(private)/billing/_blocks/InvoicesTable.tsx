"use client";

import Link from "next/link";
import { InvoiceStatusBadge } from "./InvoiceStatusBadge";
import { Skeleton } from "../../../_components/atoms/Skeleton/Skeleton";
import type { Invoice } from "../_logic/types/domain";
import { formatMxCurrency } from "../../../_lib/formatMxCurrency";
import { fmtDateShort } from "../../../_lib/formatDate";

function fmt(n: number) { return formatMxCurrency(n); }
function fmtDate(d: Date) { return fmtDateShort(d); }

interface InvoicesTableProps {
  items: Invoice[];
  isLoading: boolean;
  showBranch: boolean;
}

export function InvoicesTable({ items, isLoading, showBranch }: InvoicesTableProps) {
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
        Sin facturas registradas
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-body-sm">
        <thead>
          <tr className="border-b border-outline-variant text-label-sm text-on-surface-variant uppercase tracking-wide">
            <th className="px-4 py-3 text-left font-medium">Folio fiscal</th>
            <th className="px-4 py-3 text-left font-medium">Receptor</th>
            {showBranch && <th className="px-4 py-3 text-left font-medium">Sucursal</th>}
            <th className="px-4 py-3 text-right font-medium">Total</th>
            <th className="px-4 py-3 text-left font-medium">Fecha</th>
            <th className="px-4 py-3 text-left font-medium">Estado</th>
            <th className="px-4 py-3 text-left font-medium">Acción</th>
          </tr>
        </thead>
        <tbody>
          {items.map((inv) => (
            <tr
              key={inv.id}
              className="border-b border-outline-variant/40 hover:bg-surface-container-low transition-colors"
            >
              <td className="px-4 py-3 font-mono text-label-sm text-on-surface-variant truncate max-w-[160px]">
                {inv.uuid ?? "—"}
              </td>
              <td className="px-4 py-3">
                <p className="text-on-surface">{inv.receiverName}</p>
                <p className="text-label-sm text-on-surface-variant">{inv.receiverRfc}</p>
              </td>
              {showBranch && (
                <td className="px-4 py-3 text-on-surface-variant">
                  {inv.branchId.slice(0, 8)}
                </td>
              )}
              <td className="px-4 py-3 text-right tabular-nums font-medium">
                {fmt(inv.total)}
              </td>
              <td className="px-4 py-3 text-on-surface-variant tabular-nums">
                {fmtDate(inv.createdAt)}
              </td>
              <td className="px-4 py-3">
                <InvoiceStatusBadge status={inv.status} />
              </td>
              <td className="px-4 py-3">
                <Link
                  href={`/billing/${inv.id}`}
                  className="text-label-sm text-primary hover:text-primary/80 font-medium transition-colors"
                >
                  Ver
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
