## Context

Ver `proposal.md - Why`. El módulo de compras ya resuelve un `branchId` efectivo en `CreatePurchasePage.tsx:41` (`isBypass ? selectedBranchId : userBranchId`) para crear la compra; ese mismo valor sólo falta propagarlo al buscador de productos (`app/(private)/purchases/_logic/services/searchProducts.ts` → `useProductSearch.ts`). El endpoint `GET /api/v1/admin/products` (`ProductsController.list`) ya soporta `branchId` como filtro opcional y ya aplica `resolveScopedBranchId`/`enforceBranchScope` cuando se envía — no requiere cambios de backend. El patrón a replicar es literalmente el mismo que ya usa `app/(private)/pos/_logic/services/searchProducts.ts` (`searchProducts({ search, branchId, ... })`).

## Goals / Non-Goals

**Goals:**
- Que el buscador de productos de "Alta de compra" filtre por la sucursal activa del formulario, reutilizando el `branchId` ya calculado en `CreatePurchasePage.tsx`.
- Mostrar un hint cuando un usuario con `branches:access_all` aún no eligió sucursal, en vez de disparar una búsqueda sin filtro.

**Non-Goals:**
- No se agrega ningún gate de "producto debe estar asignado a la sucursal" en `CreatePurchaseUseCase` (backend). El spec `inventory-api` ya declara las compras como vía legítima para introducir un producto en el `branch_inventory` de una sucursal — endurecer eso es un cambio de comportamiento de negocio distinto, fuera de alcance aquí.
- No se toca el matching de productos del uploader de CFDI (`handleSatParsed`) más allá de que, al resolver contra el catálogo, use la misma fuente ya filtrada — el algoritmo de matching por nombre/unidad no cambia.
- No se modifica `ProductsController`, `resolveScopedBranchId`, `enforceBranchScope` ni `ListProductsUseCase` — el contrato `branchId` ya existe y ya es correcto (usado hoy por POS).

## Decisions

**D1 — Reusar el `branchId` ya resuelto en `CreatePurchasePage`, no uno nuevo.** `CreatePurchasePage.tsx:41` ya calcula `branchId = isBypass === true ? selectedBranchId : (userBranchId ?? "")`. Se pasa tal cual a `useProductSearch`. Alternativa descartada: que el hook resuelva su propio `branchId` vía `useCurrentUser()` — se descarta porque duplicaría la lógica de bypass/selección y podría divergir del `branchId` que finalmente se manda en el `POST /purchases` (riesgo de inconsistencia entre "sucursal del buscador" y "sucursal de la compra"), justo el Criterio de Seguridad de la Historia 2 en proposal.md.

**D2 — Búsqueda inactiva (no vacía-y-disparada) cuando falta sucursal.** Cuando `branchId === ""` (bypass sin sucursal elegida), `useProductSearch` no ejecuta el fetch — no manda `branchId` vacío ni omite el filtro (lo que traería el catálogo completo, el bug original). Se implementa con un early-return en el `useEffect` del hook, igual al patrón usado en otros hooks del proyecto que condicionan el fetch a una dependencia presente. `CreatePurchasePage` muestra el hint existente-o-nuevo de "Selecciona una sucursal" reusando el mismo slot visual que ya usa para otros estados vacíos del buscador.

**D3 — Filtro estricto (sin toggle "ver catálogo completo").** Decisión ya tomada con el usuario en la sesión de planeación: el buscador de compras es estricto, sólo productos asignados a la sucursal. Si el operador necesita comprar un producto no asignado, primero debe asignarlo desde Inventario (flujo ya existente, reforzado por el change `add-inventory-to-pricing-link`).

## Verificación

Verificado en dev con browser real (Playwright), ambas rutas de `branchId`:
- Operador sin `branches:access_all` (`kevhernandez07@gmail.com`, rol `zarioz_test`, sucursal ZARIOZ): sin selector de sucursal, buscador ya activo con `branchId` propio — `GET /api/v1/admin/products?...&branchId=d7a243e5-...` (ZARIOZ).
- Usuario con `branches:access_all` (`admin@example.com`): sin sucursal seleccionada → buscador deshabilitado con hint, sin request; selecciona ZARIOZ → `branchId=d7a243e5-...`; cambia a PRADERA → refetch con `branchId=c91afd65-...`.

## Risks / Trade-offs

- [Riesgo] Un producto recién creado en Catálogos pero aún no asignado a ninguna sucursal no podrá comprarse hasta asignarlo desde Inventario → Mitigación: comportamiento ya documentado y esperado (ver Non-Goals); el banner de `add-inventory-to-pricing-link` ya guía ese flujo.
- [Riesgo] Si `INVENTORY_SCOPE_MODE=general` (no `branch`), el filtro por `branchId` en `ProductsController.list` no restringe nada (según `products-api`, el modo `general` no acota por asignación) → Mitigación: ninguna requerida, es el comportamiento correcto documentado — en modo `general` cualquier producto es vendible/comprable en cualquier sucursal, por diseño.
