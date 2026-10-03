/**
 * Integration test: creación atómica + cancelación de ventas.
 * Verifica la transacción Prisma completa: incremento de folio, decremento de inventario,
 * persistencia de sale + sale_items, y restauración de stock al cancelar.
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
import { CancelSaleUseCase } from "@/modules/pos/application/use-cases/CancelSaleUseCase";
import { GetSaleUseCase } from "@/modules/pos/application/use-cases/GetSaleUseCase";
import { isBranchScopedInventory } from "@/shared/infrastructure/config/inventoryScope";

const P = "POSTEST_";

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

jest.setTimeout(60_000);

// Asume alta automática de fila de inventario al vender (allowRowCreation=true) — sólo válido en modo `general`.
// En modo `branch` la venta sin fila previa se rechaza a propósito (ver ProductNotAvailableInBranchError).
(isBranchScopedInventory() ? describe.skip : describe)("Sales — crear y cancelar (integration real DB)", () => {
  const branchRepo = new PrismaBranchRepository(prisma);
  const deptRepo = new PrismaDepartmentRepository(prisma);
  const productRepo = new PrismaProductRepository(prisma);
  const priceRepo = new PrismaProductPriceRepository(prisma);
  const customerRepo = new PrismaCustomerRepository(prisma);
  const folioRepo = new PrismaFolioRepository(prisma);
  const pmRepo = new PrismaPaymentMethodRepository(prisma);
  const saleRepo = new PrismaSaleRepository(prisma);
  const lookups = new PrismaPosLookupService(prisma);

  const createCustomer = new CreateCustomerUseCase(customerRepo);
  const createProduct = new CreateProductUseCase(productRepo, deptRepo);
  const createPrice = new CreateProductPriceUseCase(productRepo, priceRepo);
  const createSale = new CreateSaleUseCase(saleRepo, lookups);
  const cancelSale = new CancelSaleUseCase(saleRepo);
  const getSale = new GetSaleUseCase(saleRepo);

  let branchId: string;
  let customerId: string;
  let cashierId: string;
  let productId: string;
  let priceId: string;
  let folioId: string;
  let pmId: string;

  beforeAll(async () => {
    await cleanup();

    const branch = await branchRepo.create({ code: `${P}BRANCH1`, name: "Sucursal POS Test" });
    branchId = branch.id;

    const dept = await deptRepo.create({ code: `${P}DEPT1`, name: "Dept POS Test" });
    const product = await createProduct.execute({
      code: `${P}PROD1`, name: "Producto POS Test", unit: "kg", departmentId: dept.id, ivaRate: 0.16, isTaxable: true,
    });
    productId = product.id;

    const price = await createPrice.execute(productId, { branchId: branchId, name: "Lista", price: 100, isDefault: true });
    priceId = price.id;

    const customer = await createCustomer.execute({ code: `${P}CLI1`, name: "Cliente POS", rfc: "CPO010101001", branchIds: [branchId] });
    customerId = customer.id;

    const folio = await folioRepo.create({ code: `${P}FOL1`, name: "Folio POS", prefix: "POS", currentNumber: 0, scope: "POS" });
    folioId = folio.id;

    const pm = await pmRepo.create({ code: `${P}PM1`, name: "Efectivo POS" });
    pmId = pm.id;

    // Usuario cajero minimal (sin hash real, solo para FK)
    const cashier = await prisma.user.create({
      data: { email: `${P}cashier@test.com`, passwordHash: "test-hash", name: "Cajero Test" },
    });
    cashierId = cashier.id;
  });

  let saleId: string;

  it("crea venta con 2 unidades — folio incrementa, inventario decrementa", async () => {
    const result = await createSale.execute(
      { branchId, customerId, paymentMethodId: pmId, folioId, items: [{ productId, productPriceId: priceId, quantity: 2 }] },
      cashierId
    );

    saleId = result.dto.id;
    expect(result.dto.status).toBe("completed");
    expect(result.dto.subtotal).toBeCloseTo(172.4138, 2);
    expect(result.dto.taxTotal).toBeCloseTo(27.5862, 2);
    expect(result.dto.total).toBeCloseTo(200, 2);
    expect(result.dto.items).toHaveLength(1);
    expect(result.dto.items[0].productCodeSnapshot).toBe(`${P}PROD1`);
    expect(result.dto.folioNumber).toBe(1);

    // Folio incrementó
    const folioRow = await prisma.folio.findUnique({ where: { id: folioId } });
    expect(folioRow!.currentNumber).toBe(1);

    // Inventario decrementado (negativo: no había stock inicial)
    const inv = await prisma.branchInventory.findFirst({ where: { branchId, productId } });
    expect(inv).not.toBeNull();
    expect(Number(inv!.quantity)).toBe(-2);
  });

  it("segunda venta incrementa folio a 2 y acumula inventario negativo", async () => {
    const result = await createSale.execute(
      { branchId, customerId, paymentMethodId: pmId, folioId, items: [{ productId, productPriceId: priceId, quantity: 3 }] },
      cashierId
    );
    expect(result.dto.folioNumber).toBe(2);

    const inv = await prisma.branchInventory.findFirst({ where: { branchId, productId } });
    expect(Number(inv!.quantity)).toBe(-5);
  });

  it("cancela la primera venta — restaura 2 unidades de stock", async () => {
    const result = await cancelSale.execute(saleId, { reason: "Motivo de prueba" });
    expect(result.dto.status).toBe("cancelled");
    expect(result.dto.cancellationReason).toBe("Motivo de prueba");

    const inv = await prisma.branchInventory.findFirst({ where: { branchId, productId } });
    expect(Number(inv!.quantity)).toBe(-3); // -5 + 2 restaurados
  });

  it("cancelar misma venta segunda vez es idempotente (200, no modifica stock)", async () => {
    const result = await cancelSale.execute(saleId, { reason: "Repetido" });
    expect(result.dto.status).toBe("cancelled");
    // razón NO cambia: idempotente preserva el original
    expect(result.dto.cancellationReason).toBe("Motivo de prueba");

    // Stock no cambia
    const inv = await prisma.branchInventory.findFirst({ where: { branchId, productId } });
    expect(Number(inv!.quantity)).toBe(-3);
  });

  it("folio NO se libera al cancelar (siguiente número sigue siendo 3)", async () => {
    const result = await createSale.execute(
      { branchId, customerId, paymentMethodId: pmId, folioId, items: [{ productId, productPriceId: priceId, quantity: 1 }] },
      cashierId
    );
    expect(result.dto.folioNumber).toBe(3);
  });

  it("getSale devuelve detalle con items persistidos", async () => {
    const result = await getSale.execute(saleId);
    expect(result.dto.id).toBe(saleId);
    expect(result.dto.status).toBe("cancelled");
    expect(result.dto.items).toHaveLength(1);
  });
});
