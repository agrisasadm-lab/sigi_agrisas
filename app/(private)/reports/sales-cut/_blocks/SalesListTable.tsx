"use client";

import type { SaleListRowDto } from "../_logic/types/api";
import { formatMxCurrency } from "../../../../_lib/formatMxCurrency";

function money(v: string): string {
  return formatMxCurrency(Number(v));
}

export function SalesListTable({ rows }: { rows: SaleListRowDto[] }) {
  return (
    <div className="space-y-2">
      <h3 className="text-title-sm font-medium text-on-surface">Detalle de tickets</h3>
      <div className="overflow-x-auto rounded-lg border border-outline-variant bg-surface-container-low">
        <table className="w-full text-body-sm">
          <thead>
            <tr className="border-b border-outline-variant text-label-sm text-on-surface-variant uppercase tracking-wide">
              <th className="px-4 py-3 text-left font-medium">Ticket</th>
              <th className="px-4 py-3 text-left font-medium">Cliente</th>
              <th className="px-4 py-3 text-right font-medium">Importe</th>
              <th className="px-4 py-3 text-left font-medium">Forma de pago</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-4 text-center text-on-surface-variant">Sin ventas</td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.saleId} className="border-b border-outline-variant/40">
                  <td className="px-4 py-3">{r.folioCode}</td>
                  <td className="px-4 py-3">{r.customerName ?? "—"}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-medium">{money(r.total)}</td>
                  <td className="px-4 py-3">{r.paymentMethodName}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
