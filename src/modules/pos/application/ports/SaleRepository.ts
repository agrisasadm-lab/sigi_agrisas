import { Sale, SaleStatus } from "../../domain/entities/Sale";
import { SaleJoinedFields } from "../mappers/toSaleDto";

export interface SaleSummary {
  sale: Sale;
  joined: SaleJoinedFields;
  returnedQuantityBySaleItem?: Record<string, number>;
  satProductCodeByProductId?: Record<string, string | null>;
}

export interface FindAllSalesOptions {
  page: number;
  pageSize: number;
  branchId?: string;
  customerId?: string;
  statuses?: SaleStatus[];
  from?: Date;
  to?: Date;
  search?: string;
}

export interface SnapshotItemInput {
  productId: string;
  /**
   * UUID of the catalog price, or `null` when the originating price has been
   * hard-deleted. Snapshots survive price deletion (see pos-api spec
   * "Snapshot survives price deletion") so the column on `sale_items` is
   * nullable end-to-end.
   */
  productPriceId: string | null;
  /** Non-null when this line was sold via a `ProductDosification` instead of a `ProductPrice`. */
  dosificationId: string | null;
  /** Snapshot of `dosification.numParts` at sale time. `null` for non-dosification lines. */
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
}

export interface CreateSaleData {
  branchId: string;
  customerId: string | null;
  cashierId: string;
  paymentMethodId: string;
  folioId: string;
  notes: string | null;
  quoteId?: string | null;
  clientRequestId?: string | null;
  paidAmount: number;
  paymentStatus: string;
  subtotal: number;
  taxTotal: number;
  total: number;
  items: SnapshotItemInput[];
}

export interface CreateSaleFromQuoteData extends CreateSaleData {
  /** The id of the originating quote. Required for this method. */
  quoteId: string;
}

export interface EditSaleData {
  customerId?: string;
  paymentMethodId?: string;
  notes?: string | null;
  subtotal: number;
  taxTotal: number;
  total: number;
  items: SnapshotItemInput[];
}

export interface SaleRepository {
  findAll(opts: FindAllSalesOptions): Promise<{ items: SaleSummary[]; total: number }>;
  findByIdWithItems(id: string): Promise<SaleSummary | null>;
  /** Idempotent-replay lookup for offline-created sales (see pos-api "Idempotent replay via clientRequestId"). */
  findByClientRequestId(clientRequestId: string): Promise<SaleSummary | null>;
  /** Atomic create: assigns folio number, decrements inventory (allowing negative), persists sale + items. */
  createCompleted(data: CreateSaleData): Promise<SaleSummary>;
  /**
   * Atomic create driven by a Quote conversion: uses snapshot prices/taxes from the
   * quote (not re-resolved from the catalog), assigns a fresh fiscal folio number,
   * decrements inventory (allowing negative), persists sale + items, and atomically
   * marks the originating quote as `converted` with `convertedSaleId` pointing back.
   * Implementations MUST do all of the above within a single transaction.
   */
  createCompletedFromQuote(data: CreateSaleFromQuoteData): Promise<SaleSummary>;
  /** Atomic cancel: idempotent if already cancelled; otherwise restores stock + marks cancelled. */
  cancel(id: string, reason: string | null): Promise<SaleSummary>;
  /** Atomic edit (HQ-only invocation, enforced upstream). */
  replaceItemsAndRecalculate(id: string, data: EditSaleData): Promise<SaleSummary>;
  /** Transition sale status to 'returned_total'. */
  markReturnedTotal(saleId: string): Promise<void>;
}
