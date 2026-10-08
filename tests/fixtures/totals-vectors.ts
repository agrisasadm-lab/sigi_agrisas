export interface TotalsVectorLine {
  quantity: number;
  unitPrice: number;
  discountPct?: number | null;
  discountAmount?: number | null;
  ivaRate?: number | null;
  iepsRate?: number | null;
  isTaxable?: boolean;
}

export const totalsVectors: ReadonlyArray<ReadonlyArray<TotalsVectorLine>> = [
  [{ quantity: 1, unitPrice: 100 }],
  [{ quantity: 2, unitPrice: 100, ivaRate: 0.16 }],
  [{ quantity: 1, unitPrice: 100, discountPct: 10 }],
  [{ quantity: 1, unitPrice: 100, ivaRate: 0.16, iepsRate: 0.08 }],
  [{ quantity: 1, unitPrice: 100, ivaRate: null, iepsRate: null }],
  [
    { quantity: 1, unitPrice: 100, ivaRate: 0.16 },
    { quantity: 2, unitPrice: 50 },
  ],
  [{ quantity: 3, unitPrice: 33.333, ivaRate: 0.16 }],
  [{ quantity: 1, unitPrice: 12345.6789, ivaRate: 0.16 }],
  [{ quantity: 1, unitPrice: 0.12345 }],
  // isTaxable=false: tax must be zero regardless of rates
  [{ quantity: 1, unitPrice: 100, ivaRate: 0.16, iepsRate: 0.08, isTaxable: false }],
  [{ quantity: 2, unitPrice: 50, ivaRate: 0.16, isTaxable: false }],
  [
    { quantity: 4, unitPrice: 7.77, discountPct: 13.5, ivaRate: 0.16 },
    { quantity: 1.5, unitPrice: 99.99, ivaRate: 0, iepsRate: 0.08 },
    { quantity: 100, unitPrice: 1.01, discountPct: 0, ivaRate: 0.16, iepsRate: 0 },
  ],
  // Fractional-quantity surcharge (fractional-quantity-surcharge change): the surcharge is
  // resolved and baked into `unitPrice` by the use case BEFORE it reaches the calculator (see
  // design.md § Decisión 1) — the calculator itself stays agnostic. This vector's `unitPrice`
  // (100 * 1.05) represents that already-resolved value, confirming the three calculators stay
  // equivalent regardless of how `unitPrice` was derived.
  [{ quantity: 0.5, unitPrice: 105, ivaRate: 0.16 }],
];

/**
 * Vectores con `discountAmount` — NO forman parte de `totalsVectors` porque
 * `PurchaseTotalsCalculator` (consumidor de `totalsVectors` en las pruebas de
 * equivalencia de 4 vías) nunca pasa ese campo al núcleo compartido (fuera de
 * alcance de `add-line-discount-amount`, ver design.md Decisión 5) — mezclarlos
 * rompería esa equivalencia legítimamente. Sólo Sale/Quote/Return lo soportan.
 */
export const discountAmountVectors: ReadonlyArray<ReadonlyArray<TotalsVectorLine>> = [
  [{ quantity: 1, unitPrice: 500, discountAmount: 100 }],
  [{ quantity: 1, unitPrice: 116, discountAmount: 16, ivaRate: 0.16 }],
  [{ quantity: 1, unitPrice: 80, discountAmount: 100 }], // clamps to 0, never negative
  [
    { quantity: 2, unitPrice: 100, discountAmount: 50, ivaRate: 0.16, iepsRate: 0.08 },
    { quantity: 1, unitPrice: 200, discountPct: 10 },
  ],
];
