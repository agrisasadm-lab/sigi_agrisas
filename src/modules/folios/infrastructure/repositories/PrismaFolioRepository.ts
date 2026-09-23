import { PrismaClient, Prisma } from "@prisma/client";
import {
  FolioRepository,
  FindAllFoliosOptions,
  CreateFolioData,
  UpdateFolioData,
  AuditCounts,
  BranchCountersResult,
} from "@/modules/folios/application/ports/FolioRepository";
import { Folio } from "@/modules/folios/domain/entities/Folio";
import { FolioScope } from "@/shared/domain/types/FolioScope";
import { FolioNotFoundError } from "@/modules/folios/domain/errors/FolioNotFoundError";
import { FolioCodeAlreadyInUseError } from "@/modules/folios/domain/errors/FolioCodeAlreadyInUseError";
import { AuditSequenceRaw } from "@/modules/folios/application/dto/FolioAuditDto";
import { isPrismaUniqueError, isPrismaNotFoundError } from "@/shared/infrastructure/prisma/errors";

type PrismaFolio = {
  id: string;
  code: string;
  name: string;
  prefix: string | null;
  scope: string;
  currentNumber: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

function toDomain(row: PrismaFolio): Folio {
  return Folio.create(row.id, {
    code: row.code,
    name: row.name,
    prefix: row.prefix,
    scope: row.scope as FolioScope,
    currentNumber: row.currentNumber,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

export class PrismaFolioRepository implements FolioRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findAll({ page, pageSize, includeInactive, scope }: FindAllFoliosOptions): Promise<{ items: Folio[]; total: number }> {
    // El catálogo de folios es global — `branchId` (si viene) no filtra qué folios
    // aparecen, sólo enriquece cada uno con su contador de esa sucursal (ver
    // ListFoliosUseCase → findBranchCounters).
    const where: { isActive?: boolean; scope?: string } = {};
    if (!includeInactive) where.isActive = true;
    if (scope) where.scope = scope;
    const skip = (page - 1) * pageSize;
    const [rows, total] = await Promise.all([
      this.prisma.folio.findMany({ where, skip, take: pageSize, orderBy: { createdAt: "desc" } }),
      this.prisma.folio.count({ where }),
    ]);
    return { items: rows.map(toDomain), total };
  }

  async findById(id: string): Promise<Folio | null> {
    const row = await this.prisma.folio.findUnique({ where: { id } });
    return row ? toDomain(row) : null;
  }

  async create(data: CreateFolioData): Promise<Folio> {
    try {
      const row = await this.prisma.folio.create({
        data: {
          code: data.code,
          name: data.name,
          prefix: data.prefix ?? null,
          scope: data.scope,
          currentNumber: data.currentNumber ?? 0,
          isActive: data.isActive ?? true,
        },
      });
      return toDomain(row);
    } catch (err) {
      if (isPrismaUniqueError(err)) throw new FolioCodeAlreadyInUseError();
      throw err;
    }
  }

  async update(id: string, data: UpdateFolioData): Promise<Folio> {
    try {
      const row = await this.prisma.folio.update({ where: { id }, data });
      return toDomain(row);
    } catch (err) {
      if (isPrismaNotFoundError(err)) throw new FolioNotFoundError();
      throw err;
    }
  }

  async softDelete(id: string): Promise<void> {
    try {
      await this.prisma.folio.update({ where: { id }, data: { isActive: false } });
    } catch (err) {
      if (isPrismaNotFoundError(err)) throw new FolioNotFoundError();
      throw err;
    }
  }

  async findBranchCounters(folioIds: string[], branchId: string): Promise<BranchCountersResult | null> {
    const branch = await this.prisma.branch.findUnique({ where: { id: branchId }, select: { code: true } });
    if (!branch) return null;
    const rows = await this.prisma.folioBranchCounter.findMany({
      where: { branchId, folioId: { in: folioIds } },
      select: { folioId: true, currentNumber: true },
    });
    return { branchCode: branch.code, counters: new Map(rows.map((r) => [r.folioId, r.currentNumber])) };
  }

  async findAuditSequence(folioId: string, branchId?: string, likePattern?: string): Promise<AuditSequenceRaw[]> {
    type RawRow = { num: unknown; doc_type: string; doc_id: string; status: string; issued_at: Date };
    // Filtro branch-scoped opcional: aplica SÓLO cuando el caller resolvió un
    // patrón (folio branch-scoped + branchId) — ver AuditFolioSequenceUseCase.
    // Sin él, comportamiento histórico sin cambio (audita el global/legacy).
    const branchFilter =
      branchId && likePattern
        ? Prisma.sql`AND branch_id = ${branchId} AND folio_code LIKE ${likePattern} ESCAPE '\\'`
        : Prisma.empty;
    const rows = await this.prisma.$queryRaw<RawRow[]>`
      SELECT folio_number AS num, 'sale' AS doc_type, id AS doc_id, status, created_at AS issued_at
      FROM sales
      WHERE folio_id = ${folioId} AND folio_number IS NOT NULL ${branchFilter}
      UNION ALL
      SELECT folio_number, 'quote', id, status, created_at
      FROM quotes
      WHERE folio_id = ${folioId} AND folio_number IS NOT NULL ${branchFilter}
      UNION ALL
      SELECT folio_number, 'purchase', id, status, created_at
      FROM purchases
      WHERE folio_id = ${folioId} AND folio_number IS NOT NULL ${branchFilter}
      UNION ALL
      SELECT folio_number, 'payment', id, status, created_at
      FROM customer_payments
      WHERE folio_id = ${folioId} AND folio_number IS NOT NULL ${branchFilter}
      ORDER BY num ASC
      LIMIT 10001
    `;
    return rows.map((r) => ({
      num: Number(r.num),
      doc_type: r.doc_type as AuditSequenceRaw["doc_type"],
      doc_id: r.doc_id,
      status: r.status,
      issued_at: r.issued_at,
    }));
  }

  async getAuditCounts(folioId: string, branchId?: string, likePattern?: string): Promise<AuditCounts> {
    type CountRow = { with_number: unknown; without_number: unknown };
    const branchFilter =
      branchId && likePattern
        ? Prisma.sql`AND branch_id = ${branchId} AND folio_code LIKE ${likePattern} ESCAPE '\\'`
        : Prisma.empty;
    const [row] = await this.prisma.$queryRaw<CountRow[]>`
      SELECT
        COUNT(*) FILTER (WHERE folio_number IS NOT NULL)::int AS with_number,
        COUNT(*) FILTER (WHERE folio_number IS NULL)::int AS without_number
      FROM (
        SELECT folio_number FROM sales WHERE folio_id = ${folioId} ${branchFilter}
        UNION ALL
        SELECT folio_number FROM quotes WHERE folio_id = ${folioId} ${branchFilter}
        UNION ALL
        SELECT folio_number FROM purchases WHERE folio_id = ${folioId} ${branchFilter}
        UNION ALL
        SELECT folio_number FROM customer_payments WHERE folio_id = ${folioId} ${branchFilter}
      ) t
    `;
    return {
      withFolioNumber: Number(row.with_number),
      withoutFolioNumber: Number(row.without_number),
    };
  }
}
