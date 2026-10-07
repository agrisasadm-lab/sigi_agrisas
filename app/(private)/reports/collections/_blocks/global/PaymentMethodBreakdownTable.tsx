"use client";

import type { CashCutPaymentMethodBreakdownDto } from "../../_logic/global/types/api";
import { formatMxCurrency } from "../../../../../_lib/formatMxCurrency";

function money(v: string): string {
  return formatMxCurrency(Number(v));
}

export function PaymentMethodBreakdownTable({ rows }: { rows: CashCutPaymentMethodBreakdownDto[] }) {
  return (
    <div className="space-y-2">
      <h3 className="text-title-sm font-medium text-on-surface">Desglose por forma de pago</h3>
      <div className="overflow-x-auto rounded-lg border border-outline-variant bg-surface-container-low">
        <table className="w-full text-body-sm">
          <thead>
            <tr className="border-b border-outline-variant text-label-sm text-on-surface-variant uppercase tracking-wide">
              <th className="px-4 py-3 text-left font-medium">Forma de pago</th>
              <th className="px-4 py-3 text-right font-medium">Conteo</th>
              <th className="px-4 py-3 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-4 text-center text-on-surface-variant">Sin datos</td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.paymentMethodId} className="border-b border-outline-variant/40">
                  <td className="px-4 py-3">{r.label}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-on-surface-variant">{r.count}</td>
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
