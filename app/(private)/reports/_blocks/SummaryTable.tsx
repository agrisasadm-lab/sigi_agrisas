"use client";

import type { AccountStatementSummaryRowDto } from "../_logic/types/api";
import { formatMxCurrency } from "../../../_lib/formatMxCurrency";

function money(v: string | null): string {
  return v === null ? "—" : formatMxCurrency(Number(v));
}

interface Props {
  rows: AccountStatementSummaryRowDto[];
  onRowClick: (customerId: string) => void;
}

export function SummaryTable({ rows, onRowClick }: Props) {
  return (
    <div className="overflow-x-auto rounded-lg border border-outline-variant bg-surface-container-low">
      <table className="w-full text-body-sm">
        <thead>
          <tr className="border-b border-outline-variant text-label-sm text-on-surface-variant uppercase tracking-wide">
            <th className="px-4 py-3 text-left font-medium">Código</th>
            <th className="px-4 py-3 text-left font-medium">Cliente</th>
            <th className="px-4 py-3 text-right font-medium">Saldo inicial</th>
            <th className="px-4 py-3 text-right font-medium">Cargado</th>
            <th className="px-4 py-3 text-right font-medium">Abonado</th>
            <th className="px-4 py-3 text-right font-medium">Saldo</th>
            <th className="px-4 py-3 text-right font-medium">Límite</th>
            <th className="px-4 py-3 text-right font-medium">Disponible</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.customerId}
              onClick={() => onRowClick(r.customerId)}
              className="border-b border-outline-variant/40 hover:bg-surface-container-low/60 cursor-pointer transition-colors"
            >
              <td className="px-4 py-3 font-mono text-on-surface-variant">{r.customerCode}</td>
              <td className="px-4 py-3 max-w-[220px] truncate">{r.customerName}</td>
              <td className="px-4 py-3 text-right tabular-nums text-on-surface-variant">{money(r.initialBalance)}</td>
              <td className="px-4 py-3 text-right tabular-nums text-on-surface-variant">{money(r.totalCharged)}</td>
              <td className="px-4 py-3 text-right tabular-nums text-on-surface-variant">{money(r.totalPaid)}</td>
              <td className="px-4 py-3 text-right tabular-nums font-medium">{money(r.currentBalance)}</td>
              <td className="px-4 py-3 text-right tabular-nums text-on-surface-variant">{money(r.creditLimit)}</td>
              <td className="px-4 py-3 text-right tabular-nums text-on-surface-variant">{money(r.availableCredit)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
