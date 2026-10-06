## 1. Schema y migración (dev)

- [x] 1.1 Agregar `model FolioBranchCounter` a `prisma/schema.prisma` (ver design.md — Decisión 1): `folioId`, `branchId`, `currentNumber Int @default(0)`, `createdAt`, `updatedAt`, relaciones `folio`/`branch`, `@@id([folioId, branchId])`, `@@index([branchId])`, `@@map("folio_branch_counters")`. Agregar `branchCounters FolioBranchCounter[]` en `Folio` y `folioCounters FolioBranchCounter[]` en `Branch`.
- [x] 1.2 En `Sale`, `Quote`, `Purchase`: ampliar `folioCode` de `@db.VarChar(40)` a `@db.VarChar(64)`; reemplazar `@@unique([folioId, folioNumber])` por `@@unique([folioCode])` + `@@index([folioId])`. En `InventoryMovement`: ampliar `folioCode` a `VarChar(64)` (sin cambio de unique, es nullable y no tiene uno).
- [x] 1.3 `npx prisma migrate dev --name add_folio_branch_counters` contra la DB de dev (`qzzjpyepggwautckqeex`) — revisar el SQL generado contra el de design.md (Decisión 4), en particular el guard `DO $$ ... RAISE EXCEPTION` si hay `folio_code` duplicado (agregarlo a mano en la migración generada si Prisma no lo incluye) y que sólo se toquen `sales`/`quotes`/`purchases`/`inventory_movements` (no `customer_payments`/`waybills`/`provider_payments`).
- [x] 1.4 `npx prisma generate`.

## 2. Helper de allocate por sucursal

- [x] 2.1 Crear `src/shared/domain/folios/formatBranchFolioCode.ts` — función pura `formatBranchFolioCode(prefix: string | null, code: string, branchCode: string, n: number): string` (ver design.md — Decisión 3).
- [x] 2.2 Crear `src/shared/infrastructure/folios/allocateBranchFolio.ts` — `allocateBranchFolio(tx, folioId, branchId): Promise<{ folioNumber: number; folioCode: string }>` vía el `$queryRaw` de design.md — Decisión 2. Reutiliza `InactiveResourceError` (mismo import que `allocateFolio.ts`). NO modificar `allocateFolio.ts` existente.
- [x] 2.3 Tests unit: `tests/unit/modules/shared/domain/folios/formatBranchFolioCode.test.ts` (con/sin prefix, padding a 6 dígitos, distintos branchCode).

## 3. Callers — ventas, cotizaciones, compras

- [x] 3.1 `src/modules/pos/infrastructure/repositories/PrismaSaleRepository.ts`: en `createCompleted` y `createCompletedFromQuote`, reemplazar `allocateFolio(tx, data.folioId)` por `allocateBranchFolio(tx, data.folioId, data.branchId)`.
- [x] 3.2 `src/modules/quotes/infrastructure/repositories/PrismaQuoteRepository.ts`: en `createWithItems`, mismo cambio con `data.branchId`.
- [x] 3.3 `src/modules/purchases/infrastructure/repositories/PrismaPurchaseRepository.ts`: en `createCompleted`, reemplazar `allocateFolio(tx, folio.id)` (folio resuelto vía `resolveCanonicalFolio(tx, CP_FOLIO_CODE)`) por `allocateBranchFolio(tx, folio.id, data.branchId)`.
- [x] 3.4 Verificar que `InMemorySaleRepository`, `InMemoryQuoteRepository`, `InMemoryPurchaseRepository` (usados en tests) no asuman unicidad global de `folioNumber` al asignar números — si lo hacen, cambiar a un contador `Map<"folioId|branchId", number>` por sucursal, igual que el comportamiento real.
- [x] 3.5 Tests: actualizar/crear tests de `createCompleted`/`createCompletedFromQuote`/`createWithItems` verificando `folioCode` con formato `<prefix><BRANCH_CODE>-<NNNNNN>` y que dos sucursales distintas no comparten contador (usar fixtures con 2 branches).

## 4. Preview de folios — backend

- [x] 4.1 `src/modules/folios/application/ports/FolioRepository.ts`: agregar `branchId?: string` a `FindAllFoliosOptions`; nuevo método `findBranchCounters(folioIds: string[], branchId: string): Promise<{ branchCode: string; counters: Map<string, number> } | null>` (retorna `null` si la sucursal no existe).
- [x] 4.2 `src/modules/folios/application/dto/FolioDto.ts`: agregar `branchCurrentNumber: number | null` y `nextFolioCode: string | null` a `FolioDto`; `toFolioDto` acepta un contexto opcional `{ branchCode, currentNumber }` para calcularlos (usando `formatBranchFolioCode` sólo si `code` ∈ `{TK, TC, COT, CP}` — ver constante compartida de folios branch-scoped, task 4.6).
- [x] 4.3 `src/modules/folios/application/use-cases/ListFoliosUseCase.ts`: si `opts.branchId` está presente, tras `findAll` llamar `findBranchCounters` y poblar los campos nuevos; si la sucursal no existe, lanzar el error que el controller mapea a 404 `Branch not found`.
- [x] 4.4 `src/modules/folios/infrastructure/http/FoliosController.ts`: constructor recibe `authzService: AuthorizationService` (inyectar desde `rbacContainer.authorizationService` en `src/modules/folios/infrastructure/di/container.ts`, mismo patrón que `SalesController`). En `list`, parsear `branchId` (uuid) y aplicar `resolveScopedBranchId(req, branchId)` antes de pasarlo al use case.
- [x] 4.5 `PrismaFolioRepository`: implementar `findBranchCounters` (`prisma.folioBranchCounter.findMany({ where: { branchId, folioId: { in } } })` + `prisma.branch.findUnique({ where: { id: branchId } })`, `null` si no existe). `InMemoryFolioRepository`: implementar espejo en memoria.
- [x] 4.6 Definir constante compartida `BRANCH_SCOPED_FOLIO_CODES = ["TK", "TC", "COT", "CP"] as const` (ubicar en `src/shared/domain/folios/` junto a `formatBranchFolioCode.ts`) — usada por `toFolioDto`, `AuditFolioSequenceUseCase` (task 5) y cualquier UI que necesite saber si un folio es branch-scoped.
- [x] 4.7 Tests: `tests/unit/modules/folios/application/use-cases/ListFoliosUseCase.branchPreview.test.ts` (InMemory — con contador existente, sin contador aún (`branchCurrentNumber: 0`), sucursal inexistente, folio no branch-scoped → campos `null`). `tests/unit/modules/folios/infrastructure/http/FoliosController.branchScope.test.ts` (no-bypass forzado a su sucursal, 403 con otra, bypass sin `branchId` → sin cambio).

## 5. Auditoría — backend

- [x] 5.1 `AuditSequenceRaw`/`AuditSequenceItemDto` (`FolioAuditDto.ts`): agregar `"purchase"` a la unión de `doc_type`/`documentType`. `FolioAuditResultDto`: agregar `branchId: string | null`, `branchCode: string | null`.
- [x] 5.2 `FolioRepository.findAuditSequence`/`getAuditCounts`: agregar parámetro `branchId?: string`. `PrismaFolioRepository`: agregar `purchases` al `UNION ALL` de ambos métodos (`doc_type='purchase'`); cuando `branchId` está presente Y el folio es branch-scoped (usar constante de 4.6), agregar `AND folio_code LIKE '<prefix o code><branchCode>-%'` a cada rama del `UNION` (resolver el patrón en la capa de aplicación, pasarlo como parámetro — no construir el `LIKE` con concatenación insegura de SQL).
- [x] 5.3 `AuditFolioSequenceUseCase`: aceptar `branchId?: string` en `execute`; cuando está presente y el folio es branch-scoped, resolver `currentNumber` desde `folio_branch_counters` (0 si no hay fila) en vez de `folio.currentNumber`; resolver `branchCode` del branch para el patrón `LIKE`; sin `branchId` (o folio no branch-scoped), comportamiento actual sin cambio.
- [x] 5.4 `FoliosController` — endpoint de audit: parsear `?branchId=` (uuid), aplicar `resolveScopedBranchId` (mismo guard que list).
- [x] 5.5 Tests: `tests/unit/modules/folios/application/use-cases/AuditFolioSequenceUseCase.test.ts` (nuevo) — casos: purchases ahora cuentan, `branchId` filtra por patrón, sin `branchId` en folio branch-scoped excluye la serie nueva (regresión del bug de mezcla de series), folio no branch-scoped sin cambio, huecos, sucursal inexistente. Caso "sucursal ajena sin bypass → 403" cubierto en `FoliosController.branchScope.test.ts` (4.7, nivel HTTP).

## 6. Frontend — previews de folio

- [x] 6.1 `app/_hooks/useFoliosOptions.ts`: agregar `branchId?: string | null` a los args; cache key `${scope ?? "_all"}|${branchId ?? "_"}`; incluir `branchId` en la URL cuando esté presente; exponer `branchCurrentNumber`/`nextFolioCode` en `FolioOption`; `branchId` en el array de dependencias del efecto de fetch.
- [x] 6.2 `app/(private)/pos/_blocks/CartPanel.tsx`, `app/(private)/quotes/_blocks/QuoteEmitPanel.tsx`, `app/(private)/quotes/_blocks/ConvertQuoteModal.tsx`: usar `f.nextFolioCode` cuando esté presente en vez de calcular `f.currentNumber + 1` client-side; fallback al cálculo actual sólo si `nextFolioCode` es `null` (folio no branch-scoped o sin sucursal seleccionada).
- [x] 6.3 Callers que invocan `useFoliosOptions`: `app/(private)/pos/_blocks/PosPage.tsx` pasa `selectedBranchId` (bypass) o el `branchId` propio; `app/(private)/quotes/_blocks/QuoteCreatePage.tsx` idem; `ConvertQuoteModal.tsx`/`QuoteEditPage.tsx` pasan `quote.branchId`; `EditSalePage.tsx` pasa `sale.branchId`.
- [x] 6.4 Tras confirmar una venta o cotización, invocar `refresh()` del hook (si no ocurre ya) para que el preview refleje el nuevo `currentNumber` sin esperar un remount.
- [x] 6.5 `app/_lib/offline/catalogCache.ts`: `pullFolios` agrega `&branchId=${ownerBranchId}` a la URL; `CachedFolio` (`app/_lib/offline/db.ts`) gana `branchCurrentNumber`/`nextFolioCode` opcionales — sin bump de `DB_VERSION` (campos nuevos opcionales, no rompen registros existentes).
- [x] 6.6 Tests: `tests/unit/ui/_hooks/useFoliosOptions.test.ts` (cache key con `branchId`, refetch al cambiar sucursal); actualizar tests de `CartPanel`, `QuoteEmitPanel`, `ConvertQuoteModal` para el uso de `nextFolioCode`.

## 7. Frontend — auditoría

- [x] 7.1 `app/(private)/catalogs/folios/_logic/types/api.ts`/`domain.ts`: agregar `branchId`/`branchCode` opcionales al tipo de resultado de auditoría; `documentType` incluye `"purchase"`.
- [x] 7.2 `app/(private)/catalogs/folios/_blocks/FolioAuditModal.tsx`: cuando el folio auditado tiene `code` ∈ `{TK, TC, COT, CP}`, mostrar selector de sucursal ("Global (histórico)" + opciones vía `useBypassBranchOptions`); al cambiar, refetch con `?branchId=`. Para otros folios, no renderizar el selector.
- [x] 7.3 Tests: `tests/unit/ui/(private)/catalogs/folios/FolioAuditModal.test.tsx` — selector visible sólo para folios branch-scoped, refetch al cambiar sucursal, tabla muestra filas `documentType: "purchase"`.

## 8. Verificación

- [x] 8.1 `npm test` — suite completa en verde.
- [x] 8.2 `npm run build` — sin errores de tipos.
- [x] 8.3 Revisado `src/modules/reports/`: todo uso de `folioNumber` en ese módulo pertenece a RB/abonos y estados de cuenta (`LedgerGrouper.ts`, `AccountMovement.ts`, `PaymentHistoryReportUseCase`), folio que sigue con contador global (no tocado por este change). El único ordenamiento por `folioNumber` (`LedgerGrouper.byInvoice`/`bySerie`) ya usa `folioCode.localeCompare` como desempate — con `folioCode` ahora único incluso si `folioNumber` coincidiera entre sucursales, el orden queda determinista. Sin cambios necesarios.
- [x] 8.4 Verificación manual en dev (Playwright): usuario de sucursal ZARIOZ crea una venta → folio `TK-ZARIOZ-000001`; usuario de sucursal PRADERA crea una compra → `CP-PRADERA-000001`; ZARIOZ crea una segunda compra → `CP-ZARIOZ-000002` (independiente de PRADERA); admin en `/catalogs/folios` audita `CP` sin sucursal → ve sólo el histórico legacy; audita `CP` con ZARIOZ seleccionada → ve sólo la serie de ZARIOZ, incluyendo compras.
- [x] 8.5 Confirmar con el usuario antes de `npx prisma migrate deploy` en prod (`cggfhiyxufjdzxzcxugo`) — no ejecutar sin aprobación explícita separada. Aplicado 2026-09-23: SQL de la migración corrido vía `mcp__supabase-prod__execute_sql` (no `prisma migrate deploy` — había 2 migraciones anteriores pendientes en prod, `add_customer_branches`/`separate_branch_pricing`, que el usuario decidió NO aplicar aún porque requieren desplegar el código nuevo a la vez; se aplicó sólo esta por ser aditiva e independiente) y checkpoint insertado a mano en `_prisma_migrations`.
