/**
 * Integration test: branch scoping de cotizaciones a nivel HTTP/controller (task 11.4).
 *
 * Construye el QuotesController real con repos Prisma + AuthorizationService stub
 * (para evitar configurar la cadena completa de RBAC). Verifica:
 *  - operator sin bypass listando sin ?branchId= → filtro implícito por su sucursal
 *  - operator sin bypass con ?branchId=<otra> → 403
 *  - operator sin branch asignada y sin bypass → 403
 *  - admin con bypass sin ?branchId= → ve todas las sucursales
 *  - GET /:id sobre cotización de otra sucursal → 403 (existence no leak)
 *  - PATCH /:id sobre cotización de otra sucursal → 403
 *  - POST /authorize sobre cotización de otra sucursal → 403
 *  - DELETE /:id sobre cotización de otra sucursal → 403
 *  - POST /convert sobre cotización de otra sucursal → 403
 */
// @react-pdf/renderer is a server-only ESM lib; mock it for the node test env
jest.mock("@react-pdf/renderer", () => ({
  renderToBuffer: jest.fn().mockResolvedValue(Buffer.from("%PDF-1.4 mock")),
  Document: ({ children }: { children: unknown }) => children,
  Page: ({ children }: { children: unknown }) => children,
  Text: ({ children }: { children: unknown }) => children,
  View: ({ children }: { children: unknown }) => children,
  StyleSheet: { create: (s: unknown) => s },
}));

// QuotePdf uses JSX which the node test env can't parse; mock the whole module
jest.mock("@/modules/quotes/infrastructure/pdf/QuotePdf", () => ({
  QuotePdf: () => null,
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
import { PrismaQuoteRepository } from "@/modules/quotes/infrastructure/repositories/PrismaQuoteRepository";
import { PrismaSaleRepository } from "@/modules/pos/infrastructure/repositories/PrismaSaleRepository";
import { PrismaPosLookupService } from "@/modules/pos/infrastructure/repositories/PrismaPosLookupService";
import { CreateCustomerUseCase } from "@/modules/customers/application/use-cases/CreateCustomerUseCase";
import { CreateProductUseCase } from "@/modules/products/application/use-cases/CreateProductUseCase";
import { CreateProductPriceUseCase } from "@/modules/products/application/use-cases/CreateProductPriceUseCase";
import { CreateQuoteUseCase } from "@/modules/quotes/application/use-cases/CreateQuoteUseCase";
import { ListQuotesUseCase } from "@/modules/quotes/application/use-cases/ListQuotesUseCase";
import { GetQuoteUseCase } from "@/modules/quotes/application/use-cases/GetQuoteUseCase";
import { UpdateQuoteUseCase } from "@/modules/quotes/application/use-cases/UpdateQuoteUseCase";
import { AuthorizeQuoteUseCase } from "@/modules/quotes/application/use-cases/AuthorizeQuoteUseCase";
import { CancelQuoteUseCase } from "@/modules/quotes/application/use-cases/CancelQuoteUseCase";
import { ConvertQuoteToSaleUseCase } from "@/modules/quotes/application/use-cases/ConvertQuoteToSaleUseCase";
import { QuotesController } from "@/modules/quotes/infrastructure/http/QuotesController";
import { AuthorizationService } from "@/modules/rbac/application/ports/AuthorizationService";
import { PrismaTicketSettingsRepository } from "@/modules/settings/infrastructure/repositories/PrismaTicketSettingsRepository";
import { GetTicketSettingsUseCase } from "@/modules/settings/application/use-cases/GetTicketSettingsUseCase";

jest.setTimeout(30000);

const P = "QUOTESCOPE_";

async function cleanup() {
  await prisma.sale.deleteMany({ where: { folio: { code: { startsWith: P } } } });
  // Borrar quote_items por producto Y por folio (cubre ambos lados de la FK RESTRICT a products)
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

function makeAuthz(bypass: boolean): AuthorizationService {
  return {
    userCan: async () => bypass,
    listUserPermissions: async () => [],
    invalidate: () => {},
    invalidateByRole: async () => {},
  };
}

function req(
  method: string,
  url: string,
  body: unknown,
  headers: Record<string, string>
): NextRequest {
  return new NextRequest(`http://localhost${url}`, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: { "Content-Type": "application/json", ...headers },
  });
}

describe("Quotes — branch scoping a nivel controller (integration real DB)", () => {
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
  const ticketSettingsRepo = new PrismaTicketSettingsRepository(prisma);
  const getTicketSettingsUseCase = new GetTicketSettingsUseCase(ticketSettingsRepo);

  const createCustomer = new CreateCustomerUseCase(customerRepo);
  const createProduct = new CreateProductUseCase(productRepo, deptRepo);
  const createPrice = new CreateProductPriceUseCase(productRepo, priceRepo);

  function buildController(bypass: boolean): QuotesController {
    return new QuotesController(
      new ListQuotesUseCase(quoteRepo),
      new GetQuoteUseCase(quoteRepo),
      new CreateQuoteUseCase(quoteRepo, lookups),
      new UpdateQuoteUseCase(quoteRepo, lookups),
      new AuthorizeQuoteUseCase(quoteRepo),
      new CancelQuoteUseCase(quoteRepo),
      new ConvertQuoteToSaleUseCase(quoteRepo, saleRepo, lookups),
      makeAuthz(bypass),
      getTicketSettingsUseCase
    );
  }

  let branchAId: string;
  let branchBId: string;
  let customerId: string;
  let creatorId: string;
  let productId: string;
  let priceAId: string;
  let priceBId: string;
  let quoteFolioId: string;
  let pmId: string;
  let fiscalFolioId: string;
  let quoteInAId: string;
  let quoteInBId: string;

  beforeAll(async () => {
    await cleanup();
    branchAId = (await branchRepo.create({ code: `${P}A`, name: "Sucursal A" })).id;
    branchBId = (await branchRepo.create({ code: `${P}B`, name: "Sucursal B" })).id;
    const dept = await deptRepo.create({ code: `${P}D`, name: "Dept" });
    productId = (await createProduct.execute({
      code: `${P}P`, name: "Prod", unit: "kg", departmentId: dept.id, ivaRate: 0.16,
    })).id;
    priceAId = (await createPrice.execute(productId, { branchId: branchAId, name: "Lista", price: 100, isDefault: true })).id;
    priceBId = (await createPrice.execute(productId, { branchId: branchBId, name: "Lista", price: 100, isDefault: true })).id;
    customerId = (await createCustomer.execute({ code: `${P}C`, name: "Cliente Scope", rfc: "CSP010101001", branchIds: [branchAId, branchBId] })).id;
    quoteFolioId = (await folioRepo.create({ code: `${P}COT`, name: "Cot", prefix: "COT", currentNumber: 0, scope: "POS" })).id;
    fiscalFolioId = (await folioRepo.create({ code: `${P}FAC`, name: "Fac", prefix: "FAC", currentNumber: 0, scope: "POS" })).id;
    pmId = (await pmRepo.create({ code: `${P}PM`, name: "Efectivo" })).id;
    creatorId = (await prisma.user.create({
      data: { email: `${P}u@test.com`, passwordHash: "x", name: "Op" },
    })).id;

    // Crear una cotización en cada sucursal (vía bypass para poder usar branchB)
    const adminCtl = buildController(true);
    const adminHeaders = { "x-user-id": creatorId, "x-user-branch-id": "" };
    const a = await adminCtl.create(
      req("POST", "/quotes", {
        branchId: branchAId, customerId, folioId: quoteFolioId,
        items: [{ productId, productPriceId: priceAId, quantity: 1 }],
      }, adminHeaders)
    );
    quoteInAId = (await a.json()).id;
    const b = await adminCtl.create(
      req("POST", "/quotes", {
        branchId: branchBId, customerId, folioId: quoteFolioId,
        items: [{ productId, productPriceId: priceBId, quantity: 1 }],
      }, adminHeaders)
    );
    quoteInBId = (await b.json()).id;
  });

  describe("operator sin bypass asignado a sucursal A", () => {
    const operatorA = (): Record<string, string> => ({
      "x-user-id": "operator-A",
      "x-user-branch-id": branchAId,
    });
    const ctl = () => buildController(false);

    it("list sin ?branchId= devuelve sólo cotizaciones de A", async () => {
      const res = await ctl().list(req("GET", "/quotes", undefined, operatorA()));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.items.length).toBeGreaterThan(0);
      expect(body.items.every((q: { branchId: string }) => q.branchId === branchAId)).toBe(true);
    });

    it("list con ?branchId=B → 403", async () => {
      const res = await ctl().list(req("GET", `/quotes?branchId=${branchBId}`, undefined, operatorA()));
      expect(res.status).toBe(403);
    });

    it("getById sobre cotización de B → 403", async () => {
      const res = await ctl().getById(req("GET", `/quotes/${quoteInBId}`, undefined, operatorA()), quoteInBId);
      expect(res.status).toBe(403);
    });

    it("update sobre cotización de B → 403", async () => {
      const res = await ctl().update(
        req("PATCH", `/quotes/${quoteInBId}`, { notes: "x" }, operatorA()),
        quoteInBId
      );
      expect(res.status).toBe(403);
    });

    it("authorize sobre cotización de B → 403", async () => {
      const res = await ctl().authorize(
        req("POST", `/quotes/${quoteInBId}/authorize`, {}, operatorA()),
        quoteInBId
      );
      expect(res.status).toBe(403);
    });

    it("cancel sobre cotización de B → 403", async () => {
      const res = await ctl().cancel(
        req("DELETE", `/quotes/${quoteInBId}`, { reason: "no" }, operatorA()),
        quoteInBId
      );
      expect(res.status).toBe(403);
    });

    it("convert sobre cotización de B → 403", async () => {
      const res = await ctl().convert(
        req("POST", `/quotes/${quoteInBId}/convert`,
          { paymentMethodId: pmId, folioId: fiscalFolioId, notes: null },
          operatorA()
        ),
        quoteInBId
      );
      expect(res.status).toBe(403);
    });
  });

  describe("operator sin sucursal asignada y sin bypass", () => {
    const headers = () => ({ "x-user-id": "no-branch-op", "x-user-branch-id": "" });

    it("list sin ?branchId= → 403", async () => {
      const res = await buildController(false).list(req("GET", "/quotes", undefined, headers()));
      expect(res.status).toBe(403);
    });

    it("getById sobre cualquier cotización → 403", async () => {
      const res = await buildController(false).getById(
        req("GET", `/quotes/${quoteInAId}`, undefined, headers()),
        quoteInAId
      );
      expect(res.status).toBe(403);
    });
  });

  describe("admin con bypass", () => {
    const headers = () => ({ "x-user-id": "admin", "x-user-branch-id": "" });

    it("list sin ?branchId= ve cotizaciones de ambas sucursales", async () => {
      const res = await buildController(true).list(req("GET", "/quotes", undefined, headers()));
      expect(res.status).toBe(200);
      const body = await res.json();
      const branches = new Set(body.items.map((q: { branchId: string }) => q.branchId));
      expect(branches.has(branchAId)).toBe(true);
      expect(branches.has(branchBId)).toBe(true);
    });

    it("getById sobre cualquier cotización → 200", async () => {
      const res = await buildController(true).getById(
        req("GET", `/quotes/${quoteInBId}`, undefined, headers()),
        quoteInBId
      );
      expect(res.status).toBe(200);
    });
  });
});
