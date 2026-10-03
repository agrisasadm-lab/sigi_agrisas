import { FolioRepository } from "@/modules/folios/application/ports/FolioRepository";
import { FolioAuditResultDto, AuditSequenceItemDto } from "@/modules/folios/application/dto/FolioAuditDto";
import { FolioNotFoundError } from "@/modules/folios/domain/errors/FolioNotFoundError";
import { FolioBranchNotFoundError } from "@/modules/folios/domain/errors/FolioBranchNotFoundError";
import { isBranchScopedFolioCode } from "@/shared/domain/folios/branchScopedFolioCodes";
import { branchFolioCodeLikePattern, legacyFolioCodeRegex } from "@/shared/domain/folios/formatBranchFolioCode";

export class AuditFolioSequenceUseCase {
  constructor(private readonly repo: FolioRepository) {}

  /**
   * Sin `branchId`: si el folio NO es branch-scoped, comportamiento sin cambio
   * (audita el histórico completo contra `folio.currentNumber`). Si el folio SÍ
   * es branch-scoped, audita sólo la serie legacy — se excluyen los documentos
   * con formato nuevo (branch-suffixed) vía `legacyFolioCodeRegex`, para no
   * mezclar series con `folio_number` que colisiona entre sucursales.
   * Con `branchId` en un folio branch-scoped: audita únicamente la serie de esa
   * sucursal — `currentNumber` se resuelve de `folio_branch_counters` (0 si aún
   * no hay fila) y la secuencia se filtra por `branch_id` + el patrón de esa sucursal.
   */
  async execute(folioId: string, branchId?: string): Promise<FolioAuditResultDto> {
    const folio = await this.repo.findById(folioId);
    if (!folio) throw new FolioNotFoundError();

    let currentNumber = folio.currentNumber;
    let branchCode: string | null = null;
    let likePattern: string | undefined;
    let legacyOnlyRegex: string | undefined;

    const branchScopedFolio = isBranchScopedFolioCode(folio.code);
    const scoped = branchId && branchScopedFolio;
    if (scoped) {
      const branchCounters = await this.repo.findBranchCounters([folioId], branchId!);
      if (!branchCounters) throw new FolioBranchNotFoundError(branchId!);
      branchCode = branchCounters.branchCode;
      currentNumber = branchCounters.counters.get(folioId) ?? 0;
      likePattern = branchFolioCodeLikePattern(folio.prefix, folio.code, branchCode);
    } else if (branchScopedFolio) {
      legacyOnlyRegex = legacyFolioCodeRegex(folio.prefix, folio.code);
    }

    const [rawRows, counts] = await Promise.all([
      this.repo.findAuditSequence(folioId, scoped ? branchId : undefined, likePattern, legacyOnlyRegex),
      this.repo.getAuditCounts(folioId, scoped ? branchId : undefined, likePattern, legacyOnlyRegex),
    ]);

    const truncated = counts.withFolioNumber > 10000;
    const totalIssued = counts.withFolioNumber;

    let gaps: number[] = [];
    let sequence: AuditSequenceItemDto[] = [];

    if (!truncated) {
      const issuedSet = new Set(rawRows.map((r) => r.num));
      for (let n = 1; n <= currentNumber; n++) {
        if (!issuedSet.has(n)) gaps.push(n);
      }
      sequence = rawRows.map((r) => ({
        number: r.num,
        documentType: r.doc_type,
        documentId: r.doc_id,
        status: r.status,
        issuedAt: r.issued_at instanceof Date ? r.issued_at.toISOString() : String(r.issued_at),
      }));
    }

    return {
      folioId: folio.id,
      code: folio.code,
      prefix: folio.prefix,
      currentNumber,
      totalIssued,
      withoutFolioNumber: counts.withoutFolioNumber,
      gaps,
      truncated,
      sequence,
      branchId: scoped ? branchId! : null,
      branchCode,
    };
  }
}
