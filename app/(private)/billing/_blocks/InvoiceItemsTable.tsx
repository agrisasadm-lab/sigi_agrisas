"use client";

import type { InvoiceItem } from "../_logic/types/domain";
import { formatMxCurrency } from "../../../_lib/formatMxCurrency";
import { Table, THead, TBody, Tr, Th, Td } from "../../../_components/molecules/DataTable/DataTable";

function fmt(n: number) { return formatMxCurrency(n); }
function pct(n: number | null) { return n != null ? `${(n * 100).toFixed(0)}%` : "—"; }

interface InvoiceItemsTableProps {
  items: InvoiceItem[];
  subtotal: number;
  taxTotal: number;
  total: number;
}

export function InvoiceItemsTable({ items, subtotal, taxTotal, total }: InvoiceItemsTableProps) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <THead>
          <Tr hoverable={false}>
            <Th>Producto</Th>
            <Th align="right">Cant.</Th>
            <Th align="right">Precio</Th>
            <Th align="right">Desc.</Th>
            <Th align="right">IVA</Th>
            <Th align="right">IEPS</Th>
            <Th align="right">Subtotal</Th>
            <Th align="right">Total línea</Th>
          </Tr>
        </THead>
        <TBody>
          {items.map((item) => (
            <Tr key={item.id} hoverable={false} className="border-b border-outline-variant/40">
              <Td>
                <p className="text-on-surface font-medium">{item.productNameSnapshot}</p>
                <p className="text-label-sm text-on-surface-variant font-mono">{item.productCodeSnapshot}</p>
                {(item.satProductCodeLabel || item.satProductCode) && (
                  <p className="text-label-sm text-on-surface-variant">SAT: {item.satProductCodeLabel || item.satProductCode}</p>
                )}
              </Td>
              <Td align="right">{item.quantity}</Td>
              <Td align="right">{fmt(item.unitPrice)}</Td>
              <Td align="right">{pct(item.discountPct)}</Td>
              <Td align="right">{pct(item.ivaRate)}</Td>
              <Td align="right">{pct(item.iepsRate)}</Td>
              <Td align="right">{fmt(item.lineSubtotal)}</Td>
              <Td align="right" className="font-medium">{fmt(item.lineTotal)}</Td>
            </Tr>
          ))}
        </TBody>
        <tfoot>
          <Tr hoverable={false} className="border-t border-outline-variant">
            <Td colSpan={6} />
            <Td align="right" className="py-2 text-label-sm text-on-surface-variant">Subtotal</Td>
            <Td align="right" className="py-2">{fmt(subtotal)}</Td>
          </Tr>
          <Tr hoverable={false}>
            <Td colSpan={6} />
            <Td align="right" className="py-2 text-label-sm text-on-surface-variant">Impuestos</Td>
            <Td align="right" className="py-2">{fmt(taxTotal)}</Td>
          </Tr>
          <Tr hoverable={false} className="border-t border-outline-variant font-semibold">
            <Td colSpan={6} />
            <Td align="right" className="py-2 text-label-sm">Total</Td>
            <Td align="right" className="py-2 text-on-surface">{fmt(total)}</Td>
          </Tr>
        </tfoot>
      </Table>
    </div>
  );
}
