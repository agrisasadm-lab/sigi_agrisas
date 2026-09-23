import { randomUUID } from "crypto";
import {
  PurchaseRepository,
  FindAllPurchasesOptions,
  CreatePurchaseData,
  PurchaseSummary,
  PurchaseWithItems,
  PurchaseJoinedFields,
} from "../../application/ports/PurchaseRepository";
import { Purchase } from "../../domain/entities/Purchase";
import { PurchaseItem } from "../../domain/entities/PurchaseItem";
import { ProviderPayment } from "../../domain/entities/ProviderPayment";
import { PurchasePaymentStatus } from "../../domain/value-objects/PurchasePaymentStatus";
import { PurchaseTotalsCalculator } from "../../domain/services/PurchaseTotalsCalculator";
import { ProviderNotFoundOrInactiveError } from "../../domain/errors/ProviderNotFoundOrInactiveError";
import { ProductNotFoundOrInactiveError } from "../../domain/errors/ProductNotFoundOrInactiveError";
import { PurchaseHasActiveProviderPaymentsError } from "../../domain/errors/PurchaseHasActiveProviderPaymentsError";
import { SatUuidAlreadyExistsError } from "../../domain/errors/SatUuidAlreadyExistsError";
import { InactiveResourceError } from "@/modules/pos/domain/errors/InactiveResourceError";

interface ProviderMock {
  id: string;
  code: string;
  name: string;
  rfc: string;
  isActive: boolean;
  currentBalance: number;
}

interface BranchMock {
  id: string;
  name: string;
  isActive: boolean;
}

interface PaymentMethodMock {
  id: string;
  code: string;
  isCredit: boolean;
  isActive: boolean;
}

interface ProductMock {
  id: string;
  code: string;
  name: string;
  ivaRate: number | null;
  iepsRate: number | null;
  isTaxable: boolean;
  isActive: boolean;
  acquisitionPrice?: number | null;
}

export interface InventoryLotMock {
  id: string;
  branchId: string;
  productId: string;
  purchaseItemId: string;
  lotNumber: string;
  expirationDate: Date;
  manufactureDate: Date | null;
  quantity: number;
}

export class InMemoryPurchaseRepository implements PurchaseRepository {
  private purchases = new Map<string, Purchase>();
  private itemsByPurchase = new Map<string, PurchaseItem[]>();
  providerPaymentsByPurchase = new Map<string, ProviderPayment[]>();
  inventoryLots = new Map<string, InventoryLotMock>();
  providers = new Map<string, ProviderMock>();
  branches = new Map<string, BranchMock>();
  paymentMethods = new Map<string, PaymentMethodMock>();
  products = new Map<string, ProductMock>();
  // Contador por sucursal — espejo de folio_branch_counters (CP es branch-scoped), no del contador global.
  private folioCounterByBranch = new Map<string, number>();

  seedProvider(provider: ProviderMock): void {
    this.providers.set(provider.id, { ...provider });
  }

  seedBranch(branch: BranchMock): void {
    this.branches.set(branch.id, { ...branch });
  }

  seedPaymentMethod(pm: PaymentMethodMock): void {
    this.paymentMethods.set(pm.id, { ...pm });
  }

  seedProduct(product: ProductMock): void {
    this.products.set(product.id, { ...product });
  }

  private joinedFor(purchase: Purchase): PurchaseJoinedFields {
    const provider = this.providers.get(purchase.providerId);
    const branch = this.branches.get(purchase.branchId);
    const pm = this.paymentMethods.get(purchase.paymentMethodId);
    return {
      providerName: provider?.name ?? null,
      providerRfc: provider?.rfc ?? null,
      branchName: branch?.name ?? null,
      paymentMethodCode: pm?.code ?? null,
      paymentMethodIsCredit: pm?.isCredit ?? false,
      creatorName: null,
    };
  }

  async findAll(opts: FindAllPurchasesOptions): Promise<{ items: PurchaseSummary[]; total: number }> {
    let all = Array.from(this.purchases.values());
    if (opts.branchId) all = all.filter((p) => p.branchId === opts.branchId);
    if (opts.providerId) all = all.filter((p) => p.providerId === opts.providerId);
    if (opts.statuses && opts.statuses.length > 0) all = all.filter((p) => opts.statuses!.includes(p.status));
    if (opts.from) all = all.filter((p) => p.purchasedAt >= opts.from!);
    if (opts.to) all = all.filter((p) => p.purchasedAt <= opts.to!);

    all.sort((a, b) => b.purchasedAt.getTime() - a.purchasedAt.getTime());
    const total = all.length;
    const skip = (opts.page - 1) * opts.pageSize;
    const page = all.slice(skip, skip + opts.pageSize);

    return {
      items: page.map((purchase) => ({ purchase, joined: this.joinedFor(purchase) })),
      total,
    };
  }

  async findByIdWithItems(id: string): Promise<PurchaseWithItems | null> {
    const purchase = this.purchases.get(id);
    if (!purchase) return null;
    return {
      purchase,
      items: this.itemsByPurchase.get(id) ?? [],
      providerPayments: this.providerPaymentsByPurchase.get(id) ?? [],
      joined: this.joinedFor(purchase),
    };
  }

  async createCompleted(data: CreatePurchaseData): Promise<PurchaseWithItems> {
    let provider = data.providerId ? this.providers.get(data.providerId) : undefined;
    const newProvider = data.newProvider;
    if (newProvider) {
      const existing = Array.from(this.providers.values()).find((p) => p.rfc === newProvider.rfc);
      if (existing) {
        provider = existing;
      } else {
        const created: ProviderMock = {
          id: randomUUID(),
          code: `PROV_${newProvider.rfc}`,
          name: newProvider.name,
          rfc: newProvider.rfc,
          currentBalance: 0,
          isActive: true,
        };
        this.providers.set(created.id, created);
        provider = created;
      }
    }
    if (!provider || !provider.isActive) throw new ProviderNotFoundOrInactiveError();
    const providerId = provider.id;

    if (data.satUuid) {
      const existingPurchase = Array.from(this.purchases.values()).find((p) => p.satUuid === data.satUuid);
      if (existingPurchase) {
        throw new SatUuidAlreadyExistsError(`${existingPurchase.folioCode}-${String(existingPurchase.folioNumber).padStart(6, "0")}`);
      }
    }

    const branch = this.branches.get(data.branchId);
    if (!branch || !branch.isActive) throw new InactiveResourceError("Branch");

    const paymentMethod = this.paymentMethods.get(data.paymentMethodId);
    if (!paymentMethod || !paymentMethod.isActive) throw new InactiveResourceError("PaymentMethod");

    const calcLines: Array<{
      quantity: number;
      unitCost: number;
      discountPct: number | null;
      ivaRate: number | null;
      iepsRate: number | null;
      isTaxable: boolean;
    }> = [];
    const snapshots: Array<{
      productId: string;
      productCodeSnapshot: string;
      productNameSnapshot: string;
      quantity: number;
      unitCost: number;
      discountPct: number | null;
      ivaRate: number | null;
      iepsRate: number | null;
      lotNumber: string | null;
      expirationDate: Date | null;
      manufactureDate: Date | null;
    }> = [];

    for (const item of data.items) {
      const product = this.products.get(item.productId);
      if (!product || !product.isActive) throw new ProductNotFoundOrInactiveError();

      calcLines.push({
        quantity: item.quantity,
        unitCost: item.unitCost,
        discountPct: item.discountPct,
        ivaRate: product.ivaRate,
        iepsRate: product.iepsRate,
        isTaxable: product.isTaxable,
      });
      snapshots.push({
        productId: product.id,
        productCodeSnapshot: product.code,
        productNameSnapshot: product.name,
        quantity: item.quantity,
        unitCost: item.unitCost,
        discountPct: item.discountPct,
        ivaRate: product.isTaxable ? product.ivaRate : 0,
        iepsRate: product.isTaxable ? product.iepsRate : 0,
        lotNumber: item.lotNumber ?? null,
        expirationDate: item.expirationDate ?? null,
        manufactureDate: item.manufactureDate ?? null,
      });
      // El costo de adquisición del producto se actualiza con el último costo comprado.
      this.products.set(product.id, { ...product, acquisitionPrice: item.unitCost });
    }

    const totals = PurchaseTotalsCalculator.computeTotals(calcLines);

    const folioNumber = (this.folioCounterByBranch.get(data.branchId) ?? 0) + 1;
    this.folioCounterByBranch.set(data.branchId, folioNumber);
    const folioCode = `CP-${data.branchId}-${String(folioNumber).padStart(6, "0")}`;

    const isCredit = paymentMethod.isCredit;
    const paidAmount = isCredit ? 0 : totals.total;
    const paymentStatus: PurchasePaymentStatus = isCredit ? "pending" : "paid";

    if (isCredit) {
      provider.currentBalance += totals.total;
    }

    const purchaseId = randomUUID();
    const purchase = Purchase.create({
      id: purchaseId,
      providerId,
      branchId: data.branchId,
      folioId: randomUUID(),
      folioNumber,
      folioCode,
      paymentMethodId: data.paymentMethodId,
      creatorId: data.creatorId,
      status: "completed",
      subtotal: totals.subtotal,
      taxTotal: totals.taxTotal,
      total: totals.total,
      paidAmount,
      paymentStatus,
      notes: data.notes,
      purchasedAt: data.purchasedAt,
      satUuid: data.satUuid ?? null,
      supplierInvoiceNumber: data.supplierInvoiceNumber ?? null,
      invoiceDate: data.invoiceDate ?? null,
      xmlFileName: data.xmlFileName ?? null,
      cancelledAt: null,
      cancelledBy: null,
      cancellationReason: null,
    });

    const items = snapshots.map((s, i) =>
      PurchaseItem.create({
        purchaseId,
        productId: s.productId,
        productCodeSnapshot: s.productCodeSnapshot,
        productNameSnapshot: s.productNameSnapshot,
        quantity: s.quantity,
        unitCost: s.unitCost,
        discountPct: s.discountPct,
        ivaRate: s.ivaRate,
        iepsRate: s.iepsRate,
        lineSubtotal: totals.lines[i].lineSubtotal,
        lineTax: totals.lines[i].lineTax,
        lineTotal: totals.lines[i].lineTotal,
      })
    );

    this.purchases.set(purchaseId, purchase);
    this.itemsByPurchase.set(purchaseId, items);
    this.providerPaymentsByPurchase.set(purchaseId, []);

    for (let i = 0; i < items.length; i++) {
      const snapshot = snapshots[i];
      if (!snapshot.lotNumber || !snapshot.expirationDate) continue;
      const lotId = randomUUID();
      this.inventoryLots.set(lotId, {
        id: lotId,
        branchId: data.branchId,
        productId: snapshot.productId,
        purchaseItemId: items[i].id,
        lotNumber: snapshot.lotNumber,
        expirationDate: snapshot.expirationDate,
        manufactureDate: snapshot.manufactureDate,
        quantity: snapshot.quantity,
      });
    }

    return { purchase, items, providerPayments: [], joined: this.joinedFor(purchase) };
  }

  async cancel(
    id: string,
    cancelledBy: string,
    cancellationReason: string | null
  ): Promise<PurchaseWithItems> {
    const current = this.purchases.get(id);
    if (!current) throw new Error("Purchase not found in cancel transaction");

    const activeProviderPayments = (this.providerPaymentsByPurchase.get(id) ?? []).filter(
      (p) => p.status === "completed"
    );
    if (activeProviderPayments.length > 0) {
      throw new PurchaseHasActiveProviderPaymentsError(activeProviderPayments.map((p) => p.id));
    }

    const outstanding = current.total - current.paidAmount;
    if (outstanding > 0) {
      const provider = this.providers.get(current.providerId);
      if (provider) provider.currentBalance -= outstanding;
    }

    const itemIds = new Set((this.itemsByPurchase.get(id) ?? []).map((item) => item.id));
    for (const [lotId, lot] of this.inventoryLots) {
      if (itemIds.has(lot.purchaseItemId)) this.inventoryLots.delete(lotId);
    }

    const cancelled = Purchase.create({
      id: current.id,
      providerId: current.providerId,
      branchId: current.branchId,
      folioId: current.folioId,
      folioNumber: current.folioNumber,
      folioCode: current.folioCode,
      paymentMethodId: current.paymentMethodId,
      creatorId: current.creatorId,
      status: "cancelled",
      subtotal: current.subtotal,
      taxTotal: current.taxTotal,
      total: current.total,
      paidAmount: current.paidAmount,
      paymentStatus: current.paymentStatus,
      notes: current.notes,
      purchasedAt: current.purchasedAt,
      cancelledAt: new Date(),
      cancelledBy,
      cancellationReason,
      createdAt: current.createdAt,
    });
    this.purchases.set(id, cancelled);

    return {
      purchase: cancelled,
      items: this.itemsByPurchase.get(id) ?? [],
      providerPayments: this.providerPaymentsByPurchase.get(id) ?? [],
      joined: this.joinedFor(cancelled),
    };
  }
}
