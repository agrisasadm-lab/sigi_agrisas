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

// Prevent Prisma instantiation: enforceBranchScope imports rbacContainer at module level
// but QuotesController always passes its own authzService so the default is never used.
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
import { QuotesController } from "@/modules/quotes/infrastructure/http/QuotesController";
import { ListQuotesUseCase } from "@/modules/quotes/application/use-cases/ListQuotesUseCase";
import { GetQuoteUseCase } from "@/modules/quotes/application/use-cases/GetQuoteUseCase";
import { CreateQuoteUseCase } from "@/modules/quotes/application/use-cases/CreateQuoteUseCase";
import { UpdateQuoteUseCase } from "@/modules/quotes/application/use-cases/UpdateQuoteUseCase";
import { AuthorizeQuoteUseCase } from "@/modules/quotes/application/use-cases/AuthorizeQuoteUseCase";
import { CancelQuoteUseCase } from "@/modules/quotes/application/use-cases/CancelQuoteUseCase";
import { ConvertQuoteToSaleUseCase } from "@/modules/quotes/application/use-cases/ConvertQuoteToSaleUseCase";
import { InMemoryQuoteRepository } from "@/modules/quotes/infrastructure/repositories/InMemoryQuoteRepository";
import { InMemorySaleRepository } from "@/modules/pos/infrastructure/repositories/InMemorySaleRepository";
import { PosLookupService } from "@/modules/pos/application/ports/PosLookups";
import { AuthorizationService } from "@/modules/rbac/application/ports/AuthorizationService";
import { GetTicketSettingsUseCase } from "@/modules/settings/application/use-cases/GetTicketSettingsUseCase";
import { TicketSettingsRepository } from "@/modules/settings/application/ports/TicketSettingsRepository";
import { DEFAULT_TICKET_SETTINGS } from "@/modules/settings/domain/entities/TicketSettings";

const BRANCH_ID = "11111111-1111-1111-1111-111111111111";
const OTHER_BRANCH_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const CUSTOMER_ID = "22222222-2222-2222-2222-222222222222";
const FOLIO_ID = "33333333-3333-3333-3333-333333333333";
const PRODUCT_ID = "44444444-4444-4444-4444-444444444444";
const PRICE_ID = "55555555-5555-5555-5555-555555555555";
const PAYMENT_ID = "66666666-6666-6666-6666-666666666666";
const FISCAL_FOLIO_ID = "77777777-7777-7777-7777-777777777777";
const USER_ID = "00000000-0000-0000-0000-000000000001";

function makeLookups(overrides: Partial<PosLookupService> = {}): PosLookupService {
  return {
    async getCustomer(id) {
      return overrides.getCustomer ? overrides.getCustomer(id) : { id, isActive: true, creditLimit: null, currentBalance: 0, email: null };
    },
    async getBranch(id) {
      return overrides.getBranch ? overrides.getBranch(id) : { id, isActive: true };
    },
    async getFolio(id) {
      return overrides.getFolio
        ? overrides.getFolio(id)
        : { id, code: "COT", prefix: "COT", scope: "POS", isActive: true };
    },
    async getPaymentMethod(id) {
      return overrides.getPaymentMethod ? overrides.getPaymentMethod(id) : { id, isActive: true, isCredit: false };
    },
    async getProduct(id) {
      return overrides.getProduct
        ? overrides.getProduct(id)
        : { id, code: "FERT_001", name: "Fert", ivaRate: 0.16, iepsRate: null, isTaxable: true, isActive: true };
    },
    async getProductPrice(id) {
      return overrides.getProductPrice
        ? overrides.getProductPrice(id)
        : { id, productId: PRODUCT_ID, name: "Menudeo", price: 100, discountPct: null };
    },
    async getDosificationForSale(id) {
      return overrides.getDosificationForSale ? overrides.getDosificationForSale(id) : null;
    },
    async getDosificationSurchargePct() {
      return overrides.getDosificationSurchargePct ? overrides.getDosificationSurchargePct() : 5;
    },
    async isProductAvailableInBranch(productId, branchId) {
      return overrides.isProductAvailableInBranch ? overrides.isProductAvailableInBranch(productId, branchId) : true;
    },
    async hasBranchPriceOverrides(productId, branchId) {
      return overrides.hasBranchPriceOverrides ? overrides.hasBranchPriceOverrides(productId, branchId) : false;
    },
  };
}

function makeAuthz(bypass: boolean): AuthorizationService {
  return {
    userCan: jest.fn().mockResolvedValue(bypass),
    listUserPermissions: jest.fn().mockResolvedValue([]),
    invalidate: jest.fn(),
    invalidateByRole: jest.fn().mockResolvedValue(undefined),
  };
}

function makeTicketSettingsUseCase(): GetTicketSettingsUseCase {
  const repo: TicketSettingsRepository = {
    get: jest.fn().mockResolvedValue({ ...DEFAULT_TICKET_SETTINGS, businessName: "Agrisas Test" }),
    update: jest.fn(),
    updateLogoUrl: jest.fn(),
  };
  return new GetTicketSettingsUseCase(repo);
}

function buildController(opts: {
  bypass?: boolean;
  quoteRepo?: InMemoryQuoteRepository;
  saleRepo?: InMemorySaleRepository;
  lookups?: PosLookupService;
} = {}) {
  const quoteRepo = opts.quoteRepo ?? new InMemoryQuoteRepository();
  const saleRepo = opts.saleRepo ?? new InMemorySaleRepository();
  const lookups = opts.lookups ?? makeLookups();
  const controller = new QuotesController(
    new ListQuotesUseCase(quoteRepo),
    new GetQuoteUseCase(quoteRepo),
    new CreateQuoteUseCase(quoteRepo, lookups),
    new UpdateQuoteUseCase(quoteRepo, lookups),
    new AuthorizeQuoteUseCase(quoteRepo),
    new CancelQuoteUseCase(quoteRepo),
    new ConvertQuoteToSaleUseCase(quoteRepo, saleRepo, lookups),
    makeAuthz(opts.bypass ?? false),
    makeTicketSettingsUseCase()
  );
  return { controller, quoteRepo, saleRepo };
}

function req(
  method: string,
  url: string,
  body?: unknown,
  headers: Record<string, string> = {}
): NextRequest {
  return new NextRequest(`http://localhost${url}`, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
      "x-user-id": USER_ID,
      "x-user-branch-id": BRANCH_ID,
      ...headers,
    },
  });
}

const baseCreateBody = {
  branchId: BRANCH_ID,
  customerId: CUSTOMER_ID,
  folioId: FOLIO_ID,
  items: [{ productId: PRODUCT_ID, productPriceId: PRICE_ID, quantity: 2 }],
};

const futureIso = () => new Date(Date.now() + 86400000 * 7).toISOString();
const pastIso = () => "2020-01-01T00:00:00Z";

async function seedQuote(
  quoteRepo: InMemoryQuoteRepository,
  controller: QuotesController,
  bodyOverrides: Partial<typeof baseCreateBody> = {}
) {
  quoteRepo.reset();
  const res = await controller.create(req("POST", "/quotes", { ...baseCreateBody, ...bodyOverrides }));
  expect(res.status).toBe(201);
  return (await res.json()) as { id: string; branchId: string };
}

describe("QuotesController.create", () => {
  it("201 con body válido", async () => {
    const { controller, quoteRepo } = buildController();
    quoteRepo.reset();
    const res = await controller.create(req("POST", "/quotes", baseCreateBody));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.status).toBe("draft");
    expect(body.items).toHaveLength(1);
  });

  it("400 con UUID malformado en branchId", async () => {
    const { controller } = buildController();
    const res = await controller.create(req("POST", "/quotes", { ...baseCreateBody, branchId: "not-uuid" }));
    expect(res.status).toBe(400);
  });

  it("400 con items vacío", async () => {
    const { controller } = buildController();
    const res = await controller.create(req("POST", "/quotes", { ...baseCreateBody, items: [] }));
    expect(res.status).toBe(400);
  });

  it("400 con quantity negativa", async () => {
    const { controller } = buildController();
    const res = await controller.create(
      req("POST", "/quotes", { ...baseCreateBody, items: [{ ...baseCreateBody.items[0], quantity: -1 }] })
    );
    expect(res.status).toBe(400);
  });

  it("400 con expiresAt en el pasado", async () => {
    const { controller } = buildController();
    const res = await controller.create(req("POST", "/quotes", { ...baseCreateBody, expiresAt: pastIso() }));
    expect(res.status).toBe(400);
  });

  it("400 con expiresAt mal formateado", async () => {
    const { controller } = buildController();
    const res = await controller.create(req("POST", "/quotes", { ...baseCreateBody, expiresAt: "no-fecha" }));
    expect(res.status).toBe(400);
  });

  it("acepta expiresAt en el futuro", async () => {
    const { controller, quoteRepo } = buildController();
    quoteRepo.reset();
    const res = await controller.create(req("POST", "/quotes", { ...baseCreateBody, expiresAt: futureIso() }));
    expect(res.status).toBe(201);
  });

  it("403 cuando branchId del body no coincide con header sin bypass", async () => {
    const { controller } = buildController({ bypass: false });
    const res = await controller.create(req("POST", "/quotes", { ...baseCreateBody, branchId: OTHER_BRANCH_ID }));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.required).toBe("branches:access_all");
  });

  it("201 con branchId distinto cuando el caller tiene bypass", async () => {
    const { controller, quoteRepo } = buildController({ bypass: true });
    quoteRepo.reset();
    const res = await controller.create(req("POST", "/quotes", { ...baseCreateBody, branchId: OTHER_BRANCH_ID }));
    expect(res.status).toBe(201);
  });

  it("400 cuando customer está inactivo", async () => {
    const lookups = makeLookups({ getCustomer: async (id) => ({ id, isActive: false, creditLimit: null, currentBalance: 0, email: null }) });
    const { controller, quoteRepo } = buildController({ lookups });
    quoteRepo.reset();
    const res = await controller.create(req("POST", "/quotes", baseCreateBody));
    expect(res.status).toBe(400);
  });

  it("400 cuando folio está inactivo", async () => {
    const lookups = makeLookups({
      getFolio: async (id) => ({ id, code: "COT", prefix: "COT", scope: "POS", isActive: false }),
    });
    const { controller, quoteRepo } = buildController({ lookups });
    quoteRepo.reset();
    const res = await controller.create(req("POST", "/quotes", baseCreateBody));
    expect(res.status).toBe(400);
  });
});

describe("QuotesController.update", () => {
  it("400 con body vacío", async () => {
    const { controller, quoteRepo } = buildController();
    const created = await seedQuote(quoteRepo, controller);
    const res = await controller.update(req("PATCH", `/quotes/${created.id}`, {}), created.id);
    expect(res.status).toBe(400);
  });

  it("400 con items vacíos", async () => {
    const { controller, quoteRepo } = buildController();
    const created = await seedQuote(quoteRepo, controller);
    const res = await controller.update(req("PATCH", `/quotes/${created.id}`, { items: [] }), created.id);
    expect(res.status).toBe(400);
  });

  it("400 con UUID malformado en :id", async () => {
    const { controller } = buildController();
    const res = await controller.update(req("PATCH", "/quotes/not-uuid", { notes: "x" }), "not-uuid");
    expect(res.status).toBe(400);
  });

  it("409 cuando la cotización ya está autorizada", async () => {
    const { controller, quoteRepo } = buildController();
    const created = await seedQuote(quoteRepo, controller);
    await controller.authorize(req("POST", `/quotes/${created.id}/authorize`, {}), created.id);
    const res = await controller.update(
      req("PATCH", `/quotes/${created.id}`, { notes: "tarde" }),
      created.id
    );
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.status).toBe("authorized");
  });

  it("404 cuando la cotización no existe", async () => {
    const { controller } = buildController();
    const fakeId = "deadbeef-dead-beef-dead-beefdeadbeef";
    const res = await controller.update(
      req("PATCH", `/quotes/${fakeId}`, { notes: "x" }),
      fakeId
    );
    expect(res.status).toBe(404);
  });
});

describe("QuotesController.authorize", () => {
  it("200 happy path desde draft", async () => {
    const { controller, quoteRepo } = buildController();
    const created = await seedQuote(quoteRepo, controller);
    const res = await controller.authorize(
      req("POST", `/quotes/${created.id}/authorize`, {}),
      created.id
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("authorized");
    expect(body.authorizedBy).toBe(USER_ID);
  });

  it("409 al autorizar dos veces", async () => {
    const { controller, quoteRepo } = buildController();
    const created = await seedQuote(quoteRepo, controller);
    await controller.authorize(req("POST", `/quotes/${created.id}/authorize`, {}), created.id);
    const res = await controller.authorize(
      req("POST", `/quotes/${created.id}/authorize`, {}),
      created.id
    );
    expect(res.status).toBe(409);
  });

  it("409 cuando la cotización está expirada", async () => {
    // Crear con expiresAt válido en el futuro, luego adelantamos el reloj con jest fake timers
    jest.useFakeTimers().setSystemTime(new Date("2026-06-01T00:00:00Z"));
    try {
      const { controller, quoteRepo } = buildController();
      quoteRepo.reset();
      const createRes = await controller.create(
        req("POST", "/quotes", { ...baseCreateBody, expiresAt: "2026-06-05T00:00:00Z" })
      );
      expect(createRes.status).toBe(201);
      const created = await createRes.json();
      jest.setSystemTime(new Date("2026-06-10T00:00:00Z"));
      const res = await controller.authorize(
        req("POST", `/quotes/${created.id}/authorize`, {}),
        created.id
      );
      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body.error).toMatch(/expired/i);
    } finally {
      jest.useRealTimers();
    }
  });
});

describe("QuotesController.cancel", () => {
  it("200 happy path en draft", async () => {
    const { controller, quoteRepo } = buildController();
    const created = await seedQuote(quoteRepo, controller);
    const res = await controller.cancel(
      req("DELETE", `/quotes/${created.id}`, { reason: "Cliente desistió" }),
      created.id
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("cancelled");
    expect(body.cancellationReason).toBe("Cliente desistió");
  });

  it("409 al cancelar dos veces", async () => {
    const { controller, quoteRepo } = buildController();
    const created = await seedQuote(quoteRepo, controller);
    await controller.cancel(req("DELETE", `/quotes/${created.id}`, {}), created.id);
    const res = await controller.cancel(req("DELETE", `/quotes/${created.id}`, {}), created.id);
    expect(res.status).toBe(409);
  });

  it("409 con saleId al cancelar una cotización ya convertida", async () => {
    const { controller, quoteRepo } = buildController();
    const created = await seedQuote(quoteRepo, controller);
    await controller.authorize(req("POST", `/quotes/${created.id}/authorize`, {}), created.id);
    const convertRes = await controller.convert(
      req("POST", `/quotes/${created.id}/convert`, {
        paymentMethodId: PAYMENT_ID,
        folioId: FISCAL_FOLIO_ID,
      }),
      created.id
    );
    expect(convertRes.status).toBe(200);
    const sale = await convertRes.json();
    const res = await controller.cancel(req("DELETE", `/quotes/${created.id}`, {}), created.id);
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.saleId).toBe(sale.id);
  });
});

describe("QuotesController.convert", () => {
  it("200 happy path desde authorized", async () => {
    const { controller, quoteRepo } = buildController();
    const created = await seedQuote(quoteRepo, controller);
    await controller.authorize(req("POST", `/quotes/${created.id}/authorize`, {}), created.id);
    const res = await controller.convert(
      req("POST", `/quotes/${created.id}/convert`, {
        paymentMethodId: PAYMENT_ID,
        folioId: FISCAL_FOLIO_ID,
      }),
      created.id
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.quoteId).toBe(created.id);
  });

  it("idempotente: segunda conversión devuelve la misma venta", async () => {
    const { controller, quoteRepo } = buildController();
    const created = await seedQuote(quoteRepo, controller);
    await controller.authorize(req("POST", `/quotes/${created.id}/authorize`, {}), created.id);
    const first = await controller.convert(
      req("POST", `/quotes/${created.id}/convert`, {
        paymentMethodId: PAYMENT_ID,
        folioId: FISCAL_FOLIO_ID,
      }),
      created.id
    );
    const firstBody = await first.json();
    const second = await controller.convert(
      req("POST", `/quotes/${created.id}/convert`, {
        paymentMethodId: PAYMENT_ID,
        folioId: FISCAL_FOLIO_ID,
      }),
      created.id
    );
    const secondBody = await second.json();
    expect(second.status).toBe(200);
    expect(secondBody.id).toBe(firstBody.id);
  });

  it("409 al convertir una cotización en draft", async () => {
    const { controller, quoteRepo } = buildController();
    const created = await seedQuote(quoteRepo, controller);
    const res = await controller.convert(
      req("POST", `/quotes/${created.id}/convert`, {
        paymentMethodId: PAYMENT_ID,
        folioId: FISCAL_FOLIO_ID,
      }),
      created.id
    );
    expect(res.status).toBe(409);
  });

  it("400 cuando paymentMethod está inactivo", async () => {
    const lookups = makeLookups({
      getPaymentMethod: async (id) => ({ id, isActive: false, isCredit: false }),
    });
    const { controller, quoteRepo } = buildController({ lookups });
    const created = await seedQuote(quoteRepo, controller);
    await controller.authorize(req("POST", `/quotes/${created.id}/authorize`, {}), created.id);
    const res = await controller.convert(
      req("POST", `/quotes/${created.id}/convert`, {
        paymentMethodId: PAYMENT_ID,
        folioId: FISCAL_FOLIO_ID,
      }),
      created.id
    );
    expect(res.status).toBe(400);
  });

  it("400 con body malformado (UUID inválido en paymentMethodId)", async () => {
    const { controller, quoteRepo } = buildController();
    const created = await seedQuote(quoteRepo, controller);
    await controller.authorize(req("POST", `/quotes/${created.id}/authorize`, {}), created.id);
    const res = await controller.convert(
      req("POST", `/quotes/${created.id}/convert`, {
        paymentMethodId: "not-uuid",
        folioId: FISCAL_FOLIO_ID,
      }),
      created.id
    );
    expect(res.status).toBe(400);
  });

  it("200 con creditLimitExceeded=true cuando el cliente excede su línea de crédito al convertir (ya no bloquea)", async () => {
    const lookups = makeLookups({
      getPaymentMethod: async (id) => ({ id, isActive: true, isCredit: true }),
      getCustomer: async (id) => ({ id, isActive: true, creditLimit: 50, currentBalance: 0, email: null }),
    });
    const { controller, quoteRepo } = buildController({ lookups });
    const created = await seedQuote(quoteRepo, controller);
    await controller.authorize(req("POST", `/quotes/${created.id}/authorize`, {}), created.id);
    const res = await controller.convert(
      req("POST", `/quotes/${created.id}/convert`, {
        paymentMethodId: PAYMENT_ID,
        folioId: FISCAL_FOLIO_ID,
      }),
      created.id
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.creditLimitExceeded).toBe(true);
  });

  it("200 con creditLimitExceeded=false cuando el cliente no tiene creditLimit configurado (ya no bloquea)", async () => {
    const lookups = makeLookups({
      getPaymentMethod: async (id) => ({ id, isActive: true, isCredit: true }),
      getCustomer: async (id) => ({ id, isActive: true, creditLimit: null, currentBalance: 0, email: null }),
    });
    const { controller, quoteRepo } = buildController({ lookups });
    const created = await seedQuote(quoteRepo, controller);
    await controller.authorize(req("POST", `/quotes/${created.id}/authorize`, {}), created.id);
    const res = await controller.convert(
      req("POST", `/quotes/${created.id}/convert`, {
        paymentMethodId: PAYMENT_ID,
        folioId: FISCAL_FOLIO_ID,
      }),
      created.id
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.creditLimitExceeded).toBe(false);
  });

  it("403 cuando el caller sin bypass intenta convertir cotización de otra sucursal", async () => {
    const { controller, quoteRepo } = buildController({ bypass: true });
    // Creamos con bypass=true para poder usar OTHER_BRANCH_ID
    const created = await seedQuote(quoteRepo, controller, { branchId: OTHER_BRANCH_ID });
    await controller.authorize(req("POST", `/quotes/${created.id}/authorize`, {}), created.id);

    // Reutilizamos el repo, pero un nuevo controller sin bypass
    const { controller: noBypassCtrl } = buildController({ bypass: false, quoteRepo });
    const res = await noBypassCtrl.convert(
      req("POST", `/quotes/${created.id}/convert`, {
        paymentMethodId: PAYMENT_ID,
        folioId: FISCAL_FOLIO_ID,
      }),
      created.id
    );
    expect(res.status).toBe(403);
  });
});

describe("QuotesController.list", () => {
  it("operator sin bypass es filtrado a su branch implícitamente", async () => {
    const { controller, quoteRepo } = buildController();
    await seedQuote(quoteRepo, controller); // en BRANCH_ID
    const res = await controller.list(req("GET", "/quotes"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items.every((q: { branchId: string }) => q.branchId === BRANCH_ID)).toBe(true);
  });

  it("operator sin bypass que pide otra sucursal → 403", async () => {
    const { controller } = buildController({ bypass: false });
    const res = await controller.list(req("GET", `/quotes?branchId=${OTHER_BRANCH_ID}`));
    expect(res.status).toBe(403);
  });

  it("operator sin branch asignada y sin bypass → 403", async () => {
    const { controller } = buildController({ bypass: false });
    const r = req("GET", "/quotes", undefined, { "x-user-branch-id": "" });
    const res = await controller.list(r);
    expect(res.status).toBe(403);
  });

  it("admin con bypass sin ?branchId= → ve todas las sucursales", async () => {
    const { controller, quoteRepo } = buildController({ bypass: true });
    await seedQuote(quoteRepo, controller, { branchId: OTHER_BRANCH_ID });
    const res = await controller.list(req("GET", "/quotes"));
    expect(res.status).toBe(200);
  });

  it("400 con pageSize > 100", async () => {
    const { controller } = buildController({ bypass: true });
    const res = await controller.list(req("GET", "/quotes?pageSize=200"));
    expect(res.status).toBe(400);
  });

  it("400 con search más corto que 2 chars", async () => {
    const { controller } = buildController({ bypass: true });
    const res = await controller.list(req("GET", "/quotes?search=x"));
    expect(res.status).toBe(400);
  });
});

describe("QuotesController.getById", () => {
  it("200 con isExpired computado para draft sin expiración", async () => {
    const { controller, quoteRepo } = buildController();
    const created = await seedQuote(quoteRepo, controller);
    const res = await controller.getById(req("GET", `/quotes/${created.id}`), created.id);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.isExpired).toBe(false);
  });

  it("404 cuando no existe", async () => {
    const { controller } = buildController();
    const fakeId = "deadbeef-dead-beef-dead-beefdeadbeef";
    const res = await controller.getById(req("GET", `/quotes/${fakeId}`), fakeId);
    expect(res.status).toBe(404);
  });

  it("400 con UUID malformado", async () => {
    const { controller } = buildController();
    const res = await controller.getById(req("GET", "/quotes/not-uuid"), "not-uuid");
    expect(res.status).toBe(400);
  });

  it("403 cuando el caller sin bypass consulta cotización de otra sucursal (existence no se filtra como 404)", async () => {
    const { controller, quoteRepo } = buildController({ bypass: true });
    const created = await seedQuote(quoteRepo, controller, { branchId: OTHER_BRANCH_ID });
    const { controller: noBypass } = buildController({ bypass: false, quoteRepo });
    const res = await noBypass.getById(req("GET", `/quotes/${created.id}`), created.id);
    expect(res.status).toBe(403);
  });

  it("400 con format inválido", async () => {
    const { controller, quoteRepo } = buildController();
    const created = await seedQuote(quoteRepo, controller);
    const res = await controller.getById(req("GET", `/quotes/${created.id}?format=xyz`), created.id);
    expect(res.status).toBe(400);
  });

  it("200 con format=pdf devuelve un buffer PDF no vacío", async () => {
    const { controller, quoteRepo } = buildController();
    const created = await seedQuote(quoteRepo, controller);
    const res = await controller.getById(req("GET", `/quotes/${created.id}?format=pdf`), created.id);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
    expect(res.headers.get("Content-Disposition")).toContain("cotizacion-");
    const buffer = await res.arrayBuffer();
    expect(buffer.byteLength).toBeGreaterThan(0);
  });

  it("200 con format=pdf en cotización sin cliente asignado", async () => {
    const { controller, quoteRepo } = buildController();
    const created = await seedQuote(quoteRepo, controller, { customerId: null });
    const res = await controller.getById(req("GET", `/quotes/${created.id}?format=pdf`), created.id);
    expect(res.status).toBe(200);
    const buffer = await res.arrayBuffer();
    expect(buffer.byteLength).toBeGreaterThan(0);
  });

  it("403 con format=pdf cuando el caller sin bypass consulta cotización de otra sucursal", async () => {
    const { controller, quoteRepo } = buildController({ bypass: true });
    const created = await seedQuote(quoteRepo, controller, { branchId: OTHER_BRANCH_ID });
    const { controller: noBypass } = buildController({ bypass: false, quoteRepo });
    const res = await noBypass.getById(req("GET", `/quotes/${created.id}?format=pdf`), created.id);
    expect(res.status).toBe(403);
  });

  it("404 con format=pdf cuando no existe", async () => {
    const { controller } = buildController();
    const fakeId = "deadbeef-dead-beef-dead-beefdeadbeef";
    const res = await controller.getById(req("GET", `/quotes/${fakeId}?format=pdf`), fakeId);
    expect(res.status).toBe(404);
  });
});
