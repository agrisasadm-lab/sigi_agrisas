import { QuoteRepository } from "../ports/QuoteRepository";
import { SaleRepository } from "@/modules/pos/application/ports/SaleRepository";
import { PosLookupService } from "@/modules/pos/application/ports/PosLookups";
import { ConvertQuoteRequest } from "../dto/ConvertQuoteRequest";
import { SaleDetailDto } from "@/modules/pos/application/dto/SaleDto";
import { toSaleDetailDto } from "@/modules/pos/application/mappers/toSaleDto";
import { QuoteNotFoundError } from "../../domain/errors/QuoteNotFoundError";
import { QuoteNotAuthorizedError } from "../../domain/errors/QuoteNotAuthorizedError";
import { QuoteExpiredError } from "../../domain/errors/QuoteExpiredError";
import { InactiveResourceError } from "../../domain/errors/InactiveResourceError";
import { FolioScopeMismatchError } from "@/shared/domain/errors/FolioScopeMismatchError";
import { ProductNotAvailableInBranchError } from "../../domain/errors/ProductNotAvailableInBranchError";

export interface ConvertQuoteResult {
  dto: SaleDetailDto;
  branchId: string;
  creditLimitExceeded: boolean;
}

export class ConvertQuoteToSaleUseCase {
  constructor(
    private readonly quoteRepo: QuoteRepository,
    private readonly saleRepo: SaleRepository,
    private readonly lookups: PosLookupService,
    private readonly branchScopedInventory: boolean = false
  ) {}

  async execute(
    id: string,
    req: ConvertQuoteRequest,
    cashierId: string
  ): Promise<ConvertQuoteResult> {
    const existing = await this.quoteRepo.findByIdWithItems(id);
    if (!existing) throw new QuoteNotFoundError(id);

    // Idempotent path: already converted → return the existing sale
    if (existing.quote.status === "converted" && existing.quote.convertedSaleId) {
      const sale = await this.saleRepo.findByIdWithItems(existing.quote.convertedSaleId);
      if (!sale) {
        // Defensive: the convertedSaleId pointed to a sale that no longer exists
        // (e.g. FK SET NULL was triggered out-of-band). Treat as a hard error.
        throw new Error(
          `Quote ${id} is marked as converted but the linked sale ${existing.quote.convertedSaleId} no longer exists`
        );
      }
      return {
        dto: toSaleDetailDto(sale.sale, sale.joined),
        branchId: sale.sale.branchId,
        creditLimitExceeded: false,
      };
    }

    if (existing.quote.status !== "authorized") {
      throw new QuoteNotAuthorizedError(existing.quote.status);
    }
    if (existing.quote.expiresAt && existing.quote.expiresAt < new Date()) {
      throw new QuoteExpiredError();
    }

    // Availability may have changed since the quote was created/authorized (e.g. an
    // admin unassigned the product from this branch in the meantime) — re-check here
    // so conversion fails with a clear 400 instead of falling through to the raw
    // write-layer guard in PrismaSaleRepository.createCompletedFromQuote.
    if (this.branchScopedInventory) {
      for (const item of existing.quote.items) {
        if (!(await this.lookups.isProductAvailableInBranch(item.productId, existing.quote.branchId))) {
          throw new ProductNotAvailableInBranchError();
        }
      }
    }

    // Validate fiscal folio + payment method
    const [folio, payment] = await Promise.all([
      this.lookups.getFolio(req.folioId),
      this.lookups.getPaymentMethod(req.paymentMethodId),
    ]);
    if (!folio) throw new InactiveResourceError("Folio not found");
    if (!folio.isActive) throw new InactiveResourceError("Folio");
    if (folio.scope !== "POS") throw new FolioScopeMismatchError("POS", folio.scope);
    if (!payment) throw new InactiveResourceError("Payment method not found");
    if (!payment.isActive) throw new InactiveResourceError("Payment method");

    // Credit flow (non-blocking): compute an informational flag, never abort the conversion.
    let paidAmount = existing.quote.total;
    let paymentStatus = "paid";
    let creditLimitExceeded = false;
    if (payment.isCredit && existing.quote.customerId) {
      const customer = await this.lookups.getCustomer(existing.quote.customerId);
      if (customer && customer.creditLimit !== null) {
        const available = customer.creditLimit - customer.currentBalance;
        creditLimitExceeded = available < existing.quote.total;
      }
      paidAmount = 0;
      paymentStatus = "pending";
    }

    const sale = await this.saleRepo.createCompletedFromQuote({
      quoteId: existing.quote.id,
      branchId: existing.quote.branchId,
      customerId: existing.quote.customerId,
      paymentMethodId: req.paymentMethodId,
      folioId: req.folioId,
      cashierId,
      notes: req.notes !== undefined ? req.notes : existing.quote.notes,
      paidAmount,
      paymentStatus,
      subtotal: existing.quote.subtotal,
      taxTotal: existing.quote.taxTotal,
      total: existing.quote.total,
      items: existing.quote.items.map((it) => ({
        productId: it.productId,
        productPriceId: it.productPriceId,
        dosificationId: null,
        numPartsSnapshot: null,
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
        lineTax: it.lineTax,
        lineTotal: it.lineTotal,
      })),
    });

    // Ensure both sides of the link are consistent. The PrismaSaleRepository
    // implementation already updates the quote inside its transaction; this
    // second call is an idempotent no-op there. For InMemorySaleRepository
    // (and any other future impl that doesn't auto-mark) this guarantees the
    // quote moves to 'converted' so subsequent reads/retries see the link.
    await this.quoteRepo.markConverted(existing.quote.id, sale.sale.id);

    return {
      dto: toSaleDetailDto(sale.sale, sale.joined),
      branchId: sale.sale.branchId,
      creditLimitExceeded,
    };
  }
}
