import { authFetch, NetworkError, UnauthenticatedError, ForbiddenError } from "../../../../../_lib/authFetch";
import type {
  ListProductsParams,
  ListProductsResponse,
  ProductDto,
  CreateProductBody,
  UpdateProductBody,
} from "../types/api";
import type { Product, CreatedProduct } from "../types/domain";
import {
  ProductNotFoundError,
  ProductCodeAlreadyInUseError,
  ProductDepartmentInvalidError,
} from "../errors";

export function toProduct(dto: ProductDto): Product {
  return {
    id: dto.id,
    code: dto.code,
    name: dto.name,
    unit: dto.unit,
    unitDescription: dto.unitDescription ?? null,
    satProductCode: dto.satProductCode,
    departmentId: dto.departmentId,
    departmentName: dto.departmentName,
    isTaxable: dto.isTaxable,
    taxRateId: dto.taxRateId ?? null,
    taxRateCode: dto.taxRateCode ?? null,
    providerId: dto.providerId ?? null,
    providerName: dto.providerName ?? null,
    ivaRate: dto.ivaRate,
    iepsRate: dto.iepsRate,
    imageUrl: dto.imageUrl ?? null,
    manufactureDate: dto.manufactureDate ?? null,
    acquisitionPrice: dto.acquisitionPrice ?? null,
    isActive: dto.isActive,
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

export async function listProducts(
  { page, pageSize, includeInactive, search, departmentId, providerId }: ListProductsParams,
  fetchImpl = authFetch,
  signal?: AbortSignal,
): Promise<{ items: Product[]; total: number; page: number; pageSize: number }> {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (includeInactive) params.set("includeInactive", "true");
  const trimmed = search?.trim();
  if (trimmed && trimmed.length >= 2) params.set("search", trimmed);
  if (departmentId) params.set("departmentId", departmentId);
  if (providerId) params.set("providerId", providerId);

  let res: Response;
  try {
    res = await fetchImpl(`/api/v1/admin/products?${params.toString()}`, { signal });
  } catch (err) {
    return safeRethrow(err);
  }
  if (!res.ok) throw new NetworkError();
  const body = (await res.json()) as ListProductsResponse;
  return {
    items: body.items.map(toProduct),
    total: body.total,
    page: body.page,
    pageSize: body.pageSize,
  };
}

export async function getProduct(
  { id }: { id: string },
  fetchImpl = authFetch,
): Promise<Product> {
  let res: Response;
  try {
    res = await fetchImpl(`/api/v1/admin/products/${id}`);
  } catch (err) {
    return safeRethrow(err);
  }
  if (res.status === 404) throw new ProductNotFoundError();
  if (!res.ok) throw new NetworkError();
  const dto = (await res.json()) as ProductDto;
  return toProduct(dto);
}

export async function createProduct(
  { body }: { body: CreateProductBody },
  fetchImpl = authFetch,
): Promise<CreatedProduct> {
  let res: Response;
  try {
    res = await fetchImpl(`/api/v1/admin/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (err) {
    return safeRethrow(err);
  }
  if (res.status === 409) {
    const data = await res.json().catch(() => ({})) as { error?: string };
    if (data.error?.toLowerCase().includes("code")) throw new ProductCodeAlreadyInUseError();
    throw new ProductCodeAlreadyInUseError();
  }
  if (res.status === 400) {
    const data = await res.json().catch(() => ({})) as { error?: string };
    if (data.error?.toLowerCase().includes("department")) throw new ProductDepartmentInvalidError();
    throw new NetworkError();
  }
  if (!res.ok) throw new NetworkError();
  const dto = (await res.json()) as ProductDto & { autoAssignedBranchId: string | null };
  return { ...toProduct(dto), autoAssignedBranchId: dto.autoAssignedBranchId };
}

export async function updateProduct(
  { id, body }: { id: string; body: UpdateProductBody },
  fetchImpl = authFetch,
): Promise<Product> {
  let res: Response;
  try {
    res = await fetchImpl(`/api/v1/admin/products/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (err) {
    return safeRethrow(err);
  }
  if (res.status === 404) throw new ProductNotFoundError();
  if (res.status === 400) {
    const data = await res.json().catch(() => ({})) as { error?: string };
    if (data.error?.toLowerCase().includes("department")) throw new ProductDepartmentInvalidError();
    throw new NetworkError();
  }
  if (!res.ok) throw new NetworkError();
  const dto = (await res.json()) as ProductDto;
  return toProduct(dto);
}

export async function softDeleteProduct(
  { id }: { id: string },
  fetchImpl = authFetch,
): Promise<void> {
  let res: Response;
  try {
    res = await fetchImpl(`/api/v1/admin/products/${id}`, { method: "DELETE" });
  } catch (err) {
    return safeRethrow(err);
  }
  if (res.status === 404) throw new ProductNotFoundError();
  if (!res.ok) throw new NetworkError();
}
