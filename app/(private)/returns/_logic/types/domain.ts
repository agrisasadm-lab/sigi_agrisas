import type { ReturnStatus } from "./api";

export interface ReturnItem {
  id: string;
  saleItemId: string;
  productCodeSnapshot: string;
  productNameSnapshot: string;
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

export interface Return {
  id: string;
  saleId: string;
  branchId: string;
  branchName?: string | null;
  customerId?: string | null;
  customerName?: string | null;
  customerRfc?: string | null;
  creatorId: string;
  creatorName?: string | null;
  status: ReturnStatus;
  reason: string;
  notes?: string | null;
  refundTotal: number;
  returnedAt: Date;
  cancelledAt?: Date | null;
  cancelledBy?: string | null;
  cancellationReason?: string | null;
  createdAt: Date;
  updatedAt: Date;
  salefolioCode?: string | null;
  salefolioNumber?: number | null;
}

export interface ReturnDetail extends Return {
  items: ReturnItem[];
}

export interface ReturnFilters {
  page: number;
  pageSize: number;
  status: ReturnStatus[];
  branchId?: string;
  customerId?: string;
  saleId?: string;
  from?: string;
  to?: string;
  search: string;
}
