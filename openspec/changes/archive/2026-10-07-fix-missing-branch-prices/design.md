## Context

`product_prices.branch_id` es `NOT NULL` desde `prisma/migrations/20260922010000_separate_branch_pricing` (ver `schema.prisma:416-434`: `@@unique([productId, branchId, name])`, sin bucket global). Todo el código de lectura (`PrismaProductPriceRepository.findByProductAndBranch/findDefaultByProductId`, `ProductPricesController`, `PrismaPosLookupService.getDosificationForSale`, `CreateSaleUseCase`) exige `branchId` exacto, sin fallback — confirmado leyendo el código fuente, no sólo la spec.

Confirmado contra Supabase prod (lectura, 2026-10-07): 47 pares `(product_id, branch_id)` en `branch_inventory` sin fila en `product_prices` — PRADERA (28), HUAJUAPAN (11), ZARIOZ (8). Los 47 productos fueron creados el 2026-09-01 (antes de la migración del 09-22) y ya tienen precio consistente en 1-3 otras sucursales activas; sólo falta la fila para estas 3 sucursales. Ver `proposal.md` para el detalle de causa raíz.

**Hallazgo adicional durante el diseño**: `prisma/seeds/lib/inventory/priceWriter.ts` (`writeBasePriceTiers`, usado por `seedBranch.ts`, invocado por `npm run seed:inventory-tiendas` y por `npm run seed:all`) todavía escribe `branchId: null` en `productPrice.create()` (vía el shim `upsertBase` en `prisma/seeds/inventory-tiendas.ts:60-66`). Esto compila porque el shim castea con `as never`, pero **violaría el `NOT NULL` en runtime contra una base de datos real** — el comentario en `inventory-tiendas.ts:48-52` ya documenta un error de runtime relacionado ("Argument branchId must not be null") sin haber corregido la causa de fondo. En la práctica, el comando de seeding de onboarding de sucursales está roto hoy para la parte de precios; esto es consistente con que las 3 sucursales afectadas recibieron su `branch_inventory` por otra vía (UI de inventario) sin un paso equivalente que generara el precio.

## Goals / Non-Goals

**Goals:**
- Completar los 47 pares de precio faltantes en prod de forma segura e idempotente (Historia #1).
- Evitar que este hueco se repita sin ser detectado (Historia #2).
- Dejar `openspec/specs/pos-api` y `openspec/specs/products-api` consistentes con el comportamiento real del código (Historia #3) — ya hecho como parte del artefacto `specs/` de este change.
- Corregir `priceWriter.ts` para que ya no asuma `branchId: null`, destrabando el comando de seeding de onboarding (Historia #4).

**Non-Goals:**
- No se rediseña el modelo de precios (sigue siendo "una fila por producto+sucursal, sin herencia") — eso ya es el comportamiento vigente y correcto.
- No se construye una alerta/bloqueo en la UI de inventario para el futuro (ej. "no se puede asignar inventario sin precio") — es una mejora de producto razonable pero fuera del alcance de este fix; el guardrail de este change es a nivel de test/CI, no de UX en vivo.
- No se re-ejecuta el seeder completo de onboarding de las 4 tiendas en prod — el backfill de este change es dirigido (sólo los 47 pares), no un re-seed masivo.

## Decisions

**1. Backfill vía SQL directo sobre Supabase prod (MCP `execute_sql`), no un script de Prisma.**
Ya se usó `mcp__supabase-prod__execute_sql` en esta sesión (sólo lectura) para confirmar el alcance exacto. Para la escritura se sigue el mismo canal: una sentencia SQL explícita, revisada y aprobada por el usuario antes de correr, en vez de un script `ts-node` que requeriría apuntar `DATABASE_URL`/`DIRECT_URL` local a prod. Alternativa considerada y descartada: script Prisma ad-hoc — innecesario para una operación de una sola vez y evita manejar credenciales de prod fuera del flujo ya establecido en este repo (`mcp__supabase-prod__*` es la única vía documentada para tocar prod).

**2. Regla de backfill: sólo copiar cuando hay una única fuente de precio consistente.**
Para cada par faltante, se agrupan los `product_prices` existentes de ese `product_id` en otras sucursales por `name`. Si para cada `name` existe un valor único de `(price, min_quantity, discount_pct, is_default)` entre las sucursales que sí tienen precio, se copia tal cual a la sucursal faltante. Si algún `name` tiene valores distintos entre sucursales (sin fuente única confiable), ese par se excluye del `INSERT` y se reporta aparte para decisión manual — nunca se promedia ni se inventa un valor. La verificación de "fuente única" se corre explícitamente como `SELECT` de control antes del `INSERT` (no se asume a partir de la muestra de un solo producto ya revisada).

**3. Guardrail como test de integración contra la BD de test, no un constraint de BD ni un trigger.**
Un `CHECK`/trigger a nivel Postgres que cruce `branch_inventory` y `product_prices` es operacionalmente más pesado (requiere lógica en DB, migración adicional, mantenimiento) para un caso que sólo necesita detectarse antes de llegar a prod. Se prefiere un test de integración (`tests/integration/modules/inventory/branchPriceCoverage.test.ts` o similar) que corra en `npm test`/CI contra la BD de test, más una función pura reusable (ej. `findBranchInventoryPairsMissingPrice(prisma)`) que ese test llama — la misma función puede reusarse manualmente contra prod si se necesita repetir la verificación en el futuro, sin duplicar la query.

**4. `priceWriter.ts`: eliminar el concepto de "tier base global", escribir siempre con `branchId` explícito.**
`writeBasePriceTiers` pasa a recibir el `branchId` de Matriz explícitamente (como cualquier otra sucursal) en vez de `null`; se elimina el shim `upsertBase`/`findFirstBase` de `inventory-tiendas.ts` y los métodos correspondientes de `PrismaLike` en `types.ts`, reemplazándolos por las operaciones estándar de Prisma (`upsert`/`findFirst` con `branchId` real). `writeBranchPriceIfDivergent` ya opera por `branchId` explícito — sólo se ajusta su comparación "hereda del base" para comparar contra el precio de Matriz como una sucursal más, no como un bucket especial.

## Risks / Trade-offs

- **[Riesgo] El backfill podría copiar un precio inconsistente si el chequeo de "fuente única" tiene un falso positivo** (ej. nombres con espacios/mayúsculas distintas que Postgres no agrupa igual) → Mitigación: el `SELECT` de verificación se imprime completo para revisión humana antes de correr el `INSERT`; el `INSERT` sólo se ejecuta tras aprobación explícita del usuario sobre esa lista concreta.
- **[Riesgo] Backfill en prod es un dato financiero, difícil de revertir a ciegas** → Mitigación: se registra la lista exacta de IDs insertados (del propio `RETURNING id` del `INSERT`) en el reporte de la tarea, para poder borrar puntualmente si se detecta un error.
- **[Riesgo] Arreglar `priceWriter.ts` sin correr el seeder completo deja el fix validado sólo por tests unitarios, no por una corrida real** → Mitigación: `tasks.md` incluye correr `npm run seed:inventory-tiendas` contra la BD de dev/test (nunca prod) como parte de la verificación, no sólo `seedBranch.test.ts`.
- **[Riesgo] El guardrail de test podría dar falso positivo durante una ventana legítima de onboarding** (inventario cargado antes del precio) → Mitigación: el test corre contra fixtures de `tests/`, no contra prod en vivo, así que no hay ventana real que proteger en CI; si en el futuro se quiere repetir el chequeo contra prod, se corre manualmente y se interpreta con criterio (no es un gate automático de prod).
