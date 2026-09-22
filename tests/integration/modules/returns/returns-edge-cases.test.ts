/**
 * Integration test: edge cases de devoluciones (task 11.3).
 *
 * Cubre:
 *  (a) sale `cancelled` → 409 SaleNotReturnableError
 *  (b) sale `edited` → 409 SaleNotReturnableError
 *  (c) saleItemId de otra venta → 400 SaleItemNotPartOfSaleError
 *  (d) cancelar return → free space restored → re-crear return por la misma cantidad → 201
 *  (e) cancelar return con stock actual < cantidad → inventario negativo + 200
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
import { EditCompletedSaleUseCase } from "@/modules/pos/application/use-cases/EditCompletedSaleUseCase";
import { CreateReturnUseCase } from "@/modules/returns/application/use-cases/CreateReturnUseCase";
import { CancelReturnUseCase } from "@/modules/returns/application/use-cases/CancelReturnUseCase";
import { SaleNotReturnableError } from "@/modules/returns/domain/errors/SaleNotReturnableError";
import { SaleItemNotPartOfSaleError } from "@/modules/returns/domain/errors/SaleItemNotPartOfSaleError";

const P = "RETEDGE_";
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

describe("Returns — edge cases (integration real DB)", () => {
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
  const editSale = new EditCompletedSaleUseCase(saleRepo, lookups);
  const createReturn = new CreateReturnUseCase(returnRepo, saleRepo);
  const cancelReturn = new CancelReturnUseCase(returnRepo);

  let branchId: string;
  let customerId: string;
  let creatorId: string;
  let productId: string;
  let priceId: string;
  let folioId: string;
  let pmId: string;

  beforeAll(async () => {
    await cleanup();
    const branch = await branchRepo.create({ code: `${P}BRANCH1`, name: "Sucursal Edge" });
    branchId = branch.id;
    const dept = await deptRepo.create({ code: `${P}DEPT1`, name: "Dept Edge" });
    const product = await createProduct.execute({
      code: `${P}PROD1`, name: "Producto Edge", unit: "kg", departmentId: dept.id, ivaRate: 0.16,
    });
    productId = product.id;
    const price = await createPrice.execute(productId, { branchId: branchId, name: "Lista", price: 100, isDefault: true });
    priceId = price.id;
    const customer = await createCustomer.execute({ code: `${P}CLI1`, name: "Cliente Edge", rfc: "RED010101001", branchIds: [branchId] });
    customerId = customer.id;
    const folio = await folioRepo.create({ code: `${P}FOL1`, name: "Folio Edge", prefix: "EDG", currentNumber: 0, scope: "POS" });
    folioId = folio.id;
    const pm = await pmRepo.create({ code: `${P}PM1`, name: "Efectivo Edge" });
    pmId = pm.id;
    const user = await prisma.user.create({
      data: { email: `${P}u@test.com`, passwordHash: "x", name: "User Edge" },
    });
    creatorId = user.id;
    await prisma.branchInventory.create({
      data: { branchId, productId, quantity: 50, reservedQuantity: 0, reorderPoint: 5 },
    });
  });

  async function makeSale(qty = 5) {
    return createSale.execute(
      { branchId, customerId, paymentMethodId: pmId, folioId, items: [{ productId, productPriceId: priceId, quantity: qty }] },
      creatorId
    );
  }

  async function currentStock(): Promise<number> {
    const inv = await prisma.branchInventory.findFirst({ where: { branchId, productId } });
    return Number(inv?.quantity ?? 0);
  }

  it("(a) devolver una venta `cancelled` → SaleNotReturnableError", async () => {
    const { dto: sale } = await makeSale(2);
    await cancelSale.execute(sale.id, { reason: "test" });
    const err = await createReturn
      .execute({
        saleId: sale.id,
        creatorId,
        reason: "intento devolución sobre cancelada",
        returnedAt: new Date(),
        notes: null,
        items: [{ saleItemId: sale.items[0].id, quantity: 1 }],
      })
      .catch((e) => e);
    expect(err).toBeInstanceOf(SaleNotReturnableError);
    expect((err as SaleNotReturnableError).saleStatus).toBe("cancelled");
  });

  it("(b) devolver una venta `edited` → SaleNotReturnableError", async () => {
    const { dto: sale } = await makeSale(3);
    // Editar venta: cambia el detalle, marca status='edited'
    await editSale.execute(sale.id, {
      items: [{ productId, productPriceId: priceId, quantity: 4 }],
    });
    const err = await createReturn
      .execute({
        saleId: sale.id,
        creatorId,
        reason: "intento devolución sobre editada",
        returnedAt: new Date(),
        notes: null,
        items: [{ saleItemId: sale.items[0].id, quantity: 1 }],
      })
      .catch((e) => e);
    expect(err).toBeInstanceOf(SaleNotReturnableError);
    expect((err as SaleNotReturnableError).saleStatus).toBe("edited");
  });

  it("(c) saleItemId de otra venta → SaleItemNotPartOfSaleError", async () => {
    const { dto: saleA } = await makeSale(2);
    const { dto: saleB } = await makeSale(2);
    const err = await createReturn
      .execute({
        saleId: saleA.id,
        creatorId,
        reason: "saleItem cross-sale",
        returnedAt: new Date(),
        notes: null,
        items: [{ saleItemId: saleB.items[0].id, quantity: 1 }],
      })
      .catch((e) => e);
    expect(err).toBeInstanceOf(SaleItemNotPartOfSaleError);
    expect((err as SaleItemNotPartOfSaleError).saleItemId).toBe(saleB.items[0].id);
  });

  it("(d) cancelar return → re-emitir por la misma cantidad → 201", async () => {
    const { dto: sale } = await makeSale(5);
    const first = await createReturn.execute({
      saleId: sale.id,
      creatorId,
      reason: "1ra",
      returnedAt: new Date(),
      notes: null,
      items: [{ saleItemId: sale.items[0].id, quantity: 5 }],
    });
    await cancelReturn.execute({ id: first.id, cancelledBy: creatorId, cancellationReason: null });
    // Espacio liberado → re-crear con qty=5 debe pasar
    const second = await createReturn.execute({
      saleId: sale.id,
      creatorId,
      reason: "2da tras liberar",
      returnedAt: new Date(),
      notes: null,
      items: [{ saleItemId: sale.items[0].id, quantity: 5 }],
    });
    expect(second.status).toBe("completed");
    expect(second.items[0].quantity).toBe(5);
  });

  it("(e) cancelar return cuando stock < qty → inventario queda negativo y 200", async () => {
    const { dto: sale } = await makeSale(2);

    // Devolver 2 ud (stock sube por 2)
    const stockBefore = await currentStock();
    const ret = await createReturn.execute({
      saleId: sale.id,
      creatorId,
      reason: "para luego cancelar con stock <",
      returnedAt: new Date(),
      notes: null,
      items: [{ saleItemId: sale.items[0].id, quantity: 2 }],
    });
    expect(await currentStock()).toBe(stockBefore + 2);

    // Forzar el stock a 1 vía UPDATE crudo (simula que vendieron las 2 unidades devueltas entre dos requests)
    await prisma.branchInventory.updateMany({
      where: { branchId, productId },
      data: { quantity: 1 },
    });
    expect(await currentStock()).toBe(1);

    // Cancelar la devolución decrementa 2: 1 - 2 = -1 (permitido)
    const cancelled = await cancelReturn.execute({
      id: ret.id,
      cancelledBy: creatorId,
      cancellationReason: "test stock negativo",
    });
    expect(cancelled.status).toBe("cancelled");
    expect(await currentStock()).toBe(-1);
  });
});
