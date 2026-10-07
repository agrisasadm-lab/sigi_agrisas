"use client";

import { Card as BaseCard } from "../../../../_components/molecules/Card/Card";
import type { SalesCutReportDto } from "../_logic/types/api";
import { formatMxCurrency } from "../../../../_lib/formatMxCurrency";

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

export function TotalsCards({ report }: { report: SalesCutReportDto }) {
  const t = report.totals;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      <Card label="Ventas" value={money(t.grossSales)} sub={`${t.ticketCount} tickets`} />
      <Card label="Subtotal" value={money(t.subtotal)} />
      <Card label="IVA" value={money(t.ivaTotal)} />
      <Card label="IEPS" value={money(t.iepsTotal)} />
      <Card label="Impuestos" value={money(t.taxTotal)} />
      <Card
        label="Canceladas"
        value={money(report.cancelled.total)}
        sub={`${report.cancelled.count} tickets`}
      />
    </div>
  );
}
