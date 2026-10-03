import { authFetch, NetworkError, UnauthenticatedError, ForbiddenError } from "../../../../../_lib/authFetch";
import type { ListCustomersResponse, ListCustomersParams, CustomerDto } from "../types/api";
import type { Customer } from "../types/domain";

export function toCustomer(dto: CustomerDto): Customer {
  return {
    id: dto.id,
    code: dto.code,
    name: dto.name,
    rfc: dto.rfc,
    legalName: dto.legalName,
    taxRegime: dto.taxRegime,
    cfdiUse: dto.cfdiUse,
    taxZipCode: dto.taxZipCode,
    email: dto.email,
    phone: dto.phone,
    address: dto.address,
    contactName: dto.contactName,
    notes: dto.notes,
    creditLimit: dto.creditLimit,
    currentBalance: dto.currentBalance,
    initialBalance: dto.initialBalance,
    creditDays: dto.creditDays,
    isActive: dto.isActive,
    addressStreet: dto.addressStreet,
    addressExteriorNumber: dto.addressExteriorNumber,
    addressInteriorNumber: dto.addressInteriorNumber,
    addressNeighborhood: dto.addressNeighborhood,
    addressMunicipality: dto.addressMunicipality,
    addressState: dto.addressState,
    addressCountry: dto.addressCountry,
    addressZipCode: dto.addressZipCode,
    branchIds: dto.branchIds,
    createdAt: new Date(dto.createdAt),
    updatedAt: new Date(dto.updatedAt),
  };
}

export async function listCustomers(
  { page, pageSize, includeInactive, search, branchId }: ListCustomersParams,
  fetchImpl = authFetch,
  signal?: AbortSignal,
): Promise<{ items: Customer[]; total: number; page: number; pageSize: number }> {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (includeInactive) params.set("includeInactive", "true");
  const trimmed = search?.trim();
  if (trimmed && trimmed.length >= 2) params.set("search", trimmed);
  if (branchId) params.set("branchId", branchId);

  let res: Response;
  try {
    res = await fetchImpl(`/api/v1/admin/customers?${params.toString()}`, { signal });
  } catch (err) {
    if (err instanceof NetworkError || err instanceof UnauthenticatedError || err instanceof ForbiddenError) throw err;
    if ((err as Error).name === "AbortError") throw err;
    throw new NetworkError();
  }
  if (!res.ok) throw new NetworkError();
  const body = (await res.json()) as ListCustomersResponse;
  return {
    items: body.items.map(toCustomer),
    total: body.total,
    page: body.page,
    pageSize: body.pageSize,
  };
}
