/**
 * Integration test: cancelar venta con devoluciones vigentes (task 11.6).
 *
 * Verifica que:
 *  (a) la venta queda `cancelled`
 *  (b) el inventario se incrementa por la cantidad ORIGINAL vendida (no neta) — comportamiento
 *      intencional documentado en CLAUDE.md
 *  (c) el return sigue existiendo intacto
 *  (d) `returnedQuantityBySaleItem` sigue poblado en el detalle de la venta cancelada
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
import { CancelSaleUseCase } from "@/modules/pos/application/use-cases/CancelSaleUseCase";
import { GetSaleUseCase } from "@/modules/pos/application/use-cases/GetSaleUseCase";
import { CreateReturnUseCase } from "@/modules/returns/application/use-cases/CreateReturnUseCase";
import { GetReturnUseCase } from "@/modules/returns/application/use-cases/GetReturnUseCase";

const P = "RETCANCEL_";
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

describe("POS — cancelar venta con returns vigentes (integration real DB)", () => {
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
  const cancelSale = new CancelSaleUseCase(saleRepo);
  const getSale = new GetSaleUseCase(saleRepo);
  const createReturn = new CreateReturnUseCase(returnRepo, saleRepo);
  const getReturn = new GetReturnUseCase(returnRepo);

  let branchId: string;
  let productId: string;
  let saleId: string;
  let saleItemId: string;
  let returnId: string;
  let creatorId: string;

  const INITIAL_STOCK = 100;
  const SOLD = 10;
  const RETURNED = 4;

  beforeAll(async () => {
    await cleanup();
    const branch = await branchRepo.create({ code: `${P}BR1`, name: "Sucursal CancelRet" });
    branchId = branch.id;
    const dept = await deptRepo.create({ code: `${P}D1`, name: "Dept CancelRet" });
    const product = await createProduct.execute({ code: `${P}P1`, name: "Prod CancelRet", unit: "kg", departmentId: dept.id, ivaRate: 0.16 });
    productId = product.id;
    const price = await createPrice.execute(productId, { name: "Lista", price: 100, isDefault: true });
    const customer = await createCustomer.execute({ code: `${P}CLI1`, name: "Cliente CancelRet", rfc: "CCR010101001", branchIds: [branchId] });
    const folio = await folioRepo.create({ code: `${P}FOL1`, name: "Folio CancelRet", prefix: "CR", currentNumber: 0, scope: "POS" });
    const pm = await pmRepo.create({ code: `${P}PM1`, name: "Efectivo CancelRet" });
    const user = await prisma.user.create({ data: { email: `${P}u@test.com`, passwordHash: "x", name: "User CR" } });
    creatorId = user.id;

    await prisma.branchInventory.create({
      data: { branchId, productId, quantity: INITIAL_STOCK, reservedQuantity: 0, reorderPoint: 5 },
    });

    const sale = await createSale.execute(
      { branchId, customerId: customer.id, paymentMethodId: pm.id, folioId: folio.id, items: [{ productId, productPriceId: price.id, quantity: SOLD }] },
      creatorId
    );
    saleId = sale.dto.id;
    saleItemId = sale.dto.items[0].id;

    const ret = await createReturn.execute({
      saleId,
      creatorId,
      reason: "Devolución parcial pre-cancel",
      returnedAt: new Date(),
      notes: null,
      items: [{ saleItemId, quantity: RETURNED }],
    });
    returnId = ret.id;
  });

  async function currentStock(): Promise<number> {
    const inv = await prisma.branchInventory.findFirst({ where: { branchId, productId } });
    return Number(inv?.quantity ?? 0);
  }

  it("setup: stock = INITIAL - SOLD + RETURNED = 100 - 10 + 4 = 94", async () => {
    expect(await currentStock()).toBe(INITIAL_STOCK - SOLD + RETURNED);
  });

  it("cancelar la venta: status='cancelled', stock se infla por la cantidad ORIGINAL (no neta)", async () => {
    const stockBefore = await currentStock();
    await cancelSale.execute(saleId, { reason: "test cancel con returns" });
    const { dto } = await getSale.execute(saleId);
    expect(dto.status).toBe("cancelled");

    // Restaura el SOLD completo, sin descontar el RETURNED: stock += SOLD
    expect(await currentStock()).toBe(stockBefore + SOLD);
    // Inflación documentada = RETURNED unidades por encima del stock inicial
    expect(await currentStock()).toBe(INITIAL_STOCK + RETURNED);
  });

  it("el return sigue existiendo intacto tras cancelar la venta", async () => {
    const ret = await getReturn.execute(returnId);
    expect(ret.status).toBe("completed");
    expect(ret.items).toHaveLength(1);
    expect(ret.items[0].quantity).toBe(RETURNED);
  });

  it("returnedQuantityBySaleItem sigue mostrando el return tras cancelar la venta", async () => {
    const { dto } = await getSale.execute(saleId);
    expect(dto.returnedQuantityBySaleItem).toEqual({ [saleItemId]: RETURNED });
  });
});
