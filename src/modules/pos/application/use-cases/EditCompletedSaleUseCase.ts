import { SaleRepository, SnapshotItemInput } from "../ports/SaleRepository";
import { PosLookupService } from "../ports/PosLookups";
import { EditCompletedSaleRequest } from "../dto/EditCompletedSaleRequest";
import { SaleDetailDto } from "../dto/SaleDto";
import { toSaleDetailDto } from "../mappers/toSaleDto";
import { SaleTotalsCalculator, SaleLineInput } from "../../domain/services/SaleTotalsCalculator";
import { SaleNotFoundError } from "../../domain/errors/SaleNotFoundError";
import { EmptySaleError } from "../../domain/errors/EmptySaleError";
import { ProductPriceMismatchError } from "../../domain/errors/ProductPriceMismatchError";
import { ProductPriceNotAvailableForBranchError } from "../../domain/errors/ProductPriceNotAvailableForBranchError";
import { DosificationMismatchError } from "../../domain/errors/DosificationMismatchError";
import { DosificationRequiresDefaultPriceError } from "../../domain/errors/DosificationRequiresDefaultPriceError";
import { DosificationPriceCalculator } from "@/modules/products/domain/services/DosificationPriceCalculator";
import { isFractionalQuantity } from "@/modules/products/domain/services/isFractionalQuantity";
import { CancelledSaleNotEditableError } from "../../domain/errors/CancelledSaleNotEditableError";
import { ReturnedTotalSaleNotEditableError } from "../../domain/errors/ReturnedTotalSaleNotEditableError";
import { InactiveResourceError } from "../../domain/errors/InactiveResourceError";
import { ProductNotAvailableInBranchError } from "../../domain/errors/ProductNotAvailableInBranchError";

export interface EditCompletedSaleResult {
  dto: SaleDetailDto;
  branchId: string;
}

export class EditCompletedSaleUseCase {
  constructor(
    private readonly saleRepo: SaleRepository,
    private readonly lookups: PosLookupService,
    private readonly branchScopedInventory: boolean = false
  ) {}

  async execute(id: string, req: EditCompletedSaleRequest): Promise<EditCompletedSaleResult> {
    const existing = await this.saleRepo.findByIdWithItems(id);
    if (!existing) throw new SaleNotFoundError(id);
    if (existing.sale.status === "cancelled") throw new CancelledSaleNotEditableError();
    if (existing.sale.status === "returned_total") throw new ReturnedTotalSaleNotEditableError();
    if (!req.items || req.items.length === 0) throw new EmptySaleError();

    // Validate optional reassignments
    if (req.customerId) {
      const customer = await this.lookups.getCustomer(req.customerId);
      if (!customer || !customer.isActive) throw new InactiveResourceError("Customer");
    }
    if (req.paymentMethodId) {
      const pm = await this.lookups.getPaymentMethod(req.paymentMethodId);
      if (!pm || !pm.isActive) throw new InactiveResourceError("Payment method");
    }

    // Resolve items + snapshots
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

      if (
        this.branchScopedInventory &&
        !(await this.lookups.isProductAvailableInBranch(item.productId, existing.sale.branchId))
      ) {
        throw new ProductNotAvailableInBranchError();
      }

      let unitPrice: number;
      let discountPct: number | null;
      let priceNameSnapshot: string;
      let productPriceId: string | null;
      let dosificationId: string | null;
      let numPartsSnapshot: number | null;

      if (item.dosificationId) {
        const dosification = await this.lookups.getDosificationForSale(item.dosificationId, existing.sale.branchId);
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
        if (price.branchId != null && price.branchId !== existing.sale.branchId) {
          throw new ProductPriceNotAvailableForBranchError();
        }
        if (price.branchId == null && (await this.lookups.hasBranchPriceOverrides(item.productId, existing.sale.branchId))) {
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
        ivaRate: product.ivaRate,
        iepsRate: product.iepsRate,
      });
    }

    const totals = SaleTotalsCalculator.computeTotals(calcLines);

    const items: SnapshotItemInput[] = snapshotInputs.map((si, idx) => ({
      ...si,
      lineSubtotal: totals.lines[idx].lineSubtotal,
      lineTax: totals.lines[idx].lineTax,
      lineTotal: totals.lines[idx].lineTotal,
    }));

    const summary = await this.saleRepo.replaceItemsAndRecalculate(id, {
      customerId: req.customerId,
      paymentMethodId: req.paymentMethodId,
      notes: req.notes,
      subtotal: totals.subtotal,
      taxTotal: totals.taxTotal,
      total: totals.total,
      items,
    });

    return {
      dto: toSaleDetailDto(summary.sale, summary.joined),
      branchId: summary.sale.branchId,
    };
  }
}
