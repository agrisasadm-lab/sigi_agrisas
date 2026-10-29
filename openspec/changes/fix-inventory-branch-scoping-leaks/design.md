## Context

Ver `proposal.md` → "Why" para la causa raíz completa. Resumen técnico necesario para este diseño:

- `INVENTORY_SCOPE_MODE=branch` está activo en el entorno (`.env.local`). En ese modo, `GET /api/v1/admin/products` sólo filtra el catálogo por sucursal cuando el caller envía explícitamente `?branchId=...` (contrato documentado en `openspec/specs/products-api/spec.md`). Si se omite, el catálogo completo se devuelve sin filtrar — por diseño, para que `/catalogs/products` siga mostrando todo.
- Ese mismo endpoint lo usan 3 buscadores de producto independientes: `purchases` (ya corregido en `openspec/changes/archive/2026-10-05-purchases-branch-product-filter`), `payments` y `inventory/kardex` (ambos nunca corregidos — historias 2, 3 y 4).
- El reporte `Reportes → Inventario` (historia 1) es un problema distinto, sin relación con el endpoint de productos: una query SQL cruda (`$queryRaw`) en `PrismaDepartmentPriceListRepository.findRows()` que suma `quantity` de `branch_inventory` sin filtro cuando `filters.branchId` es `null`.
- Patrón de scoping ya existente en el repo: `resolveScopedBranchId` (`src/modules/rbac/infrastructure/http/enforceBranchScope.ts`) fuerza siempre la sucursal propia del caller sin `branches:access_all`; con ese permiso, deja pasar lo que el caller pida (incluyendo "ninguna sucursal" = sin filtro).

## Goals / Non-Goals

**Goals:**
- Historia 1: el reporte "Global" de Inventario nunca mezcla stock de distintas sucursales en un solo número.
- Historias 2 y 4: un operador sin `branches:access_all` nunca ve, en los buscadores de producto de Kardex y Abonos, productos/variantes de sucursales que no son la suya.
- Historia 3: un admin con `branches:access_all` conserva la capacidad de ver el catálogo completo en el buscador de Kardex cuando elige "Todos" (comportamiento intencional, no se retira).

**Non-Goals:**
- No se construye un endpoint/reporte nuevo de "stock agregado por sucursal" (prohibido explícitamente por el requirement "No global stock" de `inventory-api`).
- No se cambia el contrato de `GET /api/v1/admin/products` ni de `ProductsController`/`PrismaProductRepository` — ya soportan `branchId` correctamente (confirmado en `purchases-branch-product-filter`); el bug es 100% de callers que no lo envían.
- No se toca el buscador de producto de `purchases` ni `pos` (ya correctos).
- No se cambia la UX visible: ni la pestaña "Global" de Reportes/Inventario, ni el select "Todos" de sucursal en Kardex/Abonos, desaparecen o se renombran.

## Decisions

**D1 — Reporte Global (historia 1): fallback a sucursal matriz, y vacío (no suma) si tampoco hay matriz configurada.**
`findRows()` ya calcula `scopeBranchId = filters.branchId ?? HQ.id ?? null` (líneas 17-20) y lo usa para los precios (línea 29: `scopeBranchId ? {branchId: scopeBranchId} : {id: {in: []}}` — vacío, nunca "todos"). La decisión es reutilizar esa misma variable en la query de stock, reemplazando `filters.branchId` crudo por `scopeBranchId`, **y además** replicar el mismo fallback-a-vacío de los precios: `WHERE ${scopeBranchId ? branch_id = scopeBranchId : FALSE}` (no `TRUE`). Esto se corrigió en verificación manual: en el entorno real ninguna sucursal tiene `isHeadquarters = true` (confirmado por query directa a la DB de dev), así que un fallback a HQ sin este segundo ajuste habría dejado el bug intacto en la práctica (`scopeBranchId` siempre `null` → `WHERE TRUE` → sigue sumando todo). Con `FALSE`, el reporte nunca mezcla sucursales sin importar si existe una matriz configurada — stock muestra 0 en ese caso borde, igual que los precios ya muestran "sin precios" en ese mismo caso. Alternativa considerada: mantener la suma cross-branch pero exponerla como un desglose por sucursal en vez de un total ciego — descartada por ser un cambio de UI/contrato de respuesta más grande, innecesario para resolver el bug reportado.

**D2 — Kardex y Abonos (historias 2, 3, 4): mismo patrón ya probado en `purchases`, no uno nuevo.**
Se replica 1:1 el patrón de `purchases-branch-product-filter`: `searchProducts.ts` acepta `branchId?` y sólo lo agrega al query string si viene; `useProductSearch.ts` lo recibe y lo mete en las deps del efecto. Alternativa considerada: hacer que el hook haga `early-return` sin fetch si falta `branchId` (como hace `purchases`, que no tiene concepto de "ver todo") — descartada para Kardex/Abonos porque ahí SÍ existe un "Todos" intencional (historia 3); forzar early-return rompería ese caso de uso legítimo. Se deja la decisión de filtrar o no al valor que el caller resuelva (D3), no al hook.

**D3 — Quién resuelve el `branchId` efectivo: el contenedor (página/toolbar), no el Select crudo.**
En ambos módulos, el Select "Almacén"/"Sucursal" lista TODAS las sucursales incluso para operadores sin bypass (porque el backend del reporte en sí — movimientos de kardex, historial de abonos — ignora esa elección vía `resolveScopedBranchId` y fuerza la sucursal real del operador de todos modos). Si se pasara ese valor crudo al buscador de producto, un operador que (por error de UI, no de intención) tenga seleccionada otra sucursal provocaría un 403 de `ProductsController` (que SÍ valida `branchId === x-user-branch-id` para no-bypass). Decisión: calcular el `branchId` de búsqueda de producto como:
```
isBypass === true ? (branchIdDelSelect || undefined) : (branchIdPropioDeUseCurrentUser ?? undefined)
```
Esto es puramente defensivo/cosmético — el backend ya protegía al operador de ver datos ajenos en el reporte final; esta decisión evita que la búsqueda de producto intermedia truene o se comporte distinto a ese mismo reporte. Alternativa considerada: ocultar o restringir el Select a la sucursal propia para no-bypass — descartada por ser un cambio de UX no solicitado y fuera del alcance de este fix (afectaría también al reporte, no sólo al buscador).

**D4 — Sin cambios de backend.**
Confirmado por investigación previa que `ProductsController.list` + `PrismaProductRepository` ya implementan correctamente el filtro por `branchId` (incluyendo el 403 por mismatch y el filtro por `branch_inventory` en modo `branch`). Ningún archivo de `src/modules/products/` ni `src/modules/rbac/` se modifica.

## Risks / Trade-offs

- **[Riesgo] Historia 1 — si no hay ninguna sucursal marcada `isHeadquarters` (caso real confirmado en el entorno de dev: ninguna sucursal activa tiene ese flag), el admin que deja "Global" en "Todas" verá stock en 0 para todo, no un número útil.** → Mitigación aceptada conscientemente: es preferible a volver a mezclar sucursales (viola la motivación del fix), y es exactamente el mismo trade-off que los precios ya aceptan en ese caso ("sin precios" en vez de "precio de cualquier sucursal"). Si el negocio quiere un número útil en "Global", la acción correcta es marcar una sucursal como `isHeadquarters = true` (cambio de datos, no de código) — fuera de alcance de este change, que sólo corrige el bug de mezcla.
- **[Riesgo] Historia 2/4 — un operador sin sucursal asignada (`branchId: null` en el JWT) obtiene `branchId: undefined` en la búsqueda → cae al comportamiento de "sin filtro" (bug original) para ese caso borde.** → Mitigación: es un estado de datos inválido para un operador (todo operador activo debería tener sucursal asignada); no se agrega guardia especial porque enmascararía un problema de datos distinto, fuera de alcance.
- **[Trade-off] D3 duplica la lógica "bypass ? select : own" en 2 componentes (Kardex, Abonos) en vez de extraer un hook compartido (`useEffectiveBranchId` o similar).** → Aceptado: son sólo 2 ocurrencias, ambas ya siguen el patrón que `purchases` estableció por separado (no comparte hook con ellos tampoco); extraer una abstracción para 2 usos es prematuro y no lo pidió el usuario.

## Migration Plan

No aplica — sin migraciones de BD, sin flags de despliegue, sin cambio de contrato de API. Deploy estándar (PR → `develop` → release). Rollback: revertir el PR, sin pasos adicionales (los cambios son correcciones de filtrado, no alteran datos persistidos).
