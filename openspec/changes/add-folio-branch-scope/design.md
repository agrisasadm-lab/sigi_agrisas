## Context

`Folio` (`prisma/schema.prisma:122-144`) tiene un único `current_number` por fila, sin relación a `Branch`. `allocateFolio` (`src/shared/infrastructure/folios/allocateFolio.ts`) hace `UPDATE folios SET current_number = current_number + 1 WHERE id = ? AND is_active = true RETURNING ...` dentro de la transacción de cada documento. Callers actuales: `PrismaSaleRepository.createCompleted`/`createCompletedFromQuote`, `PrismaQuoteRepository.createWithItems`, `PrismaPaymentRepository` (RB), `PrismaWaybillRepository` (TS), `PrismaProviderPaymentRepository` (PP). `PrismaPurchaseRepository.createCompleted` resuelve el folio `CP` automáticamente vía `resolveCanonicalFolio(tx, "CP")` y llama `allocateFolio` igual que los demás.

Constraints reales en DB (confirmados en migraciones): `sales_folio_id_folio_number_key`, `quotes_folio_id_folio_number_key`, `purchases_folio_id_folio_number_key` — todos `UNIQUE (folio_id, folio_number)`. `folioCode` es `VARCHAR(40)` en las tres tablas y en `inventory_movements`. `Branch.code` es `VARCHAR(32) UNIQUE`.

Ver proposal.md — Historia de Usuario para las dos historias que este diseño resuelve.

## Goals / Non-Goals

**Goals:**
- (Historia 1) TK/TC/COT/CP numeran de forma independiente por sucursal, sin huecos ni mezcla entre tiendas.
- (Historia 1) Documentos legacy conservan su `folioCode` tal cual, sin renumerar.
- (Historia 1) RB/AB/DEV/PP/TS no cambian de comportamiento.
- (Historia 2) La auditoría de folios distingue la serie legacy (global) de la serie nueva (por sucursal) y no las mezcla al calcular huecos.

**Non-Goals:**
- No se migra el histórico de compras/ventas/cotizaciones a la numeración nueva — es un backfill deliberadamente fuera de alcance (arranque desde cero, decisión ya tomada con el usuario).
- No se cambia el catálogo de folios (`/catalogs/folios`) para exponer un CRUD de contadores por sucursal — los contadores son internos, resueltos automáticamente.
- No se toca `RegisterPaymentUseCase`/`PrismaPaymentRepository` (RB), `PrismaWaybillRepository` (TS) ni `PrismaProviderPaymentRepository` (PP) — siguen usando `allocateFolio` sin cambios.
- No se resuelve aquí el caso general de reportes que agrupen ventas/compras por `folioNumber` sin pasar por `folioCode` — se señala como riesgo, a revisar módulo por módulo si aparece.

## Decisions

**1. Tabla nueva `folio_branch_counters`, sin tocar `folios.current_number`.**

```prisma
model FolioBranchCounter {
  folioId       String   @map("folio_id")
  branchId      String   @map("branch_id")
  currentNumber Int      @default(0) @map("current_number")
  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")

  folio  Folio  @relation(fields: [folioId], references: [id], onDelete: Cascade)
  branch Branch @relation(fields: [branchId], references: [id], onDelete: Restrict)

  @@id([folioId, branchId])
  @@index([branchId])
  @@map("folio_branch_counters")
}
```
`onDelete: Restrict` en `branch` — no tiene sentido borrar una sucursal con historial de folios propios; `Cascade` en `folio` sí (si se borra el folio catálogo, sus contadores por sucursal ya no significan nada). Alternativa descartada: agregar `branchId` como columna nullable directamente en `folios` — no sirve porque un folio (`TK`) necesita UN contador POR sucursal, no uno solo; requeriría una fila de `Folio` por sucursal, rompiendo el catálogo global existente (`/catalogs/folios` lista folios, no combinaciones folio×sucursal).

**2. `allocateBranchFolio` como INSERT...ON CONFLICT, no como `upsert` de Prisma.**

```ts
// src/shared/infrastructure/folios/allocateBranchFolio.ts
export async function allocateBranchFolio(
  tx: Prisma.TransactionClient,
  folioId: string,
  branchId: string
): Promise<{ folioNumber: number; folioCode: string }> {
  type Row = { current_number: number; code: string; prefix: string | null; branch_code: string };
  const rows = await tx.$queryRaw<Row[]>`
    WITH f AS (SELECT id, code, prefix FROM folios WHERE id = ${folioId} AND is_active = true),
         b AS (SELECT id, code FROM branches WHERE id = ${branchId}),
         c AS (
           INSERT INTO folio_branch_counters (folio_id, branch_id, current_number, created_at, updated_at)
           SELECT f.id, b.id, 1, NOW(), NOW() FROM f, b
           ON CONFLICT (folio_id, branch_id)
           DO UPDATE SET current_number = folio_branch_counters.current_number + 1, updated_at = NOW()
           RETURNING current_number
         )
    SELECT c.current_number, f.code, f.prefix, b.code AS branch_code FROM c, f, b`;
  if (rows.length === 0) throw new InactiveResourceError("Folio");
  const r = rows[0];
  return { folioNumber: r.current_number, folioCode: formatBranchFolioCode(r.prefix, r.code, r.branch_code, r.current_number) };
}
```
Un solo `INSERT ... ON CONFLICT DO UPDATE ... RETURNING` es atómico en Postgres: la fila `(folioId, branchId)` sirve de punto de serialización — dos requests concurrentes de la misma sucursal nunca leen el mismo `current_number` antes de incrementar (mismo nivel de garantía que el `UPDATE` del `allocateFolio` original). Alternativa descartada: `tx.folioBranchCounter.upsert(...)` — el `upsert` generado por Prisma emite SELECT + INSERT/UPDATE en pasos separados bajo ciertos providers y no devuelve el valor ya incrementado sin una lectura adicional; el CTE de arriba resuelve todo (folio activo + branch existente + incremento + valores para formatear el código) en un solo roundtrip.

Si `branchId` no corresponde a ninguna sucursal, `b` queda vacío y por lo tanto `c` también — mismo camino de error que folio inactivo (`InactiveResourceError("Folio")`); en la práctica esto no debería ocurrir porque el `branchId` de la operación ya fue validado antes de llegar a este paso (branch scoping existente en `CreateSaleUseCase`/`CreateQuoteUseCase`/`CreatePurchaseUseCase`).

**3. Formato de `folioCode`: `<prefix><BRANCH_CODE>-<NNNNNN>`, función pura separada.**

```ts
// src/shared/domain/folios/formatBranchFolioCode.ts
export function formatBranchFolioCode(prefix: string | null, code: string, branchCode: string, n: number): string {
  const padded = String(n).padStart(6, "0");
  return prefix ? `${prefix}${branchCode}-${padded}` : `${code}-${branchCode}-${padded}`;
}
```
Con `prefix="TK-"` → `TK-ZARIOZ-000001`; con `prefix="CP-"` → `CP-ZARIOZ-000001`. Longitud máxima: `prefix` (≤8) + `branchCode` (≤32) + `-` + 6 dígitos = 47 caracteres — de ahí que `folioCode` deba ampliarse de `VARCHAR(40)` a `VARCHAR(64)` (margen cómodo, no ajustado al límite exacto). Se mantiene `allocateFolio`/su formato legacy (`${prefix}${pad6}` o `${code}-${n}`) intacto para RB/AB/DEV/PP/TS — ningún código existente cambia de comportamiento.

**4. Reemplazo del unique constraint: `(folioId, folioNumber)` → `(folioCode)`.**

`folioNumber` deja de ser único por folio (dos sucursales pueden compartir el mismo número, ej. ambas emiten su primer `TK` con `folioNumber=1`). `folioCode` sí es único siempre — incorpora la sucursal en el string. Migración (una vez verificado que no hay `folioCode` duplicado hoy — confirmado 0 en prod al momento de este diseño):

```sql
-- 1. Tabla de contadores
CREATE TABLE "folio_branch_counters" (
  "folio_id" TEXT NOT NULL, "branch_id" TEXT NOT NULL,
  "current_number" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "folio_branch_counters_pkey" PRIMARY KEY ("folio_id","branch_id"),
  CONSTRAINT "folio_branch_counters_folio_id_fkey" FOREIGN KEY ("folio_id") REFERENCES "folios"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "folio_branch_counters_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "folio_branch_counters_branch_id_idx" ON "folio_branch_counters"("branch_id");

-- 2. Guard defensivo: aborta si ya hay folio_code duplicado (no debería, pero evita romper el UNIQUE nuevo a ciegas)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM sales GROUP BY folio_code HAVING COUNT(*) > 1)
  OR EXISTS (SELECT 1 FROM quotes GROUP BY folio_code HAVING COUNT(*) > 1)
  OR EXISTS (SELECT 1 FROM purchases GROUP BY folio_code HAVING COUNT(*) > 1)
  THEN RAISE EXCEPTION 'Duplicate folio_code found; resolve before migrating'; END IF;
END $$;

-- 3. Ampliar columnas
ALTER TABLE "sales" ALTER COLUMN "folio_code" TYPE VARCHAR(64);
ALTER TABLE "quotes" ALTER COLUMN "folio_code" TYPE VARCHAR(64);
ALTER TABLE "purchases" ALTER COLUMN "folio_code" TYPE VARCHAR(64);
ALTER TABLE "inventory_movements" ALTER COLUMN "folio_code" TYPE VARCHAR(64);

-- 4. Nuevo unique + índice de soporte, luego soltar el viejo (por tabla)
ALTER TABLE "sales" ADD CONSTRAINT "sales_folio_code_key" UNIQUE ("folio_code");
CREATE INDEX "sales_folio_id_idx" ON "sales"("folio_id");
DROP INDEX "sales_folio_id_folio_number_key";

ALTER TABLE "quotes" ADD CONSTRAINT "quotes_folio_code_key" UNIQUE ("folio_code");
CREATE INDEX "quotes_folio_id_idx" ON "quotes"("folio_id");
DROP INDEX "quotes_folio_id_folio_number_key";

ALTER TABLE "purchases" ADD CONSTRAINT "purchases_folio_code_key" UNIQUE ("folio_code");
CREATE INDEX "purchases_folio_id_idx" ON "purchases"("folio_id");
DROP INDEX "purchases_folio_id_folio_number_key";
```
`customer_payments`, `waybills`, `provider_payments` NO se tocan — conservan su `UNIQUE (folio_id, folio_number)` porque siguen usando el contador global (`folioNumber` sigue siendo único ahí).

**5. Preview de "siguiente folio" resuelto en servidor, no en el cliente.**

Hoy la UI calcula `f.currentNumber + 1` client-side (`CartPanel.tsx:125`, etc.) — funciona porque hay un solo contador. Con contadores por sucursal, el cliente no puede calcular el siguiente número sin conocer el contador de SU sucursal específicamente, así que `GET /folios?branchId=` devuelve `branchCurrentNumber`/`nextFolioCode` ya resueltos (ver delta `admin-folios`). Alternativa descartada: exponer sólo `branchCurrentNumber` y dejar que el cliente arme el string — obligaría a duplicar `formatBranchFolioCode` en TypeScript de frontend; con `nextFolioCode` resuelto en servidor, un solo lugar (el backend) conoce el formato.

**6. Auditoría: filtrar por `folio_code LIKE` para separar series, no por fecha ni por `branch_id` en las tablas de documentos.**

`sales`/`quotes`/`purchases` YA tienen columna `branch_id` propia (no es necesario un join con `folio_branch_counters` para filtrar por sucursal). El filtro real necesario es separar "legacy" de "nuevo formato" dentro de la MISMA sucursal — un documento con `branch_id = ZARIOZ` y `folio_code = "TK-000038"` (legacy, emitido antes de este cambio) NO debe cortarse por `branch_id`, porque un legacy pudo emitirse para cualquier sucursal bajo el contador global; se distingue por el patrón del `folioCode` (`LIKE '<prefix><BRANCH_CODE>-%'`), no por columna. Con `branchId` en la query: `WHERE folio_id = :id AND branch_id = :branchId AND folio_code LIKE :pattern`. Sin `branchId`: `WHERE folio_id = :id AND folio_code NOT LIKE '%-<any-branch-code>-%'` es frágil (requeriría enumerar todos los `branch_code`); en su lugar, el modo "legacy" se define simplemente como `folio_number <= folios.current_number` (el contador global se congela en su valor actual al momento del corte — cualquier documento nuevo bajo TK/TC/COT/CP ya NO incrementa `folios.current_number`, sólo `folio_branch_counters`). Esto hace que "sin `branchId`" sea automáticamente exacto sin parsear el `folioCode`.

**7. `purchases` se agrega al UNION de auditoría (bug preexistente, no introducido por este cambio) porque de otro modo `CP` — ahora branch-scoped — auditaría siempre `totalIssued: 0`.**

Ver delta `folio-audit` — Historia 2 exige que la auditoría por sucursal de `CP` sea confiable; dejar el gap existente lo haría inútil específicamente para el folio que este cambio hace branch-scoped.

## Riesgos / Trade-offs

- **[Riesgo] Reportes que hoy agrupen o comparen por `folioNumber` asumiendo unicidad global** (fuera de los módulos tocados aquí) podrían mostrar folios "duplicados" entre sucursales. → Mitigación: revisar `src/modules/reports/` durante `tasks.md`/aplicación; si algún reporte depende de `folioNumber` como clave única, migrarlo a `folioCode`.
- **[Riesgo] `folio_branch_counters` crece indefinidamente** (una fila por combinación folio×sucursal activa, no por documento) — crecimiento acotado por `#folios branch-scoped × #sucursales`, no por volumen de transacciones. Sin mitigación necesaria.
- **[Riesgo] Ventana de despliegue**: el `DROP INDEX ... _folio_id_folio_number_key` + `ADD CONSTRAINT ..._folio_code_key` toma un lock breve en `sales`/`quotes`/`purchases` (tablas pequeñas, ≤ decenas de miles de filas). → Mitigación: aplicar en ventana de baja actividad; un pod viejo en pleno rollout que siga usando `allocateFolio` (global) para estas tablas escribiría un `folioCode` legacy que sigue siendo único bajo el constraint nuevo — sin ventana de fallo por versión mixta.
- **[Trade-off] Arranque desde cero por sucursal (decisión ya tomada)**: una sucursal que ya tenía folios `CP` bajo el contador global "pierde" continuidad numérica visible (empieza otra vez en 1 con el prefijo de sucursal) — aceptado explícitamente porque el objetivo es visibilidad por tienda, no continuidad del número crudo.

## Migration Plan

1. `npx prisma migrate dev --name add_folio_branch_counters` contra la DB de desarrollo (`qzzjpyepggwautckqeex`) — genera y aplica la migración de arriba.
2. Implementar helper + repos + endpoints + frontend (ver `tasks.md`).
3. Verificación completa en dev: `npm test`, `npm run build`, verificación manual (Playwright) — folios independientes por sucursal, preview correcto, auditoría separando series.
4. **Aplicar a prod (`cggfhiyxufjdzxzcxugo`) requiere confirmación explícita separada del usuario antes de `npx prisma migrate deploy`** — la migración en sí es sólo DDL (sin pérdida de datos), pero cualquier cambio de schema en prod se trata como acción irreversible por defecto.
5. Rollback: si algo falla post-deploy, revertir el código (mismo `allocateFolio` legacy sigue funcionando) es seguro; revertir el schema (recrear el unique viejo) requiere que no exista aún ningún `folioCode` nuevo con el formato branch-scoped — ventana de rollback limpio sólo antes del primer documento branch-scoped emitido en prod.
