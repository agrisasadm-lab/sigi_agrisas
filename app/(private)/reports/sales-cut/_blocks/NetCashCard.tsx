"use client";

import type { SalesCutReportDto } from "../_logic/types/api";
import { formatMxCurrency } from "../../../../_lib/formatMxCurrency";

function money(v: string): string {
  return formatMxCurrency(Number(v));
}

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={strong ? "text-title-sm font-semibold text-on-surface" : "text-body-sm text-on-surface-variant"}>
        {label}
      </span>
      <span className={`tabular-nums ${strong ? "text-title-md font-semibold text-on-surface" : "text-body-sm text-on-surface-variant"}`}>
        {value}
      </span>
    </div>
  );
}

export function NetCashCard({ cash }: { cash: SalesCutReportDto["cash"] }) {
  return (
    <div className="space-y-2 rounded-lg border border-outline-variant bg-surface-container px-5 py-4 max-w-md">
      <h3 className="text-title-sm font-medium text-on-surface">Neto de caja</h3>
      <Line label="Ventas" value={money(cash.grossSales)} />
      <Line label="+ Abonos cobrados" value={money(cash.paymentsReceived)} />
      <Line label="− Devoluciones" value={money(cash.returnsRefunded)} />
      <div className="border-t border-outline-variant pt-2">
        <Line label="Neto" value={money(cash.netCash)} strong />
      </div>
    </div>
  );
}
