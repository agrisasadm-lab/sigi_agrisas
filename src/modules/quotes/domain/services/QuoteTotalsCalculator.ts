import { computeLineTotals } from "@/shared/domain/services/LineTotalsCalculator";

export interface QuoteLineInput {
  quantity: number;
  unitPrice: number;
  discountPct?: number | null;
  discountAmount?: number | null;
  ivaRate?: number | null;
  iepsRate?: number | null;
  isTaxable?: boolean;
}

export interface QuoteLineTotals {
  lineSubtotal: number;
  lineIva: number;
  lineIeps: number;
  lineTax: number;
  lineTotal: number;
}

export interface QuoteTotalsResult {
  lines: QuoteLineTotals[];
  subtotal: number;
  taxTotal: number;
  total: number;
}

export class QuoteTotalsCalculator {
  static computeTotals(lines: QuoteLineInput[]): QuoteTotalsResult {
    return computeLineTotals(
      lines.map((line) => ({
        quantity: line.quantity,
        price: line.unitPrice,
        discountPct: line.discountPct,
        discountAmount: line.discountAmount,
        ivaRate: line.ivaRate,
        iepsRate: line.iepsRate,
        isTaxable: line.isTaxable,
      })),
      "unitPrice"
    );
  }
}
