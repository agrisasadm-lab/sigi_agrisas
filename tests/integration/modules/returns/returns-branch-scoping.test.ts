/**
 * Integration test: branch scoping del módulo returns (task 11.2).
 *
 * Verifica vía `ReturnsController` que:
 *  - operator A no puede ver/crear/cancelar returns sobre ventas de la sucursal B (403).
 *  - operator A SI puede sobre ventas de la sucursal A (201/200).
 *  - admin con `branches:access_all` puede sobre cualquier sucursal.
 *  - operator sin branch asignada → 403 en list/getById/cancel/create.
 */
jest.mock("@/modules/rbac/infrastructure/di/container", () => ({
  rbacContainer: {
    authorizationService: {
      userCan: jest.fn().mockResolvedValue(false),
      listUserPermissions: jest.fn().mockResolvedValue([]),
      invalidate: jest.fn(),
      invalidateByRole: jest.fn().mockResolvedValue(undefined),
    },
  },
}));

import { NextRequest } from "next/server";
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
import { CreateReturnUseCase } from "@/modules/returns/application/use-cases/CreateReturnUseCase";
import { CancelReturnUseCase } from "@/modules/returns/application/use-cases/CancelReturnUseCase";
import { ListReturnsUseCase } from "@/modules/returns/application/use-cases/ListReturnsUseCase";
import { GetReturnUseCase } from "@/modules/returns/application/use-cases/GetReturnUseCase";
import { ListReturnsBySaleUseCase } from "@/modules/returns/application/use-cases/ListReturnsBySaleUseCase";
import { ReturnsController } from "@/modules/returns/infrastructure/http/ReturnsController";
import { AuthorizationService } from "@/modules/rbac/application/ports/AuthorizationService";

const P = "RETSCOPE_";
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

function makeAuthz(bypass: boolean): AuthorizationService {
  return {
    userCan: jest.fn().mockResolvedValue(bypass),
    listUserPermissions: jest.fn().mockResolvedValue([]),
    invalidate: jest.fn(),
    invalidateByRole: jest.fn().mockResolvedValue(undefined),
  };
}

function buildController(bypass: boolean): ReturnsController {
  const saleRepo = new PrismaSaleRepository(prisma);
  const returnRepo = new PrismaReturnRepository(prisma);
  return new ReturnsController(
    new ListReturnsUseCase(returnRepo),
    new GetReturnUseCase(returnRepo),
    new ListReturnsBySaleUseCase(returnRepo),
    new CreateReturnUseCase(returnRepo, saleRepo),
    new CancelReturnUseCase(returnRepo),
    saleRepo,
    makeAuthz(bypass),
    returnRepo
  );
}

function req(
  method: string,
  url: string,
  headers: Record<string, string>,
  body?: unknown
): NextRequest {
  return new NextRequest(`http://localhost${url}`, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: { "Content-Type": "application/json", ...headers },
  });
}

describe("Returns — branch scoping (integration real DB)", () => {
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

  let branchAId: string;
  let branchBId: string;
  let saleAId: string;
  let saleAItemId: string;
  let saleBId: string;
  let saleBItemId: string;
  let opAId: string;
  let opBId: string;
  let adminId: string;

  beforeAll(async () => {
    await cleanup();

    const branchA = await branchRepo.create({ code: `${P}BR_A`, name: "Sucursal A" });
    branchAId = branchA.id;
    const branchB = await branchRepo.create({ code: `${P}BR_B`, name: "Sucursal B" });
    branchBId = branchB.id;

    const dept = await deptRepo.create({ code: `${P}DEPT1`, name: "Dept Scope" });
    const product = await createProduct.execute({
      code: `${P}PROD1`, name: "Producto Scope", unit: "kg", departmentId: dept.id, ivaRate: 0.16,
    });
    const price = await createPrice.execute(product.id, { name: "Lista", price: 100, isDefault: true });

    const customer = await createCustomer.execute({ code: `${P}CLI1`, name: "Cliente Scope", rfc: "CSC010101001", branchIds: [branchAId, branchBId] });
    const folioA = await folioRepo.create({ code: `${P}FOL_A`, name: "Folio A", prefix: "FA", currentNumber: 0, scope: "POS" });
    const folioB = await folioRepo.create({ code: `${P}FOL_B`, name: "Folio B", prefix: "FB", currentNumber: 0, scope: "POS" });
    const pm = await pmRepo.create({ code: `${P}PM1`, name: "Efectivo Scope" });

    const opA = await prisma.user.create({
      data: { email: `${P}opA@test.com`, passwordHash: "x", name: "OperatorA" },
    });
    opAId = opA.id;
    const opB = await prisma.user.create({
      data: { email: `${P}opB@test.com`, passwordHash: "x", name: "OperatorB" },
    });
    opBId = opB.id;
    const admin = await prisma.user.create({
      data: { email: `${P}admin@test.com`, passwordHash: "x", name: "AdminScope" },
    });
    adminId = admin.id;

    await prisma.branchInventory.createMany({
      data: [
        { branchId: branchAId, productId: product.id, quantity: 50, reservedQuantity: 0, reorderPoint: 5 },
        { branchId: branchBId, productId: product.id, quantity: 50, reservedQuantity: 0, reorderPoint: 5 },
      ],
    });

    const saleA = await createSale.execute(
      { branchId: branchAId, customerId: customer.id, paymentMethodId: pm.id, folioId: folioA.id, items: [{ productId: product.id, productPriceId: price.id, quantity: 5 }] },
      opAId
    );
    saleAId = saleA.dto.id;
    saleAItemId = saleA.dto.items[0].id;

    const saleB = await createSale.execute(
      { branchId: branchBId, customerId: customer.id, paymentMethodId: pm.id, folioId: folioB.id, items: [{ productId: product.id, productPriceId: price.id, quantity: 5 }] },
      opBId
    );
    saleBId = saleB.dto.id;
    saleBItemId = saleB.dto.items[0].id;
  });

  function createBody(saleId: string, saleItemId: string, qty: number) {
    return {
      saleId,
      reason: "Test scoping",
      returnedAt: new Date().toISOString(),
      items: [{ saleItemId, quantity: qty }],
    };
  }

  it("operator A creando devolución sobre venta A → 201", async () => {
    const ctl = buildController(false);
    const res = await ctl.create(
      req("POST", "/returns", { "x-user-id": opAId, "x-user-branch-id": branchAId }, createBody(saleAId, saleAItemId, 1))
    );
    expect(res.status).toBe(201);
  });

  it("operator A creando devolución sobre venta B → 403", async () => {
    const ctl = buildController(false);
    const res = await ctl.create(
      req("POST", "/returns", { "x-user-id": opAId, "x-user-branch-id": branchAId }, createBody(saleBId, saleBItemId, 1))
    );
    expect(res.status).toBe(403);
  });

  it("operator A listando ventas sin ?branchId= → ve sólo sus devoluciones (branch A)", async () => {
    const ctl = buildController(false);
    const res = await ctl.list(
      req("GET", "/returns", { "x-user-id": opAId, "x-user-branch-id": branchAId })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items.every((r: { branchId: string }) => r.branchId === branchAId)).toBe(true);
  });

  it("operator A listando con ?branchId=B → 403", async () => {
    const ctl = buildController(false);
    const res = await ctl.list(
      req("GET", `/returns?branchId=${branchBId}`, { "x-user-id": opAId, "x-user-branch-id": branchAId })
    );
    expect(res.status).toBe(403);
  });

  it("operator B cancelando una devolución de A → 403", async () => {
    // Primero seed: A crea una devolución
    const ctlA = buildController(false);
    const createRes = await ctlA.create(
      req("POST", "/returns", { "x-user-id": opAId, "x-user-branch-id": branchAId }, createBody(saleAId, saleAItemId, 1))
    );
    expect(createRes.status).toBe(201);
    const ret = await createRes.json();

    const ctlB = buildController(false);
    const res = await ctlB.cancel(
      req("POST", `/returns/${ret.id}/cancel`, { "x-user-id": opBId, "x-user-branch-id": branchBId }, {}),
      ret.id
    );
    expect(res.status).toBe(403);
  });

  it("admin con bypass cancelando devolución de A desde sucursal B → 200", async () => {
    const ctlA = buildController(false);
    const createRes = await ctlA.create(
      req("POST", "/returns", { "x-user-id": opAId, "x-user-branch-id": branchAId }, createBody(saleAId, saleAItemId, 1))
    );
    expect(createRes.status).toBe(201);
    const ret = await createRes.json();

    const adminCtl = buildController(true);
    const res = await adminCtl.cancel(
      req("POST", `/returns/${ret.id}/cancel`, { "x-user-id": adminId, "x-user-branch-id": "" }, { reason: "admin override" }),
      ret.id
    );
    expect(res.status).toBe(200);
  });

  it("operator sin branch (header vacío) listando → 403", async () => {
    const ctl = buildController(false);
    const res = await ctl.list(
      req("GET", "/returns", { "x-user-id": opAId, "x-user-branch-id": "" })
    );
    expect(res.status).toBe(403);
  });

  it("operator sin branch (header vacío) creando → 403", async () => {
    const ctl = buildController(false);
    const res = await ctl.create(
      req("POST", "/returns", { "x-user-id": opAId, "x-user-branch-id": "" }, createBody(saleAId, saleAItemId, 1))
    );
    expect(res.status).toBe(403);
  });
});
