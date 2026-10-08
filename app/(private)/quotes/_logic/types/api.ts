export type QuoteStatus = "draft" | "authorized" | "converted" | "cancelled" | "expired";

export interface QuoteItemDto {
  id: string;
  productId: string;
  productCodeSnapshot: string;
  productNameSnapshot: string;
  productPriceId: string;
  priceNameSnapshot: string;
  quantity: number;
  unitPrice: number;
  discountPct: number;
  discountAmount: number;
  ivaRate: number;
  iepsRate: number;
  lineSubtotal: number;
  lineIva: number;
  lineIeps: number;
  lineTotal: number;
}

export interface QuoteDto {
  id: string;
  branchId: string;
  branchName?: string | null;
  customerId?: string | null;
  customerName?: string | null;
  creatorId: string;
  creatorName?: string | null;
  folioId: string;
  folioNumber: number;
  folioPrefix?: string | null;
  status: QuoteStatus;
  isExpired: boolean;
  subtotal: number;
  taxTotal: number;
  total: number;
  expiresAt?: string | null;
  convertedSaleId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface QuoteDetailDto extends QuoteDto {
  notes?: string | null;
  authorizedAt?: string | null;
  authorizedById?: string | null;
  authorizedByName?: string | null;
  cancelledAt?: string | null;
  cancellationReason?: string | null;
  convertedAt?: string | null;
  convertedSaleId?: string | null;
  items: QuoteItemDto[];
}

export interface ListQuotesResponse {
  items: QuoteDto[];
  total: number;
  page: number;
  pageSize: number;
}

export interface QuoteItemInputBody {
  productId: string;
  productPriceId: string;
  quantity: number;
  discountPctOverride?: number;
  discountAmount?: number;
}

export interface CreateQuoteBody {
  branchId: string;
  customerId?: string | null;
  folioId: string;
  items: QuoteItemInputBody[];
  expiresAt?: string | null;
  notes?: string | null;
  /** Idempotency key set by `offline-sync` when this quote was queued offline; omitted for online submissions. */
  clientRequestId?: string;
}

export interface UpdateQuoteBody {
  customerId?: string | null;
  items?: QuoteItemInputBody[];
  expiresAt?: string | null;
  notes?: string | null;
}

export interface AuthorizeQuoteBody {
  notes?: string | null;
}

export interface CancelQuoteBody {
  reason?: string | null;
}

export interface ConvertQuoteBody {
  paymentMethodId: string;
  folioId: string;
  notes?: string | null;
}
