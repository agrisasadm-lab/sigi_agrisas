import { authFetch, NetworkError } from "../../../../_lib/authFetch";
import type { ProductSearchResultDto } from "../types/api";

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
): Promise<{ items: ProductSearchResultDto[]; total: number }> {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize), includeInactive: "false" });
  const trimmed = search?.trim();
  if (trimmed) params.set("search", trimmed);
  if (branchId) params.set("branchId", branchId);

  let res: Response;
  try {
    res = await fetchImpl(`/api/v1/admin/products?${params.toString()}`, { signal });
  } catch (err) {
    if ((err as Error).name === "AbortError") throw err;
    throw new NetworkError();
  }

  if (!res.ok) throw new NetworkError();

  const body = await res.json() as { items: ProductSearchResultDto[]; total: number };
  return { items: body.items, total: body.total };
}
