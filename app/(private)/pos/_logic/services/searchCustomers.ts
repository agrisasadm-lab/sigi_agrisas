import { authFetch, NetworkError } from "../../../../_lib/authFetch";
import type { CustomerDto } from "../types/api";

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
): Promise<{ items: CustomerDto[]; total: number; page: number; pageSize: number }> {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
    includeInactive: "false",
  });
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

  const body = await res.json() as {
    items: Array<Record<string, unknown>>;
    total: number;
    page: number;
    pageSize: number;
  };

  const items: CustomerDto[] = body.items.map((c) => ({
    id: c.id as string,
    code: c.code as string,
    name: c.name as string,
    rfc: c.rfc as string,
    legalName: c.legalName as string | null | undefined,
    taxRegime: c.taxRegime as string | null | undefined,
    cfdiUse: c.cfdiUse as string | null | undefined,
    taxZipCode: c.taxZipCode as string | null | undefined,
    email: c.email as string | null | undefined,
    phone: c.phone as string | null | undefined,
    creditLimit: c.creditLimit as number | null | undefined,
    currentBalance: (c.currentBalance as number) ?? 0,
    isActive: c.isActive as boolean,
  }));

  return { items, total: body.total, page: body.page, pageSize: body.pageSize };
}
