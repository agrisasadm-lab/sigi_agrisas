## Context

`ProductsController.list` (`src/modules/products/infrastructure/http/ProductsController.ts:160-167`):

```ts
let branchId = filtersParsed.data.branchId;
let branchScoped = false;
if (isBranchScopedInventory()) {
  const scoped = await resolveScopedBranchId(req, branchId);
  if (scoped instanceof NextResponse) return scoped;
  branchId = scoped.branchId;
  branchScoped = true;
}
```

`resolveScopedBranchId` (`src/modules/rbac/infrastructure/http/enforceBranchScope.ts`) fue diseñado para endpoints donde el scope implícito a la sucursal propia SIEMPRE es correcto (listados de inventario, ventas, etc. — ver CLAUDE.md "Branch scoping (transversal)"): si el caller no tiene `branches:access_all`, resuelve el `branchId` efectivo a su propia sucursal aunque no lo haya pedido. Aplicado aquí — al catálogo GENERAL de productos — ese comportamiento se propaga a cualquier consumidor del endpoint compartido `GET /api/v1/admin/products`, sin distinguir si ese consumidor pidió o no un `branchId`.

`PrismaProductRepository.findAll` (línea 85) solo filtra cuando `branchId && branchScoped` son ambos verdaderos — el fix no toca esta capa, solo evita que `branchScoped` se vuelva `true` cuando nadie lo pidió.

Consumidores confirmados del endpoint (por lectura de código, sin `branchId`): `/catalogs/products` (`useProducts.ts`/`services/products.ts`), `InventoryAssignModal` (`useProductSearch`/`searchProducts.ts` de `inventory`), y los buscadores equivalentes de `purchases`, `payments`, `inventory/kardex`. Único consumidor con `branchId` explícito: `pos` (`useProductSearch.ts` de `pos`, prop `branchId?` pasada por el caller de POS).

## Goals / Non-Goals

**Goals:**
- (Historia 1) `GET /api/v1/admin/products` sin `branchId` devuelve el catálogo completo, sin importar el modo de inventario ni `branches:access_all` del caller.
- (Historia 1) POS, que sí pasa `branchId` explícito, no cambia de comportamiento.
- (Historia 2) El buscador de "Asignar producto" (y cualquier otro buscador que omita `branchId`) puede encontrar productos no asignados a la sucursal del caller.

**Non-Goals:**
- No se toca `resolveScopedBranchId` ni `enforceBranchScope` — siguen siendo correctos para los endpoints que SÍ quieren scope implícito (inventario, ventas).
- No se agrega un nuevo parámetro ni flag — el fix se basa únicamente en si `branchId` vino o no en el query string, ya distinguible con el dato existente (`filtersParsed.data.branchId`).
- No se cambia el comportameinto cuando `branchId` SÍ viene explícito (filtrado, 403 en mismatch, enriquecimiento de `stock`) — se mantiene idéntico.
- No se modifican los servicios frontend de `purchases`/`payments`/`inventory/kardex` — ya omiten `branchId`, se benefician gratis del fix de backend.

## Decisions

**1. Gate mínimo: agregar `&& filtersParsed.data.branchId` a la condición existente, no reescribir el bloque.**
Cambia `if (isBranchScopedInventory())` a `if (isBranchScopedInventory() && filtersParsed.data.branchId)`. `filtersParsed.data.branchId` es el valor CRUDO tal como llegó en el query string (antes de cualquier resolución), ya validado como UUID por `listQueryFiltersSchema` — es la señal correcta de "el caller pidió explícitamente este filtro". Alternativa descartada: agregar un parámetro nuevo tipo `?scoped=true` — innecesario, la presencia de `branchId` ya es una señal de intención clara y es exactamente el contrato que POS ya usa.

**2. Sin `branchId`, `branchScoped` nunca se vuelve `true` y `resolveScopedBranchId` nunca se invoca — ni siquiera para validar que el operador tenga sucursal asignada.**
Antes, un operador sin sucursal asignada Y sin `branchId` en la query recibía 403 (porque `resolveScopedBranchId` fallaba al no poder resolver un branchId efectivo). Con el fix, ese caso deja de pasar por esa función — el caller simplemente ve el catálogo completo, igual que cualquier otro caller sin `branchId`. Esto es intencional: la ausencia de sucursal asignada solo importa cuando el caller *necesita* que se le resuelva una; si no pidió scope, no hay nada que resolver ni que rechazar (Historia 1, AC1).

**3. Cuando `branchId` SÍ viene explícito, cero cambios de código — mismo camino que hoy.**
Cubre exactamente el caso de POS (Historia 1, AC3) y el caso de mismatch explícito (403, ya cubierto por un test existente que no se toca).

## Riesgos / Trade-offs

- **[Riesgo] Algún consumidor no identificado podría depender hoy, sin saberlo, del filtrado implícito (bug-compatible).** Mitigado por inspección de código: se verificaron los cinco consumidores conocidos del endpoint (`catalogs/products`, `inventory` assign, `purchases`, `payments`, `inventory/kardex`, `pos`) — ninguno excepto `pos` pasa `branchId`, y ninguno de los que lo omiten espera o renderiza un `total`/conteo que dependa de estar acotado a la sucursal (ninguno muestra una columna "stock" ni un mensaje que asuma catálogo scoped). Riesgo residual bajo.
- **[Riesgo] Tests existentes que codifican el comportamiento viejo como "correcto".** `ProductsController.test.ts` (`describe("ProductsController.list — branch scope mode")`) tiene 2 tests que verifican explícitamente el comportamiento que se retira (líneas 391 y 419) — se actualizan como parte de este change (ver tasks.md), no quedan huérfanos.
- **[Trade-off] Ninguno relevante** — es una restricción de una línea que restaura un contrato ya documentado (`products-ui`), no introduce complejidad nueva.
