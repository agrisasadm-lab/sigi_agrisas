## 1. Regla de dominio

- [x] 1.1 En `src/modules/products/domain/services/resolveEffectivePrices.ts`, reemplazar la lógica de merge por: si `overrides.length > 0` retornar sólo `overrides`; si no, retornar sólo las filas con `branchId === null`. Actualizar el comentario JSDoc de la función.
- [x] 1.2 Actualizar `tests/unit/modules/products/domain/services/resolveEffectivePrices.test.ts` (o crearlo si no existe): casos — 0 overrides → todos los base; 1 override cubriendo sólo un `name` → únicamente ese override (los demás base NO aparecen); filas de otra sucursal en el input se ignoran igual que hoy.

## 2. Puerto de lookups

- [x] 2.1 En `src/modules/pos/application/ports/PosLookups.ts`, agregar `hasBranchPriceOverrides(productId: string, branchId: string): Promise<boolean>` a la interfaz `PosLookupService`, con comentario explicando su uso (gate de precio base vs. override).
- [x] 2.2 Implementar en `src/modules/pos/infrastructure/repositories/PrismaPosLookupService.ts`: `this.prisma.productPrice.count({ where: { productId, branchId } }) > 0`.
- [x] 2.3 Implementar el mismo método en el/los fake(s)/InMemory de `PosLookupService` usados por los tests de `pos` y `quotes` (buscar implementaciones existentes de la interfaz en `tests/`).

## 3. Enforzar en creación/edición de venta (POS)

- [x] 3.1 En `src/modules/pos/application/use-cases/CreateSaleUseCase.ts` (~línea 158, junto a la validación existente de `price.branchId !== req.branchId`), agregar: si `price.branchId === null` y `await this.lookups.hasBranchPriceOverrides(item.productId, req.branchId)` es `true`, lanzar `ProductPriceNotAvailableForBranchError`.
- [x] 3.2 Mismo cambio en `src/modules/pos/application/use-cases/EditCompletedSaleUseCase.ts` (~línea 97-98), usando `existing.sale.branchId` como sucursal de referencia.
- [x] 3.3 Tests: actualizar/crear `tests/unit/modules/pos/application/use-cases/CreateSaleUseCase.branchScoping.test.ts` y el test equivalente de `EditCompletedSaleUseCase` — caso nuevo: precio base seleccionado cuando el producto tiene override en la sucursal → rechaza con `ProductPriceNotAvailableForBranchError`; caso de regresión: precio base seleccionado cuando NO hay override en la sucursal → sigue aceptando (comportamiento actual sin cambio).

## 4. Enforzar en creación/edición de cotización

- [x] 4.1 En `src/modules/quotes/application/use-cases/CreateQuoteUseCase.ts` (~línea 95-96), mismo patrón que 3.1 usando `req.branchId`.
- [x] 4.2 En `src/modules/quotes/application/use-cases/UpdateQuoteUseCase.ts` (~línea 94-95), mismo patrón usando `existing.quote.branchId`.
- [x] 4.3 Tests: actualizar/crear `tests/unit/modules/quotes/application/use-cases/CreateQuoteUseCase.branchScoping.test.ts` y el equivalente de `UpdateQuoteUseCase` con los mismos dos casos de 3.3.

## 5. Caché offline

- [x] 5.1 En `app/_lib/offline/catalogCache.ts`, en `pullPricesFor`, agregar `branchId` a la URL (`?branchId=${ownerBranchId}`) usando el `branchId` propio del usuario ya disponible en el contexto de la caché (mismo patrón que el pull de productos, si existe).
- [x] 5.2 Test: actualizar el test existente de `catalogCache`/`pullPricesFor` (buscar en `tests/unit/ui/` o donde esté) verificando que la URL incluye `branchId` cuando el usuario tiene sucursal propia, y que se omite cuando no la tiene (admin sin sucursal seleccionada).

## 6. Verificación

- [x] 6.1 `npm test` — suite completa en verde.
- [x] 6.2 `npm run build` — sin errores de tipos.
- [x] 6.3 Verificación manual en dev (Playwright): producto `KAB1`/"KER KAB 1L" en sucursal ZARIOZ (override `$699.35` en "Precio Publico") — abrir POS con usuario de ZARIOZ, agregar el producto, confirmar que el selector de precio SÓLO muestra "Precio Publico $699.35" (no "Precio Subdis 10%ᐨ$3,300" ni "Precio Distri 15%-$3,116.65" de Matriz). Repetir en Cotizaciones.
- [x] 6.4 Verificación manual: producto SIN ningún override en HUAJUAPAN — confirmar que el selector sigue mostrando todos los tiers base de Matriz (sin regresión).
- [x] 6.5 Verificación manual vía API directa (curl/Postman con token válido): `POST /api/v1/admin/sales` con `productPriceId` de un precio BASE para un producto que tiene override en la sucursal del body → confirmar HTTP 400 `ProductPriceNotAvailableForBranchError`.
