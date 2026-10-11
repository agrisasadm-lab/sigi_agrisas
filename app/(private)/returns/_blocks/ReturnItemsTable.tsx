import { Skeleton } from "../../../_components/atoms/Skeleton/Skeleton";
import { Table, THead, TBody, Tr, Th, Td } from "../../../_components/molecules/DataTable/DataTable";
import type { ReturnItem } from "../_logic/types/domain";
import { formatMxCurrency } from "../../../_lib/formatMxCurrency";

function fmt(n: number) { return formatMxCurrency(n); }
function fmtPct(n: number) { return `${(n * 100).toFixed(0)}%`; }

interface ReturnItemsTableProps {
  items: ReturnItem[];
  isLoading?: boolean;
}

export function ReturnItemsTable({ items, isLoading }: ReturnItemsTableProps) {
  if (isLoading) {
    return (
      <div className="p-4 space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} height={36} width="100%" />
        ))}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <THead>
          <Tr hoverable={false}>
            <Th>Código</Th>
            <Th>Producto</Th>
            <Th>Precio</Th>
            <Th align="right">Cant.</Th>
            <Th align="right">Precio unit.</Th>
            <Th align="right">Desc.</Th>
            <Th align="right">IVA</Th>
            <Th align="right">IEPS</Th>
            <Th align="right">Subtotal</Th>
            <Th align="right">Total</Th>
          </Tr>
        </THead>
        <TBody>
          {items.map((item) => (
            <Tr key={item.id} className="border-b border-outline-variant/40 hover:bg-surface-container-low/50">
              <Td className="font-mono text-label-sm text-on-surface-variant">
                {item.productCodeSnapshot}
              </Td>
              <Td className="text-on-surface">{item.productNameSnapshot}</Td>
              <Td className="text-on-surface-variant text-label-sm">{item.priceNameSnapshot}</Td>
              <Td align="right">{item.quantity}</Td>
              <Td align="right">{fmt(item.unitPrice)}</Td>
              <Td align="right" className="text-on-surface-variant">
                {item.discountAmount > 0 ? fmt(item.discountAmount) : item.discountPct > 0 ? `${item.discountPct}%` : "—"}
              </Td>
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
