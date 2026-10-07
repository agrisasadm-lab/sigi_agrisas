"use client";

import { useRouter } from "next/navigation";
import { PurchaseStatusBadge } from "./PurchaseStatusBadge";
import { Skeleton } from "../../../_components/atoms/Skeleton/Skeleton";
import type { Purchase } from "../_logic/types/domain";
import { useTableKeyboard } from "../../../_hooks/useTableKeyboard";
import { formatMxCurrency } from "../../../_lib/formatMxCurrency";
import { fmtDateShort } from "../../../_lib/formatDate";

function fmt(n: number) { return formatMxCurrency(n); }
function fmtDate(d: Date) { return fmtDateShort(d); }

interface PurchasesTableProps {
  items: Purchase[];
  isLoading: boolean;
  showBranch: boolean;
  onEnter?: (item: Purchase) => void;
}

export function PurchasesTable({ items, isLoading, showBranch, onEnter }: PurchasesTableProps) {
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
        Sin compras registradas
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-body-sm">
        <thead>
          <tr className="border-b border-outline-variant text-label-sm text-on-surface-variant uppercase tracking-wide">
            <th className="px-4 py-3 text-left font-medium">Folio</th>
            <th className="px-4 py-3 text-left font-medium">Proveedor</th>
            {showBranch && <th className="px-4 py-3 text-left font-medium">Sucursal</th>}
            <th className="px-4 py-3 text-right font-medium">Total</th>
            <th className="px-4 py-3 text-left font-medium">Forma de pago</th>
            <th className="px-4 py-3 text-left font-medium">Fecha</th>
            <th className="px-4 py-3 text-left font-medium">Estado</th>
            <th className="px-4 py-3 text-left font-medium">Acción</th>
          </tr>
        </thead>
        <tbody>
          {items.map((p, idx) => (
            <tr
              key={p.id}
              {...getRowProps(idx)}
              className="border-b border-outline-variant/40 hover:bg-surface-container-low focus:bg-surface-container focus:outline-none transition-colors cursor-default"
            >
              <td className="px-4 py-3 font-mono text-on-surface">{p.folioCode}</td>
              <td className="px-4 py-3">
                <p className="text-on-surface truncate max-w-[160px]">{p.providerName ?? "—"}</p>
                {p.providerRfc && <p className="text-label-sm text-on-surface-variant truncate">{p.providerRfc}</p>}
              </td>
              {showBranch && (
                <td className="px-4 py-3 text-on-surface-variant truncate max-w-[120px]">{p.branchName ?? "—"}</td>
              )}
              <td className="px-4 py-3 text-right tabular-nums font-medium">{fmt(p.total)}</td>
              <td className="px-4 py-3 text-on-surface-variant">{p.paymentMethodCode ?? "—"}</td>
              <td className="px-4 py-3 text-on-surface-variant tabular-nums">{fmtDate(p.purchasedAt)}</td>
              <td className="px-4 py-3"><PurchaseStatusBadge status={p.status} /></td>
              <td className="px-4 py-3">
                <button
                  type="button"
                  onClick={() => router.push(`/purchases/${p.id}`)}
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
