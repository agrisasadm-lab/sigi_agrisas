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
      <table className="w-full text-body-sm">
        <thead>
          <tr className="border-b border-outline-variant text-label-sm text-on-surface-variant uppercase tracking-wide">
            <th className="px-4 py-3 text-left font-medium">Código</th>
            <th className="px-4 py-3 text-left font-medium">Producto</th>
            <th className="px-4 py-3 text-right font-medium">Cant.</th>
            <th className="px-4 py-3 text-right font-medium">Costo unit.</th>
            <th className="px-4 py-3 text-right font-medium">Desc.</th>
            <th className="px-4 py-3 text-right font-medium">IVA</th>
            <th className="px-4 py-3 text-right font-medium">IEPS</th>
            <th className="px-4 py-3 text-right font-medium">Subtotal</th>
            <th className="px-4 py-3 text-right font-medium">Total</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="border-b border-outline-variant/40 hover:bg-surface-container-low/50 transition-colors">
              <td className="px-4 py-3 font-mono text-label-sm text-on-surface-variant">{item.productCodeSnapshot}</td>
              <td className="px-4 py-3 text-on-surface">{item.productNameSnapshot}</td>
              <td className="px-4 py-3 text-right tabular-nums">{item.quantity}</td>
              <td className="px-4 py-3 text-right tabular-nums">{fmt(item.unitCost)}</td>
              <td className="px-4 py-3 text-right tabular-nums text-on-surface-variant">{fmtPct(item.discountPct)}</td>
              <td className="px-4 py-3 text-right tabular-nums text-on-surface-variant">{fmtPct(item.ivaRate)}</td>
              <td className="px-4 py-3 text-right tabular-nums text-on-surface-variant">{fmtPct(item.iepsRate)}</td>
              <td className="px-4 py-3 text-right tabular-nums">{fmt(item.lineSubtotal)}</td>
              <td className="px-4 py-3 text-right tabular-nums font-medium">{fmt(item.lineTotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
