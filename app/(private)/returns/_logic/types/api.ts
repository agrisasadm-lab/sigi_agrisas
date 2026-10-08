export type ReturnStatus = "completed" | "cancelled";

export interface ReturnItemDto {
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

export interface ReturnDto {
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
  returnedAt: string;
  cancelledAt?: string | null;
  cancelledBy?: string | null;
  cancellationReason?: string | null;
  createdAt: string;
  updatedAt: string;
  salefolioCode?: string | null;
  salefolioNumber?: number | null;
}

export interface ReturnDetailDto extends ReturnDto {
  items: ReturnItemDto[];
}

export interface ReturnItemInput {
  saleItemId: string;
  quantity: number;
}

export interface CreateReturnRequest {
  saleId: string;
  reason: string;
  returnedAt: string;
  notes?: string | null;
  items: ReturnItemInput[];
}

export interface CancelReturnRequest {
  reason?: string | null;
}

export interface ListReturnsRequest {
  page?: number;
  pageSize?: number;
  status?: ReturnStatus | ReturnStatus[];
  branchId?: string;
  customerId?: string;
  saleId?: string;
  from?: string;
  to?: string;
  search?: string;
}

export interface ListReturnsResponse {
  items: ReturnDto[];
  total: number;
  page: number;
  pageSize: number;
}
