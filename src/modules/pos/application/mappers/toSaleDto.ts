import { roundHalfToEven } from "@/shared/domain/services/roundHalfToEven";
import { Sale } from "../../domain/entities/Sale";
import { SaleItem } from "../../domain/entities/SaleItem";
import { SaleDto, SaleDetailDto } from "../dto/SaleDto";
import { SaleItemDto } from "../dto/SaleItemDto";

export interface SaleJoinedFields {
  branchName: string | null;
  customerName: string | null;
  customerRfc: string | null;
  customerAddress: string | null;
  customerCreditDays: number | null;
  cashierName: string | null;
  paymentMethodCode: string | null;
  paymentMethodName: string | null;
  paymentMethodIsCredit: boolean;
}

export function toSaleItemDto(
  it: SaleItem,
  satProductCodeByProductId: Record<string, string | null> = {}
): SaleItemDto {
  return {
    id: it.id,
    productId: it.productId,
    productPriceId: it.productPriceId,
    productCodeSnapshot: it.productCodeSnapshot,
    productNameSnapshot: it.productNameSnapshot,
    priceNameSnapshot: it.priceNameSnapshot,
    satProductCode: satProductCodeByProductId[it.productId] ?? null,
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

export function toSaleDto(s: Sale, joined: SaleJoinedFields): SaleDto {
  return {
    id: s.id,
    folioId: s.folioId,
    folioCode: s.folioCode,
    folioNumber: s.folioNumber,
    branchId: s.branchId,
    branchName: joined.branchName,
    customerId: s.customerId,
    customerName: joined.customerName,
    customerRfc: joined.customerRfc,
    customerAddress: joined.customerAddress,
    customerCreditDays: joined.customerCreditDays,
    cashierId: s.cashierId,
    cashierName: joined.cashierName,
    paymentMethodId: s.paymentMethodId,
    paymentMethodCode: joined.paymentMethodCode,
    paymentMethodName: joined.paymentMethodName,
    isCredit: joined.paymentMethodIsCredit,
    quoteId: s.quoteId,
    status: s.status,
    paidAmount: s.paidAmount.toFixed(4),
    paymentStatus: s.paymentStatus,
    subtotal: s.subtotal,
    taxTotal: s.taxTotal,
    total: s.total,
    notes: s.notes,
    completedAt: s.completedAt ? s.completedAt.toISOString() : null,
    cancelledAt: s.cancelledAt ? s.cancelledAt.toISOString() : null,
    cancellationReason: s.cancellationReason,
    editedAt: s.editedAt ? s.editedAt.toISOString() : null,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  };
}

export function toSaleDetailDto(
  s: Sale,
  joined: SaleJoinedFields,
  returnedAggregate: Record<string, number> = {},
  satProductCodeByProductId: Record<string, string | null> = {}
): SaleDetailDto {
  return {
    ...toSaleDto(s, joined),
    items: s.items.map((it) => toSaleItemDto(it, satProductCodeByProductId)),
    returnedQuantityBySaleItem: returnedAggregate,
  };
}
