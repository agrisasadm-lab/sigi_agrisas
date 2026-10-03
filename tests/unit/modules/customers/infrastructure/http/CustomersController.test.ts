import { NextRequest } from "next/server";
import { CustomersController } from "@/modules/customers/infrastructure/http/CustomersController";
import { InMemoryCustomerRepository } from "@/modules/customers/infrastructure/repositories/InMemoryCustomerRepository";
import { ListCustomersUseCase } from "@/modules/customers/application/use-cases/ListCustomersUseCase";
import { GetCustomerUseCase } from "@/modules/customers/application/use-cases/GetCustomerUseCase";
import { CreateCustomerUseCase } from "@/modules/customers/application/use-cases/CreateCustomerUseCase";
import { UpdateCustomerUseCase } from "@/modules/customers/application/use-cases/UpdateCustomerUseCase";
import { SoftDeleteCustomerUseCase } from "@/modules/customers/application/use-cases/SoftDeleteCustomerUseCase";
import { AuthorizationService } from "@/modules/rbac/application/ports/AuthorizationService";

const VALID_UUID = "11111111-1111-1111-1111-111111111111";
// Sucursal del operador "por defecto" que usan todos los tests existentes (no-bypass).
// La membresía por sucursal no rompe su comportamiento: create() fuerza branchIds=[BRANCH_ID]
// ignorando el body, y ese mismo header hace visibles los clientes creados así en getById/
// update/softDelete — el resto de la suite queda intacta.
const BRANCH_ID = "33333333-3333-3333-3333-333333333333";
const OTHER_BRANCH_ID = "44444444-4444-4444-4444-444444444444";

// "admin" es el único userId con bypass en estos tests; cualquier otro (incluido el "u1"
// por defecto de DEFAULT_HEADERS) es un operador de sucursal sin branches:access_all —
// discrimina por userId, no por un flag fijo, para poder mezclar llamadas de ambos roles
// contra el MISMO controller (crear como admin, leer como operador ajeno, etc.).
function makeAuthz(): AuthorizationService {
  return {
    userCan: jest.fn().mockImplementation(async (userId: string) => userId === "admin"),
    listUserPermissions: jest.fn().mockResolvedValue([]),
    invalidate: jest.fn(),
    invalidateByRole: jest.fn().mockResolvedValue(undefined),
  };
}

function makeController() {
  const repo = new InMemoryCustomerRepository();
  const controller = new CustomersController(
    new ListCustomersUseCase(repo),
    new GetCustomerUseCase(repo),
    new CreateCustomerUseCase(repo),
    new UpdateCustomerUseCase(repo),
    new SoftDeleteCustomerUseCase(repo),
    makeAuthz()
  );
  return { controller, repo };
}

const DEFAULT_HEADERS: Record<string, string> = { "x-user-id": "u1", "x-user-branch-id": BRANCH_ID };

function postReq(body: unknown, headers: Record<string, string> = DEFAULT_HEADERS): NextRequest {
  return new NextRequest("http://localhost/customers", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

function patchReq(body: unknown, id = VALID_UUID, headers: Record<string, string> = DEFAULT_HEADERS): NextRequest {
  return new NextRequest(`http://localhost/customers/${id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

function getReq(qs = "", headers: Record<string, string> = DEFAULT_HEADERS): NextRequest {
  return new NextRequest(`http://localhost/customers${qs}`, { headers });
}

const VALID_BODY = {
  code: "CLI001",
  name: "Acme S.A.",
  rfc: "ACM010101AAA",
};

// ────────────────────────────────────────────────────────────
// POST /customers — validación Zod
// ────────────────────────────────────────────────────────────

describe("CustomersController — POST create", () => {
  it("devuelve 201 con body mínimo válido", async () => {
    const { controller } = makeController();
    const res = await controller.create(postReq(VALID_BODY));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.code).toBe("CLI001");
    expect(body.currentBalance).toBe(0);
    expect(body.creditLimit).toBeNull();
    expect(body.creditDays).toBe(30);
  });

  it("crea con creditDays custom y lo persiste", async () => {
    const { controller } = makeController();
    const res = await controller.create(postReq({ ...VALID_BODY, creditDays: 45 }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.creditDays).toBe(45);
  });

  it("rechaza creditDays negativo → 400", async () => {
    const { controller } = makeController();
    const res = await controller.create(postReq({ ...VALID_BODY, creditDays: -5 }));
    expect(res.status).toBe(400);
  });

  it("rechaza creditDays no entero → 400", async () => {
    const { controller } = makeController();
    const res = await controller.create(postReq({ ...VALID_BODY, creditDays: 10.5 }));
    expect(res.status).toBe(400);
  });

  it("normaliza code a mayúsculas y trim antes de persistir", async () => {
    const { controller } = makeController();
    const res = await controller.create(postReq({ ...VALID_BODY, code: "  cli_001  " }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.code).toBe("CLI_001");
  });

  it("normaliza rfc a mayúsculas y trim", async () => {
    const { controller } = makeController();
    const res = await controller.create(postReq({ ...VALID_BODY, rfc: "  acm010101aaa  " }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.rfc).toBe("ACM010101AAA");
  });

  it("rechaza rfc con formato inválido → 400", async () => {
    const { controller } = makeController();
    const res = await controller.create(postReq({ ...VALID_BODY, rfc: "XXX" }));
    expect(res.status).toBe(400);
  });

  it("rechaza email malformado → 400", async () => {
    const { controller } = makeController();
    const res = await controller.create(postReq({ ...VALID_BODY, email: "not-an-email" }));
    expect(res.status).toBe(400);
  });

  it("rechaza creditLimit negativo → 400", async () => {
    const { controller } = makeController();
    const res = await controller.create(postReq({ ...VALID_BODY, creditLimit: -1 }));
    expect(res.status).toBe(400);
  });

  it("ignora currentBalance en body (siempre 0)", async () => {
    const { controller } = makeController();
    const res = await controller.create(postReq({ ...VALID_BODY, currentBalance: 9999 }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.currentBalance).toBe(0);
  });

  it("code duplicado → 409", async () => {
    const { controller } = makeController();
    await controller.create(postReq(VALID_BODY));
    const res = await controller.create(postReq({ ...VALID_BODY, rfc: "OTR010101AAA" }));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/code/i);
  });

  it("rfc duplicado → 409", async () => {
    const { controller } = makeController();
    await controller.create(postReq(VALID_BODY));
    const res = await controller.create(postReq({ code: "CLI002", name: "Otro", rfc: VALID_BODY.rfc }));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/rfc/i);
  });

  it("crea sin rfc → 201 con rfc: null", async () => {
    const { controller } = makeController();
    const res = await controller.create(postReq({ code: "CLI001", name: "Acme S.A." }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.rfc).toBeNull();
  });

  it("dos clientes sin rfc coexisten sin conflicto 409", async () => {
    const { controller } = makeController();
    const res1 = await controller.create(postReq({ code: "CLI001", name: "A" }));
    const res2 = await controller.create(postReq({ code: "CLI002", name: "B" }));
    expect(res1.status).toBe(201);
    expect(res2.status).toBe(201);
  });

  it("rechaza initialBalance negativo → 400", async () => {
    const { controller } = makeController();
    const res = await controller.create(postReq({ ...VALID_BODY, initialBalance: -100 }));
    expect(res.status).toBe(400);
  });

  it("crea con initialBalance y fija currentBalance al mismo valor", async () => {
    const { controller } = makeController();
    const res = await controller.create(postReq({ ...VALID_BODY, initialBalance: 1000 }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.initialBalance).toBe(1000);
    expect(body.currentBalance).toBe(1000);
  });

  it("body vacío → 400", async () => {
    const { controller } = makeController();
    const res = await controller.create(postReq({}));
    expect(res.status).toBe(400);
  });

  it("taxRegime con formato incorrecto → 400", async () => {
    const { controller } = makeController();
    const res = await controller.create(postReq({ ...VALID_BODY, taxRegime: "AB" }));
    expect(res.status).toBe(400);
  });

  it("cfdiUse con formato incorrecto → 400", async () => {
    const { controller } = makeController();
    const res = await controller.create(postReq({ ...VALID_BODY, cfdiUse: "123" }));
    expect(res.status).toBe(400);
  });

  it("cfdiUse de 4 caracteres (CP01) es aceptado", async () => {
    const { controller } = makeController();
    const res = await controller.create(postReq({ ...VALID_BODY, cfdiUse: "CP01" }));
    expect(res.status).toBe(201);
  });

  it("taxZipCode con formato incorrecto → 400", async () => {
    const { controller } = makeController();
    const res = await controller.create(postReq({ ...VALID_BODY, taxZipCode: "1234" }));
    expect(res.status).toBe(400);
  });

  it("crea con dirección estructurada completa y default addressCountry=MEX si no se envía", async () => {
    const { controller } = makeController();
    const res = await controller.create(
      postReq({
        ...VALID_BODY,
        addressStreet: "Av. Reforma",
        addressExteriorNumber: "123",
        addressNeighborhood: "Centro",
        addressMunicipality: "Cuauhtémoc",
        addressState: "CMX",
        addressZipCode: "06000",
      })
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.addressStreet).toBe("Av. Reforma");
    expect(body.addressCountry).toBe("MEX");
  });

  it("addressState con formato incorrecto → 400", async () => {
    const { controller } = makeController();
    const res = await controller.create(postReq({ ...VALID_BODY, addressState: "cmx" }));
    expect(res.status).toBe(400);
  });

  it("addressZipCode con formato incorrecto → 400", async () => {
    const { controller } = makeController();
    const res = await controller.create(postReq({ ...VALID_BODY, addressZipCode: "123" }));
    expect(res.status).toBe(400);
  });
});

// ────────────────────────────────────────────────────────────
// GET /customers — validación de query params
// ────────────────────────────────────────────────────────────

describe("CustomersController — GET list", () => {
  it("devuelve 200 con lista vacía por defecto", async () => {
    const { controller } = makeController();
    const res = await controller.list(getReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(0);
    expect(body.total).toBe(0);
  });

  it("pageSize > 100 → 400", async () => {
    const { controller } = makeController();
    const res = await controller.list(getReq("?pageSize=200"));
    expect(res.status).toBe(400);
  });

  it("search con 1 carácter → 400", async () => {
    const { controller } = makeController();
    const res = await controller.list(getReq("?search=a"));
    expect(res.status).toBe(400);
  });

  it("search con 2 caracteres → 200", async () => {
    const { controller } = makeController();
    const res = await controller.list(getReq("?search=ac"));
    expect(res.status).toBe(200);
  });
});

// ────────────────────────────────────────────────────────────
// GET /customers/:id
// ────────────────────────────────────────────────────────────

describe("CustomersController — GET by ID", () => {
  it("id no UUID → 400", async () => {
    const { controller } = makeController();
    const res = await controller.getById(getReq(), "not-a-uuid");
    expect(res.status).toBe(400);
  });

  it("cliente no encontrado → 404", async () => {
    const { controller } = makeController();
    const res = await controller.getById(getReq(), VALID_UUID);
    expect(res.status).toBe(404);
  });

  it("cliente encontrado → 200", async () => {
    const { controller } = makeController();
    const createRes = await controller.create(postReq(VALID_BODY));
    const created = await createRes.json();
    const res = await controller.getById(getReq(), created.id);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.code).toBe("CLI001");
  });
});

// ────────────────────────────────────────────────────────────
// PATCH /customers/:id — validación
// ────────────────────────────────────────────────────────────

describe("CustomersController — PATCH update", () => {
  it("body vacío → 400", async () => {
    const { controller } = makeController();
    const res = await controller.update(patchReq({}), VALID_UUID);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/at least one/i);
  });

  it("id no UUID → 400", async () => {
    const { controller } = makeController();
    const res = await controller.update(patchReq({ name: "X" }), "bad-id");
    expect(res.status).toBe(400);
  });

  it("cliente no encontrado → 404", async () => {
    const { controller } = makeController();
    const res = await controller.update(patchReq({ name: "Nuevo Nombre" }), VALID_UUID);
    expect(res.status).toBe(404);
  });

  it("ignora code y currentBalance en body", async () => {
    const { controller } = makeController();
    const createRes = await controller.create(postReq(VALID_BODY));
    const created = await createRes.json();
    const res = await controller.update(
      patchReq({ code: "HACKED", currentBalance: 99999, name: "Nombre Nuevo" }),
      created.id
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.code).toBe("CLI001");
    expect(body.currentBalance).toBe(0);
    expect(body.name).toBe("Nombre Nuevo");
  });

  it("rfc duplicado en update → 409", async () => {
    const { controller } = makeController();
    await controller.create(postReq(VALID_BODY));
    const res2 = await controller.create(postReq({ code: "CLI002", name: "Otro", rfc: "OTR010101AAA" }));
    const second = await res2.json();
    const res = await controller.update(patchReq({ rfc: VALID_BODY.rfc }), second.id);
    expect(res.status).toBe(409);
  });

  it("email inválido en update → 400", async () => {
    const { controller } = makeController();
    const createRes = await controller.create(postReq(VALID_BODY));
    const created = await createRes.json();
    const res = await controller.update(patchReq({ email: "not-email" }), created.id);
    expect(res.status).toBe(400);
  });

  it("creditLimit negativo en update → 400", async () => {
    const { controller } = makeController();
    const createRes = await controller.create(postReq(VALID_BODY));
    const created = await createRes.json();
    const res = await controller.update(patchReq({ creditLimit: -500 }), created.id);
    expect(res.status).toBe(400);
  });

  it("creditDays como único campo actualiza y no falla por 'al menos un campo'", async () => {
    const { controller } = makeController();
    const createRes = await controller.create(postReq(VALID_BODY));
    const created = await createRes.json();
    const res = await controller.update(patchReq({ creditDays: 60 }), created.id);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.creditDays).toBe(60);
  });

  it("initialBalance como único campo en update ajusta currentBalance por delta", async () => {
    const { controller } = makeController();
    const createRes = await controller.create(postReq({ ...VALID_BODY, initialBalance: 1000 }));
    const created = await createRes.json();
    const res = await controller.update(patchReq({ initialBalance: 1300 }), created.id);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.initialBalance).toBe(1300);
    expect(body.currentBalance).toBe(1300);
  });

  it("initialBalance negativo en update → 400", async () => {
    const { controller } = makeController();
    const createRes = await controller.create(postReq(VALID_BODY));
    const created = await createRes.json();
    const res = await controller.update(patchReq({ initialBalance: -100 }), created.id);
    expect(res.status).toBe(400);
  });

  it("creditDays negativo en update → 400", async () => {
    const { controller } = makeController();
    const createRes = await controller.create(postReq(VALID_BODY));
    const created = await createRes.json();
    const res = await controller.update(patchReq({ creditDays: -1 }), created.id);
    expect(res.status).toBe(400);
  });

  it("addressZipCode como único campo actualiza y no falla por 'al menos un campo'", async () => {
    const { controller } = makeController();
    const createRes = await controller.create(postReq(VALID_BODY));
    const created = await createRes.json();
    const res = await controller.update(patchReq({ addressZipCode: "06000" }), created.id);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.addressZipCode).toBe("06000");
  });

  it("addressStreet nulo en update lo limpia", async () => {
    const { controller } = makeController();
    const createRes = await controller.create(postReq({ ...VALID_BODY, addressStreet: "Av. Reforma" }));
    const created = await createRes.json();
    const res = await controller.update(patchReq({ addressStreet: null }), created.id);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.addressStreet).toBeNull();
  });

  it("addressState con formato incorrecto en update → 400", async () => {
    const { controller } = makeController();
    const createRes = await controller.create(postReq(VALID_BODY));
    const created = await createRes.json();
    const res = await controller.update(patchReq({ addressState: "cmx" }), created.id);
    expect(res.status).toBe(400);
  });
});

// ────────────────────────────────────────────────────────────
// DELETE /customers/:id
// ────────────────────────────────────────────────────────────

describe("CustomersController — DELETE soft delete", () => {
  it("id no UUID → 400", async () => {
    const { controller } = makeController();
    const res = await controller.softDelete(getReq(), "not-a-uuid");
    expect(res.status).toBe(400);
  });

  it("cliente no encontrado → 404", async () => {
    const { controller } = makeController();
    const res = await controller.softDelete(getReq(), VALID_UUID);
    expect(res.status).toBe(404);
  });

  it("soft delete exitoso → 204", async () => {
    const { controller } = makeController();
    const createRes = await controller.create(postReq(VALID_BODY));
    const created = await createRes.json();
    const res = await controller.softDelete(getReq(), created.id);
    expect(res.status).toBe(204);
  });

  it("después de soft delete, isActive=false (reactivable vía PATCH)", async () => {
    const { controller } = makeController();
    const createRes = await controller.create(postReq(VALID_BODY));
    const created = await createRes.json();
    await controller.softDelete(getReq(), created.id);
    const reactivate = await controller.update(patchReq({ isActive: true }), created.id);
    expect(reactivate.status).toBe(200);
    const body = await reactivate.json();
    expect(body.isActive).toBe(true);
  });
});

// ────────────────────────────────────────────────────────────
// Branch scoping (membresía por sucursal)
// ────────────────────────────────────────────────────────────

describe("CustomersController — branch scoping", () => {
  it("no-bypass: create fuerza branchIds a la sucursal propia, ignorando el body", async () => {
    const { controller } = makeController();
    const res = await controller.create(postReq({ ...VALID_BODY, branchIds: [OTHER_BRANCH_ID] }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.branchIds).toEqual([BRANCH_ID]);
  });

  it("no-bypass: list se filtra implícitamente a la sucursal propia", async () => {
    const { controller } = makeController();
    await controller.create(postReq(VALID_BODY));
    const res = await controller.list(getReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(1);
  });

  it("bypass: create sin branchIds → 400", async () => {
    const { controller } = makeController();
    const res = await controller.create(postReq(VALID_BODY, { "x-user-id": "admin" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/branchIds/i);
  });

  it("bypass: create con branchIds los persiste tal cual", async () => {
    const { controller } = makeController();
    const res = await controller.create(
      postReq({ ...VALID_BODY, branchIds: [BRANCH_ID, OTHER_BRANCH_ID] }, { "x-user-id": "admin" })
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.branchIds.sort()).toEqual([BRANCH_ID, OTHER_BRANCH_ID].sort());
  });

  it("getById de un cliente ajeno (sin bypass) → 403, no revela 404", async () => {
    const { controller } = makeController();
    const createRes = await controller.create(
      postReq({ ...VALID_BODY, branchIds: [OTHER_BRANCH_ID] }, { "x-user-id": "admin" })
    );
    const created = await createRes.json();

    const res = await controller.getById(getReq("", DEFAULT_HEADERS), created.id);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.required).toBe("branches:access_all");
  });

  it("update de un cliente ajeno (sin bypass) → 403", async () => {
    const { controller } = makeController();
    const createRes = await controller.create(
      postReq({ ...VALID_BODY, branchIds: [OTHER_BRANCH_ID] }, { "x-user-id": "admin" })
    );
    const created = await createRes.json();

    const res = await controller.update(patchReq({ name: "Hackeado" }, created.id, DEFAULT_HEADERS), created.id);
    expect(res.status).toBe(403);
  });

  it("softDelete de un cliente ajeno (sin bypass) → 403", async () => {
    const { controller } = makeController();
    const createRes = await controller.create(
      postReq({ ...VALID_BODY, branchIds: [OTHER_BRANCH_ID] }, { "x-user-id": "admin" })
    );
    const created = await createRes.json();

    const res = await controller.softDelete(getReq("", DEFAULT_HEADERS), created.id);
    expect(res.status).toBe(403);
  });

  it("bypass: update reemplaza el set completo de branchIds", async () => {
    const { controller } = makeController();
    const createRes = await controller.create(
      postReq({ ...VALID_BODY, branchIds: [BRANCH_ID] }, { "x-user-id": "admin" })
    );
    const created = await createRes.json();

    const res = await controller.update(
      patchReq({ branchIds: [OTHER_BRANCH_ID] }, created.id, { "x-user-id": "admin" }),
      created.id
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.branchIds).toEqual([OTHER_BRANCH_ID]);
  });

  it("bypass: update con branchIds vacío → 400", async () => {
    const { controller } = makeController();
    const createRes = await controller.create(
      postReq({ ...VALID_BODY, branchIds: [BRANCH_ID] }, { "x-user-id": "admin" })
    );
    const created = await createRes.json();

    const res = await controller.update(
      patchReq({ branchIds: [] }, created.id, { "x-user-id": "admin" }),
      created.id
    );
    expect(res.status).toBe(400);
  });

  it("no-bypass: operador que envía branchIds en update no cambia nada (se ignora, igual que code)", async () => {
    const { controller } = makeController();
    const createRes = await controller.create(postReq(VALID_BODY));
    const created = await createRes.json();

    const res = await controller.update(patchReq({ branchIds: [OTHER_BRANCH_ID], name: "Actualizado" }), created.id);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.branchIds).toEqual([BRANCH_ID]);
    expect(body.name).toBe("Actualizado");
  });
});
