// Prevent Prisma instantiation: enforceBranchScope falls back to rbacContainer
// when no authzService is passed. ReturnsController always passes its own, but
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
import { ReturnsController } from "@/modules/returns/infrastructure/http/ReturnsController";
import { ListReturnsUseCase } from "@/modules/returns/application/use-cases/ListReturnsUseCase";
import { GetReturnUseCase } from "@/modules/returns/application/use-cases/GetReturnUseCase";
import { ListReturnsBySaleUseCase } from "@/modules/returns/application/use-cases/ListReturnsBySaleUseCase";
import { CreateReturnUseCase } from "@/modules/returns/application/use-cases/CreateReturnUseCase";
import { CancelReturnUseCase } from "@/modules/returns/application/use-cases/CancelReturnUseCase";
import { InMemoryReturnRepository } from "@/modules/returns/infrastructure/repositories/InMemoryReturnRepository";
import { Sale } from "@/modules/pos/domain/entities/Sale";
import { SaleItem } from "@/modules/pos/domain/entities/SaleItem";
import { SaleRepository, SaleSummary } from "@/modules/pos/application/ports/SaleRepository";
import { AuthorizationService } from "@/modules/rbac/application/ports/AuthorizationService";
import { SaleStatus } from "@/modules/pos/domain/entities/Sale";

const VALID_BRANCH = "11111111-1111-1111-1111-111111111111";
const OTHER_BRANCH = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const CUSTOMER_ID = "22222222-2222-2222-2222-222222222222";
const SALE_ID = "33333333-3333-3333-3333-333333333333";
const SALE_ITEM_ID = "44444444-4444-4444-4444-444444444444";
const PRODUCT_ID = "55555555-5555-5555-5555-555555555555";
const PRICE_ID = "66666666-6666-6666-6666-666666666666";
const USER_ID = "00000000-0000-0000-0000-000000000001";
const OTHER_SALE_ID = "77777777-7777-7777-7777-777777777777";
const RETURN_ID_FAKE = "deadbeef-dead-beef-dead-beefdeadbeef";

const NOW = new Date("2026-06-01T10:00:00Z");
const RETURNED_AT_ISO = "2026-06-01T11:00:00Z";

function makeSaleItem(overrides: Partial<{ id: string; quantity: number }> = {}): SaleItem {
  return SaleItem.create({
    id: overrides.id ?? SALE_ITEM_ID,
    saleId: SALE_ID,
    productId: PRODUCT_ID,
    productPriceId: PRICE_ID,
    dosificationId: null,
    numPartsSnapshot: null,
    productCodeSnapshot: "PROD001",
    productNameSnapshot: "Producto Test",
    priceNameSnapshot: "Base",
    quantity: overrides.quantity ?? 10,
    unitPrice: 100,
    discountPct: null,
    discountAmount: 0,
    ivaRate: 0.16,
    iepsRate: null,
    lineSubtotal: 1000,
    lineTax: 160,
    lineTotal: 1160,
  });
}

function makeSaleSummary(opts: {
  id?: string;
  branchId?: string;
  status?: SaleStatus;
  items?: SaleItem[];
} = {}): SaleSummary {
  const items = opts.items ?? [makeSaleItem()];
  return {
    sale: Sale.create({
      id: opts.id ?? SALE_ID,
      folioId: "f1",
      folioNumber: 1,
      folioCode: "F-1",
      branchId: opts.branchId ?? VALID_BRANCH,
      customerId: CUSTOMER_ID,
      cashierId: USER_ID,
      paymentMethodId: "pm-1",
      quoteId: null,
      status: opts.status ?? "completed",
      paidAmount: 1160,
      paymentStatus: "paid",
      subtotal: 1000,
      taxTotal: 160,
      total: 1160,
      notes: null,
      completedAt: NOW,
      cancelledAt: opts.status === "cancelled" ? NOW : null,
      cancellationReason: null,
      editedAt: opts.status === "edited" ? NOW : null,
      createdAt: NOW,
      updatedAt: NOW,
      items,
    }),
    joined: { branchName: null, customerName: null, customerRfc: null, customerAddress: null, customerCreditDays: null, cashierName: null, paymentMethodCode: null, paymentMethodName: null, paymentMethodIsCredit: false },
  };
}

function makeSaleRepo(summary: SaleSummary | null = makeSaleSummary()): SaleRepository {
  return {
    findAll: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    findByIdWithItems: jest.fn().mockResolvedValue(summary),
    findByClientRequestId: jest.fn().mockResolvedValue(null),
    createCompleted: jest.fn(),
    createCompletedFromQuote: jest.fn(),
    cancel: jest.fn(),
    replaceItemsAndRecalculate: jest.fn(),
    markReturnedTotal: jest.fn().mockResolvedValue(undefined),
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

function buildController(opts: {
  bypass?: boolean;
  returnRepo?: InMemoryReturnRepository;
  saleRepo?: SaleRepository;
} = {}) {
  const returnRepo = opts.returnRepo ?? new InMemoryReturnRepository();
  const saleRepo = opts.saleRepo ?? makeSaleRepo();
  const controller = new ReturnsController(
    new ListReturnsUseCase(returnRepo),
    new GetReturnUseCase(returnRepo),
    new ListReturnsBySaleUseCase(returnRepo),
    new CreateReturnUseCase(returnRepo, saleRepo),
    new CancelReturnUseCase(returnRepo),
    saleRepo,
    makeAuthz(opts.bypass ?? false),
    returnRepo
  );
  return { controller, returnRepo, saleRepo };
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
      "x-user-branch-id": VALID_BRANCH,
      ...headers,
    },
  });
}

const baseCreateBody = {
  saleId: SALE_ID,
  reason: "Producto en mal estado",
  returnedAt: RETURNED_AT_ISO,
  items: [{ saleItemId: SALE_ITEM_ID, quantity: 2 }],
};

describe("ReturnsController.create", () => {
  it("400 con saleId UUID malformado", async () => {
    const { controller } = buildController();
    const res = await controller.create(req("POST", "/returns", { ...baseCreateBody, saleId: "not-uuid" }));
    expect(res.status).toBe(400);
  });

  it("400 con items vacío", async () => {
    const { controller } = buildController();
    const res = await controller.create(req("POST", "/returns", { ...baseCreateBody, items: [] }));
    expect(res.status).toBe(400);
  });

  it("400 con quantity negativa", async () => {
    const { controller } = buildController();
    const res = await controller.create(
      req("POST", "/returns", { ...baseCreateBody, items: [{ saleItemId: SALE_ITEM_ID, quantity: -1 }] })
    );
    expect(res.status).toBe(400);
  });

  it("400 con reason menor a 3 chars", async () => {
    const { controller } = buildController();
    const res = await controller.create(req("POST", "/returns", { ...baseCreateBody, reason: "ab" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("ReturnReasonRequired");
  });

  it("400 cuando reason está ausente", async () => {
    const { controller } = buildController();
    const { reason: _r, ...bodyNoReason } = baseCreateBody;
    const res = await controller.create(req("POST", "/returns", bodyNoReason));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("ReturnReasonRequired");
  });

  it("400 cuando reason es solo whitespace", async () => {
    const { controller } = buildController();
    const res = await controller.create(req("POST", "/returns", { ...baseCreateBody, reason: "   " }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("ReturnReasonRequired");
  });

  it("201 cuando reason tiene exactamente 500 chars", async () => {
    const { controller } = buildController({ bypass: true });
    const longReason = "a".repeat(500);
    const res = await controller.create(req("POST", "/returns", { ...baseCreateBody, reason: longReason }));
    expect(res.status).toBe(201);
  });

  it("400 cuando reason excede 500 chars", async () => {
    const { controller } = buildController();
    const tooLong = "a".repeat(501);
    const res = await controller.create(req("POST", "/returns", { ...baseCreateBody, reason: tooLong }));
    expect(res.status).toBe(400);
  });

  it("400 con returnedAt malformado", async () => {
    const { controller } = buildController();
    const res = await controller.create(req("POST", "/returns", { ...baseCreateBody, returnedAt: "no-fecha" }));
    expect(res.status).toBe(400);
  });

  it("400 con returnedAt en el futuro", async () => {
    const { controller } = buildController();
    const future = new Date(Date.now() + 7 * 86400000).toISOString();
    const res = await controller.create(req("POST", "/returns", { ...baseCreateBody, returnedAt: future }));
    expect(res.status).toBe(400);
  });

  it("403 cuando la sucursal de la venta no coincide y el caller no tiene bypass", async () => {
    const sale = makeSaleSummary({ branchId: OTHER_BRANCH });
    const { controller } = buildController({ bypass: false, saleRepo: makeSaleRepo(sale) });
    const res = await controller.create(req("POST", "/returns", baseCreateBody));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.required).toBe("branches:access_all");
  });

  it("400 cuando la venta no existe", async () => {
    const { controller } = buildController({ saleRepo: makeSaleRepo(null) });
    const res = await controller.create(req("POST", "/returns", baseCreateBody));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/sale not found/i);
  });

  it("409 con sale cancelled — body trae el status", async () => {
    const sale = makeSaleSummary({ status: "cancelled" });
    const { controller } = buildController({ saleRepo: makeSaleRepo(sale) });
    const res = await controller.create(req("POST", "/returns", baseCreateBody));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.status).toBe("cancelled");
  });

  it("409 con sale edited — body trae el status", async () => {
    const sale = makeSaleSummary({ status: "edited" });
    const { controller } = buildController({ saleRepo: makeSaleRepo(sale) });
    const res = await controller.create(req("POST", "/returns", baseCreateBody));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.status).toBe("edited");
  });

  it("400 con saleItemId de otra venta — body trae saleItemId", async () => {
    const { controller } = buildController();
    const FOREIGN_ITEM = "88888888-8888-8888-8888-888888888888";
    const res = await controller.create(
      req("POST", "/returns", { ...baseCreateBody, items: [{ saleItemId: FOREIGN_ITEM, quantity: 1 }] })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.saleItemId).toBe(FOREIGN_ITEM);
  });

  it("422 cuando quantity excede remaining — body trae saleItemId/requested/remaining", async () => {
    const { controller } = buildController();
    const res = await controller.create(
      req("POST", "/returns", { ...baseCreateBody, items: [{ saleItemId: SALE_ITEM_ID, quantity: 15 }] })
    );
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.saleItemId).toBe(SALE_ITEM_ID);
    expect(body.requested).toBe(15);
    expect(body.remaining).toBe(10);
  });

  it("201 happy path — devuelve detalle con items", async () => {
    const { controller } = buildController();
    const res = await controller.create(req("POST", "/returns", baseCreateBody));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.status).toBe("completed");
    expect(body.items).toHaveLength(1);
    expect(body.items[0].quantity).toBe(2);
    expect(body.branchId).toBe(VALID_BRANCH);
  });

  it("ignora branchId/customerId del body (no figuran en el schema)", async () => {
    const { controller, returnRepo } = buildController();
    const res = await controller.create(
      req("POST", "/returns", { ...baseCreateBody, branchId: OTHER_BRANCH, customerId: "ignored" })
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    // El branchId persistido viene del sale, no del body
    expect(body.branchId).toBe(VALID_BRANCH);
    expect(returnRepo).toBeDefined();
  });
});

describe("ReturnsController.cancel", () => {
  async function seedReturn(controller: ReturnsController) {
    const res = await controller.create(req("POST", "/returns", baseCreateBody));
    expect(res.status).toBe(201);
    return (await res.json()) as { id: string; branchId: string };
  }

  it("200 happy path", async () => {
    const { controller } = buildController();
    const created = await seedReturn(controller);
    const res = await controller.cancel(
      req("POST", `/returns/${created.id}/cancel`, { reason: "Registrada por error" }),
      created.id
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("cancelled");
    expect(body.cancellationReason).toBe("Registrada por error");
  });

  it("409 al cancelar dos veces", async () => {
    const { controller } = buildController();
    const created = await seedReturn(controller);
    const first = await controller.cancel(req("POST", `/returns/${created.id}/cancel`, {}), created.id);
    expect(first.status).toBe(200);
    const second = await controller.cancel(req("POST", `/returns/${created.id}/cancel`, {}), created.id);
    expect(second.status).toBe(409);
  });

  it("404 cuando no existe", async () => {
    const { controller } = buildController();
    const res = await controller.cancel(req("POST", `/returns/${RETURN_ID_FAKE}/cancel`, {}), RETURN_ID_FAKE);
    expect(res.status).toBe(404);
  });

  it("400 con UUID malformado en :id", async () => {
    const { controller } = buildController();
    const res = await controller.cancel(req("POST", "/returns/not-uuid/cancel", {}), "not-uuid");
    expect(res.status).toBe(400);
  });

  it("403 cuando la devolución es de otra sucursal y el caller no tiene bypass", async () => {
    // Sembramos con bypass para crear contra OTHER_BRANCH
    const sale = makeSaleSummary({ branchId: OTHER_BRANCH });
    const saleRepo = makeSaleRepo(sale);
    const returnRepo = new InMemoryReturnRepository();
    const { controller: bypassCtl } = buildController({ bypass: true, returnRepo, saleRepo });
    const created = await bypassCtl.create(req("POST", "/returns", baseCreateBody));
    expect(created.status).toBe(201);
    const createdBody = await created.json();

    // Ahora intentamos cancelar con un controller sin bypass (mismo repo)
    const { controller: noBypass } = buildController({ bypass: false, returnRepo, saleRepo });
    const res = await noBypass.cancel(req("POST", `/returns/${createdBody.id}/cancel`, {}), createdBody.id);
    expect(res.status).toBe(403);
  });
});

describe("ReturnsController.list", () => {
  it("operator sin bypass es filtrado a su sucursal implícitamente", async () => {
    const { controller, returnRepo } = buildController();
    // Sembrar una devolución en BRANCH_ID via create
    await controller.create(req("POST", "/returns", baseCreateBody));
    const res = await controller.list(req("GET", "/returns"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items.every((r: { branchId: string }) => r.branchId === VALID_BRANCH)).toBe(true);
    expect(returnRepo).toBeDefined();
  });

  it("operator sin bypass que pide otra sucursal → 403", async () => {
    const { controller } = buildController({ bypass: false });
    const res = await controller.list(req("GET", `/returns?branchId=${OTHER_BRANCH}`));
    expect(res.status).toBe(403);
  });

  it("operator sin branch asignada y sin bypass → 403", async () => {
    const { controller } = buildController({ bypass: false });
    const r = req("GET", "/returns", undefined, { "x-user-branch-id": "" });
    const res = await controller.list(r);
    expect(res.status).toBe(403);
  });

  it("admin con bypass sin ?branchId= → 200", async () => {
    const { controller } = buildController({ bypass: true });
    const res = await controller.list(req("GET", "/returns", undefined, { "x-user-branch-id": "" }));
    expect(res.status).toBe(200);
  });

  it("400 con pageSize > 100", async () => {
    const { controller } = buildController({ bypass: true });
    const res = await controller.list(req("GET", "/returns?pageSize=200"));
    expect(res.status).toBe(400);
  });

  it("400 con search más corto que 2 chars", async () => {
    const { controller } = buildController({ bypass: true });
    const res = await controller.list(req("GET", "/returns?search=x"));
    expect(res.status).toBe(400);
  });

  it("acepta filtros saleId/status/from/to (no fallan validación)", async () => {
    const { controller } = buildController({ bypass: true });
    const res = await controller.list(
      req(
        "GET",
        `/returns?saleId=${SALE_ID}&status=completed,cancelled&from=2026-01-01T00:00:00Z&to=2026-12-31T23:59:59Z`,
        undefined,
        { "x-user-branch-id": "" }
      )
    );
    expect(res.status).toBe(200);
  });
});

describe("ReturnsController.getById", () => {
  async function seedReturn(controller: ReturnsController) {
    const res = await controller.create(req("POST", "/returns", baseCreateBody));
    return (await res.json()) as { id: string };
  }

  it("200 con items", async () => {
    const { controller } = buildController();
    const created = await seedReturn(controller);
    const res = await controller.getById(req("GET", `/returns/${created.id}`), created.id);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(created.id);
    expect(body.items).toHaveLength(1);
  });

  it("404 cuando no existe (sin existence-leak: 404 antes que 403)", async () => {
    const { controller } = buildController({ bypass: false });
    const res = await controller.getById(req("GET", `/returns/${RETURN_ID_FAKE}`), RETURN_ID_FAKE);
    expect(res.status).toBe(404);
  });

  it("400 con UUID malformado", async () => {
    const { controller } = buildController();
    const res = await controller.getById(req("GET", "/returns/not-uuid"), "not-uuid");
    expect(res.status).toBe(400);
  });

  it("403 cuando la devolución es de otra sucursal y el caller no tiene bypass", async () => {
    const sale = makeSaleSummary({ branchId: OTHER_BRANCH });
    const saleRepo = makeSaleRepo(sale);
    const returnRepo = new InMemoryReturnRepository();
    const { controller: bypassCtl } = buildController({ bypass: true, returnRepo, saleRepo });
    const created = await bypassCtl.create(req("POST", "/returns", baseCreateBody));
    const createdBody = await created.json();

    const { controller: noBypass } = buildController({ bypass: false, returnRepo, saleRepo });
    const res = await noBypass.getById(req("GET", `/returns/${createdBody.id}`), createdBody.id);
    expect(res.status).toBe(403);
  });
});

describe("ReturnsController.listBySale", () => {
  async function seedReturn(controller: ReturnsController) {
    const res = await controller.create(req("POST", "/returns", baseCreateBody));
    return (await res.json()) as { id: string };
  }

  it("200 con array (completed + cancelled juntos)", async () => {
    const { controller } = buildController();
    const first = await seedReturn(controller);
    await controller.cancel(req("POST", `/returns/${first.id}/cancel`, {}), first.id);
    // Una segunda devolución viva con el espacio liberado
    const second = await controller.create(req("POST", "/returns", baseCreateBody));
    expect(second.status).toBe(201);

    const res = await controller.listBySale(req("GET", `/sales/${SALE_ID}/returns`), SALE_ID);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.returns)).toBe(true);
    expect(body.returns).toHaveLength(2);
    const statuses = body.returns.map((r: { status: string }) => r.status).sort();
    expect(statuses).toEqual(["cancelled", "completed"]);
  });

  it("200 con array vacío cuando no hay devoluciones", async () => {
    const { controller } = buildController();
    const res = await controller.listBySale(req("GET", `/sales/${SALE_ID}/returns`), SALE_ID);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ returns: [] });
  });

  it("404 cuando la sale no existe", async () => {
    const { controller } = buildController({ saleRepo: makeSaleRepo(null) });
    const res = await controller.listBySale(req("GET", `/sales/${OTHER_SALE_ID}/returns`), OTHER_SALE_ID);
    expect(res.status).toBe(404);
  });

  it("403 cuando la sale es de otra sucursal y el caller no tiene bypass", async () => {
    const sale = makeSaleSummary({ branchId: OTHER_BRANCH });
    const { controller } = buildController({ bypass: false, saleRepo: makeSaleRepo(sale) });
    const res = await controller.listBySale(req("GET", `/sales/${SALE_ID}/returns`), SALE_ID);
    expect(res.status).toBe(403);
  });

  it("400 con UUID malformado en :id", async () => {
    const { controller } = buildController();
    const res = await controller.listBySale(req("GET", "/sales/not-uuid/returns"), "not-uuid");
    expect(res.status).toBe(400);
  });
});

describe("ReturnsController.fullReturn", () => {
  const FULL_RETURN_BODY = {
    reason: "Devolución completa del ticket",
    returnedAt: "2026-06-01T10:00:00Z",
  };

  it("201 y pasa markSaleReturnedTotalId al repo para atomizar la transición de estado", async () => {
    const returnRepo = new InMemoryReturnRepository();
    const createWithItemsSpy = jest.spyOn(returnRepo, "createWithItems");
    const { controller } = buildController({ returnRepo, bypass: true });
    const res = await controller.fullReturn(
      req("POST", `/sales/${SALE_ID}/full-return`, FULL_RETURN_BODY),
      SALE_ID
    );
    expect(res.status).toBe(201);
    expect(createWithItemsSpy).toHaveBeenCalledWith(
      expect.objectContaining({ markSaleReturnedTotalId: SALE_ID })
    );
  });

  it("409 SaleAlreadyFullyReturned cuando sale ya está en returned_total", async () => {
    const saleRepo = makeSaleRepo(makeSaleSummary({ status: "returned_total" }));
    const { controller } = buildController({ saleRepo, bypass: true });
    const res = await controller.fullReturn(
      req("POST", `/sales/${SALE_ID}/full-return`, FULL_RETURN_BODY),
      SALE_ID
    );
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe("SaleAlreadyFullyReturned");
  });
});
