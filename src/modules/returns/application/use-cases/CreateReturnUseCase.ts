import { ReturnRepository, CreateReturnData } from "../ports/ReturnRepository";
import { SaleRepository } from "@/modules/pos/application/ports/SaleRepository";
import { CreateReturnRequest, ReturnDetailDto } from "../dto/ReturnDto";
import { toReturnDetailDto } from "../mappers/toReturnDto";
import { ReturnTotalsCalculator } from "../../domain/services/ReturnTotalsCalculator";
import { ReturnableQuantityCalculator } from "../../domain/services/ReturnableQuantityCalculator";
import { SaleNotReturnableError } from "../../domain/errors/SaleNotReturnableError";
import { ReturnItemsEmptyError } from "../../domain/errors/ReturnItemsEmptyError";
import { SaleItemNotPartOfSaleError } from "../../domain/errors/SaleItemNotPartOfSaleError";
import { ReturnQuantityExceedsRemainingError } from "../../domain/errors/ReturnQuantityExceedsRemainingError";
import { ReturnInvalidQuantityError } from "../../domain/errors/ReturnInvalidQuantityError";

export class CreateReturnUseCase {
  constructor(
    private readonly returnRepo: ReturnRepository,
    private readonly saleRepo: SaleRepository
  ) {}

  async execute(req: CreateReturnRequest): Promise<ReturnDetailDto> {
    if (!req.items || req.items.length === 0) {
      throw new ReturnItemsEmptyError();
    }

    // Load sale with items
    const saleSummary = await this.saleRepo.findByIdWithItems(req.saleId);
    if (!saleSummary) {
      throw new Error("Sale not found");
    }

    const { sale } = saleSummary;

    if (sale.status !== "completed") {
      throw new SaleNotReturnableError(sale.status);
    }

    // Build a map of saleItemId -> SaleItem for O(1) lookup
    const saleItemMap = new Map(sale.items.map((si) => [si.id, si]));

    // Validate each requested item belongs to this sale
    for (const reqItem of req.items) {
      if (!saleItemMap.has(reqItem.saleItemId)) {
        throw new SaleItemNotPartOfSaleError(reqItem.saleItemId);
      }
    }

    // Load prior return items for all requested sale item IDs
    const saleItemIds = req.items.map((i) => i.saleItemId);
    const priorItems = await this.returnRepo.findPriorReturnItemsBySaleItemIds(saleItemIds);

    // Group prior items by saleItemId
    const priorByItem = new Map<string, Array<{ quantity: number; returnStatus: string }>>();
    for (const prior of priorItems) {
      const group = priorByItem.get(prior.saleItemId) ?? [];
      group.push({ quantity: prior.quantity, returnStatus: prior.returnStatus });
      priorByItem.set(prior.saleItemId, group);
    }

    // Validate quantities and build snapshot items
    const snapshotItems: CreateReturnData["items"] = [];
    const totalsInput: Array<{
      quantity: number;
      unitPrice: number;
      discountPct: number | null;
      discountAmount: number;
      ivaRate: number | null;
      iepsRate: number | null;
    }> = [];

    for (const reqItem of req.items) {
      if (reqItem.quantity <= 0) {
        throw new ReturnInvalidQuantityError(reqItem.saleItemId, reqItem.quantity);
      }
      const saleItem = saleItemMap.get(reqItem.saleItemId)!;
      const prior = priorByItem.get(reqItem.saleItemId) ?? [];
      const remaining = ReturnableQuantityCalculator.computeRemaining(
        saleItem.quantity,
        prior.map((p) => ({
          quantity: p.quantity,
          returnStatus: p.returnStatus as "completed" | "cancelled",
        }))
      );

      if (reqItem.quantity > remaining) {
        throw new ReturnQuantityExceedsRemainingError(
          reqItem.saleItemId,
          reqItem.quantity,
          remaining
        );
      }

      snapshotItems.push({
        saleItemId: saleItem.id,
        productId: saleItem.productId,
        productPriceId: saleItem.productPriceId,
        dosificationId: saleItem.dosificationId,
        numPartsSnapshot: saleItem.numPartsSnapshot,
        productCodeSnapshot: saleItem.productCodeSnapshot,
        productNameSnapshot: saleItem.productNameSnapshot,
        priceNameSnapshot: saleItem.priceNameSnapshot,
        quantity: reqItem.quantity,
        unitPrice: saleItem.unitPrice,
        discountPct: saleItem.discountPct,
        discountAmount: saleItem.discountAmount,
        ivaRate: saleItem.ivaRate,
        iepsRate: saleItem.iepsRate,
        lineSubtotal: 0, // filled below
        lineTax: 0,
        lineTotal: 0,
      });

      totalsInput.push({
        quantity: reqItem.quantity,
        unitPrice: saleItem.unitPrice,
        discountPct: saleItem.discountPct,
        discountAmount: saleItem.discountAmount,
        ivaRate: saleItem.ivaRate,
        iepsRate: saleItem.iepsRate,
      });
    }

    // Compute totals
    const totalsResult = ReturnTotalsCalculator.computeTotals(totalsInput);
    for (let i = 0; i < snapshotItems.length; i++) {
      snapshotItems[i].lineSubtotal = totalsResult.lines[i].lineSubtotal;
      snapshotItems[i].lineTax = totalsResult.lines[i].lineTax;
      snapshotItems[i].lineTotal = totalsResult.lines[i].lineTotal;
    }

    const createData: CreateReturnData = {
      saleId: req.saleId,
      branchId: sale.branchId,
      customerId: sale.customerId,
      creatorId: req.creatorId,
      reason: req.reason,
      returnedAt: req.returnedAt,
      refundSubtotal: totalsResult.subtotal,
      refundTax: totalsResult.taxTotal,
      refundTotal: totalsResult.total,
      notes: req.notes ?? null,
      markSaleReturnedTotalId: req.markSaleReturnedTotalId,
      items: snapshotItems,
    };

    const { return: ret, items, joined } = await this.returnRepo.createWithItems(createData);
    return toReturnDetailDto(ret, items, joined);
  }
}
