import { authFetch, NetworkError } from "../../../../_lib/authFetch";
import type { ProductPriceDto } from "../types/api";
import { isOnline } from "../../../../_lib/offline/connectivity";
import { getProductPricesFromCache } from "../../../../_lib/offline/catalogCache";

/**
 * `branchId` es obligatorio: el backend rechaza la consulta sin sucursal y no
 * existe un conjunto de precios compartido entre sucursales. Sin sucursal
 * seleccionada la lista es vacía — no hay precio que ofrecer.
 */
export async function getProductPrices(
  productId: string,
  branchId?: string | null,
  fetchImpl = authFetch,
): Promise<ProductPriceDto[]> {
  if (!branchId) return [];
  if (!isOnline()) return getProductPricesFromCache(productId, branchId);

  const url = `/api/v1/admin/products/${productId}/prices?branchId=${branchId}`;

  let res: Response;
  try {
    res = await fetchImpl(url);
  } catch (err) {
    if (err instanceof NetworkError) return getProductPricesFromCache(productId, branchId);
    throw new NetworkError();
  }

  if (!res.ok) throw new NetworkError();

  const json = await res.json() as { items: Array<Record<string, unknown>> } | Array<Record<string, unknown>>;
  const body = Array.isArray(json) ? json : (json as { items: Array<Record<string, unknown>> }).items ?? [];
  return body.map((p) => ({
    id: p.id as string,
    productId: p.productId as string,
    branchId: p.branchId as string,
    name: p.name as string,
    price: p.price as number,
    minQuantity: p.minQuantity as number,
    discountPct: p.discountPct as number,
    isDefault: p.isDefault as boolean,
  }));
}
