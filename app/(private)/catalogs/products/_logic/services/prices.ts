import { authFetch, NetworkError, UnauthenticatedError, ForbiddenError } from "../../../../../_lib/authFetch";
import type {
  ListProductPricesResponse,
  ProductPriceDto,
  CreatePriceBody,
  UpdatePriceBody,
} from "../types/api";
import type { ProductPrice } from "../types/domain";
import { DuplicatePriceNameError, DuplicateDefaultPriceError, ProductNotFoundError } from "../errors";

export function toProductPrice(dto: ProductPriceDto): ProductPrice {
  return {
    id: dto.id,
    productId: dto.productId,
    branchId: dto.branchId,
    name: dto.name,
    price: dto.price,
    minQuantity: dto.minQuantity,
    discountPct: dto.discountPct,
    isDefault: dto.isDefault,
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

export async function listPrices(
  { productId, branchId }: { productId: string; branchId: string },
  fetchImpl = authFetch,
  signal?: AbortSignal,
): Promise<ProductPrice[]> {
  const qs = `?branchId=${encodeURIComponent(branchId)}`;
  let res: Response;
  try {
    res = await fetchImpl(`/api/v1/admin/products/${productId}/prices${qs}`, { signal });
  } catch (err) {
    return safeRethrow(err);
  }
  if (res.status === 404) throw new ProductNotFoundError();
  if (!res.ok) throw new NetworkError();
  const body = (await res.json()) as ListProductPricesResponse;
  return body.items.map(toProductPrice);
}

export async function createPrice(
  { productId, body }: { productId: string; body: CreatePriceBody },
  fetchImpl = authFetch,
): Promise<ProductPrice> {
  let res: Response;
  try {
    res = await fetchImpl(`/api/v1/admin/products/${productId}/prices`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (err) {
    return safeRethrow(err);
  }
  if (res.status === 409) {
    const data = await res.json().catch(() => ({})) as { error?: string };
    if (data.error?.toLowerCase().includes("default")) throw new DuplicateDefaultPriceError();
    throw new DuplicatePriceNameError();
  }
  if (!res.ok) throw new NetworkError();
  const dto = (await res.json()) as ProductPriceDto;
  return toProductPrice(dto);
}

export async function updatePrice(
  { productId, priceId, body }: { productId: string; priceId: string; body: UpdatePriceBody },
  fetchImpl = authFetch,
): Promise<ProductPrice> {
  let res: Response;
  try {
    res = await fetchImpl(`/api/v1/admin/products/${productId}/prices/${priceId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (err) {
    return safeRethrow(err);
  }
  if (res.status === 409) {
    const data = await res.json().catch(() => ({})) as { error?: string };
    if (data.error?.toLowerCase().includes("default")) throw new DuplicateDefaultPriceError();
    throw new DuplicatePriceNameError();
  }
  if (!res.ok) throw new NetworkError();
  const dto = (await res.json()) as ProductPriceDto;
  return toProductPrice(dto);
}

export async function deletePrice(
  { productId, priceId }: { productId: string; priceId: string },
  fetchImpl = authFetch,
): Promise<void> {
  let res: Response;
  try {
    res = await fetchImpl(`/api/v1/admin/products/${productId}/prices/${priceId}`, { method: "DELETE" });
  } catch (err) {
    return safeRethrow(err);
  }
  if (!res.ok) throw new NetworkError();
}
