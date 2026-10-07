"use client";

import Link from "next/link";
import { PaymentStatusBadge } from "./PaymentStatusBadge";
import { Skeleton } from "../../../_components/atoms/Skeleton/Skeleton";
import type { Payment } from "../_logic/types/domain";
import { useTableKeyboard } from "../../../_hooks/useTableKeyboard";
import { formatMxCurrency } from "../../../_lib/formatMxCurrency";
import { fmtDateTimeShort } from "../../../_lib/formatDate";

function fmt(n: number) { return formatMxCurrency(n); }
function fmtDate(d: Date) {
  return fmtDateTimeShort(d);
}

interface PaymentsTableProps {
  items: Payment[];
  isLoading: boolean;
  showBranch: boolean;
  onEnter?: (item: Payment) => void;
}

export function PaymentsTable({ items, isLoading, showBranch, onEnter }: PaymentsTableProps) {
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

  if (items.length === 0) return null;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-body-sm">
        <thead>
          <tr className="border-b border-outline-variant text-label-sm text-on-surface-variant uppercase tracking-wide">
            <th className="px-4 py-3 text-left font-medium">Folio recibo</th>
            <th className="px-4 py-3 text-left font-medium">Folio venta</th>
            <th className="px-4 py-3 text-left font-medium">Cliente</th>
            <th className="px-4 py-3 text-left font-medium">Cobrador</th>
            <th className="px-4 py-3 text-left font-medium">Método</th>
            {showBranch && <th className="px-4 py-3 text-left font-medium">Sucursal</th>}
            <th className="px-4 py-3 text-right font-medium">Monto</th>
            <th className="px-4 py-3 text-right font-medium">Monto total</th>
            <th className="px-4 py-3 text-right font-medium">Saldo pendiente</th>
            <th className="px-4 py-3 text-left font-medium">Fecha</th>
            <th className="px-4 py-3 text-left font-medium">Estado</th>
            <th className="px-4 py-3 text-left font-medium">Acción</th>
          </tr>
        </thead>
        <tbody>
          {items.map((p, idx) => {
            const folioLabel = p.folioPrefix
              ? `${p.folioPrefix}${p.folioNumber}`
              : String(p.folioNumber);
            return (
              <tr
                key={p.id}
                {...getRowProps(idx)}
                className="border-b border-outline-variant/40 hover:bg-surface-container-low focus:bg-surface-container focus:outline-none transition-colors cursor-default"
              >
                <td className="px-4 py-3 font-mono text-on-surface-variant">{folioLabel}</td>
                <td className="px-4 py-3">
                  {p.saleFolioCode ? (
                    <Link href={`/sales/${p.saleId}`} className="text-primary hover:underline">
                      {p.saleFolioCode}
                    </Link>
                  ) : "—"}
                </td>
                <td className="px-4 py-3 max-w-[140px] truncate text-on-surface-variant">
                  {p.customerName ?? "—"}
                </td>
                <td className="px-4 py-3 max-w-[140px] truncate text-on-surface-variant">
                  {p.userName ?? "—"}
                </td>
                <td className="px-4 py-3 text-on-surface-variant">{p.paymentMethodName ?? "—"}</td>
                {showBranch && (
                  <td className="px-4 py-3 text-on-surface-variant">{p.branchName ?? "—"}</td>
                )}
                <td className="px-4 py-3 text-right tabular-nums font-medium">{fmt(p.amount)}</td>
                <td className="px-4 py-3 text-right tabular-nums text-on-surface-variant">{fmt(p.saleTotal)}</td>
                <td className="px-4 py-3 text-right tabular-nums text-on-surface-variant">{fmt(p.saleDueAmount)}</td>
                <td className="px-4 py-3 text-on-surface-variant tabular-nums">{fmtDate(p.createdAt)}</td>
                <td className="px-4 py-3">
                  <PaymentStatusBadge status={p.status} salePaymentStatus={p.salePaymentStatus} />
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/payments/${p.id}`}
                    className="text-label-sm text-primary hover:underline"
                  >
                    Ver
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
