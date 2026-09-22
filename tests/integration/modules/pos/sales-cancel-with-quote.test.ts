/**
 * Integration test: cancelar una venta nacida de una conversión de cotización (task 11.7).
 *
 * Verifica:
 *  - sale.status='cancelled'
 *  - inventario restaurado al stock pre-conversión
 *  - quote.status permanece 'converted' (NO vuelve a 'authorized'); el comportamiento
 *    de "revertir cotización" se difiere a un módulo de reversiones futuro
 *  - quote.convertedSaleId permanece poblado (apuntando a la venta cancelada)
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
import { AuthorizeQuoteUseCase } from "@/modules/quotes/application/use-cases/AuthorizeQuoteUseCase";
import { ConvertQuoteToSaleUseCase } from "@/modules/quotes/application/use-cases/ConvertQuoteToSaleUseCase";
import { CancelSaleUseCase } from "@/modules/pos/application/use-cases/CancelSaleUseCase";

jest.setTimeout(30000);

const P = "CANCELQ_";

async function cleanup() {
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

describe("Sales — cancelar venta nacida de conversión (integration real DB)", () => {
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
  const authorizeQuote = new AuthorizeQuoteUseCase(quoteRepo);
  const convertQuote = new ConvertQuoteToSaleUseCase(quoteRepo, saleRepo, lookups);
  const cancelSale = new CancelSaleUseCase(saleRepo);

  const INITIAL_STOCK = 50;
  const SALE_QTY = 10;

  let branchId: string;
  let customerId: string;
  let creatorId: string;
  let productId: string;
  let priceId: string;
  let quoteFolioId: string;
  let fiscalFolioId: string;
  let pmId: string;
  let quoteId: string;
  let saleId: string;

  beforeAll(async () => {
    await cleanup();
    branchId = (await branchRepo.create({ code: `${P}BR`, name: "Cancel Branch" })).id;
    const dept = await deptRepo.create({ code: `${P}D`, name: "Dept" });
    productId = (await createProduct.execute({
      code: `${P}P`, name: "Prod Cancel", unit: "kg", departmentId: dept.id, ivaRate: 0.16,
    })).id;
    priceId = (await createPrice.execute(productId, { name: "Lista", price: 100, isDefault: true })).id;
    customerId = (await createCustomer.execute({ code: `${P}C`, name: "Cliente Cancel", rfc: "CCA010101001", branchIds: [branchId] })).id;
    quoteFolioId = (await folioRepo.create({ code: `${P}COT`, name: "Cot", prefix: "COT", currentNumber: 0, scope: "POS" })).id;
    fiscalFolioId = (await folioRepo.create({ code: `${P}FAC`, name: "Fac", prefix: "FAC", currentNumber: 0, scope: "POS" })).id;
    pmId = (await pmRepo.create({ code: `${P}PM`, name: "Efectivo" })).id;
    creatorId = (await prisma.user.create({
      data: { email: `${P}u@test.com`, passwordHash: "x", name: "Op" },
    })).id;
    await prisma.branchInventory.create({
      data: { branchId, productId, quantity: INITIAL_STOCK, reservedQuantity: 0, reorderPoint: 0 },
    });
  });

  it("flujo completo: convertir cotización autorizada y cancelar la venta resultante", async () => {
    // 1. Crear + autorizar cotización
    const created = await createQuote.execute(
      {
        branchId,
        customerId,
        folioId: quoteFolioId,
        items: [{ productId, productPriceId: priceId, quantity: SALE_QTY }],
      },
      creatorId
    );
    quoteId = created.dto.id;
    await authorizeQuote.execute(quoteId, {}, creatorId);

    // 2. Convertir → venta nace con quoteId; stock decrementa
    const { dto: sale } = await convertQuote.execute(
      quoteId,
      { paymentMethodId: pmId, folioId: fiscalFolioId, notes: null },
      creatorId
    );
    saleId = sale.id;
    expect(sale.quoteId).toBe(quoteId);

    const invAfterConvert = await prisma.branchInventory.findFirst({ where: { branchId, productId } });
    expect(Number(invAfterConvert!.quantity)).toBe(INITIAL_STOCK - SALE_QTY);

    // 3. Cancelar la venta
    const { dto: cancelled } = await cancelSale.execute(saleId, { reason: "Cliente arrepentido" });
    expect(cancelled.status).toBe("cancelled");
    expect(cancelled.cancellationReason).toBe("Cliente arrepentido");
    expect(cancelled.quoteId).toBe(quoteId); // el enlace sobrevive

    // 4. Stock restaurado
    const invAfterCancel = await prisma.branchInventory.findFirst({ where: { branchId, productId } });
    expect(Number(invAfterCancel!.quantity)).toBe(INITIAL_STOCK);

    // 5. Cotización permanece converted (NO regresa a authorized)
    const quoteRow = await prisma.quote.findUnique({ where: { id: quoteId } });
    expect(quoteRow!.status).toBe("converted");
    expect(quoteRow!.convertedSaleId).toBe(saleId);
  });
});
