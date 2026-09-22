## 1. Servicio de búsqueda de productos

- [x] 1.1 En `app/(private)/purchases/_logic/services/searchProducts.ts`, agregar `branchId?: string` a `SearchProductsParams` y, cuando esté presente, incluirlo en el query string (`params.set("branchId", branchId)`), igual que `app/(private)/pos/_logic/services/searchProducts.ts`.

## 2. Hook de búsqueda

- [x] 2.1 En `app/(private)/purchases/_logic/hooks/useProductSearch.ts`, agregar `branchId?: string` a `UseProductSearchParams`, pasarlo a `searchProducts(...)` y añadirlo a las dependencias del `useEffect`.
- [x] 2.2 En el mismo hook, cuando `branchId` sea `undefined`/`""`, no ejecutar el fetch: limpiar `items`/`total` a vacío y devolver early (sin abrir `AbortController` innecesario), para que `isLoading` no quede en `true` indefinidamente.

## 3. Formulario de alta de compra

- [x] 3.1 En `app/(private)/purchases/_blocks/CreatePurchasePage.tsx`, pasar el `branchId` ya calculado (línea ~41: `isBypass === true ? selectedBranchId : (userBranchId ?? "")`) a `useProductSearch({ search: debouncedProductQuery, branchId })`.
- [x] 3.2 Cuando `branchId === ""` (usuario con `branches:access_all` sin sucursal seleccionada), mostrar en el combobox/lista de productos un hint "Selecciona una sucursal para buscar productos" en vez de invocar la búsqueda o mostrar el estado vacío genérico.
- [x] 3.3 Verificar que al cambiar `selectedBranchId` (bypass) los resultados del buscador se refresquen con la nueva sucursal (ya cubierto por el cambio de dependencia del `useEffect` en 2.1, confirmar manualmente).

## 4. CFDI / SAT (verificación, sin cambio de algoritmo)

- [x] 4.1 Confirmar que `handleSatParsed`/`buildSatApplyResult` (matching de conceptos del XML) resuelve productos contra el mismo catálogo ya filtrado por sucursal (vía `useProductSearch`/`productOptions`) y no contra una fuente propia sin scope — si usa una búsqueda independiente (`searchProductsByName`), documentarlo como fuera de alcance en el resultado de `opsx:verify` (no se toca en este change, ver design.md Non-Goals).

## 5. Tests

- [x] 5.1 Crear/actualizar test unit de `useProductSearch` (`tests/unit/ui/(private)/purchases/_logic/hooks/useProductSearch.test.ts`): verifica que `branchId` se incluye en la llamada a `searchProducts`, que cambia de `branchId` dispara nueva búsqueda, y que `branchId` vacío no dispara fetch.
- [x] 5.2 Actualizar/crear test unit de `searchProducts.ts` (`tests/unit/ui/(private)/purchases/_logic/services/`) verificando que `branchId` se agrega al query string sólo cuando está presente.
- [x] 5.3 Crear test unit de `CreatePurchasePage` (`tests/unit/ui/(private)/purchases/_blocks/CreatePurchasePage.test.tsx`) cubriendo: operador sin `branches:access_all` busca con su `branchId` propio; usuario bypass sin sucursal ve el hint y no dispara búsqueda; usuario bypass selecciona sucursal y el buscador se activa con ese `branchId`.

## 6. Verificación

- [x] 6.1 `npm test` — suite completa en verde.
- [x] 6.2 `npm run build` — sin errores de tipos.
- [x] 6.3 Verificación manual en dev (Playwright, ver plan de verificación aprobado): usuario rol tienda ZARIOZ en `/purchases/new` → buscador sólo lista productos con fila en `branch_inventory` de ZARIOZ; usuario `admin@example.com` sin sucursal seleccionada → hint; admin selecciona PRADERA → buscador filtra a PRADERA.
