/**
 * Integration test: creación + cancelación de devoluciones (task 11.1).
 * Verifica que CreateReturnUseCase incrementa inventario atómicamente,
 * que el remaining se reduce con la primera devolución, y que cancelar
 * la primera devolución libera el espacio y revierte el inventario.
 */
import { prisma } from "@/shared/infrastructure/prisma/client";
import { PrismaBranchRepository } from "@/modules/branches/infrastructure/repositories/PrismaBranchRepository";
import { PrismaDepartmentRepository } from "@/modules/departments/infrastructure/repositories/PrismaDepartmentRepository";
import { PrismaProductRepository } from "@/modules/products/infrastructure/repositories/PrismaProductRepository";
import { PrismaProductPriceRepository } from "@/modules/products/infrastructure/repositories/PrismaProductPriceRepository";
import { PrismaCustomerRepository } from "@/modules/customers/infrastructure/repositories/PrismaCustomerRepository";
import { PrismaFolioRepository } from "@/modules/folios/infrastructure/repositories/PrismaFolioRepository";
import { PrismaPaymentMethodRepository } from "@/modules/payment-methods/infrastructure/repositories/PrismaPaymentMethodRepository";
import { PrismaSaleRepository } from "@/modules/pos/infrastructure/repositories/PrismaSaleRepository";
import { PrismaPosLookupService } from "@/modules/pos/infrastructure/repositories/PrismaPosLookupService";
import { PrismaReturnRepository } from "@/modules/returns/infrastructure/repositories/PrismaReturnRepository";
import { CreateCustomerUseCase } from "@/modules/customers/application/use-cases/CreateCustomerUseCase";
import { CreateProductUseCase } from "@/modules/products/application/use-cases/CreateProductUseCase";
import { CreateProductPriceUseCase } from "@/modules/products/application/use-cases/CreateProductPriceUseCase";
import { CreateSaleUseCase } from "@/modules/pos/application/use-cases/CreateSaleUseCase";
import { GetSaleUseCase } from "@/modules/pos/application/use-cases/GetSaleUseCase";
import { CreateReturnUseCase } from "@/modules/returns/application/use-cases/CreateReturnUseCase";
import { CancelReturnUseCase } from "@/modules/returns/application/use-cases/CancelReturnUseCase";
import { GetReturnUseCase } from "@/modules/returns/application/use-cases/GetReturnUseCase";
import { ReturnQuantityExceedsRemainingError } from "@/modules/returns/domain/errors/ReturnQuantityExceedsRemainingError";

const P = "RETTEST1_";
const INITIAL_STOCK = 100;
const SOLD_QTY = 10;

jest.setTimeout(60_000);

async function cleanup() {
  await prisma.returnItem.deleteMany({ where: { return: { sale: { folio: { code: { startsWith: P } } } } } });
  await prisma.return.deleteMany({ where: { sale: { folio: { code: { startsWith: P } } } } });
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

describe("Returns — create y cancel (integration real DB)", () => {
  const branchRepo = new PrismaBranchRepository(prisma);
  const deptRepo = new PrismaDepartmentRepository(prisma);
  const productRepo = new PrismaProductRepository(prisma);
  const priceRepo = new PrismaProductPriceRepository(prisma);
  const customerRepo = new PrismaCustomerRepository(prisma);
  const folioRepo = new PrismaFolioRepository(prisma);
  const pmRepo = new PrismaPaymentMethodRepository(prisma);
  const saleRepo = new PrismaSaleRepository(prisma);
  const returnRepo = new PrismaReturnRepository(prisma);
  const lookups = new PrismaPosLookupService(prisma);

  const createCustomer = new CreateCustomerUseCase(customerRepo);
  const createProduct = new CreateProductUseCase(productRepo, deptRepo);
  const createPrice = new CreateProductPriceUseCase(productRepo, priceRepo);
  const createSale = new CreateSaleUseCase(saleRepo, lookups);
  const getSale = new GetSaleUseCase(saleRepo);
  const createReturn = new CreateReturnUseCase(returnRepo, saleRepo);
  const cancelReturn = new CancelReturnUseCase(returnRepo);
  const getReturn = new GetReturnUseCase(returnRepo);

  let branchId: string;
  let customerId: string;
  let creatorId: string;
  let productId: string;
  let priceId: string;
  let folioId: string;
  let pmId: string;
  let saleId: string;
  let saleItemId: string;
  let originalSaleItemSerialized: string;

  beforeAll(async () => {
    await cleanup();

    const branch = await branchRepo.create({ code: `${P}BRANCH1`, name: "Sucursal Returns Test" });
    branchId = branch.id;

    const dept = await deptRepo.create({ code: `${P}DEPT1`, name: "Dept Returns Test" });
    const product = await createProduct.execute({
      code: `${P}PROD1`, name: "Producto Returns", unit: "kg", departmentId: dept.id, ivaRate: 0.16, isTaxable: true,
    });
    productId = product.id;

    const price = await createPrice.execute(productId, { branchId: branchId, name: "Lista", price: 100, isDefault: true });
    priceId = price.id;

    const customer = await createCustomer.execute({ code: `${P}CLI1`, name: "Cliente Returns", rfc: "CRT010101001", branchIds: [branchId] });
    customerId = customer.id;

    const folio = await folioRepo.create({ code: `${P}FOL1`, name: "Folio Returns", prefix: "RET", currentNumber: 0, scope: "POS" });
    folioId = folio.id;

    const pm = await pmRepo.create({ code: `${P}PM1`, name: "Efectivo Returns" });
    pmId = pm.id;

    const user = await prisma.user.create({
      data: { email: `${P}creator@test.com`, passwordHash: "test-hash", name: "Creador Returns" },
    });
    creatorId = user.id;

    await prisma.branchInventory.create({
      data: { branchId, productId, quantity: INITIAL_STOCK, reservedQuantity: 0, reorderPoint: 10 },
    });

    // Venta de 10 unidades — stock baja a 90
    const sale = await createSale.execute(
      { branchId, customerId, paymentMethodId: pmId, folioId, items: [{ productId, productPriceId: priceId, quantity: SOLD_QTY }] },
      creatorId
    );
    saleId = sale.dto.id;
    saleItemId = sale.dto.items[0].id;

    const row = await prisma.saleItem.findUnique({ where: { id: saleItemId } });
    originalSaleItemSerialized = JSON.stringify(row);
  });

  async function currentStock(): Promise<number> {
    const inv = await prisma.branchInventory.findFirst({ where: { branchId, productId } });
    return Number(inv?.quantity ?? 0);
  }

  it("setup: stock tras la venta es 90", async () => {
    expect(await currentStock()).toBe(INITIAL_STOCK - SOLD_QTY);
  });

  let firstReturnId: string;

  it("primera devolución de 3 unidades — stock sube a 93, status='completed'", async () => {
    const stockBefore = await currentStock();
    const dto = await createReturn.execute({
      saleId,
      creatorId,
      reason: "Producto en mal estado",
      returnedAt: new Date(),
      notes: null,
      items: [{ saleItemId, quantity: 3 }],
    });
    firstReturnId = dto.id;
    expect(dto.status).toBe("completed");
    expect(dto.refundSubtotal).toBeCloseTo(258.6207, 2);
    expect(dto.refundTax).toBeCloseTo(41.3793, 2);
    expect(dto.refundTotal).toBeCloseTo(300, 2);
    expect(await currentStock()).toBe(stockBefore + 3);
  });

  it("segunda devolución de 8 unidades — 409 ReturnQuantityExceedsRemaining (remaining=7)", async () => {
    const err = await createReturn
      .execute({
        saleId,
        creatorId,
        reason: "Otro",
        returnedAt: new Date(),
        notes: null,
        items: [{ saleItemId, quantity: 8 }],
      })
      .catch((e) => e);
    expect(err).toBeInstanceOf(ReturnQuantityExceedsRemainingError);
    expect(err.requested).toBe(8);
    expect(err.remaining).toBe(7);
  });

  let secondReturnId: string;

  it("segunda devolución de 5 unidades — stock sube a 98, status='completed'", async () => {
    const stockBefore = await currentStock();
    const dto = await createReturn.execute({
      saleId,
      creatorId,
      reason: "Cambio comercial",
      returnedAt: new Date(),
      notes: null,
      items: [{ saleItemId, quantity: 5 }],
    });
    secondReturnId = dto.id;
    expect(dto.status).toBe("completed");
    expect(await currentStock()).toBe(stockBefore + 5);
  });

  it("cancelar la primera devolución (3 ud) — stock baja a 95, status='cancelled'", async () => {
    const stockBefore = await currentStock();
    const dto = await cancelReturn.execute({
      id: firstReturnId,
      cancelledBy: creatorId,
      cancellationReason: "Test cancelación",
    });
    expect(dto.status).toBe("cancelled");
    expect(dto.cancelledBy).toBe(creatorId);
    expect(await currentStock()).toBe(stockBefore - 3);
  });

  it("sale_item original es inmutable byte-for-byte tras crear y cancelar devoluciones", async () => {
    const row = await prisma.saleItem.findUnique({ where: { id: saleItemId } });
    expect(JSON.stringify(row)).toBe(originalSaleItemSerialized);
  });

  it("la venta sigue siendo 'completed' y NO está marcada como editada", async () => {
    const { dto } = await getSale.execute(saleId);
    expect(dto.status).toBe("completed");
    expect(dto.editedAt).toBeNull();
  });

  it("la devolución cancelada conserva todos sus items (no hard-delete)", async () => {
    const detail = await getReturn.execute(firstReturnId);
    expect(detail.items).toHaveLength(1);
    expect(detail.items[0].quantity).toBe(3);
    // El registro de la devolución sigue indexable
    expect(detail.cancelledAt).not.toBeNull();
  });
});
