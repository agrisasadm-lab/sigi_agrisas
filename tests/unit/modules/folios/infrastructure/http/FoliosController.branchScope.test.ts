import { NextRequest } from "next/server";
import { FoliosController } from "@/modules/folios/infrastructure/http/FoliosController";
import { InMemoryFolioRepository } from "@/modules/folios/infrastructure/repositories/InMemoryFolioRepository";
import { ListFoliosUseCase } from "@/modules/folios/application/use-cases/ListFoliosUseCase";
import { GetFolioUseCase } from "@/modules/folios/application/use-cases/GetFolioUseCase";
import { CreateFolioUseCase } from "@/modules/folios/application/use-cases/CreateFolioUseCase";
import { UpdateFolioUseCase } from "@/modules/folios/application/use-cases/UpdateFolioUseCase";
import { SoftDeleteFolioUseCase } from "@/modules/folios/application/use-cases/SoftDeleteFolioUseCase";
import { AuditFolioSequenceUseCase } from "@/modules/folios/application/use-cases/AuditFolioSequenceUseCase";
import { Folio } from "@/modules/folios/domain/entities/Folio";
import { AuthorizationService } from "@/modules/rbac/application/ports/AuthorizationService";

const ZARIOZ = "33333333-3333-3333-3333-333333333333";
const PRADERA = "44444444-4444-4444-4444-444444444444";
const FOLIO_TK = "11111111-1111-1111-1111-111111111111";

function makeAuthz(): AuthorizationService {
  return {
    userCan: jest.fn().mockImplementation(async (userId: string) => userId === "admin"),
    listUserPermissions: jest.fn().mockResolvedValue([]),
    invalidate: jest.fn(),
    invalidateByRole: jest.fn().mockResolvedValue(undefined),
  };
}

function makeFolio(id: string, code: string, prefix: string | null): Folio {
  const now = new Date();
  return Folio.create(id, { code, name: `Folio ${code}`, prefix, scope: "POS", currentNumber: 0, isActive: true, createdAt: now, updatedAt: now });
}

function makeController() {
  const repo = new InMemoryFolioRepository();
  repo.seed([makeFolio(FOLIO_TK, "TK", "TK-")]);
  repo.seedBranch(ZARIOZ, "ZARIOZ");
  repo.seedBranch(PRADERA, "PRADERA");
  repo.seedBranchCounter(FOLIO_TK, ZARIOZ, 5);
  const controller = new FoliosController(
    new ListFoliosUseCase(repo),
    new GetFolioUseCase(repo),
    new CreateFolioUseCase(repo),
    new UpdateFolioUseCase(repo),
    new SoftDeleteFolioUseCase(repo),
    new AuditFolioSequenceUseCase(repo),
    makeAuthz()
  );
  return { controller, repo };
}

function getReq(qs: string, headers: Record<string, string>): NextRequest {
  return new NextRequest(`http://localhost/folios${qs}`, { headers });
}

const OPERATOR_ZARIOZ = { "x-user-id": "u1", "x-user-branch-id": ZARIOZ };
const OPERATOR_PRADERA = { "x-user-id": "u2", "x-user-branch-id": PRADERA };
const BYPASS = { "x-user-id": "admin", "x-user-branch-id": "" };

describe("FoliosController — branch scoping en list", () => {
  it("no-bypass sin branchId queda implícitamente scoped a su propia sucursal", async () => {
    const { controller } = makeController();
    const res = await controller.list(getReq("", OPERATOR_ZARIOZ));
    expect(res.status).toBe(200);
    const body = await res.json();
    const tk = body.items.find((f: { code: string }) => f.code === "TK");
    expect(tk.branchCurrentNumber).toBe(5);
    expect(tk.nextFolioCode).toBe("TK-ZARIOZ-000006");
  });

  it("no-bypass con ?branchId= de otra sucursal → 403", async () => {
    const { controller } = makeController();
    const res = await controller.list(getReq(`?branchId=${PRADERA}`, OPERATOR_ZARIOZ));
    expect(res.status).toBe(403);
  });

  it("bypass sin branchId → sin cambio (campos null)", async () => {
    const { controller } = makeController();
    const res = await controller.list(getReq("", BYPASS));
    expect(res.status).toBe(200);
    const body = await res.json();
    const tk = body.items.find((f: { code: string }) => f.code === "TK");
    expect(tk.branchCurrentNumber).toBeNull();
    expect(tk.nextFolioCode).toBeNull();
  });

  it("bypass con ?branchId= de cualquier sucursal → 200 con preview", async () => {
    const { controller } = makeController();
    const res = await controller.list(getReq(`?branchId=${PRADERA}`, BYPASS));
    expect(res.status).toBe(200);
    const body = await res.json();
    const tk = body.items.find((f: { code: string }) => f.code === "TK");
    expect(tk.branchCurrentNumber).toBe(0);
    expect(tk.nextFolioCode).toBe("TK-PRADERA-000001");
  });
});

describe("FoliosController — branch scoping en audit", () => {
  it("no-bypass con ?branchId= de su propia sucursal → 200", async () => {
    const { controller } = makeController();
    const res = await controller.audit(getReq(`?branchId=${ZARIOZ}`, OPERATOR_ZARIOZ), FOLIO_TK);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.branchId).toBe(ZARIOZ);
  });

  it("no-bypass con ?branchId= de otra sucursal → 403", async () => {
    const { controller } = makeController();
    const res = await controller.audit(getReq(`?branchId=${PRADERA}`, OPERATOR_ZARIOZ), FOLIO_TK);
    expect(res.status).toBe(403);
  });

  it("bypass sin branchId → audita la serie legacy (branchId null en la respuesta)", async () => {
    const { controller } = makeController();
    const res = await controller.audit(getReq("", BYPASS), FOLIO_TK);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.branchId).toBeNull();
  });

  it("branchId de sucursal inexistente → 404 Branch not found", async () => {
    const { controller } = makeController();
    const res = await controller.audit(getReq("?branchId=99999999-9999-9999-9999-999999999999", BYPASS), FOLIO_TK);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Branch not found");
  });

  it("operador sin sucursal asignada (x-user-branch-id vacío) → 403", async () => {
    const { controller } = makeController();
    const res = await controller.audit(getReq("", { "x-user-id": "u3", "x-user-branch-id": "" }), FOLIO_TK);
    expect(res.status).toBe(403);
  });
});

describe("FoliosController — operador con otra membresía no afecta al otro (regresión de aislamiento)", () => {
  it("dos operadores en sucursales distintas ven previews independientes en list", async () => {
    const { controller } = makeController();
    const resZarioz = await controller.list(getReq("", OPERATOR_ZARIOZ));
    const resPradera = await controller.list(getReq("", OPERATOR_PRADERA));
    const tkZarioz = (await resZarioz.json()).items.find((f: { code: string }) => f.code === "TK");
    const tkPradera = (await resPradera.json()).items.find((f: { code: string }) => f.code === "TK");
    expect(tkZarioz.nextFolioCode).toBe("TK-ZARIOZ-000006");
    expect(tkPradera.nextFolioCode).toBe("TK-PRADERA-000001");
  });
});
