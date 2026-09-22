/**
 * Resuelve el conjunto de precios efectivo de un producto para una sucursal:
 * si la sucursal tiene al menos un override propio (branchId === branchId),
 * el resultado son ÚNICAMENTE esos overrides — ya no se completa con los
 * precios base cuyo `name` no tenga override local. Si la sucursal no tiene
 * ningún override, el resultado son todos los precios base (branchId === null).
 *
 * `rows` puede contener filas de otras sucursales sin afectar el resultado
 * (se ignoran) — permite pasar el resultado crudo de una query amplia.
 *
 * Genérica sobre cualquier forma con `branchId`/`name` (entidad de dominio
 * `ProductPrice` o fila cruda de Prisma) para reusarse tanto en el
 * repositorio de productos como en el reporte de lista de precios.
 */
export function resolveEffectivePrices<T extends { branchId: string | null; name: string }>(
  rows: T[],
  branchId: string
): T[] {
  const overrides = rows.filter((p) => p.branchId === branchId);
  if (overrides.length > 0) return overrides;
  return rows.filter((p) => p.branchId === null);
}
