// Prevent Prisma instantiation: enforceBranchScope/requirePermission fall back to
// rbacContainer when no authzService is passed. ExpensesController always passes
// its own, but the mock guards against accidental initialization at import time.
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

// @react-pdf/renderer is a server-only lib; mock it for node test env
jest.mock("@react-pdf/renderer", () => ({
  renderToBuffer: jest.fn().mockResolvedValue(Buffer.from("%PDF-1.4 mock")),
  Document: ({ children }: { children: React.ReactNode }) => children,
  Page: ({ children }: { children: React.ReactNode }) => children,
  Text: ({ children }: { children: React.ReactNode }) => children,
  View: ({ children }: { children: React.ReactNode }) => children,
  StyleSheet: { create: (s: unknown) => s },
}));

// ExpensesReportPdf uses JSX which Jest node env can't parse; mock the whole module
jest.mock("@/modules/expenses/infrastructure/pdf/ExpensesReportPdf", () => ({
  ExpensesReportPdf: () => null,
}));

import { NextRequest } from "next/server";
import * as XLSX from "xlsx";
import { ExpensesController } from "@/modules/expenses/infrastructure/http/ExpensesController";
import { InMemoryExpenseRepository } from "@/modules/expenses/infrastructure/repositories/InMemoryExpenseRepository";
import { InMemoryExpensePhotoStorage } from "@/modules/expenses/infrastructure/services/InMemoryExpensePhotoStorage";
import { ListExpensesUseCase } from "@/modules/expenses/application/use-cases/ListExpensesUseCase";
import { GetExpenseUseCase } from "@/modules/expenses/application/use-cases/GetExpenseUseCase";
import { CreateExpenseUseCase } from "@/modules/expenses/application/use-cases/CreateExpenseUseCase";
import { UpdateExpenseUseCase } from "@/modules/expenses/application/use-cases/UpdateExpenseUseCase";
import { SoftDeleteExpenseUseCase } from "@/modules/expenses/application/use-cases/SoftDeleteExpenseUseCase";
import { UploadExpensePhotoUseCase } from "@/modules/expenses/application/use-cases/UploadExpensePhotoUseCase";
import { DeleteExpensePhotoUseCase } from "@/modules/expenses/application/use-cases/DeleteExpensePhotoUseCase";
import { GetExpensesReportUseCase } from "@/modules/expenses/application/use-cases/GetExpensesReportUseCase";
import { AuthorizationService } from "@/modules/rbac/application/ports/AuthorizationService";
import { GetTicketSettingsUseCase } from "@/modules/settings/application/use-cases/GetTicketSettingsUseCase";
import { InMemoryTicketSettingsRepository } from "@/modules/settings/infrastructure/repositories/InMemoryTicketSettingsRepository";

const VALID_BRANCH = "11111111-1111-1111-1111-111111111111";
const OTHER_BRANCH = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const USER_ID = "22222222-2222-2222-2222-222222222222";
const FAKE_ID = "deadbeef-dead-beef-dead-beefdeadbeef";

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
  repo?: InMemoryExpenseRepository;
  storage?: InMemoryExpensePhotoStorage;
} = {}) {
  const repo = opts.repo ?? new InMemoryExpenseRepository();
  const storage = opts.storage ?? new InMemoryExpensePhotoStorage();
  const authz = makeAuthz(opts.bypass ?? false);
  const controller = new ExpensesController(
    new ListExpensesUseCase(repo),
    new GetExpenseUseCase(repo),
    new CreateExpenseUseCase(repo),
    new UpdateExpenseUseCase(repo),
    new SoftDeleteExpenseUseCase(repo),
    new UploadExpensePhotoUseCase(repo, storage),
    new DeleteExpensePhotoUseCase(repo, storage),
    new GetExpensesReportUseCase(repo),
    authz,
    new GetTicketSettingsUseCase(new InMemoryTicketSettingsRepository())
  );
  return { controller, repo, storage };
}

function req(method: string, url: string, body?: unknown, headers: Record<string, string> = {}): NextRequest {
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
  branchId: VALID_BRANCH,
  concept: "Gasolina",
  amount: 500,
  expenseDate: "2026-09-01",
};

describe("ExpensesController.create", () => {
  it("201 happy path", async () => {
    const { controller } = buildController();
    const res = await controller.create(req("POST", "/expenses", baseCreateBody));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.concept).toBe("Gasolina");
    expect(body.isActive).toBe(true);
  });

  it("400 cuando falta concept", async () => {
    const { controller } = buildController();
    const { concept: _c, ...bodyNoConcept } = baseCreateBody;
    const res = await controller.create(req("POST", "/expenses", bodyNoConcept));
    expect(res.status).toBe(400);
  });

  it("400 cuando falta expenseDate", async () => {
    const { controller } = buildController();
    const { expenseDate: _d, ...bodyNoDate } = baseCreateBody;
    const res = await controller.create(req("POST", "/expenses", bodyNoDate));
    expect(res.status).toBe(400);
  });

  it("400 cuando amount <= 0", async () => {
    const { controller } = buildController();
    const res = await controller.create(req("POST", "/expenses", { ...baseCreateBody, amount: 0 }));
    expect(res.status).toBe(400);
  });

  it("403 cuando branchId no coincide y el caller no tiene bypass", async () => {
    const { controller } = buildController({ bypass: false });
    const res = await controller.create(req("POST", "/expenses", { ...baseCreateBody, branchId: OTHER_BRANCH }));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.required).toBe("branches:access_all");
  });

  it("201 con bypass creando en otra sucursal", async () => {
    const { controller } = buildController({ bypass: true });
    const res = await controller.create(req("POST", "/expenses", { ...baseCreateBody, branchId: OTHER_BRANCH }));
    expect(res.status).toBe(201);
  });
});

describe("ExpensesController.update", () => {
  async function seed(controller: ExpensesController) {
    const res = await controller.create(req("POST", "/expenses", baseCreateBody));
    return (await res.json()) as { id: string };
  }

  it("200 diff-only happy path", async () => {
    const { controller } = buildController();
    const created = await seed(controller);
    const res = await controller.update(req("PATCH", `/expenses/${created.id}`, { concept: "Diesel" }), created.id);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.concept).toBe("Diesel");
    expect(body.amount).toBe("500");
  });

  it("400 con body vacío", async () => {
    const { controller } = buildController();
    const created = await seed(controller);
    const res = await controller.update(req("PATCH", `/expenses/${created.id}`, {}), created.id);
    expect(res.status).toBe(400);
  });

  it("404 cuando no existe", async () => {
    const { controller } = buildController();
    const res = await controller.update(req("PATCH", `/expenses/${FAKE_ID}`, { concept: "X" }), FAKE_ID);
    expect(res.status).toBe(404);
  });

  it("400 con UUID malformado en :id", async () => {
    const { controller } = buildController();
    const res = await controller.update(req("PATCH", "/expenses/not-uuid", { concept: "X" }), "not-uuid");
    expect(res.status).toBe(400);
  });

  it("403 cuando el gasto es de otra sucursal y el caller no tiene bypass", async () => {
    const repo = new InMemoryExpenseRepository();
    const { controller: bypassCtl } = buildController({ bypass: true, repo });
    const created = await bypassCtl.create(req("POST", "/expenses", { ...baseCreateBody, branchId: OTHER_BRANCH }));
    const createdBody = await created.json();

    const { controller: noBypass } = buildController({ bypass: false, repo });
    const res = await noBypass.update(req("PATCH", `/expenses/${createdBody.id}`, { concept: "X" }), createdBody.id);
    expect(res.status).toBe(403);
  });

  it("400 cuando amount <= 0", async () => {
    const { controller } = buildController();
    const created = await seed(controller);
    const res = await controller.update(req("PATCH", `/expenses/${created.id}`, { amount: -5 }), created.id);
    expect(res.status).toBe(400);
  });
});

describe("ExpensesController.softDelete", () => {
  async function seed(controller: ExpensesController) {
    const res = await controller.create(req("POST", "/expenses", baseCreateBody));
    return (await res.json()) as { id: string };
  }

  it("204 happy path", async () => {
    const { controller } = buildController();
    const created = await seed(controller);
    const res = await controller.softDelete(req("DELETE", `/expenses/${created.id}`), created.id);
    expect(res.status).toBe(204);
  });

  it("404 al desactivar dos veces (no idempotente)", async () => {
    const { controller } = buildController();
    const created = await seed(controller);
    const first = await controller.softDelete(req("DELETE", `/expenses/${created.id}`), created.id);
    expect(first.status).toBe(204);
    const second = await controller.softDelete(req("DELETE", `/expenses/${created.id}`), created.id);
    expect(second.status).toBe(404);
  });

  it("404 cuando no existe", async () => {
    const { controller } = buildController();
    const res = await controller.softDelete(req("DELETE", `/expenses/${FAKE_ID}`), FAKE_ID);
    expect(res.status).toBe(404);
  });

  it("403 cuando el gasto es de otra sucursal y el caller no tiene bypass", async () => {
    const repo = new InMemoryExpenseRepository();
    const { controller: bypassCtl } = buildController({ bypass: true, repo });
    const created = await bypassCtl.create(req("POST", "/expenses", { ...baseCreateBody, branchId: OTHER_BRANCH }));
    const createdBody = await created.json();

    const { controller: noBypass } = buildController({ bypass: false, repo });
    const res = await noBypass.softDelete(req("DELETE", `/expenses/${createdBody.id}`), createdBody.id);
    expect(res.status).toBe(403);
  });
});

function makeFileRequest(url: string, file: Blob | null, headers: Record<string, string> = {}): NextRequest {
  const formData = new FormData();
  if (file) formData.append("file", file);
  return new NextRequest(`http://localhost${url}`, {
    method: "POST",
    body: formData,
    headers: { "x-user-id": USER_ID, "x-user-branch-id": VALID_BRANCH, ...headers },
  });
}

describe("ExpensesController.uploadPhoto", () => {
  async function seed(controller: ExpensesController) {
    const res = await controller.create(req("POST", "/expenses", baseCreateBody));
    return (await res.json()) as { id: string };
  }

  it("200 happy path con imagen válida", async () => {
    const { controller } = buildController();
    const created = await seed(controller);
    const file = new File(["x".repeat(100)], "comprobante.jpg", { type: "image/jpeg" });
    const res = await controller.uploadPhoto(makeFileRequest(`/expenses/${created.id}/photo`, file), created.id);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.photoUrl).toContain("expenses/");
  });

  it("400 con MIME no permitido", async () => {
    const { controller } = buildController();
    const created = await seed(controller);
    const file = new File(["x"], "doc.pdf", { type: "application/pdf" });
    const res = await controller.uploadPhoto(makeFileRequest(`/expenses/${created.id}/photo`, file), created.id);
    expect(res.status).toBe(400);
  });

  it("413 cuando excede 2MB", async () => {
    const { controller } = buildController();
    const created = await seed(controller);
    const big = "x".repeat(2 * 1024 * 1024 + 1);
    const file = new File([big], "big.jpg", { type: "image/jpeg" });
    const res = await controller.uploadPhoto(makeFileRequest(`/expenses/${created.id}/photo`, file), created.id);
    expect(res.status).toBe(413);
    const body = await res.json();
    expect(body.maxBytes).toBe(2 * 1024 * 1024);
  });

  it("400 cuando falta el archivo", async () => {
    const { controller } = buildController();
    const created = await seed(controller);
    const res = await controller.uploadPhoto(makeFileRequest(`/expenses/${created.id}/photo`, null), created.id);
    expect(res.status).toBe(400);
  });

  it("404 cuando el gasto no existe", async () => {
    const { controller } = buildController();
    const file = new File(["x"], "a.jpg", { type: "image/jpeg" });
    const res = await controller.uploadPhoto(makeFileRequest(`/expenses/${FAKE_ID}/photo`, file), FAKE_ID);
    expect(res.status).toBe(404);
  });

  it("403 cuando el gasto es de otra sucursal y el caller no tiene bypass", async () => {
    const repo = new InMemoryExpenseRepository();
    const { controller: bypassCtl } = buildController({ bypass: true, repo });
    const created = await bypassCtl.create(req("POST", "/expenses", { ...baseCreateBody, branchId: OTHER_BRANCH }));
    const createdBody = await created.json();

    const { controller: noBypass } = buildController({ bypass: false, repo });
    const file = new File(["x"], "a.jpg", { type: "image/jpeg" });
    const res = await noBypass.uploadPhoto(makeFileRequest(`/expenses/${createdBody.id}/photo`, file), createdBody.id);
    expect(res.status).toBe(403);
  });
});

describe("ExpensesController.deletePhoto", () => {
  async function seed(controller: ExpensesController) {
    const res = await controller.create(req("POST", "/expenses", baseCreateBody));
    return (await res.json()) as { id: string };
  }

  it("204 idempotente cuando no hay foto", async () => {
    const { controller } = buildController();
    const created = await seed(controller);
    const res = await controller.deletePhoto(req("DELETE", `/expenses/${created.id}/photo`), created.id);
    expect(res.status).toBe(204);
  });

  it("404 cuando el gasto no existe", async () => {
    const { controller } = buildController();
    const res = await controller.deletePhoto(req("DELETE", `/expenses/${FAKE_ID}/photo`), FAKE_ID);
    expect(res.status).toBe(404);
  });
});

describe("ExpensesController.list", () => {
  it("operator sin bypass es filtrado a su sucursal implícitamente", async () => {
    const { controller } = buildController();
    await controller.create(req("POST", "/expenses", baseCreateBody));
    const res = await controller.list(req("GET", "/expenses"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items.every((e: { branchId: string }) => e.branchId === VALID_BRANCH)).toBe(true);
  });

  it("operator sin bypass que pide otra sucursal → 403", async () => {
    const { controller } = buildController({ bypass: false });
    const res = await controller.list(req("GET", `/expenses?branchId=${OTHER_BRANCH}`));
    expect(res.status).toBe(403);
  });

  it("400 con pageSize > 100", async () => {
    const { controller } = buildController({ bypass: true });
    const res = await controller.list(req("GET", "/expenses?pageSize=200", undefined, { "x-user-branch-id": "" }));
    expect(res.status).toBe(400);
  });

  it("400 con filtro de fecha 'from' malformado", async () => {
    const { controller } = buildController({ bypass: true });
    const res = await controller.list(
      req("GET", "/expenses?from=not-a-date", undefined, { "x-user-branch-id": "" })
    );
    expect(res.status).toBe(400);
  });

  it("400 con filtro de fecha 'to' malformado", async () => {
    const { controller } = buildController({ bypass: true });
    const res = await controller.list(
      req("GET", "/expenses?to=31-13-2026", undefined, { "x-user-branch-id": "" })
    );
    expect(res.status).toBe(400);
  });

  it("acepta filtros from/to válidos", async () => {
    const { controller } = buildController({ bypass: true });
    const res = await controller.list(
      req("GET", "/expenses?from=2026-01-01&to=2026-12-31", undefined, { "x-user-branch-id": "" })
    );
    expect(res.status).toBe(200);
  });
});

describe("ExpensesController.report", () => {
  it("200 JSON con totales", async () => {
    const { controller } = buildController({ bypass: true });
    await controller.create(req("POST", "/expenses", baseCreateBody));
    const res = await controller.report(req("GET", "/expenses/report", undefined, { "x-user-branch-id": "" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.totals.rowCount).toBe(1);
    expect(body.totals.totalAmount).toBe("500.0000");
  });

  it("200 con xlsx válido", async () => {
    const { controller } = buildController({ bypass: true });
    await controller.create(req("POST", "/expenses", baseCreateBody));
    const res = await controller.report(
      req("GET", "/expenses/report?format=xlsx", undefined, { "x-user-branch-id": "" })
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    const buffer = Buffer.from(await res.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: "buffer" });
    expect(workbook.SheetNames).toContain("Reporte de gastos");
  });

  it("200 con pdf (buffer no vacío)", async () => {
    const { controller } = buildController({ bypass: true });
    await controller.create(req("POST", "/expenses", baseCreateBody));
    const res = await controller.report(
      req("GET", "/expenses/report?format=pdf", undefined, { "x-user-branch-id": "" })
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
  });

  it("409 ReportTooLarge cuando excede el límite en modo pdf", async () => {
    const repo = new InMemoryExpenseRepository();
    const mockRepo = {
      ...repo,
      findHistory: jest.fn().mockResolvedValue({ items: [], total: 10001, totalAmount: "0" }),
    } as unknown as InMemoryExpenseRepository;
    const { controller } = buildController({ bypass: true, repo: mockRepo });
    const res = await controller.report(
      req("GET", "/expenses/report?format=pdf", undefined, { "x-user-branch-id": "" })
    );
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe("ReportTooLarge");
    expect(body.limit).toBe(10000);
  });

  it("400 con filtro de fecha malformado", async () => {
    const { controller } = buildController({ bypass: true });
    const res = await controller.report(
      req("GET", "/expenses/report?from=garbage", undefined, { "x-user-branch-id": "" })
    );
    expect(res.status).toBe(400);
  });

  it("400 con format inválido", async () => {
    const { controller } = buildController({ bypass: true });
    const res = await controller.report(
      req("GET", "/expenses/report?format=csv", undefined, { "x-user-branch-id": "" })
    );
    expect(res.status).toBe(400);
  });
});
