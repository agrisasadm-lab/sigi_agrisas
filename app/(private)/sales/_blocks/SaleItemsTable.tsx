import type { ReactNode } from "react";
import type { SaleItem } from "../_logic/types/domain";
import { formatMxCurrency } from "../../../_lib/formatMxCurrency";

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
      <table className="w-full text-body-sm">
        <thead>
          <tr className="border-b border-outline-variant text-label-sm text-on-surface-variant uppercase tracking-wide">
            <th className="px-4 py-3 text-left font-medium">Código</th>
            <th className="px-4 py-3 text-left font-medium">Producto</th>
            <th className="px-4 py-3 text-left font-medium">Precio</th>
            <th className="px-4 py-3 text-right font-medium">Cant.</th>
            <th className="px-4 py-3 text-right font-medium">Desc.</th>
            <th className="px-4 py-3 text-right font-medium">IVA</th>
            <th className="px-4 py-3 text-right font-medium">IEPS</th>
            <th className="px-4 py-3 text-right font-medium">Subtotal</th>
            <th className="px-4 py-3 text-right font-medium">Total</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const returnedQty = returnedQuantityBySaleItem[item.id] ?? 0;
            const remaining = Math.max(0, item.quantity - returnedQty);
            return (
              <tr key={item.id} className="border-b border-outline-variant/40">
                <td className="px-4 py-3 font-mono text-label-sm">{item.productCodeSnapshot}</td>
                <td className="px-4 py-3 max-w-[200px]">
                  <div>{item.productNameSnapshot}</div>
                </td>
                <td className="px-4 py-3 text-on-surface-variant">
                  <div>{item.priceNameSnapshot}</div>
                  <div className="text-label-sm tabular-nums">{fmt(item.unitPrice)}</div>
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
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
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{item.discountPct > 0 ? `${item.discountPct}%` : "—"}</td>
                <td className="px-4 py-3 text-right tabular-nums text-on-surface-variant">{pct(item.ivaRate)}</td>
                <td className="px-4 py-3 text-right tabular-nums text-on-surface-variant">{pct(item.iepsRate)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{fmt(item.lineSubtotal)}</td>
                <td className="px-4 py-3 text-right tabular-nums font-medium">{fmt(item.lineTotal)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
