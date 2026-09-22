/**
 * Integration test: edge cases en el ciclo de vida de cotizaciones (task 11.3).
 *
 * Cubre:
 *  - convert sobre cotización expirada → QuoteExpiredError
 *  - convert sobre cotización draft → QuoteNotAuthorizedError
 *  - convert sobre cotización cancelled → QuoteNotAuthorizedError
 *  - edit sobre cotización autorizada → QuoteNotEditableError
 *  - cancel sobre cotización ya convertida → QuoteAlreadyConvertedError con saleId
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
import { QuoteExpiredError } from "@/modules/quotes/domain/errors/QuoteExpiredError";
import { QuoteNotAuthorizedError } from "@/modules/quotes/domain/errors/QuoteNotAuthorizedError";
import { QuoteNotEditableError } from "@/modules/quotes/domain/errors/QuoteNotEditableError";
import { QuoteAlreadyConvertedError } from "@/modules/quotes/domain/errors/QuoteAlreadyConvertedError";
import { isBranchScopedInventory } from "@/shared/infrastructure/config/inventoryScope";

jest.setTimeout(30000);

const P = "QUOTEEDGE_";

async function cleanup() {
  await prisma.sale.deleteMany({ where: { folio: { code: { startsWith: P } } } });
  // Defensa adicional: sale_items de otras sales (folio no prefijado) que quedaron
  // referenciando un producto de este test bloquean product.deleteMany más abajo.
  await prisma.saleItem.deleteMany({ where: { product: { code: { startsWith: P } } } });
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

describe("Quotes — edge cases del ciclo de vida (integration real DB)", () => {
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
    const branch = await branchRepo.create({ code: `${P}BR1`, name: "Edge Branch" });
    branchId = branch.id;
    const dept = await deptRepo.create({ code: `${P}DEPT`, name: "Dept Edge" });
    const product = await createProduct.execute({
      code: `${P}P1`, name: "Prod Edge", unit: "kg", departmentId: dept.id, ivaRate: 0.16,
    });
    productId = product.id;
    const price = await createPrice.execute(productId, { name: "Lista", price: 100, isDefault: true });
    priceId = price.id;
    const customer = await createCustomer.execute({ code: `${P}C1`, name: "Cliente Edge", rfc: "CED010101002", branchIds: [branchId] });
    customerId = customer.id;
    quoteFolioId = (await folioRepo.create({ code: `${P}COT`, name: "Cot Edge", prefix: "COT", currentNumber: 0, scope: "POS" })).id;
    fiscalFolioId = (await folioRepo.create({ code: `${P}FAC`, name: "Fac Edge", prefix: "FAC", currentNumber: 0, scope: "POS" })).id;
    pmId = (await pmRepo.create({ code: `${P}PM`, name: "Pago Edge" })).id;
    creatorId = (await prisma.user.create({
      data: { email: `${P}u@test.com`, passwordHash: "x", name: "Edge User" },
    })).id;
  });

  async function newDraft() {
    const { dto } = await createQuote.execute(
      { branchId, customerId, folioId: quoteFolioId, items: [{ productId, productPriceId: priceId, quantity: 1 }] },
      creatorId
    );
    return dto.id;
  }

  it("convert sobre cotización draft → QuoteNotAuthorizedError", async () => {
    const id = await newDraft();
    await expect(
      convertQuote.execute(id, { paymentMethodId: pmId, folioId: fiscalFolioId, notes: null }, creatorId)
    ).rejects.toBeInstanceOf(QuoteNotAuthorizedError);
  });

  it("convert sobre cotización cancelled → QuoteNotAuthorizedError", async () => {
    const id = await newDraft();
    await cancelQuote.execute(id, { reason: "test" });
    await expect(
      convertQuote.execute(id, { paymentMethodId: pmId, folioId: fiscalFolioId, notes: null }, creatorId)
    ).rejects.toBeInstanceOf(QuoteNotAuthorizedError);
  });

  it("convert sobre cotización autorizada y expirada → QuoteExpiredError", async () => {
    // Crear con expiresAt en el futuro, autorizar, luego pisar manualmente expires_at al pasado
    const { dto } = await createQuote.execute(
      {
        branchId,
        customerId,
        folioId: quoteFolioId,
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
        items: [{ productId, productPriceId: priceId, quantity: 1 }],
      },
      creatorId
    );
    const id = dto.id;
    await authorizeQuote.execute(id, {}, creatorId);
    await prisma.quote.update({
      where: { id },
      data: { expiresAt: new Date(Date.now() - 86400000) },
    });
    await expect(
      convertQuote.execute(id, { paymentMethodId: pmId, folioId: fiscalFolioId, notes: null }, creatorId)
    ).rejects.toBeInstanceOf(QuoteExpiredError);
  });

  it("update sobre cotización autorizada → QuoteNotEditableError", async () => {
    const id = await newDraft();
    await authorizeQuote.execute(id, {}, creatorId);
    await expect(
      updateQuote.execute(id, { notes: "ya tarde" })
    ).rejects.toBeInstanceOf(QuoteNotEditableError);
  });

  // Convierte la cotización, lo que requiere que el producto esté asignado a la sucursal en modo `branch`
  // (ver ProductNotAvailableInBranchError) — este test no seedea esa asignación, sólo corre en modo `general`.
  (isBranchScopedInventory() ? it.skip : it)("cancel sobre cotización converted → QuoteAlreadyConvertedError con saleId", async () => {
    const id = await newDraft();
    await authorizeQuote.execute(id, {}, creatorId);
    const { dto: sale } = await convertQuote.execute(
      id,
      { paymentMethodId: pmId, folioId: fiscalFolioId, notes: null },
      creatorId
    );
    try {
      await cancelQuote.execute(id, { reason: "intento" });
      throw new Error("expected QuoteAlreadyConvertedError");
    } catch (err) {
      expect(err).toBeInstanceOf(QuoteAlreadyConvertedError);
      expect((err as QuoteAlreadyConvertedError).saleId).toBe(sale.id);
    }
  });
});
