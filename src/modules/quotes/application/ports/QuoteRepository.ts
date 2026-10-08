import { Quote } from "../../domain/entities/Quote";
import { QuoteStatus } from "../../domain/value-objects/QuoteStatus";
import { QuoteJoinedFields } from "../mappers/toQuoteDto";

export interface QuoteSummary {
  quote: Quote;
  joined: QuoteJoinedFields;
}

export interface FindAllQuotesOptions {
  page: number;
  pageSize: number;
  branchId?: string;
  customerId?: string;
  statuses?: QuoteStatus[];
  from?: Date;
  to?: Date;
  search?: string;
}

export interface QuoteSnapshotItemInput {
  productId: string;
  productPriceId: string;
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

export interface CreateQuoteData {
  branchId: string;
  customerId: string | null;
  folioId: string;
  creatorId: string;
  notes: string | null;
  expiresAt: Date | null;
  clientRequestId?: string | null;
  subtotal: number;
  taxTotal: number;
  total: number;
  items: QuoteSnapshotItemInput[];
}

export interface ReplaceQuoteItemsData {
  notes?: string | null;
  expiresAt?: Date | null;
  subtotal: number;
  taxTotal: number;
  total: number;
  items: QuoteSnapshotItemInput[];
}

export interface UpdateQuoteMetaData {
  notes?: string | null;
  expiresAt?: Date | null;
}

/**
 * Opaque transaction handle used by ConvertQuoteToSaleUseCase to mark a quote
 * `converted` within the same transaction that creates the sale. Kept opaque
 * (not `Prisma.TransactionClient`) so the application layer's port doesn't
 * depend on the ORM — `PrismaQuoteRepository` casts it internally.
 */
export type TxHandle = unknown;

export interface QuoteRepository {
  findAll(opts: FindAllQuotesOptions): Promise<{ items: QuoteSummary[]; total: number }>;
  findByIdWithItems(id: string): Promise<QuoteSummary | null>;
  /** Idempotent-replay lookup for offline-created quotes (see quotes-api "Idempotent replay via clientRequestId"). */
  findByClientRequestId(clientRequestId: string): Promise<QuoteSummary | null>;
  /** Atomic: increments folio + INSERT quote + INSERT items. NEVER touches inventory. */
  createWithItems(data: CreateQuoteData): Promise<QuoteSummary>;
  /** Atomic: DELETE items + INSERT new items + UPDATE totals/notes/expires. */
  replaceItemsAndRecalculate(id: string, data: ReplaceQuoteItemsData): Promise<QuoteSummary>;
  /** Only updates notes/expiresAt; never touches items or totals. */
  updateMeta(id: string, data: UpdateQuoteMetaData): Promise<QuoteSummary>;
  markAuthorized(id: string, userId: string, notesAppendix: string | null): Promise<QuoteSummary>;
  markCancelled(id: string, reason: string | null): Promise<QuoteSummary>;
  /** Called from within ConvertQuoteToSaleUseCase's transaction; tx is forwarded. */
  markConverted(id: string, saleId: string, tx?: TxHandle): Promise<QuoteSummary>;
}
