import { InMemoryFolioRepository } from "@/modules/folios/infrastructure/repositories/InMemoryFolioRepository";
import { AuditFolioSequenceUseCase } from "@/modules/folios/application/use-cases/AuditFolioSequenceUseCase";
import { Folio } from "@/modules/folios/domain/entities/Folio";
import { FolioNotFoundError } from "@/modules/folios/domain/errors/FolioNotFoundError";
import { FolioBranchNotFoundError } from "@/modules/folios/domain/errors/FolioBranchNotFoundError";

const ZARIOZ = "branch-zarioz";
const PRADERA = "branch-pradera";

function makeFolio(id: string, code: string, prefix: string | null, currentNumber = 0): Folio {
  const now = new Date();
  return Folio.create(id, { code, name: `Folio ${code}`, prefix, scope: "POS", currentNumber, isActive: true, createdAt: now, updatedAt: now });
}

describe("AuditFolioSequenceUseCase — folio no branch-scoped (comportamiento sin cambio)", () => {
  it("audita el histórico completo contra folio.currentNumber, con o sin branchId", async () => {
    const repo = new InMemoryFolioRepository();
    repo.seed([makeFolio("f-rb", "RB", "RB-", 2)]);
    repo.seedAuditDocs([
      { folioId: "f-rb", branchId: ZARIOZ, folioCode: "RB-000001", folioNumber: 1, docType: "payment", docId: "p1", status: "completed", issuedAt: new Date() },
      { folioId: "f-rb", branchId: PRADERA, folioCode: "RB-000002", folioNumber: 2, docType: "payment", docId: "p2", status: "completed", issuedAt: new Date() },
    ]);
    const useCase = new AuditFolioSequenceUseCase(repo);

    const withoutBranch = await useCase.execute("f-rb");
    expect(withoutBranch.totalIssued).toBe(2);
    expect(withoutBranch.gaps).toEqual([]);
    expect(withoutBranch.branchId).toBeNull();

    // branchId es ignorado para un folio no branch-scoped — mismo resultado.
    const withBranch = await useCase.execute("f-rb", ZARIOZ);
    expect(withBranch.totalIssued).toBe(2);
    expect(withBranch.branchId).toBeNull();
  });
});

describe("AuditFolioSequenceUseCase — folio branch-scoped, sin branchId (vista legacy)", () => {
  it("excluye los documentos con formato nuevo (branch-suffixed) de la serie legacy", async () => {
    const repo = new InMemoryFolioRepository();
    repo.seed([makeFolio("f-tk", "TK", "TK-", 38)]);
    repo.seedBranch(ZARIOZ, "ZARIOZ");
    repo.seedBranchCounter("f-tk", ZARIOZ, 5);
    repo.seedAuditDocs([
      // Serie legacy: 38 ventas con formato viejo (sólo una representativa aquí + el resto vía loop).
      ...Array.from({ length: 38 }, (_, i) => ({
        folioId: "f-tk",
        branchId: ZARIOZ,
        folioCode: `TK-${String(i + 1).padStart(6, "0")}`,
        folioNumber: i + 1,
        docType: "sale" as const,
        docId: `legacy-${i + 1}`,
        status: "completed",
        issuedAt: new Date(),
      })),
      // Serie nueva de ZARIOZ (folio_number colisiona con la legacy 1..5).
      ...Array.from({ length: 5 }, (_, i) => ({
        folioId: "f-tk",
        branchId: ZARIOZ,
        folioCode: `TK-ZARIOZ-${String(i + 1).padStart(6, "0")}`,
        folioNumber: i + 1,
        docType: "sale" as const,
        docId: `new-${i + 1}`,
        status: "completed",
        issuedAt: new Date(),
      })),
    ]);
    const useCase = new AuditFolioSequenceUseCase(repo);

    const result = await useCase.execute("f-tk");

    expect(result.totalIssued).toBe(38);
    expect(result.sequence).toHaveLength(38);
    expect(result.sequence.every((s) => s.documentId.startsWith("legacy-"))).toBe(true);
    expect(result.gaps).toEqual([]);
    expect(result.branchId).toBeNull();
  });
});

describe("AuditFolioSequenceUseCase — folio branch-scoped, con branchId (serie por sucursal)", () => {
  it("aísla la serie de la sucursal, excluyendo la legacy y las de otras sucursales", async () => {
    const repo = new InMemoryFolioRepository();
    repo.seed([makeFolio("f-tk", "TK", "TK-", 38)]);
    repo.seedBranch(ZARIOZ, "ZARIOZ");
    repo.seedBranch(PRADERA, "PRADERA");
    repo.seedBranchCounter("f-tk", ZARIOZ, 5);
    repo.seedAuditDocs([
      { folioId: "f-tk", branchId: ZARIOZ, folioCode: "TK-000038", folioNumber: 38, docType: "sale", docId: "legacy-38", status: "completed", issuedAt: new Date() },
      ...Array.from({ length: 5 }, (_, i) => ({
        folioId: "f-tk",
        branchId: ZARIOZ,
        folioCode: `TK-ZARIOZ-${String(i + 1).padStart(6, "0")}`,
        folioNumber: i + 1,
        docType: "sale" as const,
        docId: `zarioz-${i + 1}`,
        status: "completed",
        issuedAt: new Date(),
      })),
      { folioId: "f-tk", branchId: PRADERA, folioCode: "TK-PRADERA-000001", folioNumber: 1, docType: "sale", docId: "pradera-1", status: "completed", issuedAt: new Date() },
    ]);
    const useCase = new AuditFolioSequenceUseCase(repo);

    const result = await useCase.execute("f-tk", ZARIOZ);

    expect(result.currentNumber).toBe(5);
    expect(result.totalIssued).toBe(5);
    expect(result.sequence).toHaveLength(5);
    expect(result.sequence.every((s) => s.documentId.startsWith("zarioz-"))).toBe(true);
    expect(result.gaps).toEqual([]);
    expect(result.branchId).toBe(ZARIOZ);
    expect(result.branchCode).toBe("ZARIOZ");
  });

  it("sucursal sin contador aún: currentNumber 0, gaps vacío, sequence vacía", async () => {
    const repo = new InMemoryFolioRepository();
    repo.seed([makeFolio("f-tk", "TK", "TK-", 38)]);
    repo.seedBranch(ZARIOZ, "ZARIOZ");
    const useCase = new AuditFolioSequenceUseCase(repo);

    const result = await useCase.execute("f-tk", ZARIOZ);
    expect(result.currentNumber).toBe(0);
    expect(result.totalIssued).toBe(0);
    expect(result.sequence).toEqual([]);
    expect(result.gaps).toEqual([]);
  });

  it("sucursal inexistente lanza FolioBranchNotFoundError", async () => {
    const repo = new InMemoryFolioRepository();
    repo.seed([makeFolio("f-tk", "TK", "TK-", 0)]);
    const useCase = new AuditFolioSequenceUseCase(repo);

    await expect(useCase.execute("f-tk", "branch-unknown")).rejects.toThrow(FolioBranchNotFoundError);
  });
});

describe("AuditFolioSequenceUseCase — purchases cuentan en la auditoría de CP", () => {
  it("totalIssued y sequence incluyen documentType: purchase", async () => {
    const repo = new InMemoryFolioRepository();
    repo.seed([makeFolio("f-cp", "CP", "CP-", 5)]);
    repo.seedAuditDocs(
      Array.from({ length: 5 }, (_, i) => ({
        folioId: "f-cp",
        branchId: ZARIOZ,
        folioCode: `CP-${String(i + 1).padStart(6, "0")}`,
        folioNumber: i + 1,
        docType: "purchase" as const,
        docId: `purchase-${i + 1}`,
        status: "completed",
        issuedAt: new Date(),
      }))
    );
    const useCase = new AuditFolioSequenceUseCase(repo);

    const result = await useCase.execute("f-cp");

    expect(result.totalIssued).toBe(5);
    expect(result.sequence.every((s) => s.documentType === "purchase")).toBe(true);
  });
});

describe("AuditFolioSequenceUseCase — huecos y folio inexistente", () => {
  it("detecta un hueco cuando un número nunca fue emitido", async () => {
    const repo = new InMemoryFolioRepository();
    repo.seed([makeFolio("f-rb", "RB", "RB-", 3)]);
    repo.seedAuditDocs([
      { folioId: "f-rb", branchId: ZARIOZ, folioCode: "RB-000001", folioNumber: 1, docType: "payment", docId: "p1", status: "completed", issuedAt: new Date() },
      { folioId: "f-rb", branchId: ZARIOZ, folioCode: "RB-000003", folioNumber: 3, docType: "payment", docId: "p3", status: "completed", issuedAt: new Date() },
    ]);
    const useCase = new AuditFolioSequenceUseCase(repo);

    const result = await useCase.execute("f-rb");
    expect(result.gaps).toEqual([2]);
  });

  it("lanza FolioNotFoundError si el folio no existe", async () => {
    const repo = new InMemoryFolioRepository();
    const useCase = new AuditFolioSequenceUseCase(repo);
    await expect(useCase.execute("missing")).rejects.toThrow(FolioNotFoundError);
  });
});
