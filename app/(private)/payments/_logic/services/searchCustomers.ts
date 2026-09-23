import { authFetch, NetworkError } from "../../../../_lib/authFetch";
import type { CustomerSearchResultDto } from "../types/api";

export interface SearchCustomersParams {
  search?: string;
  page?: number;
  pageSize?: number;
  branchId?: string;
  signal?: AbortSignal;
}

export async function searchCustomers(
  { search, page = 1, pageSize = 20, branchId, signal }: SearchCustomersParams,
  fetchImpl = authFetch,
): Promise<{ items: CustomerSearchResultDto[]; total: number }> {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize), includeInactive: "false" });
  const trimmed = search?.trim();
  if (trimmed && trimmed.length >= 2) params.set("search", trimmed);
  if (branchId) params.set("branchId", branchId);

  let res: Response;
  try {
    res = await fetchImpl(`/api/v1/admin/customers?${params.toString()}`, { signal });
  } catch (err) {
    if ((err as Error).name === "AbortError") throw err;
    throw new NetworkError();
  }

  if (!res.ok) throw new NetworkError();

  const body = await res.json() as { items: CustomerSearchResultDto[]; total: number };
  return { items: body.items, total: body.total };
}
