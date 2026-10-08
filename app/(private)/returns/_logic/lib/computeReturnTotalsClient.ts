export interface ReturnLineInput {
  quantity: number;
  unitPrice: number;
  discountPct?: number | null;
  discountAmount?: number | null;
  ivaRate?: number | null;
  iepsRate?: number | null;
}

export interface ReturnTotalsResult {
  subtotal: number;
  taxTotal: number;
  total: number;
}

function roundHalfToEven(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  const scaled = value * factor;
  const floor = Math.floor(scaled);
  const diff = scaled - floor;
  const eps = 1e-9;
  let rounded: number;
  if (diff > 0.5 + eps) {
    rounded = floor + 1;
  } else if (diff < 0.5 - eps) {
    rounded = floor;
  } else {
    rounded = floor % 2 === 0 ? floor : floor + 1;
  }
  return rounded / factor;
}

const SCALE = 4;

export function computeReturnTotalsClient(lines: ReturnLineInput[]): ReturnTotalsResult {
  let subtotal = 0;
  let taxTotal = 0;
  let total = 0;

  for (const line of lines) {
    if (line.quantity <= 0) continue;
    const discountPct = line.discountPct ?? 0;
    const discountAmount = line.discountAmount ?? 0;
    const ivaRate = line.ivaRate ?? 0;
    const iepsRate = line.iepsRate ?? 0;

    // unitPrice is the final tax-inclusive price the customer pays; tax is
    // extracted from it (not added on top): lineSubtotal = lineGross / (1 + rates).
    const lineGross = Math.max(
      0,
      roundHalfToEven(line.quantity * line.unitPrice * (1 - discountPct / 100), SCALE) -
        discountAmount
    );
    const divisor = 1 + ivaRate + iepsRate;
    const lineSubtotal = roundHalfToEven(lineGross / divisor, SCALE);
    const lineIva = roundHalfToEven(lineSubtotal * ivaRate, SCALE);
    const lineIeps = roundHalfToEven(lineSubtotal * iepsRate, SCALE);
    const lineTax = roundHalfToEven(lineIva + lineIeps, SCALE);
    const lineTotal = lineGross;

    subtotal = roundHalfToEven(subtotal + lineSubtotal, SCALE);
    taxTotal = roundHalfToEven(taxTotal + lineTax, SCALE);
    total = roundHalfToEven(total + lineTotal, SCALE);
  }

  return { subtotal, taxTotal, total };
}
