import { roundHalfToEven } from "@/shared/domain/services/roundHalfToEven";

export interface LineTotalsInput {
  quantity: number;
  price: number;
  discountPct?: number | null;
  discountAmount?: number | null;
  ivaRate?: number | null;
  iepsRate?: number | null;
  isTaxable?: boolean;
}

export interface LineTotalsOutput {
  lineSubtotal: number;
  lineIva: number;
  lineIeps: number;
  lineTax: number;
  lineTotal: number;
}

export interface LineTotalsAggregateResult {
  lines: LineTotalsOutput[];
  subtotal: number;
  taxTotal: number;
  total: number;
}

const SCALE = 4;

/**
 * Núcleo compartido de Sale/Quote/Return/PurchaseTotalsCalculator — idéntico
 * en los 4, salvo el nombre del campo de precio (`unitPrice` vs `unitCost`,
 * usado solo para el texto del mensaje de error). `InvoiceTotalsCalculator`
 * no usa este núcleo — divergió (`taxObject`, sin `isTaxable`).
 */
export function computeLineTotals(
  lines: LineTotalsInput[],
  priceFieldLabel: string
): LineTotalsAggregateResult {
  const lineTotals: LineTotalsOutput[] = [];
  let subtotal = 0;
  let taxTotal = 0;
  let total = 0;

  for (const line of lines) {
    if (!Number.isFinite(line.quantity) || line.quantity <= 0) {
      throw new Error("quantity must be > 0");
    }
    if (!Number.isFinite(line.price) || line.price < 0) {
      throw new Error(`${priceFieldLabel} must be >= 0`);
    }
    const discountPct = line.discountPct ?? 0;
    if (!Number.isFinite(discountPct) || discountPct < 0 || discountPct > 100) {
      throw new Error("discountPct must be between 0 and 100");
    }
    const discountAmount = line.discountAmount ?? 0;
    if (!Number.isFinite(discountAmount) || discountAmount < 0 || discountAmount > 100) {
      throw new Error("discountAmount must be between 0 and 100");
    }
    if (discountPct > 0 && discountAmount > 0) {
      throw new Error("discountPct and discountAmount are mutually exclusive");
    }
    const rawIvaRate = line.ivaRate ?? 0;
    if (!Number.isFinite(rawIvaRate) || rawIvaRate < 0 || rawIvaRate > 1) {
      throw new Error("ivaRate must be between 0 and 1");
    }
    const rawIepsRate = line.iepsRate ?? 0;
    if (!Number.isFinite(rawIepsRate) || rawIepsRate < 0 || rawIepsRate > 1) {
      throw new Error("iepsRate must be between 0 and 1");
    }
    // ?? true: pre-migration rows lack isTaxable; default taxable preserves prior behavior
    const isTaxable = line.isTaxable ?? true;
    const ivaRate = isTaxable ? rawIvaRate : 0;
    const iepsRate = isTaxable ? rawIepsRate : 0;

    // price is the final tax-inclusive amount paid; tax is extracted from it
    // (not added on top): lineSubtotal = lineGross / (1 + rates).
    const lineGross = Math.max(
      0,
      roundHalfToEven(line.quantity * line.price * (1 - discountPct / 100), SCALE) - discountAmount
    );
    const divisor = 1 + ivaRate + iepsRate;
    const lineSubtotal = roundHalfToEven(lineGross / divisor, SCALE);
    const lineIva = roundHalfToEven(lineSubtotal * ivaRate, SCALE);
    const lineIeps = roundHalfToEven(lineSubtotal * iepsRate, SCALE);
    const lineTax = roundHalfToEven(lineIva + lineIeps, SCALE);
    const lineTotal = lineGross;

    lineTotals.push({ lineSubtotal, lineIva, lineIeps, lineTax, lineTotal });
    subtotal = roundHalfToEven(subtotal + lineSubtotal, SCALE);
    taxTotal = roundHalfToEven(taxTotal + lineTax, SCALE);
    total = roundHalfToEven(total + lineTotal, SCALE);
  }

  return { lines: lineTotals, subtotal, taxTotal, total };
}
