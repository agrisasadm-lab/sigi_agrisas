export interface ReturnItemDto {
  id: string;
  returnId: string;
  saleItemId: string;
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

export interface ReturnDto {
  id: string;
  saleId: string;
  saleFolioCode: string | null;
  saleFolioNumber: number | null;
  branchId: string;
  branchName: string | null;
  customerId: string | null;
  customerName: string | null;
  customerRfc: string | null;
  creatorId: string;
  creatorName: string | null;
  status: string;
  reason: string;
  returnedAt: string;
  refundSubtotal: number;
  refundTax: number;
  refundTotal: number;
  notes: string | null;
  cancelledAt: string | null;
  cancelledBy: string | null;
  cancellationReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReturnDetailDto extends ReturnDto {
  items: ReturnItemDto[];
}

export interface ReturnItemInput {
  saleItemId: string;
  quantity: number;
}

export interface ListReturnsRequest {
  page: number;
  pageSize: number;
  branchId?: string;
  customerId?: string;
  saleId?: string;
  statuses?: string[];
  from?: Date;
  to?: Date;
  search?: string;
}

export interface ListReturnsResponse {
  items: ReturnDto[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CreateReturnRequest {
  saleId: string;
  reason: string;
  returnedAt: Date;
  items: ReturnItemInput[];
  notes?: string | null;
  creatorId: string;
  /** When set, marks the referenced sale as 'returned_total' atomically with the return creation. */
  markSaleReturnedTotalId?: string;
}

export interface CancelReturnRequest {
  id: string;
  cancellationReason: string | null;
  cancelledBy: string;
}
