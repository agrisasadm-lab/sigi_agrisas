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
import { Table, THead, TBody, Tr, Th, Td } from "../../../_components/molecules/DataTable/DataTable";

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
    <Tr hoverable={false} className={`border-b border-outline-variant/40 ${indented ? "border-l-2 border-l-primary/30" : ""}`}>
      <Td className="px-3 tabular-nums text-on-surface-variant">{fmtDate(m.date)}</Td>
      <Td className={`px-3 whitespace-nowrap ${indented ? "pl-6 text-on-surface-variant" : ""}`}>
        {TYPE_LABEL[m.type]}
      </Td>
      <Td className="px-3 font-mono text-on-surface-variant">{m.serie}</Td>
      <Td align="right" className="px-3 font-mono text-on-surface-variant">{m.factura}</Td>
      <Td className="px-3 tabular-nums text-on-surface-variant">{fmtDate(m.dueDate)}</Td>
      <Td align="right" className="px-3">{Number(m.debit) ? money(m.debit) : "—"}</Td>
      <Td align="right" className="px-3">{Number(m.credit) ? money(m.credit) : "—"}</Td>
      <Td align="right" className="px-3 font-medium">{money(m.runningBalance)}</Td>
      <Td className="px-3 text-on-surface-variant">{m.paymentMethodCode ?? "—"}</Td>
      <Td className="px-3 text-on-surface-variant">{m.reference ?? "—"}</Td>
      <Td className="px-3">
        {m.status === "cancelled" ? (
          <span className="rounded-full bg-error-container/40 px-2 py-0.5 text-label-sm text-error">Cancelado</span>
        ) : (
          <span className="text-on-surface-variant">{m.status}</span>
        )}
      </Td>
      <Td className="px-3 text-center">
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
      </Td>
    </Tr>
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
      <Table>
        <THead>
          <Tr hoverable={false}>
            <Th className="px-3">Fecha</Th>
            <Th className="px-3">Tipo</Th>
            <Th className="px-3">Ser</Th>
            <Th align="right" className="px-3">Factura</Th>
            <Th className="px-3">Vencimiento</Th>
            <Th align="right" className="px-3">Cargo</Th>
            <Th align="right" className="px-3">Abono</Th>
            <Th align="right" className="px-3">Saldo</Th>
            <Th className="px-3">F.Pgo</Th>
            <Th className="px-3">Referencia</Th>
            <Th className="px-3">Estado</Th>
            <Th className="px-3 text-center">Anticipo</Th>
          </Tr>
        </THead>
        <TBody>
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
                <Tr key={`orphan-header-${gi}`} hoverable={false}>
                  <Td colSpan={12} className="px-3 py-2 text-label-sm font-medium text-on-surface-variant bg-surface-container">
                    Abonos sin venta visible en el rango
                  </Td>
                </Tr>
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
        </TBody>
        <tfoot>
          <Tr hoverable={false} className="border-t-2 border-outline-variant bg-surface-container font-medium">
            <Td colSpan={5} className="px-3 text-label-sm text-on-surface-variant">
              {totals.movementCount} movimientos
            </Td>
            <Td align="right" className="px-3">{money(totals.totalDebit)}</Td>
            <Td align="right" className="px-3">{money(totals.totalCredit)}</Td>
            <Td align="right" className="px-3">{money(closingBalance)}</Td>
            <Td colSpan={4} className="px-3" />
          </Tr>
        </tfoot>
      </Table>
    </div>
  );
}
