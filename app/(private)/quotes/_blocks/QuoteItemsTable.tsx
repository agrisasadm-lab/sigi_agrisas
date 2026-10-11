import type { QuoteItem } from "../_logic/types/domain";
import { formatMxCurrency } from "../../../_lib/formatMxCurrency";
import { Table, THead, TBody, Tr, Th, Td } from "../../../_components/molecules/DataTable/DataTable";

function fmt(n: number) { return formatMxCurrency(n); }
function pct(n: number) { return `${(n * 100).toFixed(0)}%`; }

interface QuoteItemsTableProps {
  items: QuoteItem[];
}

export function QuoteItemsTable({ items }: QuoteItemsTableProps) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <THead>
          <Tr hoverable={false}>
            <Th>Código</Th>
            <Th>Producto</Th>
            <Th>Tier</Th>
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
              <Td className="font-mono text-label-sm">{item.productCodeSnapshot}</Td>
              <Td className="max-w-[200px]">{item.productNameSnapshot}</Td>
              <Td className="text-on-surface-variant text-label-sm">{item.priceNameSnapshot}</Td>
              <Td align="right">{item.quantity}</Td>
              <Td align="right">{fmt(item.unitPrice)}</Td>
              <Td align="right">
                {item.discountAmount > 0 ? fmt(item.discountAmount) : item.discountPct > 0 ? `${item.discountPct}%` : "—"}
              </Td>
              <Td align="right" className="text-on-surface-variant">{pct(item.ivaRate)}</Td>
              <Td align="right" className="text-on-surface-variant">{pct(item.iepsRate)}</Td>
              <Td align="right">{fmt(item.lineSubtotal)}</Td>
              <Td align="right" className="font-medium">{fmt(item.lineTotal)}</Td>
            </Tr>
          ))}
        </TBody>
      </Table>
    </div>
  );
}
