import { QuoteRepository, QuoteSnapshotItemInput } from "../ports/QuoteRepository";
import { PosLookupService } from "@/modules/pos/application/ports/PosLookups";
import { CreateQuoteRequest } from "../dto/CreateQuoteRequest";
import { QuoteDetailDto } from "../dto/QuoteDto";
import { toQuoteDetailDto } from "../mappers/toQuoteDto";
import {
  QuoteTotalsCalculator,
  QuoteLineInput,
} from "../../domain/services/QuoteTotalsCalculator";
import { EmptyQuoteError } from "../../domain/errors/EmptyQuoteError";
import { ProductPriceMismatchError } from "../../domain/errors/ProductPriceMismatchError";
import { ProductPriceNotAvailableForBranchError } from "../../domain/errors/ProductPriceNotAvailableForBranchError";
import { ProductNotAvailableInBranchError } from "../../domain/errors/ProductNotAvailableInBranchError";
import { InactiveResourceError } from "../../domain/errors/InactiveResourceError";
import { FolioScopeMismatchError } from "@/shared/domain/errors/FolioScopeMismatchError";
import { isFractionalQuantity } from "@/modules/products/domain/services/isFractionalQuantity";

export interface CreateQuoteResult {
  dto: QuoteDetailDto;
  branchId: string;
}

export class CreateQuoteUseCase {
  constructor(
    private readonly repo: QuoteRepository,
    private readonly lookups: PosLookupService,
    private readonly branchScopedInventory: boolean = false
  ) {}

  async execute(req: CreateQuoteRequest, creatorId: string): Promise<CreateQuoteResult> {
    // Idempotent replay: a repeated clientRequestId (e.g. an offline-sync outbox
    // retry after a lost response) short-circuits before any other validation —
    // no re-validation, no folio allocation.
    if (req.clientRequestId) {
      const existing = await this.repo.findByClientRequestId(req.clientRequestId);
      if (existing) {
        return {
          dto: toQuoteDetailDto(existing.quote, existing.joined),
          branchId: existing.quote.branchId,
        };
      }
    }

    if (!req.items || req.items.length === 0) throw new EmptyQuoteError();

    // Validate expiresAt if present
    let expiresAt: Date | null = null;
    if (req.expiresAt) {
      const parsed = new Date(req.expiresAt);
      if (Number.isNaN(parsed.getTime())) {
        throw new Error("expiresAt must be a valid ISO 8601 date");
      }
      if (parsed <= new Date()) {
        throw new Error("expiresAt must be in the future");
      }
      expiresAt = parsed;
    }

    // Validate header resources
    const [customer, branch, folio] = await Promise.all([
      req.customerId ? this.lookups.getCustomer(req.customerId) : Promise.resolve(null),
      this.lookups.getBranch(req.branchId),
      this.lookups.getFolio(req.folioId),
    ]);

    if (req.customerId && !customer) throw new InactiveResourceError("Customer not found");
    if (req.customerId && customer && !customer.isActive) throw new InactiveResourceError("Customer");
    if (!branch) throw new InactiveResourceError("Branch not found");
    if (!branch.isActive) throw new InactiveResourceError("Branch");
    if (!folio) throw new InactiveResourceError("Folio not found");
    if (!folio.isActive) throw new InactiveResourceError("Folio");
    if (folio.scope !== "POS") throw new FolioScopeMismatchError("POS", folio.scope);

    // Resolve items: validate FKs + collect snapshots
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

      if (this.branchScopedInventory && !(await this.lookups.isProductAvailableInBranch(item.productId, req.branchId))) {
        throw new ProductNotAvailableInBranchError();
      }

      if (!price) throw new InactiveResourceError("Product price not found");
      if (price.productId !== item.productId) throw new ProductPriceMismatchError();
      if (price.branchId != null && price.branchId !== req.branchId) {
        throw new ProductPriceNotAvailableForBranchError();
      }
      if (price.branchId == null && (await this.lookups.hasBranchPriceOverrides(item.productId, req.branchId))) {
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
        ivaRate: product.isTaxable ? product.ivaRate : 0,
        iepsRate: product.isTaxable ? product.iepsRate : 0,
      });
    }

    const totals = QuoteTotalsCalculator.computeTotals(calcLines);

    const items: QuoteSnapshotItemInput[] = snapshotInputs.map((si, idx) => ({
      ...si,
      lineSubtotal: totals.lines[idx].lineSubtotal,
      lineTax: totals.lines[idx].lineTax,
      lineTotal: totals.lines[idx].lineTotal,
    }));

    const summary = await this.repo.createWithItems({
      branchId: req.branchId,
      customerId: req.customerId ?? null,
      folioId: req.folioId,
      creatorId,
      notes: req.notes ?? null,
      expiresAt,
      clientRequestId: req.clientRequestId ?? null,
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
