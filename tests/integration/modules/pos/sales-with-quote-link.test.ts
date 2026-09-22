/**
 * Integration test: `POST /sales` con `quoteId` opcional (task 11.6).
 *
 * Cubre el path donde una integración externa emite una venta enlazada
 * a una cotización autorizada. Verifica:
 *  - happy path: sale.quoteId poblado, quote.status='converted', quote.convertedSaleId apunta a la venta, inventario decrementado
 *  - negative: quoteId ya converted → QuoteLinkInvalidError(wrong_status)
 *  - negative: branch mismatch entre body y quote → QuoteLinkInvalidError(branch_mismatch)
 *  - negative: customer mismatch entre body y quote → QuoteLinkInvalidError(customer_mismatch)
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
import { CreateSaleUseCase } from "@/modules/pos/application/use-cases/CreateSaleUseCase";
import { QuoteLinkInvalidError } from "@/modules/pos/domain/errors/QuoteLinkInvalidError";
import { isBranchScopedInventory } from "@/shared/infrastructure/config/inventoryScope";

// Estos 3 tests venden sin seedear fila previa en branch_inventory para el producto/sucursal —
// válido en modo `general` (allowRowCreation=true). En modo `branch` la venta se rechaza a propósito
// (ver ProductNotAvailableInBranchError), así que sólo corren en modo `general`.
const itGeneralOnly = isBranchScopedInventory() ? it.skip : it;

jest.setTimeout(30000);

const P = "SALEQUOTE_";

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

describe("Sales — POST /sales con quoteId (integration real DB)", () => {
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
  const createSale = new CreateSaleUseCase(saleRepo, lookups, quoteRepo);

  let branchId: string;
  let otherBranchId: string;
  let customerId: string;
  let otherCustomerId: string;
  let cashierId: string;
  let productId: string;
  let priceId: string;
  let otherPriceId: string;
  let quoteFolioId: string;
  let fiscalFolioId: string;
  let pmId: string;

  beforeAll(async () => {
    await cleanup();
    branchId = (await branchRepo.create({ code: `${P}BR1`, name: "Branch 1" })).id;
    otherBranchId = (await branchRepo.create({ code: `${P}BR2`, name: "Branch 2" })).id;
    const dept = await deptRepo.create({ code: `${P}DEPT`, name: "Dept" });
    productId = (await createProduct.execute({
      code: `${P}P1`, name: "Prod", unit: "kg", departmentId: dept.id, ivaRate: 0.16,
    })).id;
    priceId = (await createPrice.execute(productId, { branchId, name: "Lista", price: 100, isDefault: true })).id;
    otherPriceId = (await createPrice.execute(productId, { branchId: otherBranchId, name: "Lista", price: 100, isDefault: true })).id;
    customerId = (await createCustomer.execute({ code: `${P}C1`, name: "Cli 1", rfc: "CLI010101001", branchIds: [branchId, otherBranchId] })).id;
    otherCustomerId = (await createCustomer.execute({ code: `${P}C2`, name: "Cli 2", rfc: "CLI020202002", branchIds: [branchId] })).id;
    quoteFolioId = (await folioRepo.create({ code: `${P}COT`, name: "Cot", prefix: "COT", currentNumber: 0, scope: "POS" })).id;
    fiscalFolioId = (await folioRepo.create({ code: `${P}FAC`, name: "Fac", prefix: "FAC", currentNumber: 0, scope: "POS" })).id;
    pmId = (await pmRepo.create({ code: `${P}PM`, name: "Efectivo" })).id;
    cashierId = (await prisma.user.create({
      data: { email: `${P}u@test.com`, passwordHash: "x", name: "Cashier" },
    })).id;
  });

  async function newAuthorizedQuote(opts: { branch?: string; customer?: string }) {
    const quoteBranchId = opts.branch ?? branchId;
    const { dto } = await createQuote.execute(
      {
        branchId: quoteBranchId,
        customerId: opts.customer ?? customerId,
        folioId: quoteFolioId,
        items: [{ productId, productPriceId: quoteBranchId === otherBranchId ? otherPriceId : priceId, quantity: 5 }],
      },
      cashierId
    );
    await authorizeQuote.execute(dto.id, {}, cashierId);
    return dto.id;
  }

  itGeneralOnly("happy path: POST /sales con quoteId válido enlaza ambas direcciones y decrementa stock", async () => {
    const quoteId = await newAuthorizedQuote({});
    const invBefore = await prisma.branchInventory.findFirst({ where: { branchId, productId } });
    const stockBefore = Number(invBefore?.quantity ?? 0);

    const { dto: sale } = await createSale.execute(
      {
        branchId,
        customerId,
        paymentMethodId: pmId,
        folioId: fiscalFolioId,
        quoteId,
        items: [{ productId, productPriceId: priceId, quantity: 5 }],
      },
      cashierId
    );

    expect(sale.quoteId).toBe(quoteId);
    expect(sale.status).toBe("completed");

    const quoteRow = await prisma.quote.findUnique({ where: { id: quoteId } });
    expect(quoteRow!.status).toBe("converted");
    expect(quoteRow!.convertedSaleId).toBe(sale.id);

    const invAfter = await prisma.branchInventory.findFirst({ where: { branchId, productId } });
    expect(Number(invAfter!.quantity)).toBe(stockBefore - 5);
  });

  itGeneralOnly("rechaza quoteId ya converted (reason: wrong_status)", async () => {
    const quoteId = await newAuthorizedQuote({});
    // primera venta consume la cotización
    await createSale.execute(
      { branchId, customerId, paymentMethodId: pmId, folioId: fiscalFolioId, quoteId,
        items: [{ productId, productPriceId: priceId, quantity: 1 }] },
      cashierId
    );
    // segunda intenta usar el mismo quoteId
    try {
      await createSale.execute(
        { branchId, customerId, paymentMethodId: pmId, folioId: fiscalFolioId, quoteId,
          items: [{ productId, productPriceId: priceId, quantity: 1 }] },
        cashierId
      );
      throw new Error("expected QuoteLinkInvalidError");
    } catch (err) {
      expect(err).toBeInstanceOf(QuoteLinkInvalidError);
      expect((err as QuoteLinkInvalidError).reason).toBe("wrong_status");
    }
  });

  it("rechaza branch mismatch entre body y cotización (reason: branch_mismatch)", async () => {
    const quoteId = await newAuthorizedQuote({ branch: otherBranchId });
    try {
      await createSale.execute(
        { branchId, customerId, paymentMethodId: pmId, folioId: fiscalFolioId, quoteId,
          items: [{ productId, productPriceId: priceId, quantity: 1 }] },
        cashierId
      );
      throw new Error("expected QuoteLinkInvalidError");
    } catch (err) {
      expect(err).toBeInstanceOf(QuoteLinkInvalidError);
      expect((err as QuoteLinkInvalidError).reason).toBe("branch_mismatch");
    }
  });

  it("rechaza customer mismatch entre body y cotización (reason: customer_mismatch)", async () => {
    const quoteId = await newAuthorizedQuote({ customer: otherCustomerId });
    try {
      await createSale.execute(
        { branchId, customerId, paymentMethodId: pmId, folioId: fiscalFolioId, quoteId,
          items: [{ productId, productPriceId: priceId, quantity: 1 }] },
        cashierId
      );
      throw new Error("expected QuoteLinkInvalidError");
    } catch (err) {
      expect(err).toBeInstanceOf(QuoteLinkInvalidError);
      expect((err as QuoteLinkInvalidError).reason).toBe("customer_mismatch");
    }
  });

  itGeneralOnly("POST /sales sin quoteId (compat): sale.quoteId queda null", async () => {
    const { dto: sale } = await createSale.execute(
      {
        branchId,
        customerId,
        paymentMethodId: pmId,
        folioId: fiscalFolioId,
        items: [{ productId, productPriceId: priceId, quantity: 1 }],
      },
      cashierId
    );
    expect(sale.quoteId).toBeNull();
  });
});
