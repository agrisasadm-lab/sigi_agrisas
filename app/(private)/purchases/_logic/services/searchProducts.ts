import { authFetch, NetworkError } from "../../../../_lib/authFetch";
import type { ProductDto } from "../types/api";

export interface SearchProductsParams {
  search?: string;
  branchId?: string;
  page?: number;
  pageSize?: number;
  signal?: AbortSignal;
}

export async function searchProducts(
  { search, branchId, page = 1, pageSize = 20, signal }: SearchProductsParams,
  fetchImpl = authFetch,
): Promise<{ items: ProductDto[]; total: number }> {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize), includeInactive: "false" });
  const trimmed = search?.trim();
  if (trimmed && trimmed.length >= 2) params.set("search", trimmed);
  if (branchId) params.set("branchId", branchId);

  let res: Response;
  try {
    res = await fetchImpl(`/api/v1/admin/products?${params.toString()}`, { signal });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") throw err;
    throw new NetworkError();
  }

  if (!res.ok) throw new NetworkError();

  const body = await res.json() as { items: Array<Record<string, unknown>>; total: number };
  const items: ProductDto[] = body.items.map((p) => ({
    id: p.id as string,
    code: p.code as string,
    name: p.name as string,
    unit: p.unit as string,
    ivaRate: p.ivaRate as number | null,
    iepsRate: p.iepsRate as number | null,
    isActive: p.isActive as boolean,
  }));

  return { items, total: body.total };
}
