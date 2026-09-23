import { randomUUID } from "crypto";
import {
  FolioRepository,
  FindAllFoliosOptions,
  CreateFolioData,
  UpdateFolioData,
  AuditCounts,
  BranchCountersResult,
} from "@/modules/folios/application/ports/FolioRepository";
import { Folio } from "@/modules/folios/domain/entities/Folio";
import { FolioNotFoundError } from "@/modules/folios/domain/errors/FolioNotFoundError";
import { FolioCodeAlreadyInUseError } from "@/modules/folios/domain/errors/FolioCodeAlreadyInUseError";
import { AuditSequenceRaw } from "@/modules/folios/application/dto/FolioAuditDto";

export interface SeededAuditDoc {
  folioId: string;
  branchId: string | null;
  folioCode: string;
  folioNumber: number | null;
  docType: AuditSequenceRaw["doc_type"];
  docId: string;
  status: string;
  issuedAt: Date;
}

/** Traduce un patrón SQL `LIKE ... ESCAPE '\\'` (ver `branchFolioCodeLikePattern`) a RegExp equivalente. */
function sqlLikeToRegExp(pattern: string): RegExp {
  let re = "^";
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i];
    if (ch === "\\" && i + 1 < pattern.length) {
      re += pattern[++i].replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    } else if (ch === "%") {
      re += ".*";
    } else if (ch === "_") {
      re += ".";
    } else {
      re += ch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }
  }
  return new RegExp(re + "$");
}

export class InMemoryFolioRepository implements FolioRepository {
  private store: Map<string, Folio> = new Map();
  private branches: Map<string, string> = new Map(); // branchId -> code
  private branchCounters: Map<string, number> = new Map(); // `${folioId}|${branchId}` -> currentNumber
  private auditDocs: SeededAuditDoc[] = [];

  seed(folios: Folio[]): void {
    for (const f of folios) this.store.set(f.id, f);
  }

  seedBranch(id: string, code: string): void {
    this.branches.set(id, code);
  }

  seedBranchCounter(folioId: string, branchId: string, currentNumber: number): void {
    this.branchCounters.set(`${folioId}|${branchId}`, currentNumber);
  }

  /** Simula filas de sales/quotes/purchases/customer_payments para pruebas de auditoría. */
  seedAuditDocs(docs: SeededAuditDoc[]): void {
    this.auditDocs.push(...docs);
  }

  private matchingAuditDocs(folioId: string, branchId?: string, likePattern?: string, legacyOnlyRegex?: string): SeededAuditDoc[] {
    return this.auditDocs.filter((d) => {
      if (d.folioId !== folioId) return false;
      if (branchId && likePattern) {
        return d.branchId === branchId && sqlLikeToRegExp(likePattern).test(d.folioCode);
      }
      if (legacyOnlyRegex) {
        return new RegExp(legacyOnlyRegex).test(d.folioCode);
      }
      return true;
    });
  }

  async findAll({ page, pageSize, includeInactive, scope }: FindAllFoliosOptions): Promise<{ items: Folio[]; total: number }> {
    const all = [...this.store.values()].filter(
      (f) => (includeInactive || f.isActive) && (!scope || f.scope === scope)
    );
    const skip = (page - 1) * pageSize;
    return { items: all.slice(skip, skip + pageSize), total: all.length };
  }

  async findById(id: string): Promise<Folio | null> {
    return this.store.get(id) ?? null;
  }

  async create(data: CreateFolioData): Promise<Folio> {
    const exists = [...this.store.values()].find((f) => f.code === data.code);
    if (exists) throw new FolioCodeAlreadyInUseError();
    const now = new Date();
    const f = Folio.create(randomUUID(), {
      code: data.code,
      name: data.name,
      prefix: data.prefix ?? null,
      scope: data.scope,
      currentNumber: data.currentNumber ?? 0,
      isActive: data.isActive ?? true,
      createdAt: now,
      updatedAt: now,
    });
    this.store.set(f.id, f);
    return f;
  }

  async update(id: string, data: UpdateFolioData): Promise<Folio> {
    const existing = this.store.get(id);
    if (!existing) throw new FolioNotFoundError();
    const updated = Folio.create(id, {
      code: existing.code,
      name: data.name ?? existing.name,
      prefix: data.prefix !== undefined ? data.prefix : existing.prefix,
      scope: data.scope ?? existing.scope,
      currentNumber: data.currentNumber !== undefined ? data.currentNumber : existing.currentNumber,
      isActive: data.isActive !== undefined ? data.isActive : existing.isActive,
      createdAt: existing.createdAt,
      updatedAt: new Date(),
    });
    this.store.set(id, updated);
    return updated;
  }

  async findAuditSequence(folioId: string, branchId?: string, likePattern?: string, legacyOnlyRegex?: string): Promise<AuditSequenceRaw[]> {
    return this.matchingAuditDocs(folioId, branchId, likePattern, legacyOnlyRegex)
      .filter((d) => d.folioNumber !== null)
      .map((d) => ({ num: d.folioNumber as number, doc_type: d.docType, doc_id: d.docId, status: d.status, issued_at: d.issuedAt }))
      .sort((a, b) => a.num - b.num)
      .slice(0, 10001);
  }

  async getAuditCounts(folioId: string, branchId?: string, likePattern?: string, legacyOnlyRegex?: string): Promise<AuditCounts> {
    const matched = this.matchingAuditDocs(folioId, branchId, likePattern, legacyOnlyRegex);
    return {
      withFolioNumber: matched.filter((d) => d.folioNumber !== null).length,
      withoutFolioNumber: matched.filter((d) => d.folioNumber === null).length,
    };
  }

  async findBranchCounters(folioIds: string[], branchId: string): Promise<BranchCountersResult | null> {
    const branchCode = this.branches.get(branchId);
    if (!branchCode) return null;
    const counters = new Map<string, number>();
    for (const folioId of folioIds) {
      const n = this.branchCounters.get(`${folioId}|${branchId}`);
      if (n !== undefined) counters.set(folioId, n);
    }
    return { branchCode, counters };
  }

  async softDelete(id: string): Promise<void> {
    const existing = this.store.get(id);
    if (!existing) throw new FolioNotFoundError();
    const updated = Folio.create(id, {
      code: existing.code,
      name: existing.name,
      prefix: existing.prefix,
      scope: existing.scope,
      currentNumber: existing.currentNumber,
      isActive: false,
      createdAt: existing.createdAt,
      updatedAt: new Date(),
    });
    this.store.set(id, updated);
  }
}
