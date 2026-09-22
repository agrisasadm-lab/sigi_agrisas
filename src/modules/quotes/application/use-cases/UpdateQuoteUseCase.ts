import { QuoteRepository, QuoteSnapshotItemInput } from "../ports/QuoteRepository";
import { PosLookupService } from "@/modules/pos/application/ports/PosLookups";
import { UpdateQuoteRequest } from "../dto/UpdateQuoteRequest";
import { QuoteDetailDto } from "../dto/QuoteDto";
import { toQuoteDetailDto } from "../mappers/toQuoteDto";
import {
  QuoteTotalsCalculator,
  QuoteLineInput,
} from "../../domain/services/QuoteTotalsCalculator";
import { QuoteNotFoundError } from "../../domain/errors/QuoteNotFoundError";
import { QuoteNotEditableError } from "../../domain/errors/QuoteNotEditableError";
import { EmptyQuoteError } from "../../domain/errors/EmptyQuoteError";
import { ProductPriceMismatchError } from "../../domain/errors/ProductPriceMismatchError";
import { ProductPriceNotAvailableForBranchError } from "../../domain/errors/ProductPriceNotAvailableForBranchError";
import { ProductNotAvailableInBranchError } from "../../domain/errors/ProductNotAvailableInBranchError";
import { InactiveResourceError } from "../../domain/errors/InactiveResourceError";
import { isFractionalQuantity } from "@/modules/products/domain/services/isFractionalQuantity";

export interface UpdateQuoteResult {
  dto: QuoteDetailDto;
  branchId: string;
}

export class UpdateQuoteUseCase {
  constructor(
    private readonly repo: QuoteRepository,
    private readonly lookups: PosLookupService,
    private readonly branchScopedInventory: boolean = false
  ) {}

  async execute(id: string, req: UpdateQuoteRequest): Promise<UpdateQuoteResult> {
    const existing = await this.repo.findByIdWithItems(id);
    if (!existing) throw new QuoteNotFoundError(id);
    if (existing.quote.status !== "draft") {
      throw new QuoteNotEditableError(existing.quote.status);
    }

    // Parse expiresAt
    let expiresAt: Date | null | undefined = undefined;
    if (req.expiresAt !== undefined) {
      if (req.expiresAt === null) {
        expiresAt = null;
      } else {
        const parsed = new Date(req.expiresAt);
        if (Number.isNaN(parsed.getTime())) {
          throw new Error("expiresAt must be a valid ISO 8601 date");
        }
        if (parsed <= new Date()) {
          throw new Error("expiresAt must be in the future");
        }
        expiresAt = parsed;
      }
    }

    if (req.items === undefined) {
      // Only update meta (notes/expiresAt). Body must have at least one updatable field
      // — but the controller already enforces non-empty body; we just delegate.
      const summary = await this.repo.updateMeta(id, {
        notes: req.notes,
        expiresAt,
      });
      return {
        dto: toQuoteDetailDto(summary.quote, summary.joined),
        branchId: summary.quote.branchId,
      };
    }

    if (req.items.length === 0) throw new EmptyQuoteError();

    // Validate items + collect snapshots
    const calcLines: QuoteLineInput[] = [];
    const snapshotInputs: Array<Omit<QuoteSnapshotItemInput, "lineSubtotal" | "lineTax" | "lineTotal">> = [];

    for (const item of req.items) {
      if (!Number.isFinite(item.quantity) || item.quantity <= 0) {
        throw new Error("quantity must be > 0");
      }
      const [product, price] = await Promise.all([
        this.lookups.getProduct(item.productId),
        this.lookups.getProductPrice(item.productPriceId),
      ]);
      if (!product) throw new InactiveResourceError("Product not found");
      if (!product.isActive) throw new InactiveResourceError("Product");

      if (
        this.branchScopedInventory &&
        !(await this.lookups.isProductAvailableInBranch(item.productId, existing.quote.branchId))
      ) {
        throw new ProductNotAvailableInBranchError();
      }

      if (!price) throw new InactiveResourceError("Product price not found");
      if (price.productId !== item.productId) throw new ProductPriceMismatchError();
      if (price.branchId != null && price.branchId !== existing.quote.branchId) {
        throw new ProductPriceNotAvailableForBranchError();
      }
      if (price.branchId == null && (await this.lookups.hasBranchPriceOverrides(item.productId, existing.quote.branchId))) {
        throw new ProductPriceNotAvailableForBranchError();
      }

      let unitPrice = price.price;
      if (isFractionalQuantity(item.quantity)) {
        const surchargePct = await this.lookups.getDosificationSurchargePct();
        unitPrice = price.price * (1 + surchargePct / 100);
      }

      calcLines.push({
        quantity: item.quantity,
        unitPrice,
        discountPct: price.discountPct,
        ivaRate: product.ivaRate,
        iepsRate: product.iepsRate,
        isTaxable: product.isTaxable,
      });
      snapshotInputs.push({
        productId: product.id,
        productPriceId: price.id,
        productCodeSnapshot: product.code,
        productNameSnapshot: product.name,
        priceNameSnapshot: price.name,
        quantity: item.quantity,
        unitPrice,
        discountPct: price.discountPct,
        ivaRate: product.ivaRate,
        iepsRate: product.iepsRate,
      });
    }

    const totals = QuoteTotalsCalculator.computeTotals(calcLines);

    const items: QuoteSnapshotItemInput[] = snapshotInputs.map((si, idx) => ({
      ...si,
      lineSubtotal: totals.lines[idx].lineSubtotal,
      lineTax: totals.lines[idx].lineTax,
      lineTotal: totals.lines[idx].lineTotal,
    }));

    const summary = await this.repo.replaceItemsAndRecalculate(id, {
      notes: req.notes,
      expiresAt,
      subtotal: totals.subtotal,
      taxTotal: totals.taxTotal,
      total: totals.total,
      items,
    });

    return {
      dto: toQuoteDetailDto(summary.quote, summary.joined),
      branchId: summary.quote.branchId,
    };
  }
}
