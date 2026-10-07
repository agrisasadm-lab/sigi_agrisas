"use client";

import { Card } from "../../../_components/molecules/Card/Card";
import type { AccountStatementLedgerDto } from "../_logic/types/api";
import { formatMxCurrency } from "../../../_lib/formatMxCurrency";

function money(v: string | null): string {
  return v === null ? "—" : formatMxCurrency(Number(v));
}

function Stat({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <Card className="flex flex-col">
      <span className="text-label-sm text-on-surface-variant">{label}</span>
      <span className={`tabular-nums ${strong ? "text-title-md font-semibold text-on-surface" : "text-title-sm text-on-surface-variant"}`}>
        {value}
      </span>
    </Card>
  );
}

export function LedgerHeader({ ledger }: { ledger: AccountStatementLedgerDto }) {
  const lastInvoice = ledger.lastInvoice
    ? `${ledger.lastInvoice.serie} ${ledger.lastInvoice.folioNumber}`
    : "—";
  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-headline-sm font-semibold text-on-surface">{ledger.customer.name}</h1>
        <p className="font-mono text-body-sm text-on-surface-variant">{ledger.customer.code}</p>
        {ledger.customer.address && (
          <p className="text-body-sm text-on-surface-variant">{ledger.customer.address}</p>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Stat label="Saldo inicial" value={money(ledger.openingBalance)} />
        <Stat label="Saldo actual" value={money(ledger.customer.currentBalance)} strong />
        <Stat label="Límite de crédito" value={money(ledger.customer.creditLimit)} />
        <Stat label="Crédito disponible" value={money(ledger.customer.availableCredit)} />
        <Stat label="Última factura" value={lastInvoice} />
      </div>
    </div>
  );
}
