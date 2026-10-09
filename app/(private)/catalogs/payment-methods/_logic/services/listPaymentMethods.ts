import { authFetch, NetworkError, UnauthenticatedError, ForbiddenError } from "../../../../../_lib/authFetch";
import type { ListPaymentMethodsResponse, PaymentMethodDto } from "../types/api";
import type { PaymentMethod } from "../types/domain";

function toPaymentMethod(dto: PaymentMethodDto): PaymentMethod {
  return {
    id: dto.id,
    code: dto.code,
    name: dto.name,
    description: dto.description,
    isActive: dto.isActive,
    isCredit: dto.isCredit,
    createdAt: new Date(dto.createdAt),
    updatedAt: new Date(dto.updatedAt),
  };
}

export { toPaymentMethod };

export async function listPaymentMethods(
  { page, pageSize, includeInactive }: { page: number; pageSize: number; includeInactive?: boolean },
  fetchImpl = authFetch
): Promise<{ items: PaymentMethod[]; total: number; page: number; pageSize: number }> {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (includeInactive) params.set("includeInactive", "true");

  let res: Response;
  try {
    res = await fetchImpl(`/api/v1/admin/payment-methods?${params.toString()}`);
  } catch (err) {
    if (err instanceof NetworkError || err instanceof UnauthenticatedError || err instanceof ForbiddenError) throw err;
    throw new NetworkError();
  }
  if (!res.ok) throw new NetworkError();
  const body = (await res.json()) as ListPaymentMethodsResponse;
  return {
    items: body.items.map(toPaymentMethod),
    total: body.total,
    page: body.page,
    pageSize: body.pageSize,
  };
}
