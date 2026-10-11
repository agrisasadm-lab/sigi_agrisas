import type { ReactNode } from "react";
import type { SaleItem } from "../_logic/types/domain";
import { formatMxCurrency } from "../../../_lib/formatMxCurrency";
import { Table, THead, TBody, Tr, Th, Td } from "../../../_components/molecules/DataTable/DataTable";

function fmt(n: number) { return formatMxCurrency(n); }
function pct(n: number) { return `${(n * 100).toFixed(0)}%`; }

interface SaleItemsTableProps {
  items: SaleItem[];
  returnedQuantityBySaleItem?: Record<string, number>;
  renderQuantityCell?: (item: SaleItem, returnedQty: number, remaining: number) => ReactNode;
}

export function SaleItemsTable({
  items,
  returnedQuantityBySaleItem = {},
  renderQuantityCell,
}: SaleItemsTableProps) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <THead>
          <Tr hoverable={false}>
            <Th>Código</Th>
            <Th>Producto</Th>
            <Th>Precio</Th>
            <Th align="right">Cant.</Th>
            <Th align="right">Desc.</Th>
            <Th align="right">IVA</Th>
            <Th align="right">IEPS</Th>
            <Th align="right">Subtotal</Th>
            <Th align="right">Total</Th>
          </Tr>
        </THead>
        <TBody>
          {items.map((item) => {
            const returnedQty = returnedQuantityBySaleItem[item.id] ?? 0;
            const remaining = Math.max(0, item.quantity - returnedQty);
            return (
              <Tr key={item.id} hoverable={false} className="border-b border-outline-variant/40">
                <Td className="font-mono text-label-sm">{item.productCodeSnapshot}</Td>
                <Td className="max-w-[200px]">
                  <div>{item.productNameSnapshot}</div>
                </Td>
                <Td className="text-on-surface-variant">
                  <div>{item.priceNameSnapshot}</div>
                  <div className="text-label-sm tabular-nums">{fmt(item.unitPrice)}</div>
                </Td>
                <Td align="right">
                  {renderQuantityCell ? (
                    renderQuantityCell(item, returnedQty, remaining)
                  ) : (
                    <>
                      {item.quantity}
                      {returnedQty > 0 && (
                        <span className="block text-label-sm text-on-surface-variant">
                          Devuelto: {returnedQty}
                        </span>
                      )}
                    </>
                  )}
                </Td>
                <Td align="right">
                  {item.discountAmount > 0 ? fmt(item.discountAmount) : item.discountPct > 0 ? `${item.discountPct}%` : "—"}
                </Td>
                <Td align="right" className="text-on-surface-variant">{pct(item.ivaRate)}</Td>
                <Td align="right" className="text-on-surface-variant">{pct(item.iepsRate)}</Td>
                <Td align="right">{fmt(item.lineSubtotal)}</Td>
                <Td align="right" className="font-medium">{fmt(item.lineTotal)}</Td>
              </Tr>
            );
          })}
        </TBody>
      </Table>
    </div>
  );
}
