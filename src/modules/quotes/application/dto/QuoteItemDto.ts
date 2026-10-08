export interface QuoteItemDto {
  id: string;
  productId: string;
  productPriceId: string | null;
  productCodeSnapshot: string;
  productNameSnapshot: string;
  priceNameSnapshot: string;
  quantity: number;
  unitPrice: number;
  discountPct: number | null;
  discountAmount: number;
  ivaRate: number | null;
  iepsRate: number | null;
  lineSubtotal: number;
  lineIva: number;
  lineIeps: number;
  lineTax: number;
  lineTotal: number;
}

export interface QuoteItemInput {
  productId: string;
  productPriceId: string;
  quantity: number;
  /** Overrides the catalog's `price.discountPct` for this line. */
  discountPctOverride?: number | null;
  /** Flat-amount discount for this line (0–100 MXN), mutually exclusive with `discountPctOverride`. */
  discountAmount?: number | null;
}
