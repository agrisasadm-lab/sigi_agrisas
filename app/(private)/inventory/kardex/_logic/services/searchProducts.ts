import { authFetch, NetworkError } from "../../../../../_lib/authFetch";
import type { ProductOptionDto } from "../types/api";

export interface SearchProductsParams {
  search?: string;
  branchId?: string;
  page?: number;
  pageSize?: number;
  signal?: AbortSignal;
}

export async function searchProducts(
  { search, branchId, page = 1, pageSize = 20, signal }: SearchProductsParams,
  fetchImpl = authFetch
): Promise<{ items: ProductOptionDto[]; total: number }> {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
    includeInactive: "false",
  });
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

  const body = (await res.json()) as { items: Array<Record<string, unknown>>; total: number };
  const items: ProductOptionDto[] = body.items.map((p) => ({
    id: p.id as string,
    code: p.code as string,
    name: p.name as string,
  }));

  return { items, total: body.total };
}
