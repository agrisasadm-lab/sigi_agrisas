"use client";

import type { SaleListRowDto } from "../_logic/types/api";
import { formatMxCurrency } from "../../../../_lib/formatMxCurrency";
import { Table, THead, TBody, Tr, Th, Td } from "../../../../_components/molecules/DataTable/DataTable";

function money(v: string): string {
  return formatMxCurrency(Number(v));
}

export function SalesListTable({ rows }: { rows: SaleListRowDto[] }) {
  return (
    <div className="space-y-2">
      <h3 className="text-title-sm font-medium text-on-surface">Detalle de tickets</h3>
      <div className="overflow-x-auto rounded-lg border border-outline-variant bg-surface-container-low">
        <Table>
          <THead>
            <Tr hoverable={false}>
              <Th>Ticket</Th>
              <Th>Cliente</Th>
              <Th align="right">Importe</Th>
              <Th>Forma de pago</Th>
            </Tr>
          </THead>
          <TBody>
            {rows.length === 0 ? (
              <Tr hoverable={false}>
                <Td colSpan={4} className="py-4 text-center text-on-surface-variant">Sin ventas</Td>
              </Tr>
            ) : (
              rows.map((r) => (
                <Tr key={r.saleId} hoverable={false} className="border-b border-outline-variant/40">
                  <Td>{r.folioCode}</Td>
                  <Td>{r.customerName ?? "—"}</Td>
                  <Td align="right" className="font-medium">{money(r.total)}</Td>
                  <Td>{r.paymentMethodName}</Td>
                </Tr>
              ))
            )}
          </TBody>
        </Table>
      </div>
    </div>
  );
}
