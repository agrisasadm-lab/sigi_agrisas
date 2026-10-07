"use client";

import { Card as BaseCard } from "../../../../../_components/molecules/Card/Card";
import type { CashCutReportDto } from "../../_logic/global/types/api";
import { formatMxCurrency } from "../../../../../_lib/formatMxCurrency";

function money(v: string): string {
  return formatMxCurrency(Number(v));
}

function Card({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <BaseCard className="flex flex-col">
      <span className="text-label-sm text-on-surface-variant">{label}</span>
      <span className="text-title-md font-semibold text-on-surface tabular-nums">{value}</span>
      {sub && <span className="text-label-sm text-on-surface-variant">{sub}</span>}
    </BaseCard>
  );
}

export function TotalsCards({ report }: { report: CashCutReportDto }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      <Card label="Total cobrado" value={money(report.totals.totalCollected)} sub={`${report.rows.length} abonos`} />
      <Card label="Total IVA" value={money(report.totals.totalIva)} />
    </div>
  );
}
