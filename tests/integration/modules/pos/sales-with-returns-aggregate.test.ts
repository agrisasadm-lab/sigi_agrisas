/**
 * Integration test: agregado `returnedQuantityBySaleItem` en SaleDetailDto (task 11.5).
 *
 * Verifica que GET /sales/:id devuelve un agregado correcto considerando sólo
 * devoluciones `completed` (las `cancelled` no cuentan).
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

const P = "RETAGG_";
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

describe("POS — returnedQuantityBySaleItem aggregate (integration real DB)", () => {
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

  let saleId: string;
  let aId: string;
  let bId: string;
  let cId: string;
  let creatorId: string;

  beforeAll(async () => {
    await cleanup();
    const branch = await branchRepo.create({ code: `${P}BR1`, name: "Sucursal Agg" });
    const dept = await deptRepo.create({ code: `${P}D1`, name: "Dept Agg" });
    const prodA = await createProduct.execute({ code: `${P}A`, name: "A", unit: "kg", departmentId: dept.id, ivaRate: 0.16 });
    const prodB = await createProduct.execute({ code: `${P}B`, name: "B", unit: "kg", departmentId: dept.id, ivaRate: 0.16 });
    const prodC = await createProduct.execute({ code: `${P}C`, name: "C", unit: "kg", departmentId: dept.id, ivaRate: 0.16 });
    const priceA = await createPrice.execute(prodA.id, { branchId: branch.id, name: "Lista", price: 50, isDefault: true });
    const priceB = await createPrice.execute(prodB.id, { branchId: branch.id, name: "Lista", price: 50, isDefault: true });
    const priceC = await createPrice.execute(prodC.id, { branchId: branch.id, name: "Lista", price: 50, isDefault: true });
    const customer = await createCustomer.execute({ code: `${P}CLI1`, name: "Cliente Agg", rfc: "CAG010101001", branchIds: [branch.id] });
    const folio = await folioRepo.create({ code: `${P}FOL1`, name: "Folio Agg", prefix: "AG", currentNumber: 0, scope: "POS" });
    const pm = await pmRepo.create({ code: `${P}PM1`, name: "Efectivo Agg" });
    const user = await prisma.user.create({ data: { email: `${P}u@test.com`, passwordHash: "x", name: "User Agg" } });
    creatorId = user.id;

    await prisma.branchInventory.createMany({
      data: [prodA.id, prodB.id, prodC.id].map((pid) => ({
        branchId: branch.id, productId: pid, quantity: 100, reservedQuantity: 0, reorderPoint: 5,
      })),
    });

    const sale = await createSale.execute(
      {
        branchId: branch.id,
        customerId: customer.id,
        paymentMethodId: pm.id,
        folioId: folio.id,
        items: [
          { productId: prodA.id, productPriceId: priceA.id, quantity: 5 },
          { productId: prodB.id, productPriceId: priceB.id, quantity: 3 },
          { productId: prodC.id, productPriceId: priceC.id, quantity: 2 },
        ],
      },
      creatorId
    );
    saleId = sale.dto.id;
    aId = sale.dto.items.find((i) => i.productId === prodA.id)!.id;
    bId = sale.dto.items.find((i) => i.productId === prodB.id)!.id;
    cId = sale.dto.items.find((i) => i.productId === prodC.id)!.id;
  });

  it("sin devoluciones → {}", async () => {
    const { dto } = await getSale.execute(saleId);
    expect(dto.returnedQuantityBySaleItem).toEqual({});
  });

  it("primer return de 2A + 1C → { A: 2, C: 1 } (B ausente)", async () => {
    await createReturn.execute({
      saleId,
      creatorId,
      reason: "Parcial inicial",
      returnedAt: new Date(),
      notes: null,
      items: [
        { saleItemId: aId, quantity: 2 },
        { saleItemId: cId, quantity: 1 },
      ],
    });
    const { dto } = await getSale.execute(saleId);
    expect(dto.returnedQuantityBySaleItem).toEqual({ [aId]: 2, [cId]: 1 });
  });

  let firstReturnId: string;

  it("segundo return de 1A → { A: 3, C: 1 }", async () => {
    const ret = await createReturn.execute({
      saleId,
      creatorId,
      reason: "Adicional A",
      returnedAt: new Date(),
      notes: null,
      items: [{ saleItemId: aId, quantity: 1 }],
    });
    firstReturnId = ret.id; // este será el que cancelaremos (tiene sólo 1A)
    const { dto } = await getSale.execute(saleId);
    expect(dto.returnedQuantityBySaleItem).toEqual({ [aId]: 3, [cId]: 1 });
  });

  it("cancelar el segundo return (1A) → { A: 2, C: 1 }", async () => {
    await cancelReturn.execute({ id: firstReturnId, cancelledBy: creatorId, cancellationReason: null });
    const { dto } = await getSale.execute(saleId);
    expect(dto.returnedQuantityBySaleItem).toEqual({ [aId]: 2, [cId]: 1 });
    expect(dto.returnedQuantityBySaleItem[bId]).toBeUndefined();
  });
});
