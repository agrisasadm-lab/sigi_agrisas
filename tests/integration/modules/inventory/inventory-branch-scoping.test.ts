/**
 * Integration test: branch scoping para inventario.
 * Verifica que `enforceBranchScope` funciona correctamente para los
 * endpoints de inventario con el AuthorizationService real.
 */
import { NextRequest } from "next/server";
import { prisma } from "@/shared/infrastructure/prisma/client";
import { PrismaBranchRepository } from "@/modules/branches/infrastructure/repositories/PrismaBranchRepository";
import { PrismaDepartmentRepository } from "@/modules/departments/infrastructure/repositories/PrismaDepartmentRepository";
import { PrismaProductRepository } from "@/modules/products/infrastructure/repositories/PrismaProductRepository";
import { PrismaProductPriceRepository } from "@/modules/products/infrastructure/repositories/PrismaProductPriceRepository";
import { PrismaBranchInventoryRepository } from "@/modules/inventory/infrastructure/repositories/PrismaBranchInventoryRepository";
import { PrismaInventoryLotRepository } from "@/modules/inventory/infrastructure/repositories/PrismaInventoryLotRepository";
import { PrismaAuthorizationService } from "@/modules/rbac/infrastructure/services/PrismaAuthorizationService";
import { UserRolePrismaRepository } from "@/modules/rbac/infrastructure/repositories/UserRolePrismaRepository";
import { PrismaFolioRepository } from "@/modules/folios/infrastructure/repositories/PrismaFolioRepository";
import { PrismaPaymentMethodRepository } from "@/modules/payment-methods/infrastructure/repositories/PrismaPaymentMethodRepository";
import { PrismaSaleRepository } from "@/modules/pos/infrastructure/repositories/PrismaSaleRepository";
import { PrismaPosLookupService } from "@/modules/pos/infrastructure/repositories/PrismaPosLookupService";
import { PrismaWaybillRepository } from "@/modules/waybills/infrastructure/repositories/PrismaWaybillRepository";
import { PrismaWaybillLookupService } from "@/modules/waybills/infrastructure/services/PrismaWaybillLookupService";
import { FakeFacturamaGateway } from "@/modules/waybills/infrastructure/services/FakeFacturamaGateway";
import { PrismaVehicleRepository } from "@/modules/vehicles/infrastructure/repositories/PrismaVehicleRepository";
import { PrismaDriverRepository } from "@/modules/drivers/infrastructure/repositories/PrismaDriverRepository";
import { CreateProductUseCase } from "@/modules/products/application/use-cases/CreateProductUseCase";
import { CreateProductPriceUseCase } from "@/modules/products/application/use-cases/CreateProductPriceUseCase";
import { CreateBranchInventoryItemUseCase } from "@/modules/inventory/application/use-cases/CreateBranchInventoryItemUseCase";
import { AdjustStockUseCase } from "@/modules/inventory/application/use-cases/AdjustStockUseCase";
import { ListBranchInventoryUseCase } from "@/modules/inventory/application/use-cases/ListBranchInventoryUseCase";
import { ListProductsUseCase } from "@/modules/products/application/use-cases/ListProductsUseCase";
import { CreateSaleUseCase } from "@/modules/pos/application/use-cases/CreateSaleUseCase";
import { CancelSaleUseCase } from "@/modules/pos/application/use-cases/CancelSaleUseCase";
import { CreateWaybillUseCase } from "@/modules/waybills/application/use-cases/CreateWaybillUseCase";
import { ProductNotAvailableInBranchError } from "@/modules/pos/domain/errors/ProductNotAvailableInBranchError";
import { enforceBranchScope } from "@/modules/rbac/infrastructure/http/enforceBranchScope";

const P = "INVSCOPE_";
const OPERATOR_USER_ID = "00000000-ff01-0000-0000-000000000001";

function makeRequest(headers: Record<string, string>) {
  return new NextRequest("http://localhost/inventory", { headers });
}

async function cleanup() {
  await prisma.userRole.deleteMany({ where: { userId: OPERATOR_USER_ID } });
  await prisma.waybill.deleteMany({ where: { origin: { code: { startsWith: P } } } });
  await prisma.sale.deleteMany({ where: { folio: { code: { startsWith: P } } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: P } } });
  await prisma.branchInventory.deleteMany({ where: { branch: { code: { startsWith: P } } } });
  await prisma.inventoryMovement.deleteMany({ where: { product: { code: { startsWith: P } } } });
  await prisma.productPrice.deleteMany({ where: { product: { code: { startsWith: P } } } });
  await prisma.product.deleteMany({ where: { code: { startsWith: P } } });
  await prisma.folio.deleteMany({ where: { code: { startsWith: P } } });
  await prisma.paymentMethod.deleteMany({ where: { code: { startsWith: P } } });
  await prisma.branch.deleteMany({ where: { code: { startsWith: P } } });
  await prisma.department.deleteMany({ where: { code: { startsWith: P } } });
}

afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

describe("Inventory — branch scoping (integration real DB)", () => {
  const branchRepo = new PrismaBranchRepository(prisma);
  const deptRepo = new PrismaDepartmentRepository(prisma);
  const productRepo = new PrismaProductRepository(prisma);
  const inventoryRepo = new PrismaBranchInventoryRepository(prisma);
  const inventoryLotRepo = new PrismaInventoryLotRepository(prisma);
  const authzService = new PrismaAuthorizationService(prisma, new UserRolePrismaRepository(prisma));

  const createProduct = new CreateProductUseCase(productRepo, deptRepo);
  const createInventory = new CreateBranchInventoryItemUseCase(inventoryRepo, branchRepo, productRepo);
  const listInventory = new ListBranchInventoryUseCase(inventoryRepo, branchRepo, inventoryLotRepo);

  let branchAId: string;
  let branchBId: string;
  let productId: string;
  let deptId: string;

  beforeAll(async () => {
    await cleanup();

    const branchA = await branchRepo.create({ code: `${P}BRA`, name: "Branch A Inv Scope" });
    branchAId = branchA.id;

    const branchB = await branchRepo.create({ code: `${P}BRB`, name: "Branch B Inv Scope" });
    branchBId = branchB.id;

    const dept = await deptRepo.create({ code: `${P}DEPT1`, name: "Dept Inv Scope" });
    deptId = dept.id;
    const product = await createProduct.execute({
      code: `${P}PROD1`, name: "Producto Inv Scope", unit: "u", departmentId: dept.id,
    });
    productId = product.id;

    // Stock solo en branch A
    await createInventory.execute(branchAId, { productId, quantity: 20, reorderPoint: 5 });

    // Usuario operador asignado a branch A (sin branches:access_all)
    await prisma.user.create({
      data: { id: OPERATOR_USER_ID, email: `${P}op@test.com`, passwordHash: "hash", name: "Op Inv Scope" },
    });

    const viewerRole = await prisma.role.findFirstOrThrow({ where: { name: "viewer" } });
    await prisma.userRole.create({ data: { userId: OPERATOR_USER_ID, roleId: viewerRole.id } });
  });

  it("operador en branch A puede ver inventario de branch A", async () => {
    const req = makeRequest({ "x-user-id": OPERATOR_USER_ID, "x-user-branch-id": branchAId });
    const scopeResult = await enforceBranchScope(req, branchAId, authzService);
    expect(scopeResult).toBeNull(); // null = autorizado
  });

  it("operador en branch A NO puede ver inventario de branch B", async () => {
    const req = makeRequest({ "x-user-id": OPERATOR_USER_ID, "x-user-branch-id": branchAId });
    const scopeResult = await enforceBranchScope(req, branchBId, authzService);
    expect(scopeResult).not.toBeNull();
    expect(scopeResult!.status).toBe(403);
  });

  it("listInventory devuelve solo el inventario de branch A (aislamiento real)", async () => {
    const result = await listInventory.execute({ branchId: branchAId, page: 1, pageSize: 50, belowReorder: false });
    expect(result.items.length).toBeGreaterThan(0);
    result.items.forEach((item) => {
      expect(item.productId).toBe(productId);
    });
  });

  it("listInventory de branch B sin inventario devuelve vacío", async () => {
    const result = await listInventory.execute({ branchId: branchBId, page: 1, pageSize: 50, belowReorder: false });
    expect(result.items).toHaveLength(0);
  });

  it("usuario sin sucursal asignada (x-user-branch-id vacío) NO puede acceder", async () => {
    const req = makeRequest({ "x-user-id": OPERATOR_USER_ID, "x-user-branch-id": "" });
    const scopeResult = await enforceBranchScope(req, branchAId, authzService);
    expect(scopeResult).not.toBeNull();
    expect(scopeResult!.status).toBe(403);
  });

  describe("Ciclo completo modo branch: asignar → vender → cancelar → traspasar", () => {
    jest.setTimeout(60_000);

    const priceRepo = new PrismaProductPriceRepository(prisma);
    const folioRepo = new PrismaFolioRepository(prisma);
    const pmRepo = new PrismaPaymentMethodRepository(prisma);
    const saleRepo = new PrismaSaleRepository(prisma);
    const lookups = new PrismaPosLookupService(prisma);
    const waybillRepo = new PrismaWaybillRepository(prisma);
    const waybillLookupService = new PrismaWaybillLookupService(prisma);
    const vehicleRepo = new PrismaVehicleRepository(prisma);
    const driverRepo = new PrismaDriverRepository(prisma);
    const gateway = new FakeFacturamaGateway();

    const createPrice = new CreateProductPriceUseCase(productRepo, priceRepo);
    const listProducts = new ListProductsUseCase(productRepo);
    const adjustStock = new AdjustStockUseCase(inventoryRepo);
    // branchScopedInventory=true — simula INVENTORY_SCOPE_MODE=branch sin depender de la env var del proceso.
    const createSaleScoped = new CreateSaleUseCase(saleRepo, lookups, undefined, true);
    const cancelSale = new CancelSaleUseCase(saleRepo);
    const createWaybill = new CreateWaybillUseCase(waybillRepo, gateway, waybillLookupService, vehicleRepo, driverRepo);

    let product2Id: string;
    let price2Id: string;
    let folioId: string;
    let pmId: string;
    let cashierId: string;

    beforeAll(async () => {
      const product2 = await createProduct.execute({
        code: `${P}PROD2`, name: "Producto Exclusivo Inv Scope", unit: "u", departmentId: deptId,
      });
      product2Id = product2.id;

      const price2 = await createPrice.execute(product2Id, { branchId: branchAId, name: "Lista", price: 50, isDefault: true });
      price2Id = price2.id;

      const folio = await folioRepo.create({
        code: `${P}FOLPOS`, name: "Folio POS Inv Scope", prefix: "IVP", currentNumber: 0, scope: "POS",
      });
      folioId = folio.id;

      const pm = await pmRepo.create({ code: `${P}PM1`, name: "Efectivo Inv Scope" });
      pmId = pm.id;

      cashierId = OPERATOR_USER_ID;
    });

    it("PROD2 sin asignar a ninguna sucursal no aparece en catálogo branchScoped de branch A", async () => {
      const result = await listProducts.execute({
        page: 1, pageSize: 50, includeInactive: false, branchId: branchAId, branchScoped: true,
      });
      expect(result.items.find((p) => p.id === product2Id)).toBeUndefined();
    });

    it("asignar PROD2 a branch A (quantity 0) lo hace visible en su catálogo branchScoped", async () => {
      await createInventory.execute(branchAId, { productId: product2Id, quantity: 0, reorderPoint: 0 });

      const inBranchA = await listProducts.execute({
        page: 1, pageSize: 50, includeInactive: false, branchId: branchAId, branchScoped: true,
      });
      expect(inBranchA.items.find((p) => p.id === product2Id)?.stock).toBe(0);

      const inBranchB = await listProducts.execute({
        page: 1, pageSize: 50, includeInactive: false, branchId: branchBId, branchScoped: true,
      });
      expect(inBranchB.items.find((p) => p.id === product2Id)).toBeUndefined();
    });

    let saleId: string;

    it("vender PROD2 en branch A pasa el gate (está asignado)", async () => {
      const result = await createSaleScoped.execute(
        { branchId: branchAId, paymentMethodId: pmId, folioId, items: [{ productId: product2Id, productPriceId: price2Id, quantity: 2 }] },
        cashierId
      );
      saleId = result.dto.id;
      expect(result.dto.status).toBe("completed");

      const inv = await prisma.branchInventory.findUnique({
        where: { branchId_productId: { branchId: branchAId, productId: product2Id } },
      });
      expect(Number(inv!.quantity)).toBe(-2);
    });

    it("vender PROD2 en branch B rechaza con ProductNotAvailableInBranchError (no asignado ahí)", async () => {
      await expect(
        createSaleScoped.execute(
          { branchId: branchBId, paymentMethodId: pmId, folioId, items: [{ productId: product2Id, productPriceId: price2Id, quantity: 1 }] },
          cashierId
        )
      ).rejects.toThrow(ProductNotAvailableInBranchError);
    });

    it("cancelar la venta de branch A restaura stock sin bloqueo del gate", async () => {
      const result = await cancelSale.execute(saleId, { reason: "Prueba ciclo branch scope" });
      expect(result.dto.status).toBe("cancelled");

      const inv = await prisma.branchInventory.findUnique({
        where: { branchId_productId: { branchId: branchAId, productId: product2Id } },
      });
      expect(Number(inv!.quantity)).toBe(0);
    });

    it("traspaso simple branch A → branch B habilita PROD2 en el catálogo branchScoped de branch B", async () => {
      const before = await prisma.branchInventory.findUnique({
        where: { branchId_productId: { branchId: branchBId, productId: product2Id } },
      });
      expect(before).toBeNull();

      // Origen debe tener stock físico suficiente — el traspaso rechaza con stock insuficiente (a diferencia de la venta).
      await adjustStock.execute(branchAId, product2Id, { delta: 5 });

      await createWaybill.execute(
        {
          type: "simple",
          originBranchId: branchAId,
          destinationBranchId: branchBId,
          transferDate: new Date().toISOString(),
          items: [{ productId: product2Id, quantity: 3 }],
        },
        cashierId
      );

      // Origen A: 0 (tras cancelación) + 5 (ajuste) - 3 (traspaso) = 2
      const afterOrigin = await prisma.branchInventory.findUnique({
        where: { branchId_productId: { branchId: branchAId, productId: product2Id } },
      });
      expect(Number(afterOrigin!.quantity)).toBe(2);

      const afterDestination = await prisma.branchInventory.findUnique({
        where: { branchId_productId: { branchId: branchBId, productId: product2Id } },
      });
      expect(afterDestination).not.toBeNull();
      expect(Number(afterDestination!.quantity)).toBe(3);

      const inBranchB = await listProducts.execute({
        page: 1, pageSize: 50, includeInactive: false, branchId: branchBId, branchScoped: true,
      });
      expect(inBranchB.items.find((p) => p.id === product2Id)?.stock).toBe(3);
    });
  });
});
