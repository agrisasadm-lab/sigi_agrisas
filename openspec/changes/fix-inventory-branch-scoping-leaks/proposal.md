## Historia de Usuario

| # | Rol | Tarea | Motivo | Criterios de Aceptación | Criterios de Seguridad |
|---|---|---|---|---|---|
| 1 | Administrador (con `branches:access_all`) | Como administrador, quiero que el reporte de Inventario en la pestaña "Global" muestre el stock de una sola sucursal de referencia cuando no elijo ninguna, para poder confiar en los números sin que se mezclen cantidades de todas las sucursales en un solo total engañoso | - Entrar a Reportes → Inventario → tab "Global" sin seleccionar sucursal en el filtro → el stock mostrado por producto corresponde a UNA sola sucursal (la matriz/HQ), igual que ya ocurre hoy con los precios, no a la suma de todas.<br>- Seleccionar una sucursal específica en el filtro → el stock mostrado sigue siendo exactamente el de esa sucursal (comportamiento sin regresión).<br>- Si no existe sucursal matriz (`isHeadquarters`) y no se eligió ninguna, el reporte no debe fallar (stock vacío/0, no excepción). | - No se expone un endpoint nuevo de "stock total cross-branch" (ya prohibido por spec `inventory-api` — "No global stock").<br>- La resolución de sucursal (HQ) ocurre en el repositorio, no se filtra en memoria después de traer todo — evita exponer cantidades de sucursales a las que el usuario no tiene acceso explícito. |
| 2 | Operador de sucursal (sin `branches:access_all`) | Como operador, quiero que al buscar un producto por clave en el Kardex de Inventario sólo aparezcan los registros/variantes asignados a MI sucursal, para no confundirme con productos de otras sucursales que no puedo ni debo ver | - Logueado como operador de sucursal B1, buscar una clave con variantes en B1/B2/B3 (ej. "NKS") en el combobox "Clave" del Kardex → sólo aparece la variante de B1.<br>- El select "Almacén" del Kardex sigue funcionando igual para generar el reporte de movimientos (sin regresión).<br>- Si el operador no tiene sucursal asignada (caso borde), la búsqueda no debe romperse (fallback sin filtro, no excepción/crash). | - El buscador nunca debe recibir ni enviar un `branchId` distinto al propio del operador — evita una respuesta 403 del backend y evita exponer/filtrar por sucursales ajenas.<br>- No depende de filtrado en cliente: el filtro se aplica en el backend (`GET /api/v1/admin/products?branchId=...`), consistente con el resto de módulos (`purchases`, `pos`). |
| 3 | Administrador (con `branches:access_all`) | Como administrador, quiero poder elegir "Todos" en el filtro de sucursal del Kardex y ver el catálogo completo en el buscador de producto, para poder consultar el kardex de cualquier producto sin restricción cuando realmente necesito la vista global | - Logueado como admin con el select "Almacén" en "Todos" → el combobox "Clave" muestra el catálogo completo (sin filtrar), comportamiento intencional, no un bug.<br>- Logueado como admin con una sucursal específica elegida → el combobox "Clave" sólo muestra productos asignados a esa sucursal. | - El bypass sigue requiriendo el permiso `branches:access_all` ya existente — no se crea una ruta nueva de bypass. |
| 4 | Operador de sucursal (sin `branches:access_all`) | Como operador, quiero que al buscar un producto en el historial de Abonos sólo aparezcan productos de mi sucursal, para no confundirme con productos de otras sucursales al filtrar pagos | - Logueado como operador de sucursal B1, buscar un producto en el combobox de Abonos → Historial → sólo aparecen productos asignados a B1.<br>- El filtro "Sucursal" (visible sólo para bypass) sigue funcionando igual para el reporte en sí (sin regresión). | - Mismo criterio que historia 2: nunca enviar un `branchId` ajeno al propio del operador; filtrado siempre server-side. |

Nota: historias 2 y 3 provienen de la misma feature (Kardex) pero se separaron porque sus criterios de aceptación difieren por rol (operador siempre su sucursal; admin respeta su elección, incluyendo "Todos"). Historia 1 (reporte Global) e historia 4 (Abonos) son bugs independientes entre sí y del Kardex, con la misma causa raíz de fondo (branch scoping incompleto).

## Why

El usuario reportó que el reporte "Global" de Inventario mezcla stock de todas las sucursales en un solo total, y que el buscador de producto del Kardex sigue mostrando variantes de otras sucursales — un problema que ya había señalado antes y que no quedó resuelto. La causa de fondo es doble:

1. El reporte `Reportes → Inventario` suma `quantity` de `branch_inventory` con `WHERE TRUE` cuando no hay `branchId` (admin con `branches:access_all` sin elegir sucursal en "Global"), violando el requirement `inventory-api` → "No global stock" ("Stock is always reported per branch").
2. Un cambio previo (`fix-products-implicit-branch-filter`, archivado) quitó a propósito el filtrado implícito por sucursal de `GET /api/v1/admin/products` cuando se omite `branchId`, para que `/catalogs/products` mostrara el catálogo completo. Ese mismo endpoint lo consumen los buscadores de producto de `purchases`, `payments` (Abonos) y `inventory/kardex`. El fix de seguimiento (`purchases-branch-product-filter`) sólo corrigió `purchases` — `kardex` y `payments` quedaron sin el `branchId` que necesitan, exactamente la deuda que el usuario reporta como "no corregida".

Con `INVENTORY_SCOPE_MODE=branch` activo en el entorno, omitir `branchId` en ese endpoint nunca filtra el catálogo — por eso aparecen variantes de otras sucursales.

## What Changes

- `src/modules/reports/infrastructure/repositories/PrismaDepartmentPriceListRepository.ts`: la query de stock usa el mismo fallback a sucursal matriz (`scopeBranchId`) que ya usan los precios, en vez de sumar sin filtro cuando no hay `branchId` explícito.
- `app/(private)/inventory/kardex/_logic/services/searchProducts.ts` y `_logic/hooks/useProductSearch.ts`: aceptan y propagan `branchId` opcional hacia `GET /api/v1/admin/products`.
- `app/(private)/inventory/kardex/_blocks/KardexFilters.tsx` y `KardexPage.tsx`: calculan el `branchId` efectivo de búsqueda (sucursal propia para operadores sin bypass; respeta la selección del admin, incluyendo "Todos") y lo pasan al buscador de producto.
- `app/(private)/payments/_logic/services/searchProducts.ts` y `_logic/hooks/useProductSearch.ts`: mismo cambio que kardex — aceptan y propagan `branchId` opcional.
- `app/(private)/payments/_blocks/PaymentsHistoryToolbar.tsx`: calcula el `branchId` efectivo (sucursal propia para operadores; selección del admin para bypass) y lo pasa al buscador de producto del historial de Abonos.

## Capabilities

### New Capabilities

(ninguna)

### Modified Capabilities

(ninguna — este fix corrige comportamiento que ya viola requirements existentes de `inventory-api` y `products-api`; no cambia el contrato de esos endpoints, sólo corrige callers que no lo respetaban correctamente. No se modifican requisitos/escenarios de spec.)

## Impact

- **Backend**: ningún endpoint cambia de contrato. Sólo se corrige una query SQL cruda en un repositorio de reportes (`PrismaDepartmentPriceListRepository`).
- **Frontend**: 3 pares servicio+hook de búsqueda de producto (`kardex`, `payments`) y sus componentes contenedores (`KardexPage`/`KardexFilters`, `PaymentsHistoryToolbar`) ganan un parámetro `branchId` que hoy no envían.
- **Specs**: no se modifica ningún spec — el comportamiento esperado ya estaba documentado en `inventory-api` ("No global stock") y `products-api` (semántica de `branchId` en `GET /products`); este change alinea la implementación a lo ya documentado.
- **Tests**: se agregan/actualizan tests unitarios para los 3 servicios/hooks de búsqueda y para `PrismaDepartmentPriceListRepository`.
- **Sin migraciones de BD, sin cambios de permisos RBAC.**
