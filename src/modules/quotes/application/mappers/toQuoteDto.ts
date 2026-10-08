import { roundHalfToEven } from "@/shared/domain/services/roundHalfToEven";
import { Quote } from "../../domain/entities/Quote";
import { QuoteItem } from "../../domain/entities/QuoteItem";
import { QuoteDto, QuoteDetailDto } from "../dto/QuoteDto";
import { QuoteItemDto } from "../dto/QuoteItemDto";

export interface QuoteJoinedFields {
  branchName: string | null;
  customerName: string | null;
  customerRfc: string | null;
  creatorName: string | null;
}

export function toQuoteItemDto(it: QuoteItem): QuoteItemDto {
  return {
    id: it.id,
    productId: it.productId,
    productPriceId: it.productPriceId,
    productCodeSnapshot: it.productCodeSnapshot,
    productNameSnapshot: it.productNameSnapshot,
    priceNameSnapshot: it.priceNameSnapshot,
    quantity: it.quantity,
    unitPrice: it.unitPrice,
    discountPct: it.discountPct,
    discountAmount: it.discountAmount,
    ivaRate: it.ivaRate,
    iepsRate: it.iepsRate,
    lineSubtotal: it.lineSubtotal,
    lineIva: roundHalfToEven(it.lineSubtotal * (it.ivaRate ?? 0), 4),
    lineIeps: roundHalfToEven(it.lineSubtotal * (it.iepsRate ?? 0), 4),
    lineTax: it.lineTax,
    lineTotal: it.lineTotal,
  };
}

export function toQuoteDto(q: Quote, joined: QuoteJoinedFields, now: Date = new Date()): QuoteDto {
  return {
    id: q.id,
    folioId: q.folioId,
    folioCode: q.folioCode,
    folioNumber: q.folioNumber,
    branchId: q.branchId,
    branchName: joined.branchName,
    customerId: q.customerId,
    customerName: joined.customerName,
    customerRfc: joined.customerRfc,
    creatorId: q.creatorId,
    creatorName: joined.creatorName,
    status: q.status,
    subtotal: q.subtotal,
    taxTotal: q.taxTotal,
    total: q.total,
    notes: q.notes,
    expiresAt: q.expiresAt ? q.expiresAt.toISOString() : null,
    authorizedAt: q.authorizedAt ? q.authorizedAt.toISOString() : null,
    authorizedBy: q.authorizedBy,
    cancelledAt: q.cancelledAt ? q.cancelledAt.toISOString() : null,
    cancellationReason: q.cancellationReason,
    convertedAt: q.convertedAt ? q.convertedAt.toISOString() : null,
    convertedSaleId: q.convertedSaleId,
    isExpired: q.isExpiredNow(now),
    createdAt: q.createdAt.toISOString(),
    updatedAt: q.updatedAt.toISOString(),
  };
}

export function toQuoteDetailDto(
  q: Quote,
  joined: QuoteJoinedFields,
  now: Date = new Date()
): QuoteDetailDto {
  return { ...toQuoteDto(q, joined, now), items: q.items.map(toQuoteItemDto) };
}
