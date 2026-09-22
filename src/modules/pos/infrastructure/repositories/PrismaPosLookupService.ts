import { PrismaClient } from "@prisma/client";
import {
  PosLookupService,
  ProductLookup,
  ProductPriceLookup,
  DosificationLookup,
  CustomerLookup,
  BranchLookup,
  FolioLookup,
  PaymentMethodLookup,
} from "../../application/ports/PosLookups";
import { PrismaPricingSettingsRepository } from "@/modules/settings/infrastructure/repositories/PrismaPricingSettingsRepository";

export class PrismaPosLookupService implements PosLookupService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly pricingSettingsRepo: PrismaPricingSettingsRepository = new PrismaPricingSettingsRepository(prisma)
  ) {}

  async getDosificationSurchargePct(): Promise<number> {
    const settings = await this.pricingSettingsRepo.get();
    return settings.dosificationSurchargePct;
  }

  async getProduct(id: string): Promise<ProductLookup | null> {
    const row = await this.prisma.product.findUnique({
      where: { id },
      select: { id: true, code: true, name: true, ivaRate: true, iepsRate: true, isTaxable: true, isActive: true },
    });
    if (!row) return null;
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      ivaRate: row.ivaRate ? Number(row.ivaRate) : null,
      iepsRate: row.iepsRate ? Number(row.iepsRate) : null,
      isTaxable: row.isTaxable,
      isActive: row.isActive,
    };
  }

  async getProductPrice(id: string): Promise<ProductPriceLookup | null> {
    const row = await this.prisma.productPrice.findUnique({
      where: { id },
      select: { id: true, productId: true, branchId: true, name: true, price: true, discountPct: true },
    });
    if (!row) return null;
    return {
      id: row.id,
      productId: row.productId,
      branchId: row.branchId,
      name: row.name,
      price: Number(row.price),
      discountPct: row.discountPct ? Number(row.discountPct) : null,
    };
  }

  async getDosificationForSale(id: string, branchId: string): Promise<DosificationLookup | null> {
    const row = await this.prisma.productDosification.findUnique({
      where: { id },
      select: { id: true, productId: true, name: true, numParts: true, isActive: true },
    });
    if (!row) return null;
    // Prefiere el default propio de la sucursal; cae al default global si no existe.
    const branchDefaultPrice = await this.prisma.productPrice.findFirst({
      where: { productId: row.productId, branchId, isDefault: true },
      select: { price: true },
    });
    const defaultPrice =
      branchDefaultPrice ??
      (await this.prisma.productPrice.findFirst({
        where: { productId: row.productId, branchId: null, isDefault: true },
        select: { price: true },
      }));
    return {
      id: row.id,
      productId: row.productId,
      name: row.name,
      numParts: row.numParts,
      isActive: row.isActive,
      basePrice: defaultPrice ? Number(defaultPrice.price) : null,
    };
  }

  async getCustomer(id: string): Promise<CustomerLookup | null> {
    const row = await this.prisma.customer.findUnique({
      where: { id },
      select: { id: true, isActive: true, creditLimit: true, currentBalance: true, email: true },
    });
    if (!row) return null;
    return {
      id: row.id,
      isActive: row.isActive,
      creditLimit: row.creditLimit ? Number(row.creditLimit) : null,
      currentBalance: Number(row.currentBalance),
      email: row.email,
    };
  }

  async getBranch(id: string): Promise<BranchLookup | null> {
    const row = await this.prisma.branch.findUnique({
      where: { id },
      select: { id: true, isActive: true },
    });
    return row ?? null;
  }

  async getFolio(id: string): Promise<FolioLookup | null> {
    const row = await this.prisma.folio.findUnique({
      where: { id },
      select: { id: true, code: true, prefix: true, scope: true, isActive: true },
    });
    if (!row) return null;
    return { ...row, scope: row.scope as FolioLookup["scope"] };
  }

  async getPaymentMethod(id: string): Promise<PaymentMethodLookup | null> {
    const row = await this.prisma.paymentMethod.findUnique({
      where: { id },
      select: { id: true, isActive: true, isCredit: true },
    });
    return row ?? null;
  }

  async isProductAvailableInBranch(productId: string, branchId: string): Promise<boolean> {
    const row = await this.prisma.branchInventory.findUnique({
      where: { branchId_productId: { branchId, productId } },
      select: { productId: true },
    });
    return row !== null;
  }

  async hasBranchPriceOverrides(productId: string, branchId: string): Promise<boolean> {
    const count = await this.prisma.productPrice.count({ where: { productId, branchId } });
    return count > 0;
  }
}
