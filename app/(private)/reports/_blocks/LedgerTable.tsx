"use client";

import { Fragment } from "react";
import type {
  AccountStatementMovementDto,
  AccountStatementLedgerGroupDto,
  AccountMovementType,
} from "../_logic/types/api";
import { Icon } from "../../../_components/atoms/Icon/Icon";
import { formatMxCurrency } from "../../../_lib/formatMxCurrency";
import { fmtDateShort } from "../../../_lib/formatDate";

function money(v: string): string {
  return formatMxCurrency(Number(v));
}
function fmtDate(s: string | null): string {
  if (!s) return "—";
  return fmtDateShort(new Date(s));
}

const TYPE_LABEL: Record<AccountMovementType, string> = {
  sale_credit: "Venta crédito",
  sale_cash: "Venta contado",
  payment: "Abono",
};

interface Props {
  groups: AccountStatementLedgerGroupDto[];
  totals: { movementCount: number; totalDebit: string; totalCredit: string };
  closingBalance: string;
  onPrintAnticipo?: (paymentId: string) => void;
  printingId?: string | null;
}

function MovementRow({
  m,
  indented,
  onPrintAnticipo,
  printingId,
}: {
  m: AccountStatementMovementDto;
  indented: boolean;
  onPrintAnticipo?: (paymentId: string) => void;
  printingId?: string | null;
}) {
  return (
    <tr className={`border-b border-outline-variant/40 ${indented ? "border-l-2 border-l-primary/30" : ""}`}>
      <td className="px-3 py-3 tabular-nums text-on-surface-variant">{fmtDate(m.date)}</td>
      <td className={`px-3 py-3 whitespace-nowrap ${indented ? "pl-6 text-on-surface-variant" : ""}`}>
        {TYPE_LABEL[m.type]}
      </td>
      <td className="px-3 py-3 font-mono text-on-surface-variant">{m.serie}</td>
      <td className="px-3 py-3 text-right tabular-nums font-mono text-on-surface-variant">{m.factura}</td>
      <td className="px-3 py-3 tabular-nums text-on-surface-variant">{fmtDate(m.dueDate)}</td>
      <td className="px-3 py-3 text-right tabular-nums">{Number(m.debit) ? money(m.debit) : "—"}</td>
      <td className="px-3 py-3 text-right tabular-nums">{Number(m.credit) ? money(m.credit) : "—"}</td>
      <td className="px-3 py-3 text-right tabular-nums font-medium">{money(m.runningBalance)}</td>
      <td className="px-3 py-3 text-on-surface-variant">{m.paymentMethodCode ?? "—"}</td>
      <td className="px-3 py-3 text-on-surface-variant">{m.reference ?? "—"}</td>
      <td className="px-3 py-3">
        {m.status === "cancelled" ? (
          <span className="rounded-full bg-error-container/40 px-2 py-0.5 text-label-sm text-error">Cancelado</span>
        ) : (
          <span className="text-on-surface-variant">{m.status}</span>
        )}
      </td>
      <td className="px-3 py-3 text-center">
        {m.type === "payment" && onPrintAnticipo ? (
          <button
            type="button"
            onClick={() => onPrintAnticipo(m.id)}
            disabled={printingId === m.id}
            title="Imprimir anticipo"
            className="inline-flex items-center justify-center rounded-full p-1.5 text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface disabled:opacity-50"
          >
            <Icon name="print" size={18} />
          </button>
        ) : (
          <span className="text-on-surface-variant">—</span>
        )}
      </td>
    </tr>
  );
}

export function LedgerTable({
  groups,
  totals,
  closingBalance,
  onPrintAnticipo,
  printingId,
}: Props) {
  return (
    <div className="overflow-x-auto rounded-lg border border-outline-variant bg-surface-container-low">
      <table className="w-full text-body-sm">
        <thead>
          <tr className="border-b border-outline-variant text-label-sm text-on-surface-variant uppercase tracking-wide">
            <th className="px-3 py-3 text-left font-medium">Fecha</th>
            <th className="px-3 py-3 text-left font-medium">Tipo</th>
            <th className="px-3 py-3 text-left font-medium">Ser</th>
            <th className="px-3 py-3 text-right font-medium">Factura</th>
            <th className="px-3 py-3 text-left font-medium">Vencimiento</th>
            <th className="px-3 py-3 text-right font-medium">Cargo</th>
            <th className="px-3 py-3 text-right font-medium">Abono</th>
            <th className="px-3 py-3 text-right font-medium">Saldo</th>
            <th className="px-3 py-3 text-left font-medium">F.Pgo</th>
            <th className="px-3 py-3 text-left font-medium">Referencia</th>
            <th className="px-3 py-3 text-left font-medium">Estado</th>
            <th className="px-3 py-3 text-center font-medium">Anticipo</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((group, gi) => (
            <Fragment key={group.sale?.id ?? `orphan-${gi}`}>
              {group.sale ? (
                <MovementRow
                  key={group.sale.id}
                  m={group.sale}
                  indented={false}
                  onPrintAnticipo={onPrintAnticipo}
                  printingId={printingId}
                />
              ) : (
                <tr key={`orphan-header-${gi}`}>
                  <td colSpan={12} className="px-3 py-2 text-label-sm font-medium text-on-surface-variant bg-surface-container">
                    Abonos sin venta visible en el rango
                  </td>
                </tr>
              )}
              {group.payments.map((p) => (
                <MovementRow
                  key={p.id}
                  m={p}
                  indented={true}
                  onPrintAnticipo={onPrintAnticipo}
                  printingId={printingId}
                />
              ))}
            </Fragment>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-outline-variant bg-surface-container font-medium">
            <td colSpan={5} className="px-3 py-3 text-label-sm text-on-surface-variant">
              {totals.movementCount} movimientos
            </td>
            <td className="px-3 py-3 text-right tabular-nums">{money(totals.totalDebit)}</td>
            <td className="px-3 py-3 text-right tabular-nums">{money(totals.totalCredit)}</td>
            <td className="px-3 py-3 text-right tabular-nums">{money(closingBalance)}</td>
            <td colSpan={4} />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
