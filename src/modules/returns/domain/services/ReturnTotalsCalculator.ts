import { computeLineTotals } from "@/shared/domain/services/LineTotalsCalculator";

export interface ReturnLineInput {
  quantity: number;
  unitPrice: number;
  discountPct?: number | null;
  discountAmount?: number | null;
  ivaRate?: number | null;
  iepsRate?: number | null;
  isTaxable?: boolean;
}

export interface ReturnLineTotals {
  lineSubtotal: number;
  lineIva: number;
  lineIeps: number;
  lineTax: number;
  lineTotal: number;
}

export interface ReturnTotalsResult {
  lines: ReturnLineTotals[];
  subtotal: number;
  taxTotal: number;
  total: number;
}

export class ReturnTotalsCalculator {
  static computeTotals(lines: ReturnLineInput[]): ReturnTotalsResult {
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
