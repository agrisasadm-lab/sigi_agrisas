/**
 * Integration test: stock negativo al vender.
 * Verifica que el CHECK quantity >= 0 fue eliminado de branch_inventory
 * y que vender sin stock previo crea el registro con quantity negativo.
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
import { PrismaBranchInventoryRepository } from "@/modules/inventory/infrastructure/repositories/PrismaBranchInventoryRepository";
import { AdjustStockUseCase } from "@/modules/inventory/application/use-cases/AdjustStockUseCase";
import { NegativeStockNotAllowedError } from "@/modules/inventory/domain/errors/NegativeStockNotAllowedError";
import { isBranchScopedInventory } from "@/shared/infrastructure/config/inventoryScope";

const P = "POSNEG_";

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

// Asume alta automática de fila de inventario al vender (allowRowCreation=true) — sólo válido en modo `general`.
// En modo `branch` la venta sin fila previa se rechaza a propósito (ver ProductNotAvailableInBranchError).
(isBranchScopedInventory() ? describe.skip : describe)("Sales — stock negativo por ventas (integration real DB)", () => {
  const branchRepo = new PrismaBranchRepository(prisma);
  const deptRepo = new PrismaDepartmentRepository(prisma);
  const productRepo = new PrismaProductRepository(prisma);
  const priceRepo = new PrismaProductPriceRepository(prisma);
  const customerRepo = new PrismaCustomerRepository(prisma);
  const folioRepo = new PrismaFolioRepository(prisma);
  const pmRepo = new PrismaPaymentMethodRepository(prisma);
  const inventoryRepo = new PrismaBranchInventoryRepository(prisma);
  const saleRepo = new PrismaSaleRepository(prisma);
  const lookups = new PrismaPosLookupService(prisma);

  const createCustomer = new CreateCustomerUseCase(customerRepo);
  const createProduct = new CreateProductUseCase(productRepo, deptRepo);
  const createPrice = new CreateProductPriceUseCase(productRepo, priceRepo);
  const createSale = new CreateSaleUseCase(saleRepo, lookups);
  const adjustStock = new AdjustStockUseCase(inventoryRepo);

  let branchId: string;
  let customerId: string;
  let cashierId: string;
  let productId: string;
  let priceId: string;
  let folioId: string;
  let pmId: string;

  beforeAll(async () => {
    await cleanup();

    const branch = await branchRepo.create({ code: `${P}BRANCH1`, name: "Sucursal Neg Stock" });
    branchId = branch.id;

    const dept = await deptRepo.create({ code: `${P}DEPT1`, name: "Dept Neg Stock" });
    const product = await createProduct.execute({
      code: `${P}PROD1`, name: "Producto Neg Stock", unit: "u", departmentId: dept.id, ivaRate: 0.16,
    });
    productId = product.id;

    const price = await createPrice.execute(productId, { name: "Lista", price: 50, isDefault: true });
    priceId = price.id;

    const customer = await createCustomer.execute({ code: `${P}CLI1`, name: "Cliente Neg", rfc: "CNE010101001", branchIds: [branchId] });
    customerId = customer.id;

    const folio = await folioRepo.create({ code: `${P}FOL1`, name: "Folio Neg", prefix: "NEG", currentNumber: 0, scope: "POS" });
    folioId = folio.id;

    const pm = await pmRepo.create({ code: `${P}PM1`, name: "Efectivo Neg" });
    pmId = pm.id;

    const cashier = await prisma.user.create({
      data: { email: `${P}cashier@test.com`, passwordHash: "test-hash", name: "Cajero Neg" },
    });
    cashierId = cashier.id;
  });

  it("vender sin registro de inventario crea fila con quantity negativa", async () => {
    const result = await createSale.execute(
      { branchId, customerId, paymentMethodId: pmId, folioId, items: [{ productId, productPriceId: priceId, quantity: 5 }] },
      cashierId
    );
    expect(result.dto.status).toBe("completed");

    const inv = await prisma.branchInventory.findFirst({ where: { branchId, productId } });
    expect(inv).not.toBeNull();
    expect(Number(inv!.quantity)).toBe(-5);
  });

  it("vender sobre stock=0 deja quantity negativa", async () => {
    // Stock es -5, vender 3 más = -8
    await createSale.execute(
      { branchId, customerId, paymentMethodId: pmId, folioId, items: [{ productId, productPriceId: priceId, quantity: 3 }] },
      cashierId
    );
    const inv = await prisma.branchInventory.findFirst({ where: { branchId, productId } });
    expect(Number(inv!.quantity)).toBe(-8);
  });

  it("inserción directa en BD con quantity negativa es permitida (CHECK eliminado)", async () => {
    // Verificar directamente que el DB no rechaza un valor negativo vía $executeRaw
    await expect(
      prisma.$executeRaw`UPDATE branch_inventory SET quantity = -99 WHERE branch_id = ${branchId} AND product_id = ${productId}`
    ).resolves.toBe(1);

    const inv = await prisma.branchInventory.findFirst({ where: { branchId, productId } });
    expect(Number(inv!.quantity)).toBe(-99);
  });

  it("el admin /adjust SÍ rechaza delta que deja negativo (guard en código, no en BD)", async () => {
    // Primero seteamos stock positivo para que el guard funcione
    await prisma.$executeRaw`UPDATE branch_inventory SET quantity = 5 WHERE branch_id = ${branchId} AND product_id = ${productId}`;

    await expect(
      adjustStock.execute(branchId, productId, { delta: -100 })
    ).rejects.toThrow(NegativeStockNotAllowedError);

    // Verifica que el stock NO cambió
    const inv = await prisma.branchInventory.findFirst({ where: { branchId, productId } });
    expect(Number(inv!.quantity)).toBe(5);
  });
});
