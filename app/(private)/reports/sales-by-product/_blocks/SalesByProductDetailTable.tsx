"use client";

import { Table, THead, TBody, Tr, Th, Td } from "../../../../_components/molecules/DataTable";
import type { SalesByProductDetailRowDto } from "../_logic/types/api";
import { formatMxCurrency } from "../../../../_lib/formatMxCurrency";

function money(v: string): string {
  return formatMxCurrency(Number(v));
}

export function SalesByProductDetailTable({ rows }: { rows: SalesByProductDetailRowDto[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-outline-variant bg-surface-container-low">
      <Table>
        <THead>
          <tr>
            <Th>Departamento</Th>
            <Th>Producto</Th>
            <Th>Cliente</Th>
            <Th align="right">Cantidad</Th>
            <Th align="right">Monto</Th>
          </tr>
        </THead>
        <TBody>
          {rows.length === 0 ? (
            <tr>
              <Td colSpan={5} className="text-center text-on-surface-variant">Sin datos</Td>
            </tr>
          ) : (
            rows.map((r) => (
              <Tr key={`${r.departmentId}-${r.productId}-${r.customerId ?? "sin-cliente"}`}>
                <Td>{r.departmentName}</Td>
                <Td>{`${r.productName} (${r.productCode})`}</Td>
                <Td>{r.customerName}</Td>
                <Td align="right">{r.quantity}</Td>
                <Td align="right" className="font-medium">{money(r.total)}</Td>
              </Tr>
            ))
          )}
        </TBody>
      </Table>
    </div>
  );
}
