## 1. Fix 1 — Reporte de Inventario "Global" (historia 1)

- [x] 1.1 En `src/modules/reports/infrastructure/repositories/PrismaDepartmentPriceListRepository.ts`, cambiar la condición de la query de stock (`$queryRaw`) de `filters.branchId ? ... : TRUE` a usar `scopeBranchId` (el mismo fallback a sucursal matriz ya usado para precios).
- [x] 1.2 Crear `tests/unit/modules/reports/infrastructure/repositories/PrismaDepartmentPriceListRepository.test.ts` (mock de `PrismaClient` con `$queryRaw: jest.fn()`, mismo patrón que `PrismaSalesCutRepository.test.ts`) cubriendo: (a) sin `branchId` el query de stock filtra por el id de HQ, no por `TRUE`; (b) con `branchId` explícito, filtra por ese id exacto (sin regresión).

## 2. Fix 2 — Buscador de producto en Kardex (historias 2 y 3)

- [x] 2.1 En `app/(private)/inventory/kardex/_logic/services/searchProducts.ts`, agregar `branchId?: string` a `SearchProductsParams` y, si viene, `params.set("branchId", branchId)`.
- [x] 2.2 En `app/(private)/inventory/kardex/_logic/hooks/useProductSearch.ts`, aceptar `branchId?: string`, pasarlo a `searchProducts`, agregarlo a las deps del `useEffect`.
- [x] 2.3 En `app/(private)/inventory/kardex/_blocks/KardexPage.tsx`, obtener `branchId` propio desde `useCurrentUser()` y calcular el `branchId` efectivo de búsqueda: `isBypass === true ? (branchId || undefined) : (userBranchId ?? undefined)`.
- [x] 2.4 Pasar ese valor como nuevo prop (ej. `productSearchBranchId`) de `KardexPage` a `KardexFilters`, y desde ahí al `useProductSearch` que ya vive dentro de `KardexFilters.tsx`.
- [x] 2.5 Crear/actualizar tests de `searchProducts.ts` y `useProductSearch.ts` de kardex (mirror de `tests/unit/ui/(private)/purchases/_logic/...`): branchId se agrega al query string cuando viene; se omite cuando no viene (caso "Todos" intencional para bypass).

## 3. Fix 3 — Buscador de producto en Abonos / Payments (historia 4)

- [x] 3.1 En `app/(private)/payments/_logic/services/searchProducts.ts`, mismo cambio que 2.1 (agregar `branchId?` opcional al query string).
- [x] 3.2 En `app/(private)/payments/_logic/hooks/useProductSearch.ts`, mismo cambio que 2.2 (aceptar y propagar `branchId?`).
- [x] 3.3 En `app/(private)/payments/_blocks/PaymentsHistoryToolbar.tsx`, agregar `branchId: userBranchId` a la destructuración de `useCurrentUser()` (ya se usa `can` ahí) y calcular `productSearchBranchId` con la misma fórmula que 2.3, pasándolo a `useProductSearch({ search: debouncedProductQuery, branchId: productSearchBranchId })`.
- [x] 3.4 Crear/actualizar tests de `searchProducts.ts` y `useProductSearch.ts` de payments, mismo mirror que 2.5.

## 4. Verificación

- [x] 4.1 Correr `npm test` completo — todos los tests nuevos y existentes en verde.
- [x] 4.2 Verificación manual con Playwright (`mcp__playwright__*`) contra `npm run dev`, usuario admin (sesión ya iniciada en el navegador):
  - Reportes → Inventario → tab "Global" con "Todas" → verificado en vivo: `QUAN1` (251 en Matriz, 0 en el resto) muestra `0.0000` bajo "Todas" (nunca mezcla; en esta DB no hay sucursal `isHeadquarters`, cayó al ajuste de "vacío" hecho en el mismo fix) y `251.0000` con "Matriz" elegida explícitamente — sin regresión.
  - Inventario → Kardex → combobox "Clave" con admin + "Todos" → catálogo completo (`PRO_RAIZ_MAX_DE_1L` de TLAXIACO y `PRO_RA` de Matriz ambos visibles). Con "Matriz" elegida → sólo `PRO_RA` (asignado a Matriz), `PRO_RAIZ_MAX_DE_1L` (sólo TLAXIACO) correctamente excluido.
  - Abonos → Historial → buscador de producto, mismo caso (`PRO_RA`/`PRO_RAIZ_MAX_DE_1L`) con sucursal "Matriz" → mismo resultado correcto.
  - Ruta de operador (no-bypass) verificada en vivo: se creó un usuario de prueba efímero (rol `operator`, sucursal ZARIOZ, sin `branches:access_all`) sólo para esta verificación, en la DB de dev. Kardex y Abonos → Historial, buscando "RAIZ MAX": ambos mostraron únicamente `PRO_RA` (asignado a ZARIOZ) y excluyeron `PRO_RAIZ_MAX_DE_1L` (sólo TLAXIACO) — sin errores 403, confirmando que el operador usa siempre su propia sucursal (vía `useCurrentUser()`) y no el valor cosmético del Select "Almacén"/"Sucursal" (que para no-bypass no refleja su sucursal real, ver D3 en design.md). Usuario de prueba eliminado al terminar.
  - Durante esta verificación se encontró y corrigió un bug real en la implementación de la tarea 1.1 (ver nota abajo).
- [x] 4.3 Correr `opsx:verify` contra este change antes de pedir archivado.
