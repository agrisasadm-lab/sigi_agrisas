import { authFetch, NetworkError, UnauthenticatedError, ForbiddenError } from "../../../../../_lib/authFetch";
import type { ListFoliosResponse, FolioDto } from "../types/api";
import type { Folio, FolioAuditResult } from "../types/domain";

function toFolio(dto: FolioDto): Folio {
  return {
    id: dto.id,
    code: dto.code,
    name: dto.name,
    prefix: dto.prefix,
    scope: dto.scope,
    currentNumber: dto.currentNumber,
    isActive: dto.isActive,
    createdAt: new Date(dto.createdAt),
    updatedAt: new Date(dto.updatedAt),
    branchCurrentNumber: dto.branchCurrentNumber,
    nextFolioCode: dto.nextFolioCode,
  };
}

export { toFolio };

export async function listFolios(
  { page, pageSize, includeInactive }: { page: number; pageSize: number; includeInactive?: boolean },
  fetchImpl = authFetch
): Promise<{ items: Folio[]; total: number; page: number; pageSize: number }> {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (includeInactive) params.set("includeInactive", "true");

  let res: Response;
  try {
    res = await fetchImpl(`/api/v1/admin/folios?${params.toString()}`);
  } catch (err) {
    if (err instanceof NetworkError || err instanceof UnauthenticatedError || err instanceof ForbiddenError) throw err;
    throw new NetworkError();
  }
  if (!res.ok) throw new NetworkError();
  const body = (await res.json()) as ListFoliosResponse;
  return {
    items: body.items.map(toFolio),
    total: body.total,
    page: body.page,
    pageSize: body.pageSize,
  };
}

export async function auditFolio(id: string, branchId?: string | null, fetchImpl = authFetch): Promise<FolioAuditResult> {
  const qs = branchId ? `?branchId=${branchId}` : "";
  let res: Response;
  try {
    res = await fetchImpl(`/api/v1/admin/folios/${id}/audit${qs}`);
  } catch (err) {
    if (err instanceof NetworkError || err instanceof UnauthenticatedError || err instanceof ForbiddenError) throw err;
    throw new NetworkError();
  }
  if (!res.ok) throw new NetworkError();
  return (await res.json()) as FolioAuditResult;
}
