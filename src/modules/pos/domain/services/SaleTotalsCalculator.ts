import { computeLineTotals } from "@/shared/domain/services/LineTotalsCalculator";

export interface SaleLineInput {
  quantity: number;
  unitPrice: number;
  discountPct?: number | null;
  discountAmount?: number | null;
  ivaRate?: number | null;
  iepsRate?: number | null;
  isTaxable?: boolean;
}

export interface SaleLineTotals {
  lineSubtotal: number;
  lineIva: number;
  lineIeps: number;
  lineTax: number;
  lineTotal: number;
}

export interface SaleTotalsResult {
  lines: SaleLineTotals[];
  subtotal: number;
  taxTotal: number;
  total: number;
}

export class SaleTotalsCalculator {
  static computeTotals(lines: SaleLineInput[]): SaleTotalsResult {
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
