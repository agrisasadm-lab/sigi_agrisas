/**
 * Integration test: contadores de folio por sucursal (workstream A —
 * add-folio-branch-scope). Ventas, cotizaciones y compras dejan de compartir
 * el contador global de `folios.current_number`: cada sucursal lleva el suyo
 * en `folio_branch_counters`, y el `folioCode` incorpora el código de la
 * sucursal.
 */
import { prisma } from "@/shared/infrastructure/prisma/client";
import { PrismaBranchRepository } from "@/modules/branches/infrastructure/repositories/PrismaBranchRepository";
import { PrismaDepartmentRepository } from "@/modules/departments/infrastructure/repositories/PrismaDepartmentRepository";
import { PrismaProductRepository } from "@/modules/products/infrastructure/repositories/PrismaProductRepository";
import { PrismaProductPriceRepository } from "@/modules/products/infrastructure/repositories/PrismaProductPriceRepository";
import { PrismaFolioRepository } from "@/modules/folios/infrastructure/repositories/PrismaFolioRepository";
import { PrismaPaymentMethodRepository } from "@/modules/payment-methods/infrastructure/repositories/PrismaPaymentMethodRepository";
import { PrismaCustomerRepository } from "@/modules/customers/infrastructure/repositories/PrismaCustomerRepository";
import { PrismaProviderRepository } from "@/modules/providers/infrastructure/repositories/PrismaProviderRepository";
import { PrismaSaleRepository } from "@/modules/pos/infrastructure/repositories/PrismaSaleRepository";
import { PrismaPurchaseRepository } from "@/modules/purchases/infrastructure/repositories/PrismaPurchaseRepository";
import { PrismaPosLookupService } from "@/modules/pos/infrastructure/repositories/PrismaPosLookupService";
import { CreateProductUseCase } from "@/modules/products/application/use-cases/CreateProductUseCase";
import { CreateProductPriceUseCase } from "@/modules/products/application/use-cases/CreateProductPriceUseCase";
import { CreateCustomerUseCase } from "@/modules/customers/application/use-cases/CreateCustomerUseCase";
import { CreateSaleUseCase } from "@/modules/pos/application/use-cases/CreateSaleUseCase";
import { PrismaBranchInventoryRepository } from "@/modules/inventory/infrastructure/repositories/PrismaBranchInventoryRepository";
import { CreateBranchInventoryItemUseCase } from "@/modules/inventory/application/use-cases/CreateBranchInventoryItemUseCase";

const P = "FOLBR_";

async function cleanup() {
  await prisma.purchase.deleteMany({ where: { branch: { code: { startsWith: P } } } });
  await prisma.sale.deleteMany({ where: { branch: { code: { startsWith: P } } } });
  await prisma.branchInventory.deleteMany({ where: { branch: { code: { startsWith: P } } } });
  await prisma.inventoryMovement.deleteMany({ where: { product: { code: { startsWith: P } } } });
  await prisma.productPrice.deleteMany({ where: { product: { code: { startsWith: P } } } });
  await prisma.product.deleteMany({ where: { code: { startsWith: P } } });
  await prisma.customer.deleteMany({ where: { code: { startsWith: P } } });
  await prisma.provider.deleteMany({ where: { code: { startsWith: P } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: P.toLowerCase() } } });
  // El folio CP real (canónico, no el de prueba) también gana un contador para nuestra sucursal
  // via resolveCanonicalFolio — limpiar por branch_id cubre ese caso sin tocar folios ajenos.
  await prisma.folioBranchCounter.deleteMany({ where: { branch: { code: { startsWith: P } } } });
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

describe("Folios — contador por sucursal (integration real DB)", () => {
  const branchRepo = new PrismaBranchRepository(prisma);
  const deptRepo = new PrismaDepartmentRepository(prisma);
  const productRepo = new PrismaProductRepository(prisma);
  const priceRepo = new PrismaProductPriceRepository(prisma);
  const folioRepo = new PrismaFolioRepository(prisma);
  const pmRepo = new PrismaPaymentMethodRepository(prisma);
  const customerRepo = new PrismaCustomerRepository(prisma);
  const providerRepo = new PrismaProviderRepository(prisma);
  const saleRepo = new PrismaSaleRepository(prisma);
  const purchaseRepo = new PrismaPurchaseRepository(prisma);
  const lookups = new PrismaPosLookupService(prisma);

  const createProduct = new CreateProductUseCase(productRepo, deptRepo);
  const createPrice = new CreateProductPriceUseCase(productRepo, priceRepo, branchRepo);
  const createCustomer = new CreateCustomerUseCase(customerRepo);
  const inventoryRepo = new PrismaBranchInventoryRepository(prisma);
  const createInventory = new CreateBranchInventoryItemUseCase(inventoryRepo, branchRepo, productRepo);
  // branchScopedInventory=true — este entorno de dev corre INVENTORY_SCOPE_MODE=branch;
  // asignar el producto a cada sucursal (abajo) satisface el gate sin depender del modo real del proceso.
  const createSale = new CreateSaleUseCase(saleRepo, lookups, undefined, true);

  let branchAId: string;
  let branchBId: string;
  let branchACode: string;
  let branchBCode: string;
  let productId: string;
  let priceAId: string;
  let priceBId: string;
  let customerId: string;
  let salesFolioId: string;
  let pmId: string;
  let providerId: string;
  let purchasePmId: string;
  let cashierId: string;

  beforeAll(async () => {
    await cleanup();

    branchACode = `${P}A`;
    branchBCode = `${P}B`;
    branchAId = (await branchRepo.create({ code: branchACode, name: "Sucursal A" })).id;
    branchBId = (await branchRepo.create({ code: branchBCode, name: "Sucursal B" })).id;

    const dept = await deptRepo.create({ code: `${P}DEPT`, name: "Dept" });
    productId = (await createProduct.execute({
      code: `${P}PROD`, name: "Producto", unit: "kg", departmentId: dept.id, ivaRate: 0.16,
    })).id;
    priceAId = (await createPrice.execute(productId, { branchId: branchAId, name: "Lista", price: 100, isDefault: true })).id;
    priceBId = (await createPrice.execute(productId, { branchId: branchBId, name: "Lista", price: 100, isDefault: true })).id;

    customerId = (await createCustomer.execute({
      code: `${P}CLI`, name: "Cliente", rfc: "FBR010101001", branchIds: [branchAId, branchBId],
    })).id;

    const salesFolio = await folioRepo.create({
      code: `${P}TK`, name: "Ticket", prefix: "TK-", currentNumber: 0, scope: "POS",
    });
    salesFolioId = salesFolio.id;

    pmId = (await pmRepo.create({ code: `${P}PM`, name: "Efectivo" })).id;

    await createInventory.execute(branchAId, { productId, quantity: 20, reorderPoint: 0 });
    await createInventory.execute(branchBId, { productId, quantity: 20, reorderPoint: 0 });

    const cashier = await prisma.user.create({
      data: { email: `${P.toLowerCase()}cashier@test.com`, passwordHash: "test-hash", name: "Cajero Test" },
    });
    cashierId = cashier.id;

    const provider = await providerRepo.create({ code: `${P}PROV`, name: "Proveedor", rfc: "FBR020202002" });
    providerId = provider.id;
    purchasePmId = (await pmRepo.create({ code: `${P}PMCR`, name: "Crédito Proveedor", isCredit: true })).id;
    await folioRepo.create({ code: `${P}CP`, name: "Compra", prefix: "CP-", currentNumber: 0, scope: "OPERATIONS" });
  });

  it("dos sucursales que emiten el mismo folio llevan contadores independientes", async () => {
    const { dto: saleA1 } = await createSale.execute(
      { branchId: branchAId, customerId, paymentMethodId: pmId, folioId: salesFolioId,
        items: [{ productId, productPriceId: priceAId, quantity: 1 }] },
      cashierId
    );
    const { dto: saleB1 } = await createSale.execute(
      { branchId: branchBId, customerId, paymentMethodId: pmId, folioId: salesFolioId,
        items: [{ productId, productPriceId: priceBId, quantity: 1 }] },
      cashierId
    );
    const { dto: saleA2 } = await createSale.execute(
      { branchId: branchAId, customerId, paymentMethodId: pmId, folioId: salesFolioId,
        items: [{ productId, productPriceId: priceAId, quantity: 1 }] },
      cashierId
    );

    // Cada sucursal arranca en 1, no continúa el consecutivo de la otra.
    expect(saleA1.folioCode).toBe(`TK-${branchACode}-000001`);
    expect(saleB1.folioCode).toBe(`TK-${branchBCode}-000001`);
    expect(saleA2.folioCode).toBe(`TK-${branchACode}-000002`);
  });

  it("el contador global de folios.current_number no se mueve", async () => {
    const folio = await prisma.folio.findUnique({ where: { id: salesFolioId } });
    expect(folio!.currentNumber).toBe(0);
  });

  it("cada sucursal tiene su propia fila en folio_branch_counters", async () => {
    const counterA = await prisma.folioBranchCounter.findUnique({
      where: { folioId_branchId: { folioId: salesFolioId, branchId: branchAId } },
    });
    const counterB = await prisma.folioBranchCounter.findUnique({
      where: { folioId_branchId: { folioId: salesFolioId, branchId: branchBId } },
    });
    expect(counterA!.currentNumber).toBe(2);
    expect(counterB!.currentNumber).toBe(1);
  });

  it("compras también usan el contador por sucursal, con su propio prefijo", async () => {
    const purchase = await purchaseRepo.createCompleted({
      providerId,
      branchId: branchAId,
      paymentMethodId: purchasePmId,
      creatorId: cashierId,
      notes: null,
      items: [{ productId, quantity: 5, unitCost: 50, discountPct: null }],
    });
    expect(purchase.purchase.folioCode).toBe(`CP-${branchACode}-000001`);
  });
});
