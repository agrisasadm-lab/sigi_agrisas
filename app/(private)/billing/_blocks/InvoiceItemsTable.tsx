"use client";

import type { InvoiceItem } from "../_logic/types/domain";
import { formatMxCurrency } from "../../../_lib/formatMxCurrency";

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
      <table className="w-full text-body-sm">
        <thead>
          <tr className="border-b border-outline-variant text-label-sm text-on-surface-variant uppercase tracking-wide">
            <th className="px-4 py-3 text-left font-medium">Producto</th>
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
              <td className="px-4 py-3">
                <p className="text-on-surface font-medium">{item.productNameSnapshot}</p>
                <p className="text-label-sm text-on-surface-variant font-mono">{item.productCodeSnapshot}</p>
                {(item.satProductCodeLabel || item.satProductCode) && (
                  <p className="text-label-sm text-on-surface-variant">SAT: {item.satProductCodeLabel || item.satProductCode}</p>
                )}
              </td>
              <td className="px-4 py-3 text-right tabular-nums">{item.quantity}</td>
              <td className="px-4 py-3 text-right tabular-nums">{fmt(item.unitPrice)}</td>
              <td className="px-4 py-3 text-right tabular-nums">{pct(item.discountPct)}</td>
              <td className="px-4 py-3 text-right tabular-nums">{pct(item.ivaRate)}</td>
              <td className="px-4 py-3 text-right tabular-nums">{pct(item.iepsRate)}</td>
              <td className="px-4 py-3 text-right tabular-nums">{fmt(item.lineSubtotal)}</td>
              <td className="px-4 py-3 text-right tabular-nums font-medium">{fmt(item.lineTotal)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-outline-variant">
            <td colSpan={6} />
            <td className="px-4 py-2 text-right text-label-sm text-on-surface-variant">Subtotal</td>
            <td className="px-4 py-2 text-right tabular-nums">{fmt(subtotal)}</td>
          </tr>
          <tr>
            <td colSpan={6} />
            <td className="px-4 py-2 text-right text-label-sm text-on-surface-variant">Impuestos</td>
            <td className="px-4 py-2 text-right tabular-nums">{fmt(taxTotal)}</td>
          </tr>
          <tr className="border-t border-outline-variant font-semibold">
            <td colSpan={6} />
            <td className="px-4 py-2 text-right text-label-sm">Total</td>
            <td className="px-4 py-2 text-right tabular-nums text-on-surface">{fmt(total)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
