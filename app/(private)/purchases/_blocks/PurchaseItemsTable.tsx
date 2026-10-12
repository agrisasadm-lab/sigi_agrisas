import { Table, THead, TBody, Tr, Th, Td } from "../../../_components/molecules/DataTable/DataTable";
import type { PurchaseItem } from "../_logic/types/domain";
import { formatMxCurrency } from "../../../_lib/formatMxCurrency";

function fmt(n: number) { return formatMxCurrency(n); }
function fmtPct(n: number | null) { return n === null ? "—" : `${(n * 100).toFixed(0)}%`; }

interface PurchaseItemsTableProps {
  items: PurchaseItem[];
}

export function PurchaseItemsTable({ items }: PurchaseItemsTableProps) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <THead>
          <Tr hoverable={false}>
            <Th>Código</Th>
            <Th>Producto</Th>
            <Th align="right">Cant.</Th>
            <Th align="right">Costo unit.</Th>
            <Th align="right">Desc.</Th>
            <Th align="right">IVA</Th>
            <Th align="right">IEPS</Th>
            <Th align="right">Subtotal</Th>
            <Th align="right">Total</Th>
          </Tr>
        </THead>
        <TBody>
          {items.map((item) => (
            <Tr key={item.id} className="border-b border-outline-variant/40 hover:bg-surface-container-low/50 transition-colors">
              <Td className="font-mono text-label-sm text-on-surface-variant">{item.productCodeSnapshot}</Td>
              <Td className="text-on-surface">{item.productNameSnapshot}</Td>
              <Td align="right">{item.quantity}</Td>
              <Td align="right">{fmt(item.unitCost)}</Td>
              <Td align="right" className="text-on-surface-variant">{fmtPct(item.discountPct)}</Td>
              <Td align="right" className="text-on-surface-variant">{fmtPct(item.ivaRate)}</Td>
              <Td align="right" className="text-on-surface-variant">{fmtPct(item.iepsRate)}</Td>
              <Td align="right">{fmt(item.lineSubtotal)}</Td>
              <Td align="right" className="font-medium">{fmt(item.lineTotal)}</Td>
            </Tr>
          ))}
        </TBody>
      </Table>
    </div>
  );
}
