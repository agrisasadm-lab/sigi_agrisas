import { Return } from "../../domain/entities/Return";
import { ReturnItem } from "../../domain/entities/ReturnItem";

export interface ReturnWithItems {
  return: Return;
  items: ReturnItem[];
  joined: ReturnJoinedFields;
}

export interface ReturnJoinedFields {
  saleFolioCode: string | null;
  saleFolioNumber: number | null;
  branchName: string | null;
  customerName: string | null;
  customerRfc: string | null;
  creatorName: string | null;
}

export interface ReturnSummary {
  return: Return;
  joined: ReturnJoinedFields;
}

export interface FindAllReturnsOptions {
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

export interface PriorReturnItemRow {
  saleItemId: string;
  quantity: number;
  returnStatus: string;
}

export interface CreateReturnData {
  saleId: string;
  branchId: string;
  customerId: string | null;
  creatorId: string;
  reason: string;
  returnedAt: Date;
  refundSubtotal: number;
  refundTax: number;
  refundTotal: number;
  notes: string | null;
  /** When set, marks the referenced sale as 'returned_total' within the same transaction. */
  markSaleReturnedTotalId?: string;
  items: Array<{
    saleItemId: string;
    productId: string;
    productPriceId: string | null;
    dosificationId: string | null;
    numPartsSnapshot: number | null;
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
    lineTax: number;
    lineTotal: number;
  }>;
}

export interface ReturnRepository {
  findAll(opts: FindAllReturnsOptions): Promise<{ items: ReturnSummary[]; total: number }>;
  findByIdWithItems(id: string): Promise<ReturnWithItems | null>;
  findBySaleId(saleId: string): Promise<ReturnWithItems[]>;
  findPriorReturnItemsBySaleItemIds(saleItemIds: string[]): Promise<PriorReturnItemRow[]>;
  aggregateReturnedQuantityBySaleItemIds(saleItemIds: string[]): Promise<Record<string, number>>;
  createWithItems(data: CreateReturnData): Promise<ReturnWithItems>;
  markCancelled(
    id: string,
    cancelledBy: string,
    cancellationReason: string | null,
    itemsToUndo: Array<{ productId: string; quantity: number; numPartsSnapshot: number | null }>
  ): Promise<Return>;
}
