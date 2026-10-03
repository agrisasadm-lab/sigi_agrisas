## 1. Filtrado del selector de sucursal

- [x] 1.1 En `ProductPricesTab.tsx`, obtener `branchId` (propio) y `can("branches:access_all")` desde `useCurrentUser()`.
- [x] 1.2 Calcular `visibleBranches` con `useMemo` sobre `branches` (de `useBranchesOptions`), `canAccessAllBranches` y el `branchId` propio: si `canAccessAllBranches === true` o `"loading"`, usar `branches` sin filtrar; si `false`, filtrar a `branches.filter((b) => b.id === userBranchId)`.
- [x] 1.3 Reemplazar el `.map(branches...)` del `<select id="price-branch-scope">` para iterar `visibleBranches` en vez de `branches`.
- [x] 1.4 Verificar manualmente que un usuario sin `branches:access_all` y sin `branchId` asignado (`null`) ve solo la opción "Precio base (todas)". (cubierto por test unitario 3.3 + lógica revisada; el usuario real de prueba en dev sí tiene sucursal asignada)

## 2. Traducción del error de branch-scope

- [x] 2.1 Importar `ForbiddenError` desde `app/_lib/authFetch` en `useProductPrices.ts` (`app/(private)/catalogs/products/_logic/hooks/useProductPrices.ts`).
- [x] 2.2 En el `catch` de `createOne`, antes del `setSaveError` genérico: si `err instanceof ForbiddenError && err.required === "branches:access_all"`, hacer `setSaveError("No puedes crear precios para otra sucursal.")` y `return null` (sin re-lanzar).
- [x] 2.3 Aplicar el mismo cambio en el `catch` de `updateOne`.
- [x] 2.4 No tocar el `catch` de `deleteOne` ni el manejo de `DuplicatePriceNameError`/`DuplicateDefaultPriceError` (siguen re-lanzándose igual).

## 3. Tests

- [x] 3.1 Test unitario de UI (`tests/unit/ui/...`) para `ProductPricesTab`/`useProductPrices`: usuario sin `branches:access_all` con `branchId` asignado ve solo su sucursal + "Precio base" en el selector.
- [x] 3.2 Test unitario: usuario con `branches:access_all` sigue viendo todas las sucursales activas en el selector (sin regresión).
- [x] 3.3 Test unitario: usuario sin `branches:access_all` y sin `branchId` asignado ve solo "Precio base (todas)".
- [x] 3.4 Test unitario: `createOne`/`updateOne` con un `ForbiddenError({required: "branches:access_all"})` simulado produce `saveError === "No puedes crear precios para otra sucursal."` (no el mensaje crudo "Forbidden").
- [x] 3.5 Test unitario: otros errores (`DuplicatePriceNameError`, `DuplicateDefaultPriceError`, `NetworkError`) siguen produciendo su mensaje/comportamiento actual sin regresión.

## 4. Verificación manual (dev)

- [x] 4.1 Repetir la reproducción manual ya hecha (rol `zarioz_test`, sucursal ZARIOZ, en `/catalogs/products/[id]` tab Precios): confirmado que el selector ya no ofrece "Matriz" (solo "Precio base (todas)" + "ZARIOZ"). El mensaje traducido del 403 queda cubierto por el test unitario 3.4 (no se forzó en browser).
- [x] 4.2 Repetir con el usuario admin (`branches:access_all`) y confirmar que el selector sigue mostrando todas las sucursales, sin regresión. Confirmado: selector muestra las 8 sucursales activas.
- [x] 4.3 `npm run build` para verificar tipos. Build exitoso, sin errores de tipos.
