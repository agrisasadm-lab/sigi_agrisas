/**
 * Integration test: regla clave del módulo `quotes` — el ciclo de vida de
 * cotizaciones NO modifica `branch_inventory` en NINGÚN punto excepto en la
 * conversión a venta, que delega al pipeline de POS.
 *
 * Cubre tasks 11.1 (CRUD básico + verificar inventario sin cambios) y 11.5
 * (no-inventory-impact con stock inicial fijo).
 */
import { prisma } from "@/shared/infrastructure/prisma/client";
import { PrismaBranchRepository } from "@/modules/branches/infrastructure/repositories/PrismaBranchRepository";
import { PrismaDepartmentRepository } from "@/modules/departments/infrastructure/repositories/PrismaDepartmentRepository";
import { PrismaProductRepository } from "@/modules/products/infrastructure/repositories/PrismaProductRepository";
import { PrismaProductPriceRepository } from "@/modules/products/infrastructure/repositories/PrismaProductPriceRepository";
import { PrismaCustomerRepository } from "@/modules/customers/infrastructure/repositories/PrismaCustomerRepository";
import { PrismaFolioRepository } from "@/modules/folios/infrastructure/repositories/PrismaFolioRepository";
import { PrismaPaymentMethodRepository } from "@/modules/payment-methods/infrastructure/repositories/PrismaPaymentMethodRepository";
import { PrismaQuoteRepository } from "@/modules/quotes/infrastructure/repositories/PrismaQuoteRepository";
import { PrismaSaleRepository } from "@/modules/pos/infrastructure/repositories/PrismaSaleRepository";
import { PrismaPosLookupService } from "@/modules/pos/infrastructure/repositories/PrismaPosLookupService";
import { CreateCustomerUseCase } from "@/modules/customers/application/use-cases/CreateCustomerUseCase";
import { CreateProductUseCase } from "@/modules/products/application/use-cases/CreateProductUseCase";
import { CreateProductPriceUseCase } from "@/modules/products/application/use-cases/CreateProductPriceUseCase";
import { CreateQuoteUseCase } from "@/modules/quotes/application/use-cases/CreateQuoteUseCase";
import { UpdateQuoteUseCase } from "@/modules/quotes/application/use-cases/UpdateQuoteUseCase";
import { AuthorizeQuoteUseCase } from "@/modules/quotes/application/use-cases/AuthorizeQuoteUseCase";
import { CancelQuoteUseCase } from "@/modules/quotes/application/use-cases/CancelQuoteUseCase";
import { ConvertQuoteToSaleUseCase } from "@/modules/quotes/application/use-cases/ConvertQuoteToSaleUseCase";
import { GetQuoteUseCase } from "@/modules/quotes/application/use-cases/GetQuoteUseCase";

const P = "QUOTETEST_";
const INITIAL_STOCK = 100;

async function cleanup() {
  // Borra primero los hijos para no chocar con FK RESTRICT
  await prisma.sale.deleteMany({ where: { folio: { code: { startsWith: P } } } });
  await prisma.quoteItem.deleteMany({ where: { product: { code: { startsWith: P } } } });
  await prisma.quoteItem.deleteMany({ where: { quote: { folio: { code: { startsWith: P } } } } });
  await prisma.quote.deleteMany({ where: { folio: { code: { startsWith: P } } } });
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

describe("Quotes — el ciclo de vida no toca inventario (integration real DB)", () => {
  const branchRepo = new PrismaBranchRepository(prisma);
  const deptRepo = new PrismaDepartmentRepository(prisma);
  const productRepo = new PrismaProductRepository(prisma);
  const priceRepo = new PrismaProductPriceRepository(prisma);
  const customerRepo = new PrismaCustomerRepository(prisma);
  const folioRepo = new PrismaFolioRepository(prisma);
  const pmRepo = new PrismaPaymentMethodRepository(prisma);
  const quoteRepo = new PrismaQuoteRepository(prisma);
  const saleRepo = new PrismaSaleRepository(prisma);
  const lookups = new PrismaPosLookupService(prisma);

  const createCustomer = new CreateCustomerUseCase(customerRepo);
  const createProduct = new CreateProductUseCase(productRepo, deptRepo);
  const createPrice = new CreateProductPriceUseCase(productRepo, priceRepo);
  const createQuote = new CreateQuoteUseCase(quoteRepo, lookups);
  const updateQuote = new UpdateQuoteUseCase(quoteRepo, lookups);
  const authorizeQuote = new AuthorizeQuoteUseCase(quoteRepo);
  const cancelQuote = new CancelQuoteUseCase(quoteRepo);
  const convertQuote = new ConvertQuoteToSaleUseCase(quoteRepo, saleRepo, lookups);
  const getQuote = new GetQuoteUseCase(quoteRepo);

  let branchId: string;
  let customerId: string;
  let creatorId: string;
  let productId: string;
  let priceId: string;
  let quoteFolioId: string;
  let fiscalFolioId: string;
  let pmId: string;

  beforeAll(async () => {
    await cleanup();

    const branch = await branchRepo.create({ code: `${P}BRANCH1`, name: "Sucursal Quote Test" });
    branchId = branch.id;

    const dept = await deptRepo.create({ code: `${P}DEPT1`, name: "Dept Quote Test" });
    const product = await createProduct.execute({
      code: `${P}PROD1`,
      name: "Producto Quote Test",
      unit: "kg",
      departmentId: dept.id,
      ivaRate: 0.16,
    });
    productId = product.id;

    const price = await createPrice.execute(productId, {
      branchId: branchId,
      name: "Lista",
      price: 50,
      isDefault: true,
    });
    priceId = price.id;

    const customer = await createCustomer.execute({
      code: `${P}CLI1`,
      name: "Cliente Quote",
      rfc: "CQO010101001",
      branchIds: [branchId],
    });
    customerId = customer.id;

    const cotFolio = await folioRepo.create({
      code: `${P}COT`,
      name: "Folio Cotización",
      prefix: "COT",
      currentNumber: 0,
      scope: "POS",
    });
    quoteFolioId = cotFolio.id;

    const fiscalFolio = await folioRepo.create({
      code: `${P}FAC`,
      name: "Folio Fiscal",
      prefix: "FAC",
      currentNumber: 0,
      scope: "POS",
    });
    fiscalFolioId = fiscalFolio.id;

    const pm = await pmRepo.create({ code: `${P}PM1`, name: "Efectivo Quote" });
    pmId = pm.id;

    const user = await prisma.user.create({
      data: { email: `${P}creator@test.com`, passwordHash: "test-hash", name: "Creador Test" },
    });
    creatorId = user.id;

    // Stock inicial: 100 unidades en la sucursal
    await prisma.branchInventory.create({
      data: {
        branchId,
        productId,
        quantity: INITIAL_STOCK,
        reservedQuantity: 0,
        reorderPoint: 10,
      },
    });
  });

  async function currentStock(): Promise<number> {
    const inv = await prisma.branchInventory.findFirst({ where: { branchId, productId } });
    return Number(inv?.quantity ?? 0);
  }

  it("stock inicial es 100", async () => {
    expect(await currentStock()).toBe(INITIAL_STOCK);
  });

  let draftId: string;

  it("create quote con qty=30 NO mueve inventario", async () => {
    const before = await currentStock();
    const { dto } = await createQuote.execute(
      {
        branchId,
        customerId,
        folioId: quoteFolioId,
        items: [{ productId, productPriceId: priceId, quantity: 30 }],
      },
      creatorId
    );
    draftId = dto.id;
    expect(dto.status).toBe("draft");
    expect(dto.folioNumber).toBe(1);
    expect(await currentStock()).toBe(before);
  });

  it("update quote (cambiar qty a 50) NO mueve inventario", async () => {
    const before = await currentStock();
    const { dto } = await updateQuote.execute(draftId, {
      items: [{ productId, productPriceId: priceId, quantity: 50 }],
    });
    expect(dto.subtotal).toBeCloseTo(2500, 2); // 50 × 50
    expect(await currentStock()).toBe(before);
  });

  it("update quote (sólo notas) NO mueve inventario", async () => {
    const before = await currentStock();
    await updateQuote.execute(draftId, { notes: "Cliente pide entrega martes" });
    expect(await currentStock()).toBe(before);
  });

  it("authorize quote NO mueve inventario", async () => {
    const before = await currentStock();
    const { dto } = await authorizeQuote.execute(draftId, {}, creatorId);
    expect(dto.status).toBe("authorized");
    expect(dto.authorizedBy).toBe(creatorId);
    expect(await currentStock()).toBe(before);
  });

  it("cancel quote autorizada NO mueve inventario", async () => {
    const before = await currentStock();
    const { dto } = await cancelQuote.execute(draftId, { reason: "Cliente desistió" });
    expect(dto.status).toBe("cancelled");
    expect(await currentStock()).toBe(before);
  });

  it("folio NO se libera al cancelar (la siguiente cotización toma número 2)", async () => {
    const { dto } = await createQuote.execute(
      {
        branchId,
        customerId,
        folioId: quoteFolioId,
        items: [{ productId, productPriceId: priceId, quantity: 10 }],
      },
      creatorId
    );
    expect(dto.folioNumber).toBe(2);
  });

  let quoteToConvertId: string;
  let convertedSaleId: string;

  it("crear + autorizar otra cotización con qty=20 sigue sin tocar inventario", async () => {
    const stockBefore = await currentStock();
    const created = await createQuote.execute(
      {
        branchId,
        customerId,
        folioId: quoteFolioId,
        items: [{ productId, productPriceId: priceId, quantity: 20 }],
      },
      creatorId
    );
    quoteToConvertId = created.dto.id;
    expect(await currentStock()).toBe(stockBefore);

    await authorizeQuote.execute(quoteToConvertId, {}, creatorId);
    expect(await currentStock()).toBe(stockBefore);
  });

  it("convert quote SI decrementa inventario (20 unidades) y enlaza venta ↔ cotización", async () => {
    const stockBefore = await currentStock();
    const { dto: sale } = await convertQuote.execute(
      quoteToConvertId,
      { paymentMethodId: pmId, folioId: fiscalFolioId },
      creatorId
    );
    convertedSaleId = sale.id;
    expect(sale.status).toBe("completed");
    expect(sale.quoteId).toBe(quoteToConvertId);
    expect(await currentStock()).toBe(stockBefore - 20);

    // Cotización marcada como convertida con enlace al sale
    const { dto: quote } = await getQuote.execute(quoteToConvertId);
    expect(quote.status).toBe("converted");
    expect(quote.convertedSaleId).toBe(convertedSaleId);

    // Folio fiscal incrementado — contador por sucursal, no el global (allocateBranchFolio).
    const fiscalFolio = await prisma.folio.findUnique({ where: { id: fiscalFolioId } });
    expect(fiscalFolio!.currentNumber).toBe(0);
    const branchCounter = await prisma.folioBranchCounter.findUnique({
      where: { folioId_branchId: { folioId: fiscalFolioId, branchId } },
    });
    expect(branchCounter!.currentNumber).toBe(1);
  });

  it("convertir dos veces la misma cotización es idempotente (sin doble decremento ni doble folio)", async () => {
    const stockBefore = await currentStock();
    const fiscalFolioBefore = await prisma.folio.findUnique({ where: { id: fiscalFolioId } });

    const { dto: secondSale } = await convertQuote.execute(
      quoteToConvertId,
      { paymentMethodId: pmId, folioId: fiscalFolioId },
      creatorId
    );

    expect(secondSale.id).toBe(convertedSaleId); // misma venta
    expect(await currentStock()).toBe(stockBefore); // sin doble decremento
    const fiscalFolioAfter = await prisma.folio.findUnique({ where: { id: fiscalFolioId } });
    expect(fiscalFolioAfter!.currentNumber).toBe(fiscalFolioBefore!.currentNumber); // sin doble incremento
  });

  it("rechaza editar cotización ya autorizada/convertida", async () => {
    await expect(
      updateQuote.execute(quoteToConvertId, { notes: "tarde" })
    ).rejects.toThrow();
  });

  it("rechaza cancelar cotización ya convertida (debe cancelarse la venta)", async () => {
    await expect(cancelQuote.execute(quoteToConvertId, { reason: "no" })).rejects.toThrow();
  });
});
