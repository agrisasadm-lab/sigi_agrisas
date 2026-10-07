"use client";

import type { SalesCutBreakdownRowDto } from "../_logic/types/api";
import { formatMxCurrency } from "../../../../_lib/formatMxCurrency";

function money(v: string): string {
  return formatMxCurrency(Number(v));
}

interface Props {
  title: string;
  conceptHeader: string;
  rows: SalesCutBreakdownRowDto[];
  quantityHeader?: string;
}

export function BreakdownTable({ title, conceptHeader, rows, quantityHeader }: Props) {
  const colCount = quantityHeader ? 6 : 5;
  return (
    <div className="space-y-2">
      <h3 className="text-title-sm font-medium text-on-surface">{title}</h3>
      <div className="overflow-x-auto rounded-lg border border-outline-variant bg-surface-container-low">
        <table className="w-full text-body-sm">
          <thead>
            <tr className="border-b border-outline-variant text-label-sm text-on-surface-variant uppercase tracking-wide">
              <th className="px-4 py-3 text-left font-medium">{conceptHeader}</th>
              <th className="px-4 py-3 text-right font-medium">Tickets</th>
              {quantityHeader && <th className="px-4 py-3 text-right font-medium">{quantityHeader}</th>}
              <th className="px-4 py-3 text-right font-medium">Subtotal</th>
              <th className="px-4 py-3 text-right font-medium">Impuestos</th>
              <th className="px-4 py-3 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={colCount} className="px-4 py-4 text-center text-on-surface-variant">Sin datos</td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.key} className="border-b border-outline-variant/40">
                  <td className="px-4 py-3">{r.label}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-on-surface-variant">{r.ticketCount}</td>
                  {quantityHeader && (
                    <td className="px-4 py-3 text-right tabular-nums text-on-surface-variant">
                      {r.quantitySold ?? "0"}
                    </td>
                  )}
                  <td className="px-4 py-3 text-right tabular-nums text-on-surface-variant">{money(r.subtotal)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-on-surface-variant">{money(r.taxTotal)}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-medium">{money(r.total)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
