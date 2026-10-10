"use client";

import type { CollectionsByCustomerRowDto } from "../../_logic/by-customer/types/api";
import { formatMxCurrency } from "../../../../../_lib/formatMxCurrency";
import { Table, THead, TBody, Tr, Th, Td } from "../../../../../_components/molecules/DataTable/DataTable";

function money(v: string): string {
  return formatMxCurrency(Number(v));
}

export function ByCustomerTable({ rows }: { rows: CollectionsByCustomerRowDto[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-outline-variant bg-surface-container-low">
      <Table>
        <THead>
          <Tr hoverable={false}>
            <Th>Cliente</Th>
            <Th>Código</Th>
            <Th align="right">Abonos</Th>
            <Th align="right">Total</Th>
          </Tr>
        </THead>
        <TBody>
          {rows.length === 0 ? (
            <Tr hoverable={false}>
              <Td colSpan={4} className="py-4 text-center text-on-surface-variant">Sin cobranza</Td>
            </Tr>
          ) : (
            rows.map((r) => (
              <Tr key={r.customerId} hoverable={false} className="border-b border-outline-variant/40">
                <Td>{r.customerName}</Td>
                <Td>{r.customerCode}</Td>
                <Td align="right" className="text-on-surface-variant">{r.count}</Td>
                <Td align="right" className="font-medium">{money(r.total)}</Td>
              </Tr>
            ))
          )}
        </TBody>
      </Table>
    </div>
  );
}
