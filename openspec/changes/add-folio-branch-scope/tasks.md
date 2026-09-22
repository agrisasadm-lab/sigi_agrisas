## 1. Schema y migración (dev)

- [ ] 1.1 Agregar `model FolioBranchCounter` a `prisma/schema.prisma` (ver design.md — Decisión 1): `folioId`, `branchId`, `currentNumber Int @default(0)`, `createdAt`, `updatedAt`, relaciones `folio`/`branch`, `@@id([folioId, branchId])`, `@@index([branchId])`, `@@map("folio_branch_counters")`. Agregar `branchCounters FolioBranchCounter[]` en `Folio` y `folioCounters FolioBranchCounter[]` en `Branch`.
- [ ] 1.2 En `Sale`, `Quote`, `Purchase`: ampliar `folioCode` de `@db.VarChar(40)` a `@db.VarChar(64)`; reemplazar `@@unique([folioId, folioNumber])` por `@@unique([folioCode])` + `@@index([folioId])`. En `InventoryMovement`: ampliar `folioCode` a `VarChar(64)` (sin cambio de unique, es nullable y no tiene uno).
- [ ] 1.3 `npx prisma migrate dev --name add_folio_branch_counters` contra la DB de dev (`qzzjpyepggwautckqeex`) — revisar el SQL generado contra el de design.md (Decisión 4), en particular el guard `DO $$ ... RAISE EXCEPTION` si hay `folio_code` duplicado (agregarlo a mano en la migración generada si Prisma no lo incluye) y que sólo se toquen `sales`/`quotes`/`purchases`/`inventory_movements` (no `customer_payments`/`waybills`/`provider_payments`).
- [ ] 1.4 `npx prisma generate`.

## 2. Helper de allocate por sucursal

- [ ] 2.1 Crear `src/shared/domain/folios/formatBranchFolioCode.ts` — función pura `formatBranchFolioCode(prefix: string | null, code: string, branchCode: string, n: number): string` (ver design.md — Decisión 3).
- [ ] 2.2 Crear `src/shared/infrastructure/folios/allocateBranchFolio.ts` — `allocateBranchFolio(tx, folioId, branchId): Promise<{ folioNumber: number; folioCode: string }>` vía el `$queryRaw` de design.md — Decisión 2. Reutiliza `InactiveResourceError` (mismo import que `allocateFolio.ts`). NO modificar `allocateFolio.ts` existente.
- [ ] 2.3 Tests unit: `tests/unit/shared/domain/folios/formatBranchFolioCode.test.ts` (con/sin prefix, padding a 6 dígitos, distintos branchCode).

## 3. Callers — ventas, cotizaciones, compras

- [ ] 3.1 `src/modules/pos/infrastructure/repositories/PrismaSaleRepository.ts`: en `createCompleted` y `createCompletedFromQuote`, reemplazar `allocateFolio(tx, data.folioId)` por `allocateBranchFolio(tx, data.folioId, data.branchId)`.
- [ ] 3.2 `src/modules/quotes/infrastructure/repositories/PrismaQuoteRepository.ts`: en `createWithItems`, mismo cambio con `data.branchId`.
- [ ] 3.3 `src/modules/purchases/infrastructure/repositories/PrismaPurchaseRepository.ts`: en `createCompleted`, reemplazar `allocateFolio(tx, folio.id)` (folio resuelto vía `resolveCanonicalFolio(tx, CP_FOLIO_CODE)`) por `allocateBranchFolio(tx, folio.id, data.branchId)`.
- [ ] 3.4 Verificar que `InMemorySaleRepository`, `InMemoryQuoteRepository`, `InMemoryPurchaseRepository` (usados en tests) no asuman unicidad global de `folioNumber` al asignar números — si lo hacen, cambiar a un contador `Map<"folioId|branchId", number>` por sucursal, igual que el comportamiento real.
- [ ] 3.5 Tests: actualizar/crear tests de `createCompleted`/`createCompletedFromQuote`/`createWithItems` verificando `folioCode` con formato `<prefix><BRANCH_CODE>-<NNNNNN>` y que dos sucursales distintas no comparten contador (usar fixtures con 2 branches).

## 4. Preview de folios — backend

- [ ] 4.1 `src/modules/folios/application/ports/FolioRepository.ts`: agregar `branchId?: string` a `FindAllFoliosOptions`; nuevo método `findBranchCounters(folioIds: string[], branchId: string): Promise<{ branchCode: string; counters: Map<string, number> } | null>` (retorna `null` si la sucursal no existe).
- [ ] 4.2 `src/modules/folios/application/dto/FolioDto.ts`: agregar `branchCurrentNumber: number | null` y `nextFolioCode: string | null` a `FolioDto`; `toFolioDto` acepta un contexto opcional `{ branchCode, currentNumber }` para calcularlos (usando `formatBranchFolioCode` sólo si `code` ∈ `{TK, TC, COT, CP}` — ver constante compartida de folios branch-scoped, task 4.6).
- [ ] 4.3 `src/modules/folios/application/use-cases/ListFoliosUseCase.ts`: si `opts.branchId` está presente, tras `findAll` llamar `findBranchCounters` y poblar los campos nuevos; si la sucursal no existe, lanzar el error que el controller mapea a 404 `Branch not found`.
- [ ] 4.4 `src/modules/folios/infrastructure/http/FoliosController.ts`: constructor recibe `authzService: AuthorizationService` (inyectar desde `rbacContainer.authorizationService` en `src/modules/folios/infrastructure/di/container.ts`, mismo patrón que `SalesController`). En `list`, parsear `branchId` (uuid) y aplicar `resolveScopedBranchId(req, branchId)` antes de pasarlo al use case.
- [ ] 4.5 `PrismaFolioRepository`: implementar `findBranchCounters` (`prisma.folioBranchCounter.findMany({ where: { branchId, folioId: { in } } })` + `prisma.branch.findUnique({ where: { id: branchId } })`, `null` si no existe). `InMemoryFolioRepository`: implementar espejo en memoria.
- [ ] 4.6 Definir constante compartida `BRANCH_SCOPED_FOLIO_CODES = ["TK", "TC", "COT", "CP"] as const` (ubicar en `src/shared/domain/folios/` junto a `formatBranchFolioCode.ts`) — usada por `toFolioDto`, `AuditFolioSequenceUseCase` (task 5) y cualquier UI que necesite saber si un folio es branch-scoped.
- [ ] 4.7 Tests: `tests/unit/modules/folios/application/use-cases/ListFoliosUseCase.branchPreview.test.ts` (InMemory — con contador existente, sin contador aún (`branchCurrentNumber: 0`), sucursal inexistente, folio no branch-scoped → campos `null`). `tests/unit/modules/folios/infrastructure/http/FoliosController.branchScope.test.ts` (no-bypass forzado a su sucursal, 403 con otra, bypass sin `branchId` → sin cambio).

## 5. Auditoría — backend

- [ ] 5.1 `AuditSequenceRaw`/`AuditSequenceItemDto` (`FolioAuditDto.ts`): agregar `"purchase"` a la unión de `doc_type`/`documentType`. `FolioAuditResultDto`: agregar `branchId: string | null`, `branchCode: string | null`.
- [ ] 5.2 `FolioRepository.findAuditSequence`/`getAuditCounts`: agregar parámetro `branchId?: string`. `PrismaFolioRepository`: agregar `purchases` al `UNION ALL` de ambos métodos (`doc_type='purchase'`); cuando `branchId` está presente Y el folio es branch-scoped (usar constante de 4.6), agregar `AND folio_code LIKE '<prefix o code><branchCode>-%'` a cada rama del `UNION` (resolver el patrón en la capa de aplicación, pasarlo como parámetro — no construir el `LIKE` con concatenación insegura de SQL).
- [ ] 5.3 `AuditFolioSequenceUseCase`: aceptar `branchId?: string` en `execute`; cuando está presente y el folio es branch-scoped, resolver `currentNumber` desde `folio_branch_counters` (0 si no hay fila) en vez de `folio.currentNumber`; resolver `branchCode` del branch para el patrón `LIKE`; sin `branchId` (o folio no branch-scoped), comportamiento actual sin cambio.
- [ ] 5.4 `FoliosController` — endpoint de audit: parsear `?branchId=` (uuid), aplicar `resolveScopedBranchId` (mismo guard que list).
- [ ] 5.5 Tests: actualizar `tests/unit/modules/folios/application/use-cases/FoliosUseCases.test.ts` (o el archivo que cubra `AuditFolioSequenceUseCase`) — casos: purchases ahora cuentan, `branchId` filtra por patrón, sin `branchId` muestra sólo serie legacy, sucursal ajena sin bypass → 403.

## 6. Frontend — previews de folio

- [ ] 6.1 `app/_hooks/useFoliosOptions.ts`: agregar `branchId?: string | null` a los args; cache key `${scope ?? "_all"}|${branchId ?? "_"}`; incluir `branchId` en la URL cuando esté presente; exponer `branchCurrentNumber`/`nextFolioCode` en `FolioOption`; `branchId` en el array de dependencias del efecto de fetch.
- [ ] 6.2 `app/(private)/pos/_blocks/CartPanel.tsx`, `app/(private)/quotes/_blocks/QuoteEmitPanel.tsx`, `app/(private)/quotes/_blocks/ConvertQuoteModal.tsx`: usar `f.nextFolioCode` cuando esté presente en vez de calcular `f.currentNumber + 1` client-side; fallback al cálculo actual sólo si `nextFolioCode` es `null` (folio no branch-scoped o sin sucursal seleccionada).
- [ ] 6.3 Callers que invocan `useFoliosOptions`: `app/(private)/pos/_blocks/PosPage.tsx` pasa `selectedBranchId` (bypass) o el `branchId` propio; `app/(private)/quotes/_blocks/QuoteCreatePage.tsx` idem; `ConvertQuoteModal.tsx`/`QuoteEditPage.tsx` pasan `quote.branchId`; `EditSalePage.tsx` pasa `sale.branchId`.
- [ ] 6.4 Tras confirmar una venta o cotización, invocar `refresh()` del hook (si no ocurre ya) para que el preview refleje el nuevo `currentNumber` sin esperar un remount.
- [ ] 6.5 `app/_lib/offline/catalogCache.ts`: `pullFolios` agrega `&branchId=${ownerBranchId}` a la URL; `CachedFolio` (`app/_lib/offline/db.ts`) gana `branchCurrentNumber`/`nextFolioCode` opcionales — sin bump de `DB_VERSION` (campos nuevos opcionales, no rompen registros existentes).
- [ ] 6.6 Tests: `tests/unit/ui/_hooks/useFoliosOptions.test.ts` (cache key con `branchId`, refetch al cambiar sucursal); actualizar tests de `CartPanel`, `QuoteEmitPanel`, `ConvertQuoteModal` para el uso de `nextFolioCode`.

## 7. Frontend — auditoría

- [ ] 7.1 `app/(private)/catalogs/folios/_logic/types/api.ts`/`domain.ts`: agregar `branchId`/`branchCode` opcionales al tipo de resultado de auditoría; `documentType` incluye `"purchase"`.
- [ ] 7.2 `app/(private)/catalogs/folios/_blocks/FolioAuditModal.tsx`: cuando el folio auditado tiene `code` ∈ `{TK, TC, COT, CP}`, mostrar selector de sucursal ("Global (histórico)" + opciones vía `useBypassBranchOptions`); al cambiar, refetch con `?branchId=`. Para otros folios, no renderizar el selector.
- [ ] 7.3 Tests: `tests/unit/ui/(private)/catalogs/folios/FolioAuditModal.test.tsx` — selector visible sólo para folios branch-scoped, refetch al cambiar sucursal, tabla muestra filas `documentType: "purchase"`.

## 8. Verificación

- [ ] 8.1 `npm test` — suite completa en verde.
- [ ] 8.2 `npm run build` — sin errores de tipos.
- [ ] 8.3 Revisar `src/modules/reports/` (grep `folioNumber`) por cualquier reporte que agrupe/compare por `folioNumber` asumiendo unicidad global (design.md — Riesgos) — documentar hallazgos en el resultado de `opsx:verify`, corregir sólo si rompe una expectativa ya cubierta por specs de reports.
- [ ] 8.4 Verificación manual en dev (Playwright): usuario de sucursal ZARIOZ crea una venta → folio `TK-ZARIOZ-000001`; usuario de sucursal PRADERA crea una compra → `CP-PRADERA-000001`; ZARIOZ crea una segunda compra → `CP-ZARIOZ-000002` (independiente de PRADERA); admin en `/catalogs/folios` audita `CP` sin sucursal → ve sólo el histórico legacy; audita `CP` con ZARIOZ seleccionada → ve sólo la serie de ZARIOZ, incluyendo compras.
- [ ] 8.5 Confirmar con el usuario antes de `npx prisma migrate deploy` en prod (`cggfhiyxufjdzxzcxugo`) — no ejecutar sin aprobación explícita separada.
