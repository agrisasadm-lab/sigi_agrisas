import { authFetch, NetworkError, UnauthenticatedError, ForbiddenError } from "../../../../../_lib/authFetch";
import type {
  ListProductDosificationsResponse,
  ProductDosificationDto,
  CreateDosificationBody,
  UpdateDosificationBody,
} from "../types/api";
import type { ProductDosification } from "../types/domain";
import { DuplicateDosificationNameError, ProductNotFoundError } from "../errors";

export function toProductDosification(dto: ProductDosificationDto): ProductDosification {
  return {
    id: dto.id,
    productId: dto.productId,
    name: dto.name,
    numParts: dto.numParts,
    isActive: dto.isActive,
    computedUnitPrice: dto.computedUnitPrice,
    requiresDefaultPrice: dto.requiresDefaultPrice,
    createdAt: new Date(dto.createdAt),
    updatedAt: new Date(dto.updatedAt),
  };
}

async function safeRethrow(err: unknown): Promise<never> {
  if (
    err instanceof NetworkError ||
    err instanceof UnauthenticatedError ||
    err instanceof ForbiddenError
  )
    throw err;
  if ((err as Error).name === "AbortError") throw err;
  throw new NetworkError();
}

export async function listDosifications(
  { productId, branchId }: { productId: string; branchId: string },
  fetchImpl = authFetch,
  signal?: AbortSignal,
): Promise<ProductDosification[]> {
  const qs = `?branchId=${encodeURIComponent(branchId)}`;
  let res: Response;
  try {
    res = await fetchImpl(`/api/v1/admin/products/${productId}/dosifications${qs}`, { signal });
  } catch (err) {
    return safeRethrow(err);
  }
  if (res.status === 404) throw new ProductNotFoundError();
  if (!res.ok) throw new NetworkError();
  const body = (await res.json()) as ListProductDosificationsResponse;
  return body.items.map(toProductDosification);
}

export async function createDosification(
  { productId, branchId, body }: { productId: string; branchId: string; body: CreateDosificationBody },
  fetchImpl = authFetch,
): Promise<ProductDosification> {
  let res: Response;
  try {
    res = await fetchImpl(`/api/v1/admin/products/${productId}/dosifications?branchId=${encodeURIComponent(branchId)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (err) {
    return safeRethrow(err);
  }
  if (res.status === 409) throw new DuplicateDosificationNameError();
  if (!res.ok) throw new NetworkError();
  const dto = (await res.json()) as ProductDosificationDto;
  return toProductDosification(dto);
}

export async function updateDosification(
  { productId, dosificationId, branchId, body }: { productId: string; dosificationId: string; branchId: string; body: UpdateDosificationBody },
  fetchImpl = authFetch,
): Promise<ProductDosification> {
  let res: Response;
  try {
    res = await fetchImpl(`/api/v1/admin/products/${productId}/dosifications/${dosificationId}?branchId=${encodeURIComponent(branchId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (err) {
    return safeRethrow(err);
  }
  if (res.status === 409) throw new DuplicateDosificationNameError();
  if (!res.ok) throw new NetworkError();
  const dto = (await res.json()) as ProductDosificationDto;
  return toProductDosification(dto);
}

export async function softDeleteDosification(
  { productId, dosificationId }: { productId: string; dosificationId: string },
  fetchImpl = authFetch,
): Promise<void> {
  let res: Response;
  try {
    res = await fetchImpl(`/api/v1/admin/products/${productId}/dosifications/${dosificationId}`, { method: "DELETE" });
  } catch (err) {
    return safeRethrow(err);
  }
  if (!res.ok) throw new NetworkError();
}
