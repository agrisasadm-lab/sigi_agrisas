import type { QuoteStatus } from "./api";

export type { QuoteStatus };

export interface QuoteItem {
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

export interface Quote {
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
  expiresAt?: Date | null;
  convertedSaleId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface QuoteDetail extends Quote {
  notes?: string | null;
  authorizedAt?: Date | null;
  authorizedById?: string | null;
  authorizedByName?: string | null;
  cancelledAt?: Date | null;
  cancellationReason?: string | null;
  convertedAt?: Date | null;
  convertedSaleId?: string | null;
  items: QuoteItem[];
}

export interface QuoteListFilters {
  page: number;
  pageSize: number;
  branchId?: string;
  customerId?: string;
  status?: QuoteStatus | "expired" | "";
  from?: string;
  to?: string;
  search?: string;
}
