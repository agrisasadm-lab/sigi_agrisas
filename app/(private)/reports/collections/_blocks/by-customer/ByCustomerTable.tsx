"use client";

import type { CollectionsByCustomerRowDto } from "../../_logic/by-customer/types/api";
import { formatMxCurrency } from "../../../../../_lib/formatMxCurrency";

function money(v: string): string {
  return formatMxCurrency(Number(v));
}

export function ByCustomerTable({ rows }: { rows: CollectionsByCustomerRowDto[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-outline-variant bg-surface-container-low">
      <table className="w-full text-body-sm">
        <thead>
          <tr className="border-b border-outline-variant text-label-sm text-on-surface-variant uppercase tracking-wide">
            <th className="px-4 py-3 text-left font-medium">Cliente</th>
            <th className="px-4 py-3 text-left font-medium">Código</th>
            <th className="px-4 py-3 text-right font-medium">Abonos</th>
            <th className="px-4 py-3 text-right font-medium">Total</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={4} className="px-4 py-4 text-center text-on-surface-variant">Sin cobranza</td>
            </tr>
          ) : (
            rows.map((r) => (
              <tr key={r.customerId} className="border-b border-outline-variant/40">
                <td className="px-4 py-3">{r.customerName}</td>
                <td className="px-4 py-3">{r.customerCode}</td>
                <td className="px-4 py-3 text-right tabular-nums text-on-surface-variant">{r.count}</td>
                <td className="px-4 py-3 text-right tabular-nums font-medium">{money(r.total)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
