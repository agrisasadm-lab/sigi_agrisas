## Context

`resolveEffectivePrices` (`src/modules/products/domain/services/resolveEffectivePrices.ts`) es la única función de dominio que decide qué precios ve una sucursal:

```ts
export function resolveEffectivePrices<T extends { branchId: string | null; name: string }>(
  rows: T[],
  branchId: string
): T[] {
  const overrides = rows.filter((p) => p.branchId === branchId);
  const overrideNames = new Set(overrides.map((p) => p.name));
  const inheritedBases = rows.filter((p) => p.branchId === null && !overrideNames.has(p.name));
  return [...overrides, ...inheritedBases];
}
```

Tres consumidores la usan tal cual (sin cambio de firma tras este fix): `PrismaProductPriceRepository.findEffectiveForBranch`, `InMemoryProductPriceRepository`, y `PrismaDepartmentPriceListRepository` (reporte de lista de precios por departamento).

La validación de "el precio pertenece a la sucursal" ya existe, duplicada en 3 use cases, todos con el mismo patrón `price.branchId != null && price.branchId !== <branchId de la operación>`:
- `CreateSaleUseCase.ts:158` (rechaza override de otra sucursal)
- `EditCompletedSaleUseCase.ts:97-98`
- `CreateQuoteUseCase.ts:95-96`
- `UpdateQuoteUseCase.ts:94-95`

Ninguna de las 4 rechaza hoy un precio BASE (`branchId === null`) cuando la sucursal de la operación ya tiene su propio override — ese es el hueco que permite seleccionar Matriz aunque exista precio local (ver proposal.md — Why).

`PosLookupService` (`src/modules/pos/infrastructure/repositories/PrismaPosLookupService.ts`) es el único puerto de lookups compartido por POS y Cotizaciones (`quotes/infrastructure/di/container.ts:26` instancia `PrismaPosLookupService` directamente, no un puerto propio) — un método nuevo ahí sirve a los 4 use cases sin duplicar implementación.

## Goals / Non-Goals

**Goals** (trazado a la Historia de Usuario #1 de proposal.md):
- El selector de precios en POS/Cotizaciones nunca ofrece un tier de Matriz que la sucursal no tiene, cuando esa sucursal ya definió su propio precio (AC1, AC2).
- La regla se aplica también si el cliente llama a la API directamente sin pasar por la UI (AC3, Criterio de Seguridad 1).
- Sin cambio de permisos ni de contrato de endpoints — mismo `products:read`/`sales:create`/`quotes:create` de siempre (Criterio de Seguridad 2).

**Non-Goals:**
- No se resuelve la limitación de la caché offline de precios per se (`app/_lib/offline/catalogCache.ts`) más allá de agregar `branchId` a la URL de precarga — el comportamiento fino de qué pasa si el POS está offline y el catálogo cacheado quedó desactualizado no cambia con este fix (ya era best-effort).
- No se toca el orden de prioridad de negocio (`Precio Publico` → `subdis` → `distri` → resto) — sólo qué subconjunto de filas entra a ese ordenamiento.
- No se modifica `getDosificationForSale` (resolución de precio default para líneas de dosificación) — ya resuelve el override de sucursal primero con fallback al global; esa lógica es independiente de `resolveEffectivePrices` y no tiene el mismo bug (siempre prioriza el override si existe).
- No se migra ni se re-siembra ningún dato — los overrides en producción ya son correctos (verificado: 222/225 coinciden con el Excel).

## Decisions

**1. Regla de `resolveEffectivePrices`: si hay ≥1 override, sólo overrides; si no, todos los bases.**

```ts
export function resolveEffectivePrices<T extends { branchId: string | null; name: string }>(
  rows: T[],
  branchId: string
): T[] {
  const overrides = rows.filter((p) => p.branchId === branchId);
  if (overrides.length > 0) return overrides;
  return rows.filter((p) => p.branchId === null);
}
```

Alternativa descartada: mantener el merge por nombre pero excluir sólo los nombres SIN mapeo a ningún tier conocido de la sucursal. Se descarta porque el reporte de campo (proposal.md — Why) muestra que la intención real del negocio es "una sucursal con precio propio vende únicamente a ese precio", no una fusión parcial por nombre — el Excel de precios por tienda trae una sola columna de precio, no tiers.

**2. Enforzar en backend con un método nuevo `hasBranchPriceOverrides`, no reutilizando `findEffectiveForBranch`.**

`PosLookups.hasBranchPriceOverrides(productId: string, branchId: string): Promise<boolean>` — un `count` directo (`productPrice.count({ where: { productId, branchId } }) > 0`), no una consulta que traiga filas. Alternativa descartada: llamar a `resolveEffectivePrices` desde el use case y comparar longitudes — más costoso (trae todas las filas del producto) para responder una pregunta booleana, y acopla el use case a una función de dominio de otro módulo (`products`) en vez de pasar por el puerto de lookups que POS/Cotizaciones ya usan para todo lo demás.

**3. La validación nueva vive en los 4 use cases que ya tienen la validación de "otra sucursal", como una condición adicional que reutiliza el mismo error.**

En cada uno, junto al `if (price.branchId != null && price.branchId !== branchId) throw ProductPriceNotAvailableForBranchError()` existente, se agrega:

```ts
if (price.branchId == null && await this.lookups.hasBranchPriceOverrides(item.productId, branchId)) {
  throw new ProductPriceNotAvailableForBranchError();
}
```

Se reutiliza el mismo error (ya mapeado a HTTP 400 en los 4 controllers) — no se introduce un tipo de error nuevo porque, desde la perspectiva del caller, es la misma clase de problema ("este precio no es válido para esta sucursal"), y el mensaje ya definido en las specs ("Product price does not belong to this branch") sigue siendo preciso.

**4. Caché offline: agregar `branchId` a `pullPricesFor`, sin más cambios.**

`app/_lib/offline/catalogCache.ts` (`pullPricesFor`) hoy pide `/products/:id/prices` sin `branchId` — cachea sólo precios base. Con la regla nueva, una sucursal con override quedaría con la caché vacía de precios reales (peor que hoy). El fix es una línea (agregar `?branchId=${ownerBranchId}` a la URL), usando el `branchId` propio del usuario logueado (ya disponible en el contexto de la caché, mismo patrón que `pullProductsFor`). No se rediseña el mecanismo de caché.

## Riesgos / Trade-offs

- **[Riesgo] Un producto con override de sucursal pero SIN override marcado `isDefault`** → tras el fix, si el único precio que la sucursal tiene no es el default, el selector no muestra ningún precio "default" preseleccionado. **Mitigación**: no es un caso nuevo introducido por este fix — ya podía ocurrir hoy si el override no es default; `PriceTierPicker.tsx` ya maneja "sin default, usar el primero de la lista" (`prices.find(isDefault) ?? prices[0]`). Sin cambio de UI necesario.
- **[Riesgo] Ventas antiguas con `productPriceId` apuntando a un precio base que YA no sería seleccionable hoy** (la sucursal ganó un override después de esa venta) → la validación nueva sólo corre en creación/edición, nunca al leer una venta ya completada; el snapshot (`priceNameSnapshot`, `unitPrice`) es inmutable y no se re-valida. Sin impacto en datos históricos.
- **[Riesgo] `hasBranchPriceOverrides` agrega una consulta extra por línea de venta/cotización** (sólo cuando el precio elegido es base) → costo marginal: un `COUNT` indexado por `(productId, branchId)` (ya existe `@@index([branchId])` y `@@unique([productId, branchId, name])` en `ProductPrice`), ejecutado sólo para líneas base, no para overrides (la mayoría de líneas en sucursales con catálogo propio ya son overrides y no disparan la consulta).
- **[Trade-off] La caché offline (`catalogCache.ts`) queda dependiente de que el dispositivo haya sincronizado con el `branchId` correcto antes de quedarse sin red** — si el usuario nunca sincronizó estando online con su sucursal asignada, la caché offline de precios queda vacía para productos con override. Aceptado: es estrictamente mejor que el estado actual (que servía precios de Matriz incorrectos sin avisar), y una caché vacía es un fallo visible (sin precios que elegir), no silencioso.

## Migration Plan

Sin migración de datos ni de schema. Despliegue estándar:
1. Merge a `develop` → deploy automático (según `project_vercel_deploy_setup`).
2. Sin pasos de rollback especiales — revertir el commit restaura el comportamiento de merge anterior; ningún dato se transforma de forma irreversible.
3. Verificación post-deploy: repetir en prod (sólo lectura) la consulta ya usada en el análisis de campo — confirmar que el POS de ZARIOZ ya no ofrece "Precio Subdis 10%"/"Precio Distri 15%" para productos con override local (ej. `KAB1`).
