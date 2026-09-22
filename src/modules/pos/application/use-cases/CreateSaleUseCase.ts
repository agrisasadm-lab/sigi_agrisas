import { SaleRepository, SnapshotItemInput } from "../ports/SaleRepository";
import { PosLookupService } from "../ports/PosLookups";
import { QuoteRepository } from "@/modules/quotes/application/ports/QuoteRepository";
import { CreateSaleRequest } from "../dto/CreateSaleRequest";
import { SaleDetailDto } from "../dto/SaleDto";
import { toSaleDetailDto } from "../mappers/toSaleDto";
import { SaleTotalsCalculator, SaleLineInput } from "../../domain/services/SaleTotalsCalculator";
import { EmptySaleError } from "../../domain/errors/EmptySaleError";
import { ProductPriceMismatchError } from "../../domain/errors/ProductPriceMismatchError";
import { ProductPriceNotAvailableForBranchError } from "../../domain/errors/ProductPriceNotAvailableForBranchError";
import { DosificationMismatchError } from "../../domain/errors/DosificationMismatchError";
import { DosificationRequiresDefaultPriceError } from "../../domain/errors/DosificationRequiresDefaultPriceError";
import { DosificationPriceCalculator } from "@/modules/products/domain/services/DosificationPriceCalculator";
import { isFractionalQuantity } from "@/modules/products/domain/services/isFractionalQuantity";
import { InactiveResourceError } from "../../domain/errors/InactiveResourceError";
import { QuoteLinkInvalidError } from "../../domain/errors/QuoteLinkInvalidError";
import { FolioScopeMismatchError } from "@/shared/domain/errors/FolioScopeMismatchError";
import { ProductNotAvailableInBranchError } from "../../domain/errors/ProductNotAvailableInBranchError";

export interface CreateSaleResult {
  dto: SaleDetailDto;
  branchId: string;
  creditLimitExceeded: boolean;
}

export class CreateSaleUseCase {
  constructor(
    private readonly saleRepo: SaleRepository,
    private readonly lookups: PosLookupService,
    /**
     * Optional. When present, `req.quoteId` is validated against this repository
     * before persisting the sale and the corresponding quote is marked converted
     * inside the same transaction (createCompletedFromQuote path).
     */
    private readonly quoteRepo?: QuoteRepository,
    private readonly branchScopedInventory: boolean = false
  ) {}

  async execute(req: CreateSaleRequest, cashierId: string): Promise<CreateSaleResult> {
    // 0. Idempotent replay: a repeated clientRequestId (e.g. an offline-sync outbox
    //    retry after a lost response) short-circuits before any other validation —
    //    no re-validation, no folio allocation, no inventory decrement.
    if (req.clientRequestId) {
      const existing = await this.saleRepo.findByClientRequestId(req.clientRequestId);
      if (existing) {
        return {
          dto: toSaleDetailDto(existing.sale, existing.joined),
          branchId: existing.sale.branchId,
          creditLimitExceeded: false,
        };
      }
    }

    if (!req.items || req.items.length === 0) throw new EmptySaleError();

    // 1. Validate header resources
    const [customer, branch, folio, payment] = await Promise.all([
      req.customerId ? this.lookups.getCustomer(req.customerId) : Promise.resolve(null),
      this.lookups.getBranch(req.branchId),
      this.lookups.getFolio(req.folioId),
      this.lookups.getPaymentMethod(req.paymentMethodId),
    ]);

    if (req.customerId && !customer) throw new InactiveResourceError("Customer not found");
    if (customer && !customer.isActive) throw new InactiveResourceError("Customer");
    if (!branch) throw new InactiveResourceError("Branch not found");
    if (!branch.isActive) throw new InactiveResourceError("Branch");
    if (!folio) throw new InactiveResourceError("Folio not found");
    if (folio.scope !== "POS") throw new FolioScopeMismatchError("POS", folio.scope);
    if (!folio.isActive) throw new InactiveResourceError("Folio");
    if (!payment) throw new InactiveResourceError("Payment method not found");
    if (!payment.isActive) throw new InactiveResourceError("Payment method");

    // Credit pre-check: credit sales never block on missing credit line or exceeded limit
    // (business decision: always allow the sale, only warn via creditLimitExceeded below).
    if (payment.isCredit && !customer) {
      throw new InactiveResourceError("Customer required for credit sales");
    }
    const creditAvailable: number | null =
      payment.isCredit && customer!.creditLimit !== null ? customer!.creditLimit - customer!.currentBalance : null;

    // 1b. Validate quoteId when provided
    let validatedQuoteId: string | null = null;
    if (req.quoteId) {
      if (!this.quoteRepo) {
        throw new Error("quoteId provided but QuoteRepository not injected");
      }
      const quoteSummary = await this.quoteRepo.findByIdWithItems(req.quoteId);
      if (!quoteSummary) throw new QuoteLinkInvalidError("Quote not found", "not_found");
      const q = quoteSummary.quote;
      if (q.status !== "authorized" || q.convertedSaleId !== null) {
        throw new QuoteLinkInvalidError(
          `Quote cannot be linked to a new sale (status=${q.status})`,
          "wrong_status"
        );
      }
      if (q.branchId !== req.branchId) {
        throw new QuoteLinkInvalidError(
          "Quote branchId does not match sale branchId",
          "branch_mismatch"
        );
      }
      if (q.customerId !== req.customerId) {
        throw new QuoteLinkInvalidError(
          "Quote customerId does not match sale customerId",
          "customer_mismatch"
        );
      }
      validatedQuoteId = req.quoteId;
    }

    // 2. Resolve each item: validate FK consistency + collect snapshots
    const calcLines: SaleLineInput[] = [];
    const snapshotInputs: Array<Omit<SnapshotItemInput, "lineSubtotal" | "lineTax" | "lineTotal">> = [];

    for (const item of req.items) {
      if (!Number.isFinite(item.quantity) || item.quantity <= 0) {
        throw new Error("quantity must be > 0");
      }

      if (Boolean(item.productPriceId) === Boolean(item.dosificationId)) {
        throw new Error("Exactly one of productPriceId or dosificationId is required");
      }

      const product = await this.lookups.getProduct(item.productId);
      if (!product) throw new InactiveResourceError("Product not found");
      if (!product.isActive) throw new InactiveResourceError("Product");

      if (this.branchScopedInventory && !(await this.lookups.isProductAvailableInBranch(item.productId, req.branchId))) {
        throw new ProductNotAvailableInBranchError();
      }

      let unitPrice: number;
      let discountPct: number | null;
      let priceNameSnapshot: string;
      let productPriceId: string | null;
      let dosificationId: string | null;
      let numPartsSnapshot: number | null;

      if (item.dosificationId) {
        const dosification = await this.lookups.getDosificationForSale(item.dosificationId, req.branchId);
        if (!dosification) throw new InactiveResourceError("Dosification not found");
        if (dosification.productId !== item.productId) throw new DosificationMismatchError();
        if (!dosification.isActive) throw new InactiveResourceError("Dosification");
        if (dosification.basePrice === null) throw new DosificationRequiresDefaultPriceError();

        const surchargePct = await this.lookups.getDosificationSurchargePct();
        unitPrice = DosificationPriceCalculator.computeUnitPrice(dosification.basePrice, dosification.numParts, surchargePct);
        discountPct = null;
        priceNameSnapshot = dosification.name;
        productPriceId = null;
        dosificationId = dosification.id;
        numPartsSnapshot = dosification.numParts;
      } else {
        const price = await this.lookups.getProductPrice(item.productPriceId!);
        if (!price) throw new InactiveResourceError("Product price not found");
        if (price.productId !== item.productId) throw new ProductPriceMismatchError();
        if (price.branchId != null && price.branchId !== req.branchId) {
          throw new ProductPriceNotAvailableForBranchError();
        }
        if (price.branchId == null && (await this.lookups.hasBranchPriceOverrides(item.productId, req.branchId))) {
          throw new ProductPriceNotAvailableForBranchError();
        }

        if (isFractionalQuantity(item.quantity)) {
          const surchargePct = await this.lookups.getDosificationSurchargePct();
          unitPrice = price.price * (1 + surchargePct / 100);
        } else {
          unitPrice = price.price;
        }
        discountPct = price.discountPct;
        priceNameSnapshot = price.name;
        productPriceId = price.id;
        dosificationId = null;
        numPartsSnapshot = null;
      }

      calcLines.push({
        quantity: item.quantity,
        unitPrice,
        discountPct,
        ivaRate: product.ivaRate,
        iepsRate: product.iepsRate,
        isTaxable: product.isTaxable,
      });

      snapshotInputs.push({
        productId: product.id,
        productPriceId,
        dosificationId,
        numPartsSnapshot,
        productCodeSnapshot: product.code,
        productNameSnapshot: product.name,
        priceNameSnapshot,
        quantity: item.quantity,
        unitPrice,
        discountPct,
        ivaRate: product.isTaxable ? product.ivaRate : 0,
        iepsRate: product.isTaxable ? product.iepsRate : 0,
      });
    }

    // 3. Compute totals via pure domain service
    const totals = SaleTotalsCalculator.computeTotals(calcLines);

    // 3b. Compute informational credit-limit-exceeded flag now that we have the final total.
    // Non-blocking: the sale always proceeds, even over the limit or without a credit line.
    let paidAmount = totals.total;
    let paymentStatus = "paid";
    const creditLimitExceeded = payment.isCredit && creditAvailable !== null && creditAvailable < totals.total;
    if (payment.isCredit) {
      paidAmount = 0;
      paymentStatus = "pending";
    }

    // 4. Compose snapshot items with computed line totals
    const items: SnapshotItemInput[] = snapshotInputs.map((si, idx) => ({
      ...si,
      lineSubtotal: totals.lines[idx].lineSubtotal,
      lineTax: totals.lines[idx].lineTax,
      lineTotal: totals.lines[idx].lineTotal,
    }));

    // 5. Delegate atomic emission to the repository. When quoteId is set,
    //    use createCompletedFromQuote so the quote is marked converted in the same tx.
    const summary = validatedQuoteId
      ? await this.saleRepo.createCompletedFromQuote({
          quoteId: validatedQuoteId,
          branchId: req.branchId,
          customerId: req.customerId ?? null,
          cashierId,
          paymentMethodId: req.paymentMethodId,
          folioId: req.folioId,
          notes: req.notes ?? null,
          clientRequestId: req.clientRequestId ?? null,
          paidAmount,
          paymentStatus,
          subtotal: totals.subtotal,
          taxTotal: totals.taxTotal,
          total: totals.total,
          items,
        })
      : await this.saleRepo.createCompleted({
          branchId: req.branchId,
          customerId: req.customerId ?? null,
          cashierId,
          paymentMethodId: req.paymentMethodId,
          folioId: req.folioId,
          notes: req.notes ?? null,
          clientRequestId: req.clientRequestId ?? null,
          paidAmount,
          paymentStatus,
          subtotal: totals.subtotal,
          taxTotal: totals.taxTotal,
          total: totals.total,
          items,
        });

    return {
      dto: toSaleDetailDto(summary.sale, summary.joined),
      branchId: summary.sale.branchId,
      creditLimitExceeded,
    };
  }
}
