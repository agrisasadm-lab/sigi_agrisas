import type { QuoteItem } from "../_logic/types/domain";
import { formatMxCurrency } from "../../../_lib/formatMxCurrency";

function fmt(n: number) { return formatMxCurrency(n); }
function pct(n: number) { return `${(n * 100).toFixed(0)}%`; }

interface QuoteItemsTableProps {
  items: QuoteItem[];
}

export function QuoteItemsTable({ items }: QuoteItemsTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-body-sm">
        <thead>
          <tr className="border-b border-outline-variant text-label-sm text-on-surface-variant uppercase tracking-wide">
            <th className="px-4 py-3 text-left font-medium">Código</th>
            <th className="px-4 py-3 text-left font-medium">Producto</th>
            <th className="px-4 py-3 text-left font-medium">Tier</th>
            <th className="px-4 py-3 text-right font-medium">Cant.</th>
            <th className="px-4 py-3 text-right font-medium">Precio</th>
            <th className="px-4 py-3 text-right font-medium">Desc.</th>
            <th className="px-4 py-3 text-right font-medium">IVA</th>
            <th className="px-4 py-3 text-right font-medium">IEPS</th>
            <th className="px-4 py-3 text-right font-medium">Subtotal</th>
            <th className="px-4 py-3 text-right font-medium">Total línea</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="border-b border-outline-variant/40">
              <td className="px-4 py-3 font-mono text-label-sm">{item.productCodeSnapshot}</td>
              <td className="px-4 py-3 max-w-[200px]">{item.productNameSnapshot}</td>
              <td className="px-4 py-3 text-on-surface-variant text-label-sm">{item.priceNameSnapshot}</td>
              <td className="px-4 py-3 text-right tabular-nums">{item.quantity}</td>
              <td className="px-4 py-3 text-right tabular-nums">{fmt(item.unitPrice)}</td>
              <td className="px-4 py-3 text-right tabular-nums">{item.discountPct > 0 ? `${item.discountPct}%` : "—"}</td>
              <td className="px-4 py-3 text-right tabular-nums text-on-surface-variant">{pct(item.ivaRate)}</td>
              <td className="px-4 py-3 text-right tabular-nums text-on-surface-variant">{pct(item.iepsRate)}</td>
              <td className="px-4 py-3 text-right tabular-nums">{fmt(item.lineSubtotal)}</td>
              <td className="px-4 py-3 text-right tabular-nums font-medium">{fmt(item.lineTotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
