import { roundHalfToEven } from "@/shared/domain/services/roundHalfToEven";
import { Return } from "../../domain/entities/Return";
import { ReturnItem } from "../../domain/entities/ReturnItem";
import { ReturnDto, ReturnDetailDto, ReturnItemDto } from "../dto/ReturnDto";
import { ReturnJoinedFields } from "../ports/ReturnRepository";

export function toReturnItemDto(item: ReturnItem): ReturnItemDto {
  return {
    id: item.id,
    returnId: item.returnId,
    saleItemId: item.saleItemId,
    productId: item.productId,
    productPriceId: item.productPriceId,
    productCodeSnapshot: item.productCodeSnapshot,
    productNameSnapshot: item.productNameSnapshot,
    priceNameSnapshot: item.priceNameSnapshot,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    discountPct: item.discountPct,
    discountAmount: item.discountAmount,
    ivaRate: item.ivaRate,
    iepsRate: item.iepsRate,
    lineSubtotal: item.lineSubtotal,
    lineIva: roundHalfToEven(item.lineSubtotal * (item.ivaRate ?? 0), 4),
    lineIeps: roundHalfToEven(item.lineSubtotal * (item.iepsRate ?? 0), 4),
    lineTax: item.lineTax,
    lineTotal: item.lineTotal,
  };
}

export function toReturnDto(ret: Return, joined: ReturnJoinedFields): ReturnDto {
  return {
    id: ret.id,
    saleId: ret.saleId,
    saleFolioCode: joined.saleFolioCode,
    saleFolioNumber: joined.saleFolioNumber,
    branchId: ret.branchId,
    branchName: joined.branchName,
    customerId: ret.customerId,
    customerName: joined.customerName,
    customerRfc: joined.customerRfc,
    creatorId: ret.creatorId,
    creatorName: joined.creatorName,
    status: ret.status,
    reason: ret.reason,
    returnedAt: ret.returnedAt.toISOString(),
    refundSubtotal: ret.refundSubtotal,
    refundTax: ret.refundTax,
    refundTotal: ret.refundTotal,
    notes: ret.notes,
    cancelledAt: ret.cancelledAt?.toISOString() ?? null,
    cancelledBy: ret.cancelledBy,
    cancellationReason: ret.cancellationReason,
    createdAt: ret.createdAt.toISOString(),
    updatedAt: ret.updatedAt.toISOString(),
  };
}

export function toReturnDetailDto(
  ret: Return,
  items: ReturnItem[],
  joined: ReturnJoinedFields
): ReturnDetailDto {
  return {
    ...toReturnDto(ret, joined),
    items: items.map(toReturnItemDto),
  };
}
