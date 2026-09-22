// Prevent Prisma instantiation: enforceBranchScope falls back to rbacContainer
// when no authzService is passed. SalesController always passes its own, but
// the mock guards against accidental initialization at import time.
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
import { SalesController } from "@/modules/pos/infrastructure/http/SalesController";
import { ListSalesUseCase } from "@/modules/pos/application/use-cases/ListSalesUseCase";
import { GetSaleUseCase } from "@/modules/pos/application/use-cases/GetSaleUseCase";
import { CreateSaleUseCase } from "@/modules/pos/application/use-cases/CreateSaleUseCase";
import { CancelSaleUseCase } from "@/modules/pos/application/use-cases/CancelSaleUseCase";
import { EditCompletedSaleUseCase } from "@/modules/pos/application/use-cases/EditCompletedSaleUseCase";
import { SendSaleTicketEmailUseCase } from "@/modules/pos/application/use-cases/SendSaleTicketEmailUseCase";
import { SaleRepository, SaleSummary } from "@/modules/pos/application/ports/SaleRepository";
import { PosLookupService } from "@/modules/pos/application/ports/PosLookups";
import { BranchRepository } from "@/modules/branches/application/ports/BranchRepository";
import { AuthorizationService } from "@/modules/rbac/application/ports/AuthorizationService";
import { Sale, SaleStatus } from "@/modules/pos/domain/entities/Sale";
import { Branch } from "@/modules/branches/domain/entities/Branch";
import { QuoteRepository, QuoteSummary } from "@/modules/quotes/application/ports/QuoteRepository";
import { Quote } from "@/modules/quotes/domain/entities/Quote";
import { QuoteStatus } from "@/modules/quotes/domain/value-objects/QuoteStatus";
import { SaleHasActivePaymentsError } from "@/modules/payments/domain/errors/SaleHasActivePaymentsError";

const VALID_UUID = "11111111-1111-1111-1111-111111111111";
const HQ_ID = "22222222-2222-2222-2222-222222222222";
const SALE_ID = "33333333-3333-3333-3333-333333333333";

function makeSummary(status: SaleStatus, branchId = VALID_UUID): SaleSummary {
  const now = new Date();
  const sale = Sale.create({
    id: SALE_ID,
    folioId: "f1",
    folioNumber: 1,
    folioCode: "F-1",
    branchId,
    customerId: "c1",
    cashierId: "u1",
    paymentMethodId: "pm1",
    quoteId: null,
    status,
    paidAmount: 116,
    paymentStatus: "paid",
    subtotal: 100,
    taxTotal: 16,
    total: 116,
    notes: null,
    completedAt: now,
    cancelledAt: status === "cancelled" ? now : null,
    cancellationReason: null,
    editedAt: status === "edited" ? now : null,
    createdAt: now,
    updatedAt: now,
    items: [],
  });
  return {
    sale,
    joined: { branchName: null, customerName: null, customerRfc: null, customerAddress: null, customerCreditDays: null, cashierName: null, paymentMethodCode: null, paymentMethodName: null, paymentMethodIsCredit: false },
  };
}

function makeRepo(overrides?: Partial<SaleRepository>): SaleRepository {
  return {
    findAll: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    findByIdWithItems: jest.fn().mockResolvedValue(makeSummary("completed")),
    findByClientRequestId: jest.fn().mockResolvedValue(null),
    createCompleted: jest.fn().mockResolvedValue(makeSummary("completed")),
    createCompletedFromQuote: jest.fn().mockResolvedValue(makeSummary("completed")),
    cancel: jest.fn().mockResolvedValue(makeSummary("cancelled")),
    replaceItemsAndRecalculate: jest.fn().mockResolvedValue(makeSummary("edited")),
    markReturnedTotal: jest.fn(),
    ...overrides,
  };
}

function makeLookups(): PosLookupService {
  return {
    getProduct: jest.fn(),
    getProductPrice: jest.fn(),
    getCustomer: jest.fn(),
    getBranch: jest.fn(),
    getFolio: jest.fn(),
    getPaymentMethod: jest.fn(),
    getDosificationForSale: jest.fn(),
    getDosificationSurchargePct: jest.fn().mockResolvedValue(5),
    isProductAvailableInBranch: jest.fn().mockResolvedValue(true),
    hasBranchPriceOverrides: jest.fn().mockResolvedValue(false),
  };
}

function makeBranchRepo(hq: Branch | null): BranchRepository {
  return {
    findAll: jest.fn(),
    findById: jest.fn(),
    findHeadquarters: jest.fn().mockResolvedValue(hq),
    create: jest.fn(),
    update: jest.fn(),
    softDelete: jest.fn(),
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

function makeHq(): Branch {
  const now = new Date();
  return Branch.create(HQ_ID, {
    code: "MATRIZ",
    name: "Matriz",
    address: null,
    phone: null,
    email: null,
    isHeadquarters: true,
    isActive: true,
    addressStreet: null,
    addressExteriorNumber: null,
    addressInteriorNumber: null,
    addressNeighborhood: null,
    addressMunicipality: null,
    addressState: null,
    addressCountry: null,
    addressZipCode: null,
    createdAt: now,
    updatedAt: now,
  });
}

function makeQuoteRepo(overrides?: Partial<QuoteRepository>): QuoteRepository {
  return {
    findAll: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    findByIdWithItems: jest.fn().mockResolvedValue(null),
    findByClientRequestId: jest.fn().mockResolvedValue(null),
    createWithItems: jest.fn(),
    replaceItemsAndRecalculate: jest.fn(),
    updateMeta: jest.fn(),
    markAuthorized: jest.fn(),
    markCancelled: jest.fn(),
    markConverted: jest.fn(),
    ...overrides,
  };
}

function makeQuoteSummary(opts: {
  status: QuoteStatus;
  branchId: string;
  customerId: string;
  convertedSaleId?: string | null;
}): QuoteSummary {
  const now = new Date();
  return {
    quote: Quote.create({
      id: "00000000-0000-0000-0000-0000000000aa",
      folioId: "00000000-0000-0000-0000-0000000000f0",
      folioNumber: 1,
      folioCode: "COT-1",
      branchId: opts.branchId,
      customerId: opts.customerId,
      creatorId: "00000000-0000-0000-0000-0000000000c0",
      status: opts.status,
      subtotal: 100,
      taxTotal: 16,
      total: 116,
      notes: null,
      expiresAt: null,
      authorizedAt: opts.status === "authorized" || opts.status === "converted" ? now : null,
      authorizedBy: opts.status === "authorized" || opts.status === "converted" ? "u1" : null,
      cancelledAt: opts.status === "cancelled" ? now : null,
      cancellationReason: null,
      convertedAt: opts.status === "converted" ? now : null,
      convertedSaleId: opts.convertedSaleId ?? null,
      createdAt: now,
      updatedAt: now,
      items: [],
    }),
    joined: { branchName: null, customerName: null, customerRfc: null, creatorName: null },
  };
}

function makeMailer() {
  return { send: jest.fn().mockResolvedValue(undefined) };
}

function buildController(opts: {
  repo?: SaleRepository;
  quoteRepo?: QuoteRepository;
  bypass?: boolean;
  hq?: Branch | null;
}): SalesController {
  const repo = opts.repo ?? makeRepo();
  const lookups = makeLookups();
  return new SalesController(
    new ListSalesUseCase(repo),
    new GetSaleUseCase(repo),
    new CreateSaleUseCase(repo, lookups, opts.quoteRepo),
    new CancelSaleUseCase(repo),
    new EditCompletedSaleUseCase(repo, lookups),
    new SendSaleTicketEmailUseCase(repo, lookups, makeMailer()),
    makeBranchRepo(opts.hq ?? null),
    lookups,
    makeAuthz(opts.bypass ?? false)
  );
}

function postReq(body: unknown, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest("http://localhost/sales", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json", ...headers },
  });
}

function patchReq(body: unknown, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest("http://localhost/sales/x", {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json", ...headers },
  });
}

function getReq(qs: string, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(`http://localhost/sales${qs}`, { headers });
}

describe("SalesController — Zod validation", () => {
  it("rejects body con items vacíos en create", async () => {
    const res = await buildController({}).create(
      postReq({
        branchId: VALID_UUID,
        customerId: VALID_UUID,
        paymentMethodId: VALID_UUID,
        folioId: VALID_UUID,
        items: [],
      })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/at least one item/i);
  });

  it("rejects body con quantity <= 0", async () => {
    const res = await buildController({}).create(
      postReq({
        branchId: VALID_UUID,
        customerId: VALID_UUID,
        paymentMethodId: VALID_UUID,
        folioId: VALID_UUID,
        items: [{ productId: VALID_UUID, productPriceId: VALID_UUID, quantity: 0 }],
      })
    );
    expect(res.status).toBe(400);
  });

  it("rejects branchId no-UUID", async () => {
    const res = await buildController({}).create(
      postReq({
        branchId: "not-uuid",
        customerId: VALID_UUID,
        paymentMethodId: VALID_UUID,
        folioId: VALID_UUID,
        items: [{ productId: VALID_UUID, productPriceId: VALID_UUID, quantity: 1 }],
      })
    );
    expect(res.status).toBe(400);
  });

  it("rejects notes > 1000 chars", async () => {
    const res = await buildController({}).create(
      postReq({
        branchId: VALID_UUID,
        customerId: VALID_UUID,
        paymentMethodId: VALID_UUID,
        folioId: VALID_UUID,
        notes: "x".repeat(1001),
        items: [{ productId: VALID_UUID, productPriceId: VALID_UUID, quantity: 1 }],
      })
    );
    expect(res.status).toBe(400);
  });
});

describe("SalesController — Branch scoping", () => {
  const validBody = {
    branchId: VALID_UUID,
    customerId: VALID_UUID,
    paymentMethodId: VALID_UUID,
    folioId: VALID_UUID,
    items: [{ productId: VALID_UUID, productPriceId: VALID_UUID, quantity: 1 }],
  };

  it("operator sin bypass solicitando otra branch → 403 en create", async () => {
    const res = await buildController({ bypass: false }).create(
      postReq(validBody, { "x-user-id": "u1", "x-user-branch-id": "other-branch" })
    );
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.required).toBe("branches:access_all");
  });

  it("operator sin branch asignada listando sin ?branchId= → 403", async () => {
    const res = await buildController({ bypass: false }).list(
      getReq("", { "x-user-id": "u1", "x-user-branch-id": "" })
    );
    expect(res.status).toBe(403);
  });

  it("admin con bypass puede listar todas las sucursales", async () => {
    const res = await buildController({ bypass: true }).list(
      getReq("", { "x-user-id": "admin", "x-user-branch-id": "" })
    );
    expect(res.status).toBe(200);
  });
});

describe("SalesController — quoteId link (task 10.8)", () => {
  const SALE_BRANCH = VALID_UUID;
  const SALE_CUSTOMER = "44444444-4444-4444-4444-444444444444";
  const PRICE_ID = "55555555-5555-5555-5555-555555555555";
  const QUOTE_ID = "66666666-6666-6666-6666-666666666666";

  // Lookups with active resources so the use case reaches the quoteId validation step.
  function activeLookups(): PosLookupService {
    return {
      getProduct: jest.fn().mockResolvedValue({
        id: VALID_UUID, code: "P1", name: "Producto", ivaRate: 0.16, iepsRate: null, isActive: true,
      }),
      getProductPrice: jest.fn().mockResolvedValue({
        id: PRICE_ID, productId: VALID_UUID, name: "Lista", price: 100, discountPct: null,
      }),
      getCustomer: jest.fn().mockResolvedValue({ id: SALE_CUSTOMER, isActive: true }),
      getBranch: jest.fn().mockResolvedValue({ id: SALE_BRANCH, isActive: true }),
      getFolio: jest.fn().mockResolvedValue({ id: VALID_UUID, code: "F", prefix: "F", scope: "POS", isActive: true }),
      getDosificationForSale: jest.fn(),
      getPaymentMethod: jest.fn().mockResolvedValue({ id: VALID_UUID, isActive: true }),
      getDosificationSurchargePct: jest.fn().mockResolvedValue(5),
      isProductAvailableInBranch: jest.fn().mockResolvedValue(true),
      hasBranchPriceOverrides: jest.fn().mockResolvedValue(false),
    };
  }

  function buildCtl(opts: { quoteRepo: QuoteRepository }): SalesController {
    const repo = makeRepo();
    return new SalesController(
      new ListSalesUseCase(repo),
      new GetSaleUseCase(repo),
      new CreateSaleUseCase(repo, activeLookups(), opts.quoteRepo),
      new CancelSaleUseCase(repo),
      new EditCompletedSaleUseCase(repo, activeLookups()),
      new SendSaleTicketEmailUseCase(repo, activeLookups(), makeMailer()),
      makeBranchRepo(null),
      activeLookups(),
      makeAuthz(false)
    );
  }

  const baseBody = (overrides: Record<string, unknown> = {}) => ({
    branchId: SALE_BRANCH,
    customerId: SALE_CUSTOMER,
    paymentMethodId: VALID_UUID,
    folioId: VALID_UUID,
    items: [{ productId: VALID_UUID, productPriceId: PRICE_ID, quantity: 1 }],
    ...overrides,
  });

  const operatorHeaders = { "x-user-id": "u1", "x-user-branch-id": SALE_BRANCH };

  it("acepta quoteId opcional ausente (compatibilidad con flow directo)", async () => {
    const quoteRepo = makeQuoteRepo();
    const ctl = buildCtl({ quoteRepo });
    const res = await ctl.create(postReq(baseBody(), operatorHeaders));
    expect(res.status).toBe(201);
    expect(quoteRepo.findByIdWithItems).not.toHaveBeenCalled();
  });

  it("400 quoteId no es UUID válido (Zod)", async () => {
    const ctl = buildCtl({ quoteRepo: makeQuoteRepo() });
    const res = await ctl.create(postReq(baseBody({ quoteId: "not-uuid" }), operatorHeaders));
    expect(res.status).toBe(400);
  });

  it("400 quoteId no existe (reason: not_found)", async () => {
    const quoteRepo = makeQuoteRepo({ findByIdWithItems: jest.fn().mockResolvedValue(null) });
    const ctl = buildCtl({ quoteRepo });
    const res = await ctl.create(postReq(baseBody({ quoteId: QUOTE_ID }), operatorHeaders));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.reason).toBe("not_found");
  });

  it("400 quoteId apunta a una cotización ya converted (reason: wrong_status)", async () => {
    const quoteRepo = makeQuoteRepo({
      findByIdWithItems: jest.fn().mockResolvedValue(
        makeQuoteSummary({
          status: "converted",
          branchId: SALE_BRANCH,
          customerId: SALE_CUSTOMER,
          convertedSaleId: "prev-sale-id",
        })
      ),
    });
    const ctl = buildCtl({ quoteRepo });
    const res = await ctl.create(postReq(baseBody({ quoteId: QUOTE_ID }), operatorHeaders));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.reason).toBe("wrong_status");
  });

  it("400 quoteId apunta a cotización draft (reason: wrong_status)", async () => {
    const quoteRepo = makeQuoteRepo({
      findByIdWithItems: jest.fn().mockResolvedValue(
        makeQuoteSummary({ status: "draft", branchId: SALE_BRANCH, customerId: SALE_CUSTOMER })
      ),
    });
    const ctl = buildCtl({ quoteRepo });
    const res = await ctl.create(postReq(baseBody({ quoteId: QUOTE_ID }), operatorHeaders));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.reason).toBe("wrong_status");
  });

  it("400 branch del body NO coincide con el de la cotización (reason: branch_mismatch)", async () => {
    const quoteRepo = makeQuoteRepo({
      findByIdWithItems: jest.fn().mockResolvedValue(
        makeQuoteSummary({
          status: "authorized",
          branchId: "99999999-9999-9999-9999-999999999999",
          customerId: SALE_CUSTOMER,
        })
      ),
    });
    const ctl = buildCtl({ quoteRepo });
    const res = await ctl.create(postReq(baseBody({ quoteId: QUOTE_ID }), operatorHeaders));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.reason).toBe("branch_mismatch");
  });

  it("400 customer del body NO coincide con el de la cotización (reason: customer_mismatch)", async () => {
    const quoteRepo = makeQuoteRepo({
      findByIdWithItems: jest.fn().mockResolvedValue(
        makeQuoteSummary({
          status: "authorized",
          branchId: SALE_BRANCH,
          customerId: "88888888-8888-8888-8888-888888888888",
        })
      ),
    });
    const ctl = buildCtl({ quoteRepo });
    const res = await ctl.create(postReq(baseBody({ quoteId: QUOTE_ID }), operatorHeaders));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.reason).toBe("customer_mismatch");
  });

  it("happy path: quoteId válido y autorizado → 201 (pipeline lo persiste)", async () => {
    const quoteRepo = makeQuoteRepo({
      findByIdWithItems: jest.fn().mockResolvedValue(
        makeQuoteSummary({ status: "authorized", branchId: SALE_BRANCH, customerId: SALE_CUSTOMER })
      ),
    });
    const ctl = buildCtl({ quoteRepo });
    const res = await ctl.create(postReq(baseBody({ quoteId: QUOTE_ID }), operatorHeaders));
    expect(res.status).toBe(201);
    expect(quoteRepo.findByIdWithItems).toHaveBeenCalledWith(QUOTE_ID);
  });
});

describe("SalesController — HQ edit guard", () => {
  const editBody = { items: [{ productId: VALID_UUID, productPriceId: VALID_UUID, quantity: 1 }] };

  it("usuario sin bypass y fuera de la matriz → 403", async () => {
    const res = await buildController({ bypass: false, hq: makeHq() }).edit(
      patchReq(editBody, { "x-user-id": "u1", "x-user-branch-id": "other-branch" }),
      SALE_ID
    );
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/headquarters/i);
  });

  it("usuario sin bypass en la matriz → procede al use case", async () => {
    const res = await buildController({ bypass: false, hq: makeHq() }).edit(
      patchReq(editBody, { "x-user-id": "u1", "x-user-branch-id": HQ_ID }),
      SALE_ID
    );
    // 200 (mock devuelve edited summary) o 4xx por validación: lo importante es que NO sea 403 del HQ guard
    expect(res.status).not.toBe(403);
  });

  it("admin con bypass puede editar desde cualquier sucursal", async () => {
    const res = await buildController({ bypass: true, hq: makeHq() }).edit(
      patchReq(editBody, { "x-user-id": "admin", "x-user-branch-id": "" }),
      SALE_ID
    );
    expect(res.status).not.toBe(403);
  });

  it("sin matriz registrada → 403 para non-admin", async () => {
    const res = await buildController({ bypass: false, hq: null }).edit(
      patchReq(editBody, { "x-user-id": "u1", "x-user-branch-id": HQ_ID }),
      SALE_ID
    );
    expect(res.status).toBe(403);
  });
});

describe("SalesController — Flujo de crédito y abonos activos", () => {
  const SALE_BRANCH_CR = VALID_UUID;
  const SALE_CUSTOMER_CR = "44444444-4444-4444-4444-444444444444";
  const PRICE_ID_CR = "55555555-5555-5555-5555-555555555555";

  function creditLookups(opts: { creditLimit: number | null; currentBalance?: number }): PosLookupService {
    return {
      getProduct: jest.fn().mockResolvedValue({
        id: VALID_UUID, code: "P1", name: "Prod", ivaRate: 0, iepsRate: null, isActive: true,
      }),
      getProductPrice: jest.fn().mockResolvedValue({
        id: PRICE_ID_CR, productId: VALID_UUID, name: "Lista", price: 100, discountPct: null,
      }),
      getCustomer: jest.fn().mockResolvedValue({
        id: SALE_CUSTOMER_CR, isActive: true,
        creditLimit: opts.creditLimit,
        currentBalance: opts.currentBalance ?? 0,
      }),
      getBranch: jest.fn().mockResolvedValue({ id: SALE_BRANCH_CR, isActive: true }),
      getFolio: jest.fn().mockResolvedValue({ id: VALID_UUID, code: "F", prefix: null, scope: "POS", isActive: true }),
      getPaymentMethod: jest.fn().mockResolvedValue({ id: VALID_UUID, isActive: true, isCredit: true }),
      getDosificationForSale: jest.fn(),
      getDosificationSurchargePct: jest.fn().mockResolvedValue(5),
      isProductAvailableInBranch: jest.fn().mockResolvedValue(true),
      hasBranchPriceOverrides: jest.fn().mockResolvedValue(false),
    };
  }

  function makeSelectiveAuthz(opts: { creditPermission: boolean }): AuthorizationService {
    return {
      userCan: jest.fn().mockImplementation(async (_userId: string, permission: string) => {
        if (permission === "sales:create_credit") return opts.creditPermission;
        return false;
      }),
      listUserPermissions: jest.fn().mockResolvedValue([]),
      invalidate: jest.fn(),
      invalidateByRole: jest.fn().mockResolvedValue(undefined),
    };
  }

  function buildCreditCtl(opts: {
    creditLimit: number | null;
    currentBalance?: number;
    creditPermission: boolean;
  }): SalesController {
    const repo = makeRepo();
    const lookups = creditLookups(opts);
    const authz = makeSelectiveAuthz({ creditPermission: opts.creditPermission });
    return new SalesController(
      new ListSalesUseCase(repo),
      new GetSaleUseCase(repo),
      new CreateSaleUseCase(repo, lookups, makeQuoteRepo()),
      new CancelSaleUseCase(repo),
      new EditCompletedSaleUseCase(repo, lookups),
      new SendSaleTicketEmailUseCase(repo, lookups, makeMailer()),
      makeBranchRepo(null),
      lookups,
      authz
    );
  }

  const creditBody = {
    branchId: SALE_BRANCH_CR,
    customerId: SALE_CUSTOMER_CR,
    paymentMethodId: VALID_UUID,
    folioId: VALID_UUID,
    items: [{ productId: VALID_UUID, productPriceId: PRICE_ID_CR, quantity: 1 }],
  };

  const operatorHeaders = { "x-user-id": "u1", "x-user-branch-id": SALE_BRANCH_CR };

  it("403 cuando usuario no tiene sales:create_credit y cliente sin línea de crédito", async () => {
    const ctl = buildCreditCtl({ creditLimit: null, creditPermission: false });
    const res = await ctl.create(postReq(creditBody, operatorHeaders));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.required).toBe("sales:create_credit");
  });

  it("201 con creditLimitExceeded=false cuando cliente no tiene línea de crédito (ya no bloquea)", async () => {
    const ctl = buildCreditCtl({ creditLimit: null, creditPermission: true });
    const res = await ctl.create(postReq(creditBody, operatorHeaders));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.creditLimitExceeded).toBe(false);
  });

  it("201 con creditLimitExceeded=true cuando el total supera el límite disponible (ya no bloquea)", async () => {
    // price=100, qty=1 → total=100; creditLimit=50 → excedido
    const ctl = buildCreditCtl({ creditLimit: 50, currentBalance: 0, creditPermission: true });
    const res = await ctl.create(postReq(creditBody, operatorHeaders));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.creditLimitExceeded).toBe(true);
  });

  it("409 SaleHasActivePayments al cancelar una venta con abonos activos", async () => {
    const repo = makeRepo({
      cancel: jest.fn().mockRejectedValue(new SaleHasActivePaymentsError(["pay-1", "pay-2"])),
    });
    const ctl = buildController({ repo, bypass: false });
    const res = await ctl.cancel(
      postReq({}, { "x-user-id": "u1", "x-user-branch-id": VALID_UUID }),
      SALE_ID
    );
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe("SaleHasActivePayments");
    expect(body.paymentIds).toEqual(["pay-1", "pay-2"]);
  });

  it("409 SaleHasActivePayments al editar una venta con abonos activos", async () => {
    const repo = makeRepo({
      replaceItemsAndRecalculate: jest.fn().mockRejectedValue(
        new SaleHasActivePaymentsError(["pay-1"])
      ),
    });
    // Use credit lookups so getProduct/getProductPrice return valid data
    // and the use case reaches replaceItemsAndRecalculate before throwing
    const lookups = creditLookups({ creditLimit: null });
    const ctl = new SalesController(
      new ListSalesUseCase(repo),
      new GetSaleUseCase(repo),
      new CreateSaleUseCase(repo, lookups, makeQuoteRepo()),
      new CancelSaleUseCase(repo),
      new EditCompletedSaleUseCase(repo, lookups),
      new SendSaleTicketEmailUseCase(repo, lookups, makeMailer()),
      makeBranchRepo(makeHq()),
      lookups,
      makeAuthz(false)
    );
    // productPriceId must match what creditLookups.getProductPrice returns (PRICE_ID_CR)
    const editBody = { items: [{ productId: VALID_UUID, productPriceId: PRICE_ID_CR, quantity: 1 }] };
    const res = await ctl.edit(
      patchReq(editBody, { "x-user-id": "u1", "x-user-branch-id": HQ_ID }),
      SALE_ID
    );
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe("SaleHasActivePayments");
    expect(body.paymentIds).toEqual(["pay-1"]);
  });
});

describe("SalesController.getById — returnedQuantityBySaleItem", () => {
  it("incluye el agregado provisto por el repo", async () => {
    const summary = makeSummary("completed");
    summary.returnedQuantityBySaleItem = { "item-A": 2, "item-C": 1 };
    const repo = makeRepo({ findByIdWithItems: jest.fn().mockResolvedValue(summary) });
    const ctl = buildController({ repo, bypass: true });

    const res = await ctl.getById(
      getReq(`/${SALE_ID}`, { "x-user-id": "admin", "x-user-branch-id": "" }),
      SALE_ID
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.returnedQuantityBySaleItem).toEqual({ "item-A": 2, "item-C": 1 });
  });

  it("retorna {} cuando el repo no provee agregado (sin returns)", async () => {
    const summary = makeSummary("completed");
    // sin asignar returnedQuantityBySaleItem
    const repo = makeRepo({ findByIdWithItems: jest.fn().mockResolvedValue(summary) });
    const ctl = buildController({ repo, bypass: true });

    const res = await ctl.getById(
      getReq(`/${SALE_ID}`, { "x-user-id": "admin", "x-user-branch-id": "" }),
      SALE_ID
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.returnedQuantityBySaleItem).toEqual({});
  });
});

describe("SalesController.sendTicketEmail", () => {
  it("200 con override email, ignora el email del cliente", async () => {
    const ctl = buildController({ bypass: true });
    const res = await ctl.sendTicketEmail(
      postReq({ email: "otra@direccion.com" }, { "x-user-id": "admin", "x-user-branch-id": "" }),
      SALE_ID
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sentTo).toBe("otra@direccion.com");
  });

  it("400 cuando no hay email de cliente ni override", async () => {
    const ctl = buildController({ bypass: true });
    const res = await ctl.sendTicketEmail(
      postReq({}, { "x-user-id": "admin", "x-user-branch-id": "" }),
      SALE_ID
    );
    expect(res.status).toBe(400);
  });

  it("400 con email de formato inválido (Zod)", async () => {
    const ctl = buildController({ bypass: true });
    const res = await ctl.sendTicketEmail(
      postReq({ email: "not-an-email" }, { "x-user-id": "admin", "x-user-branch-id": "" }),
      SALE_ID
    );
    expect(res.status).toBe(400);
  });

  it("404 cuando la venta no existe", async () => {
    const repo = makeRepo({ findByIdWithItems: jest.fn().mockResolvedValue(null) });
    const ctl = buildController({ repo, bypass: true });
    const res = await ctl.sendTicketEmail(
      postReq({ email: "otra@direccion.com" }, { "x-user-id": "admin", "x-user-branch-id": "" }),
      SALE_ID
    );
    expect(res.status).toBe(404);
  });
});
