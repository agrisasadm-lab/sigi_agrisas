"use client";

import type { SalesCutBreakdownRowDto } from "../_logic/types/api";
import { formatMxCurrency } from "../../../../_lib/formatMxCurrency";
import { Table, THead, TBody, Tr, Th, Td } from "../../../../_components/molecules/DataTable/DataTable";

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
        <Table>
          <THead>
            <Tr hoverable={false}>
              <Th>{conceptHeader}</Th>
              <Th align="right">Tickets</Th>
              {quantityHeader && <Th align="right">{quantityHeader}</Th>}
              <Th align="right">Subtotal</Th>
              <Th align="right">Impuestos</Th>
              <Th align="right">Total</Th>
            </Tr>
          </THead>
          <TBody>
            {rows.length === 0 ? (
              <Tr hoverable={false}>
                <Td colSpan={colCount} className="py-4 text-center text-on-surface-variant">Sin datos</Td>
              </Tr>
            ) : (
              rows.map((r) => (
                <Tr key={r.key} hoverable={false} className="border-b border-outline-variant/40">
                  <Td>{r.label}</Td>
                  <Td align="right" className="text-on-surface-variant">{r.ticketCount}</Td>
                  {quantityHeader && (
                    <Td align="right" className="text-on-surface-variant">
                      {r.quantitySold ?? "0"}
                    </Td>
                  )}
                  <Td align="right" className="text-on-surface-variant">{money(r.subtotal)}</Td>
                  <Td align="right" className="text-on-surface-variant">{money(r.taxTotal)}</Td>
                  <Td align="right" className="font-medium">{money(r.total)}</Td>
                </Tr>
              ))
            )}
          </TBody>
        </Table>
      </div>
    </div>
  );
}
