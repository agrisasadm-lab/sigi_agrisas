import { FolioRepository } from "@/modules/folios/application/ports/FolioRepository";
import { FolioDto, toFolioDto } from "@/modules/folios/application/dto/FolioDto";
import { FolioScope } from "@/shared/domain/types/FolioScope";
import { FolioBranchNotFoundError } from "@/modules/folios/domain/errors/FolioBranchNotFoundError";

export interface ListFoliosRequest {
  page: number;
  pageSize: number;
  includeInactive: boolean;
  scope?: FolioScope;
  /** Cuando está presente, cada item incluye `branchCurrentNumber`/`nextFolioCode` para esta sucursal. */
  branchId?: string;
}

export interface ListFoliosResponse {
  items: FolioDto[];
  total: number;
  page: number;
  pageSize: number;
}

export class ListFoliosUseCase {
  constructor(private readonly repo: FolioRepository) {}

  async execute(req: ListFoliosRequest): Promise<ListFoliosResponse> {
    const { items, total } = await this.repo.findAll(req);

    if (!req.branchId) {
      return { items: items.map((f) => toFolioDto(f)), total, page: req.page, pageSize: req.pageSize };
    }

    const branchCounters = await this.repo.findBranchCounters(items.map((f) => f.id), req.branchId);
    if (!branchCounters) throw new FolioBranchNotFoundError(req.branchId);

    const dtos = items.map((f) =>
      toFolioDto(f, {
        branchCode: branchCounters.branchCode,
        currentNumber: branchCounters.counters.get(f.id) ?? 0,
      })
    );
    return { items: dtos, total, page: req.page, pageSize: req.pageSize };
  }
}
