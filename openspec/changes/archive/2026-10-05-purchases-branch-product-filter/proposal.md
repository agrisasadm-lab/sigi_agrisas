## Historia de Usuario

| # | Rol | Tarea | Motivo | Criterios de Aceptación | Criterios de Seguridad |
|---|---|---|---|---|---|
| 1 | Operador de sucursal (sin `branches:access_all`) dando de alta una compra | Como operador de sucursal, quiero que el buscador de productos en "Alta de compra" muestre sólo los productos asignados a mi sucursal (fila en `branch_inventory`) para no poder seleccionar por error un producto que no pertenece a mi sucursal | Hoy el buscador trae el catálogo activo completo (comparte el mismo endpoint sin `branchId` que ya se corrigió para el catálogo general), lo que permite dar de alta compras con productos ajenos a la sucursal y genera inconsistencias de inventario | - Given un operador con sucursal propia asignada, When abre "Alta de compra" y busca un producto, Then sólo aparecen productos con fila en `branch_inventory` de su sucursal (misma fuente que ya filtra `ProductsController.list` con `branchId`)<br>- Given el operador busca un producto que existe en el catálogo pero NO está asignado a su sucursal, When escribe el término de búsqueda, Then el producto no aparece en resultados (ni por código ni por nombre)<br>- Given no hay ningún producto asignado a la sucursal que matchee la búsqueda, When se muestra el resultado, Then el buscador muestra la lista vacía existente (mismo componente, sin nuevo estado especial) | - El filtrado por sucursal se resuelve en backend (`branchId` viaja al mismo endpoint `GET /api/v1/admin/products` que ya aplica `resolveScopedBranchId`/`enforceBranchScope`) — el frontend no filtra client-side una lista sin scope<br>- El `branchId` enviado es siempre el de la sucursal ya resuelta en la página (propia del operador, o la seleccionada por un bypass), nunca un valor libre editable en el request de búsqueda |
| 2 | Administrador con `branches:access_all` dando de alta una compra | Como administrador, quiero que el buscador de productos en "Alta de compra" respete la sucursal que seleccioné en el formulario (no mi ausencia de sucursal propia) para dar de alta compras en la sucursal correcta sin ver productos de otras sucursales mezclados | El admin no tiene `branchId` propio fijo — hoy, al no mandarse `branchId` al buscador, ve el catálogo completo sin relación con la sucursal elegida en el formulario de compra | - Given un admin que ya seleccionó una sucursal en el formulario de compra, When busca un producto, Then sólo ve productos asignados a esa sucursal seleccionada (igual que el operador, pero con la sucursal que él eligió)<br>- Given un admin que aún NO ha seleccionado sucursal, When intenta buscar, Then el buscador no dispara la búsqueda y se muestra un hint pidiendo seleccionar sucursal primero (evita la ambigüedad de "todas" vs "ninguna")<br>- Given el admin cambia la sucursal seleccionada a mitad de la búsqueda, When el cambio ocurre, Then los resultados se refrescan con el filtro de la nueva sucursal (sin resultados obsoletos de la sucursal anterior) | - `branchId` para el admin es el valor `selectedBranchId` del propio formulario de compra (mismo estado ya usado para crear la compra), no un input adicional independiente — evita divergencia entre "sucursal de la compra" y "sucursal del buscador" |

Nota: se separó en 2 historias porque el origen del `branchId` difiere por rol (propio del operador vs. seleccionado por el admin) y el caso 2 agrega un criterio de aceptación propio (hint sin sucursal) que no aplica al operador, que siempre tiene sucursal fija.

## Why

El buscador de productos de "Alta de compra" (`app/(private)/purchases/_logic/services/searchProducts.ts`) llama a `GET /api/v1/admin/products` sin `branchId`, a diferencia del buscador equivalente del POS (`app/(private)/pos/_logic/services/searchProducts.ts`) que sí lo manda. Desde que `fix-products-implicit-branch-filter` corrigió el catálogo general para devolver TODO el catálogo activo cuando no se pasa `branchId` (comportamiento correcto para `/catalogs/products`), el efecto colateral en compras es que el buscador ya no hereda ningún filtro implícito: un operador de sucursal puede seleccionar cualquier producto activo del catálogo (857 productos) al dar de alta una compra, no sólo los ~224 asignados a su propia sucursal — reportado en campo como "al dar de alta la compra se muestran todos los productos y no sólo los de la sucursal".

## What Changes

- `app/(private)/purchases/_logic/services/searchProducts.ts`: acepta parámetro `branchId` opcional y lo agrega al query string (`?branchId=`), mismo patrón que el buscador de POS.
- `app/(private)/purchases/_logic/hooks/useProductSearch.ts`: acepta prop `branchId`, la incluye en las dependencias del efecto de búsqueda (refresca resultados al cambiar de sucursal).
- `app/(private)/purchases/_blocks/CreatePurchasePage.tsx`: pasa el `branchId` ya resuelto en el formulario (`isBypass ? selectedBranchId : userBranchId`) al hook `useProductSearch`. Si `branchId` está vacío (admin sin sucursal seleccionada aún), el hook no dispara la búsqueda y la UI muestra un hint pidiendo seleccionar sucursal primero.
- Sin cambios de backend: `ProductsController.list` ya filtra por `branchId` en modo `INVENTORY_SCOPE_MODE=branch` (vía `inventory.some.branchId`) y ya aplica `resolveScopedBranchId`/`enforceBranchScope` cuando el `branchId` viene en el query — este change sólo hace que el módulo de compras empiece a usar ese contrato existente.

## Capabilities

### New Capabilities
_(ninguna)_

### Modified Capabilities
- `purchases-ui`: el requirement del buscador de productos en el formulario de alta de compra cambia — pasa de consultar el catálogo sin scope a filtrar por la sucursal activa del formulario (propia del operador o seleccionada por un bypass), con hint cuando no hay sucursal seleccionada.

## Impact

- **Archivos modificados**: `app/(private)/purchases/_logic/services/searchProducts.ts`, `app/(private)/purchases/_logic/hooks/useProductSearch.ts`, `app/(private)/purchases/_blocks/CreatePurchasePage.tsx`.
- **Sin cambios de API, schema, ni permisos**: `ProductsController.list`, `resolveScopedBranchId`, `enforceBranchScope` y `ListProductsUseCase` no se tocan — ya soportan el contrato `branchId` que este change empieza a usar desde compras.
- **Sin cambios de datos**: no requiere migración ni seed.
- **Alcance de pruebas**: unit test de UI (`tests/unit/ui/(private)/purchases/...`) para `CreatePurchasePage`/`useProductSearch` verificando que `branchId` se propaga a la búsqueda y que el hint aparece sin sucursal seleccionada.
