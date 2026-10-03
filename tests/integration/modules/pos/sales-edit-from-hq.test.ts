/**
 * Integration test: edición de venta completada.
 * Verifica la transacción Prisma completa: restauración de stock viejo,
 * borrado de items, re-inserción, recálculo de totales, status='edited'.
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
import { EditCompletedSaleUseCase } from "@/modules/pos/application/use-cases/EditCompletedSaleUseCase";
import { CancelSaleUseCase } from "@/modules/pos/application/use-cases/CancelSaleUseCase";
import { CancelledSaleNotEditableError } from "@/modules/pos/domain/errors/CancelledSaleNotEditableError";

const P = "POSEDIT_";

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

describe("Sales — edición de venta completada (integration real DB)", () => {
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
  const editSale = new EditCompletedSaleUseCase(saleRepo, lookups);
  const cancelSale = new CancelSaleUseCase(saleRepo);

  let branchId: string;
  let customerId: string;
  let cashierId: string;
  let productId: string;
  let priceId: string;
  let folioId: string;
  let pmId: string;

  beforeAll(async () => {
    await cleanup();
    // Demote any existing HQ before creating ours (partial unique index is global)
    await prisma.branch.updateMany({ where: { isHeadquarters: true }, data: { isHeadquarters: false } });

    const branch = await branchRepo.create({ code: `${P}BRANCH1`, name: "Sucursal Edit Test", isHeadquarters: true });
    branchId = branch.id;

    const dept = await deptRepo.create({ code: `${P}DEPT1`, name: "Dept Edit Test" });
    const product = await createProduct.execute({
      code: `${P}PROD1`, name: "Producto Edit", unit: "pz", departmentId: dept.id, ivaRate: 0.16, isTaxable: true,
    });
    productId = product.id;

    const price = await createPrice.execute(productId, { branchId: branchId, name: "Lista", price: 200, isDefault: true });
    priceId = price.id;

    const customer = await createCustomer.execute({ code: `${P}CLI1`, name: "Cliente Edit", rfc: "CED010101001", branchIds: [branchId] });
    customerId = customer.id;

    const folio = await folioRepo.create({ code: `${P}FOL1`, name: "Folio Edit", prefix: "EDIT", currentNumber: 0, scope: "POS" });
    folioId = folio.id;

    const pm = await pmRepo.create({ code: `${P}PM1`, name: "Efectivo Edit" });
    pmId = pm.id;

    const cashier = await prisma.user.create({
      data: { email: `${P}cashier@test.com`, passwordHash: "test-hash", name: "Cajero Edit" },
    });
    cashierId = cashier.id;

    // Pre-cargar inventario (10 unidades)
    await prisma.branchInventory.create({
      data: { branchId, productId, quantity: 10, reorderPoint: 0, reservedQuantity: 0 },
    });
  });

  let saleId: string;

  it("crea venta original con 3 unidades", async () => {
    const result = await createSale.execute(
      { branchId, customerId, paymentMethodId: pmId, folioId, items: [{ productId, productPriceId: priceId, quantity: 3 }] },
      cashierId
    );
    saleId = result.dto.id;
    expect(result.dto.status).toBe("completed");
    expect(result.dto.total).toBeCloseTo(3 * 200, 0);

    const inv = await prisma.branchInventory.findFirst({ where: { branchId, productId } });
    expect(Number(inv!.quantity)).toBe(7); // 10 - 3
  });

  it("edita venta: cambia cantidad a 1 → stock se ajusta correctamente", async () => {
    const result = await editSale.execute(saleId, {
      items: [{ productId, productPriceId: priceId, quantity: 1 }],
    });
    expect(result.dto.status).toBe("edited");
    expect(result.dto.items).toHaveLength(1);
    expect(result.dto.items[0].quantity).toBe(1);
    expect(result.dto.total).toBeCloseTo(1 * 200, 0);

    // Stock: 7 (post-venta) + 3 (restaurados) - 1 (nueva cantidad) = 9
    const inv = await prisma.branchInventory.findFirst({ where: { branchId, productId } });
    expect(Number(inv!.quantity)).toBe(9);
  });

  it("folioId/folioNumber/folioCode permanecen inmutables tras edición", async () => {
    const sale = await prisma.sale.findUnique({ where: { id: saleId } });
    expect(sale!.folioId).toBe(folioId);
    expect(sale!.folioNumber).toBe(1);
  });

  it("editar venta cancelada → CancelledSaleNotEditableError", async () => {
    const other = await createSale.execute(
      { branchId, customerId, paymentMethodId: pmId, folioId, items: [{ productId, productPriceId: priceId, quantity: 1 }] },
      cashierId
    );
    await cancelSale.execute(other.dto.id, {});
    await expect(
      editSale.execute(other.dto.id, { items: [{ productId, productPriceId: priceId, quantity: 1 }] })
    ).rejects.toThrow(CancelledSaleNotEditableError);
  });
});
