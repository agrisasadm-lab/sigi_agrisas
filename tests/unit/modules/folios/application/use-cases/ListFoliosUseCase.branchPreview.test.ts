import { InMemoryFolioRepository } from "@/modules/folios/infrastructure/repositories/InMemoryFolioRepository";
import { ListFoliosUseCase } from "@/modules/folios/application/use-cases/ListFoliosUseCase";
import { Folio } from "@/modules/folios/domain/entities/Folio";
import { FolioBranchNotFoundError } from "@/modules/folios/domain/errors/FolioBranchNotFoundError";

const ZARIOZ = "branch-zarioz";
const UNKNOWN_BRANCH = "branch-unknown";

function makeFolio(id: string, code: string, prefix: string | null = null): Folio {
  const now = new Date();
  return Folio.create(id, { code, name: `Folio ${code}`, prefix, scope: "POS", currentNumber: 14, isActive: true, createdAt: now, updatedAt: now });
}

describe("ListFoliosUseCase — preview por sucursal", () => {
  it("sin branchId: branchCurrentNumber y nextFolioCode son null", async () => {
    const repo = new InMemoryFolioRepository();
    repo.seed([makeFolio("f-tk", "TK", "TK-")]);
    const result = await new ListFoliosUseCase(repo).execute({ page: 1, pageSize: 20, includeInactive: false });
    expect(result.items[0].branchCurrentNumber).toBeNull();
    expect(result.items[0].nextFolioCode).toBeNull();
  });

  it("con branchId y contador existente: resuelve branchCurrentNumber y nextFolioCode", async () => {
    const repo = new InMemoryFolioRepository();
    repo.seed([makeFolio("f-tk", "TK", "TK-")]);
    repo.seedBranch(ZARIOZ, "ZARIOZ");
    repo.seedBranchCounter("f-tk", ZARIOZ, 5);

    const result = await new ListFoliosUseCase(repo).execute({ page: 1, pageSize: 20, includeInactive: false, branchId: ZARIOZ });

    expect(result.items[0].branchCurrentNumber).toBe(5);
    expect(result.items[0].nextFolioCode).toBe("TK-ZARIOZ-000006");
  });

  it("con branchId sin contador aún: branchCurrentNumber es 0, nextFolioCode arranca en 1", async () => {
    const repo = new InMemoryFolioRepository();
    repo.seed([makeFolio("f-tk", "TK", "TK-")]);
    repo.seedBranch(ZARIOZ, "ZARIOZ");

    const result = await new ListFoliosUseCase(repo).execute({ page: 1, pageSize: 20, includeInactive: false, branchId: ZARIOZ });

    expect(result.items[0].branchCurrentNumber).toBe(0);
    expect(result.items[0].nextFolioCode).toBe("TK-ZARIOZ-000001");
  });

  it("sucursal inexistente lanza FolioBranchNotFoundError", async () => {
    const repo = new InMemoryFolioRepository();
    repo.seed([makeFolio("f-tk", "TK", "TK-")]);

    await expect(
      new ListFoliosUseCase(repo).execute({ page: 1, pageSize: 20, includeInactive: false, branchId: UNKNOWN_BRANCH })
    ).rejects.toThrow(FolioBranchNotFoundError);
  });

  it("folio no branch-scoped (RB): campos quedan null aunque se pida branchId", async () => {
    const repo = new InMemoryFolioRepository();
    repo.seed([makeFolio("f-rb", "RB", "RB-")]);
    repo.seedBranch(ZARIOZ, "ZARIOZ");
    repo.seedBranchCounter("f-rb", ZARIOZ, 3);

    const result = await new ListFoliosUseCase(repo).execute({ page: 1, pageSize: 20, includeInactive: false, branchId: ZARIOZ });

    expect(result.items[0].branchCurrentNumber).toBeNull();
    expect(result.items[0].nextFolioCode).toBeNull();
  });
});
