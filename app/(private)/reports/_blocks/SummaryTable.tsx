"use client";

import type { AccountStatementSummaryRowDto } from "../_logic/types/api";
import { formatMxCurrency } from "../../../_lib/formatMxCurrency";
import { Table, THead, TBody, Tr, Th, Td } from "../../../_components/molecules/DataTable/DataTable";

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
      <Table>
        <THead>
          <Tr hoverable={false}>
            <Th>Código</Th>
            <Th>Cliente</Th>
            <Th align="right">Saldo inicial</Th>
            <Th align="right">Cargado</Th>
            <Th align="right">Abonado</Th>
            <Th align="right">Saldo</Th>
            <Th align="right">Límite</Th>
            <Th align="right">Disponible</Th>
          </Tr>
        </THead>
        <TBody>
          {rows.map((r) => (
            <Tr
              key={r.customerId}
              onClick={() => onRowClick(r.customerId)}
              hoverable={false}
              className="border-b border-outline-variant/40 hover:bg-surface-container-low/60 cursor-pointer transition-colors"
            >
              <Td className="font-mono text-on-surface-variant">{r.customerCode}</Td>
              <Td className="max-w-[220px] truncate">{r.customerName}</Td>
              <Td align="right" className="text-on-surface-variant">{money(r.initialBalance)}</Td>
              <Td align="right" className="text-on-surface-variant">{money(r.totalCharged)}</Td>
              <Td align="right" className="text-on-surface-variant">{money(r.totalPaid)}</Td>
              <Td align="right" className="font-medium">{money(r.currentBalance)}</Td>
              <Td align="right" className="text-on-surface-variant">{money(r.creditLimit)}</Td>
              <Td align="right" className="text-on-surface-variant">{money(r.availableCredit)}</Td>
            </Tr>
          ))}
        </TBody>
      </Table>
    </div>
  );
}
