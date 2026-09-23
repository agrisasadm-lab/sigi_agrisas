import { Folio } from "@/modules/folios/domain/entities/Folio";
import { FolioScope } from "@/shared/domain/types/FolioScope";
import { AuditSequenceRaw } from "@/modules/folios/application/dto/FolioAuditDto";

export interface FindAllFoliosOptions {
  page: number;
  pageSize: number;
  includeInactive: boolean;
  scope?: FolioScope;
  branchId?: string;
}

/** Contadores por sucursal de un conjunto de folios, resueltos en una sola consulta. */
export interface BranchCountersResult {
  branchCode: string;
  /** folioId -> currentNumber (0 si el folio aún no tiene fila para esta sucursal). */
  counters: Map<string, number>;
}

export interface CreateFolioData {
  code: string;
  name: string;
  scope: FolioScope;
  prefix?: string | null;
  currentNumber?: number;
  isActive?: boolean;
}

export interface UpdateFolioData {
  name?: string;
  prefix?: string | null;
  scope?: FolioScope;
  currentNumber?: number;
  isActive?: boolean;
}

export interface AuditCounts {
  withFolioNumber: number;
  withoutFolioNumber: number;
}

export interface FolioRepository {
  findAll(opts: FindAllFoliosOptions): Promise<{ items: Folio[]; total: number }>;
  findById(id: string): Promise<Folio | null>;
  create(data: CreateFolioData): Promise<Folio>;
  update(id: string, data: UpdateFolioData): Promise<Folio>;
  softDelete(id: string): Promise<void>;
  findAuditSequence(folioId: string, branchId?: string, likePattern?: string): Promise<AuditSequenceRaw[]>;
  getAuditCounts(folioId: string, branchId?: string, likePattern?: string): Promise<AuditCounts>;
  /** `null` si `branchId` no corresponde a ninguna sucursal. */
  findBranchCounters(folioIds: string[], branchId: string): Promise<BranchCountersResult | null>;
}
