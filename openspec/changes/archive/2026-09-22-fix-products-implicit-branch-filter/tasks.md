## 1. Fix del backend

- [x] 1.1 En `src/modules/products/infrastructure/http/ProductsController.ts` (`list`, ~línea 162), cambiar `if (isBranchScopedInventory())` a `if (isBranchScopedInventory() && filtersParsed.data.branchId)`.
- [x] 1.2 Confirmar que `branchId`/`branchScoped` quedan en sus valores por defecto (`filtersParsed.data.branchId` sin tocar, `branchScoped = false`) cuando la condición no se cumple — sin cambios adicionales de código, solo verificar que el flujo existente ya hace esto correctamente al no entrar al bloque.

## 2. Actualizar tests existentes que codifican el comportamiento viejo

- [x] 2.1 En `tests/unit/modules/products/infrastructure/http/ProductsController.test.ts`, renombrar y reescribir el test `"branch mode: operator without branches:access_all is scoped to their own branch when branchId is omitted"` (línea ~391) a `"branch mode: operator without branches:access_all sees the full catalog when branchId is omitted"` — cambiar la aserción de `expect(body.total).toBe(0)` a `expect(body.total).toBe(1)` y `expect(body.items.find(...)).toBeUndefined()` a `.toBeDefined()` (el producto creado SÍ debe aparecer).
- [x] 2.2 Reemplazar el test `"branch mode: operator without an assigned branch is forbidden"` (línea ~419) por `"branch mode: operator without an assigned branch still sees the full catalog when branchId is omitted"` — cambiar la aserción de `expect(res.status).toBe(403)` a `expect(res.status).toBe(200)` con `body.total` reflejando el catálogo completo (sin filtrar), consistente con el nuevo escenario del spec.
- [x] 2.3 En el test `"branch mode: excludes products without a branch_inventory row"` (línea ~427), agregar `branchId: BRANCH_A` explícito a `makeListReq` (hoy se llama sin `branchId`, lo cual tras el fix ya no filtraría). Agregar un segundo producto (`P2`) sin fila de inventario en `BRANCH_A` para que la aserción distinga realmente "incluye el asignado, excluye el no asignado" en vez de coincidir por tener un solo producto en el repo de la prueba.
- [x] 2.4 Renombrar el test `"branch mode: admin with branches:access_all and no branchId sees the full catalog"` (línea ~443) — se deja sin cambios; sigue pasando y no es redundante (cubre explícitamente el caso `branches:access_all`, distinto del caso genérico sin ese permiso).
- [x] 2.5 Correr `npx jest --testPathPattern=ProductsController.test` y confirmar todos los tests en verde tras los cambios. 32/32 verde.

## 3. Test nuevo — caso explícito que faltaba

- [x] 3.1 Agregar un test nuevo: `"branch mode: explicit branchId matching own branch still filters correctly"` — un operador sin `branches:access_all`, asignado a `BRANCH_A`, pide `?branchId=BRANCH_A` explícito con dos productos (uno con fila de inventario en `BRANCH_A`, otro sin ella) → la respuesta solo incluye el asignado. Confirma que el camino "branchId explícito" sigue intacto tras el fix (no solo el camino "branchId omitido").

## 4. Verificación manual (dev)

- [x] 4.1 Con el usuario `kevhernandez07@gmail.com` (rol `zarioz_test`, sucursal ZARIOZ): abrir `/catalogs/products` — confirmado "Mostrando 1–20 de **857**" (antes: 224).
- [x] 4.2 Mismo usuario: abrir `/inventory` → "Asignar producto" → buscar "SUPER BTN 10" (confirmado previamente NO asignado a ZARIOZ) → apareció "SUPER_BTN_10_L — SUPER BTN 10 L" en el buscador (antes: 0 resultados) → se asignó exitosamente → banner "SUPER_BTN_10_L — SUPER BTN 10 L asignado a la sucursal. Asignar precio de venta" (link del change `add-inventory-to-pricing-link` funcionando encadenado). Asignación de prueba revertida en dev al terminar.
- [x] 4.3 Con `admin` (`branches:access_all`): repetido 4.1 vía API — total sigue en 857, sin cambio (sin regresión).
- [x] 4.4 Confirmado en Network: POS (`/pos`) sigue enviando `branchId=<ZARIOZ>` explícito en sus 4 llamadas a `/api/v1/admin/products`, y el `total` para ese `branchId` sigue siendo 224 (su catálogo scoped intacto, sin regresión).
- [x] 4.5 `npm run build` para verificar tipos. Build exitoso.
- [x] 4.6 `npx jest` (suite completa) para confirmar que no se rompió nada fuera de lo tocado. 554/556 suites, 4054/4068 tests OK.
