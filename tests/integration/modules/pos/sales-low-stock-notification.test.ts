/**
 * Integration test: notificación de stock bajo al vender (real DB).
 * Verifica que recordInventoryMovement + AdminNotificationService disparan
 * correctamente al cruzar reorder_point, con debounce de 24h.
 */
import { prisma } from "@/shared/infrastructure/prisma/client";
import { PrismaCustomerRepository } from "@/modules/customers/infrastructure/repositories/PrismaCustomerRepository";
import { PrismaBranchRepository } from "@/modules/branches/infrastructure/repositories/PrismaBranchRepository";
import { PrismaDepartmentRepository } from "@/modules/departments/infrastructure/repositories/PrismaDepartmentRepository";
import { PrismaProductRepository } from "@/modules/products/infrastructure/repositories/PrismaProductRepository";
import { PrismaProductPriceRepository } from "@/modules/products/infrastructure/repositories/PrismaProductPriceRepository";
import { PrismaFolioRepository } from "@/modules/folios/infrastructure/repositories/PrismaFolioRepository";
import { PrismaPaymentMethodRepository } from "@/modules/payment-methods/infrastructure/repositories/PrismaPaymentMethodRepository";
import { PrismaSaleRepository } from "@/modules/pos/infrastructure/repositories/PrismaSaleRepository";
import { PrismaPosLookupService } from "@/modules/pos/infrastructure/repositories/PrismaPosLookupService";
import { CreateCustomerUseCase } from "@/modules/customers/application/use-cases/CreateCustomerUseCase";
import { CreateProductUseCase } from "@/modules/products/application/use-cases/CreateProductUseCase";
import { CreateProductPriceUseCase } from "@/modules/products/application/use-cases/CreateProductPriceUseCase";
import { CreateSaleUseCase } from "@/modules/pos/application/use-cases/CreateSaleUseCase";
import type { AdminNotificationService } from "@/shared/application/services/AdminNotificationService";

const P = "POSLOWSTK_";

async function cleanup() {
  await prisma.sale.deleteMany({ where: { folio: { code: { startsWith: P } } } });
  await prisma.branchInventory.deleteMany({ where: { branch: { code: { startsWith: P } } } });
  await prisma.inventoryMovement.deleteMany({ where: { product: { code: { startsWith: P } } } });
  await prisma.productPrice.deleteMany({ where: { product: { code: { startsWith: P } } } });
  await prisma.product.deleteMany({ where: { code: { startsWith: P } } });
  await prisma.customer.deleteMany({ where: { code: { startsWith: P } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: P } } });
  await prisma.folio.deleteMany({ where: { code: { startsWith: P } } });
  await prisma.paymentMethod.deleteMany({ where: { code: { startsWith: P } } });
  await prisma.branch.deleteMany({ where: { code: { startsWith: P } } });
  await prisma.department.deleteMany({ where: { code: { startsWith: P } } });
}

afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

describe("Sales — notificación de stock bajo al vender (integration real DB)", () => {
  const branchRepo = new PrismaBranchRepository(prisma);
  const deptRepo = new PrismaDepartmentRepository(prisma);
  const productRepo = new PrismaProductRepository(prisma);
  const priceRepo = new PrismaProductPriceRepository(prisma);
  const customerRepo = new PrismaCustomerRepository(prisma);
  const folioRepo = new PrismaFolioRepository(prisma);
  const pmRepo = new PrismaPaymentMethodRepository(prisma);
  const lookups = new PrismaPosLookupService(prisma);

  let notifier: AdminNotificationService;
  let saleRepo: PrismaSaleRepository;
  let createSale: CreateSaleUseCase;

  let branchId: string;
  let customerId: string;
  let cashierId: string;
  let productId: string;
  let priceId: string;
  let folioId: string;
  let pmId: string;

  beforeAll(async () => {
    await cleanup();

    const branch = await branchRepo.create({ code: `${P}BRANCH1`, name: "Sucursal Low Stock" });
    branchId = branch.id;

    const dept = await deptRepo.create({ code: `${P}DEPT1`, name: "Dept Low Stock" });
    const product = await createProductUseCase().execute({
      code: `${P}PROD1`, name: "Producto Low Stock", unit: "u", departmentId: dept.id, ivaRate: 0.16,
    });
    productId = product.id;

    const price = await new CreateProductPriceUseCase(productRepo, priceRepo).execute(productId, {
      name: "Lista", price: 50, isDefault: true,
    });
    priceId = price.id;

    const customer = await new CreateCustomerUseCase(customerRepo).execute({
      code: `${P}CLI1`, name: "Cliente Low Stock", rfc: "CLS010101001", branchIds: [branchId],
    });
    customerId = customer.id;

    const folio = await folioRepo.create({ code: `${P}FOL1`, name: "Folio Low Stock", prefix: "LOW", currentNumber: 0, scope: "POS" });
    folioId = folio.id;

    const pm = await pmRepo.create({ code: `${P}PM1`, name: "Efectivo Low Stock" });
    pmId = pm.id;

    const cashier = await prisma.user.create({
      data: { email: `${P}cashier@test.com`, passwordHash: "test-hash", name: "Cajero Low Stock" },
    });
    cashierId = cashier.id;

    // reorderPoint=10, quantity inicial=15 — ninguna venta previa cruza el umbral todavía.
    await prisma.branchInventory.create({
      data: { branchId, productId, quantity: 15, reorderPoint: 10 },
    });
  });

  function createProductUseCase() {
    return new CreateProductUseCase(productRepo, deptRepo);
  }

  beforeEach(() => {
    notifier = {
      notifySaleCancelled: jest.fn().mockResolvedValue(undefined),
      notifyLowStock: jest.fn().mockResolvedValue(undefined),
    } as unknown as AdminNotificationService;
    saleRepo = new PrismaSaleRepository(prisma, notifier);
    createSale = new CreateSaleUseCase(saleRepo, lookups);
  });

  it("no notifica mientras quantity permanece por encima de reorderPoint", async () => {
    // 15 -> 12, sigue >= 10
    await createSale.execute(
      { branchId, customerId, paymentMethodId: pmId, folioId, items: [{ productId, productPriceId: priceId, quantity: 3 }] },
      cashierId
    );
    expect(notifier.notifyLowStock).not.toHaveBeenCalled();
  });

  it("notifica la primera vez que quantity cruza por debajo de reorderPoint", async () => {
    // 12 -> 5, cruza el umbral de 10
    await createSale.execute(
      { branchId, customerId, paymentMethodId: pmId, folioId, items: [{ productId, productPriceId: priceId, quantity: 7 }] },
      cashierId
    );
    expect(notifier.notifyLowStock).toHaveBeenCalledTimes(1);
    expect(notifier.notifyLowStock).toHaveBeenCalledWith(
      expect.objectContaining({ productCode: `${P}PROD1`, quantity: 5, reorderPoint: 10 })
    );

    const inv = await prisma.branchInventory.findFirst({ where: { branchId, productId } });
    expect(inv!.lastLowStockNotifiedAt).not.toBeNull();
  });

  it("no vuelve a notificar dentro de las 24h aunque siga cruzando el umbral", async () => {
    // 5 -> 3, sigue bajo el umbral pero dentro del debounce de la prueba anterior
    await createSale.execute(
      { branchId, customerId, paymentMethodId: pmId, folioId, items: [{ productId, productPriceId: priceId, quantity: 2 }] },
      cashierId
    );
    expect(notifier.notifyLowStock).not.toHaveBeenCalled();
  });

  it("vuelve a notificar después de pasadas 24h", async () => {
    // Simula que la última notificación fue hace más de 24h.
    await prisma.$executeRaw`
      UPDATE branch_inventory SET last_low_stock_notified_at = NOW() - INTERVAL '25 hours'
      WHERE branch_id = ${branchId} AND product_id = ${productId}
    `;
    // 3 -> 1, sigue bajo el umbral
    await createSale.execute(
      { branchId, customerId, paymentMethodId: pmId, folioId, items: [{ productId, productPriceId: priceId, quantity: 2 }] },
      cashierId
    );
    expect(notifier.notifyLowStock).toHaveBeenCalledTimes(1);
  });
});
