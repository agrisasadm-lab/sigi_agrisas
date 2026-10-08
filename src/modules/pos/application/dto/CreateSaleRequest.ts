export interface SaleItemInput {
  productId: string;
  /** Exactly one of `productPriceId`/`dosificationId` SHALL be present. */
  productPriceId?: string;
  dosificationId?: string;
  quantity: number;
  /** Overrides the catalog's `price.discountPct` for this line. Ignored on dosification lines. */
  discountPctOverride?: number | null;
  /** Flat-amount discount for this line (0–100 MXN), mutually exclusive with `discountPctOverride`. Ignored on dosification lines. */
  discountAmount?: number | null;
}

export interface CreateSaleRequest {
  branchId: string;
  customerId?: string | null;
  paymentMethodId: string;
  folioId: string;
  notes?: string | null;
  quoteId?: string | null;
  /** Idempotency key from offline-created sales queued via `offline-sync`. */
  clientRequestId?: string | null;
  items: SaleItemInput[];
}
