## 1. Auditoría previa (no-regresión)

- [x] 1.1 Buscar (grep/codegraph) todos los consumidores de `submit`/`reset` retornados por `useSaleSubmission` y `useQuoteSubmission` (ej. `PosPage`, `CartPanel`, `QuotePage`/equivalente) y confirmar que ninguno pasa esas funciones a un array de deps de otro `useEffect`/`useCallback`/`useMemo` que pueda disparar un loop al recrearse. — Verificado: `PosPage.tsx` y `QuoteCreatePage.tsx` usan `submitSale`/`submitQuote`/`resetSale`/`resetQuote`/`submit`/`resetSubmit` solo dentro de funciones manejadoras planas (`handleSubmit`, `handleNewQuote`), nunca dentro de un array de deps de `useEffect`/`useCallback`/`useMemo`. Sin riesgo de loop.

## 2. Fix `useSaleSubmission.ts`

- [x] 2.1 Agregar `offlineEnabled`, `ownerBranchId` al array de deps del `useCallback` de `submit` (`app/(private)/pos/_logic/hooks/useSaleSubmission.ts:98`).
- [x] 2.2 Correr `npx eslint app/(private)/pos/_logic/hooks/useSaleSubmission.ts` → 0 warnings. ✓

## 3. Fix `useQuoteSubmission.ts`

- [x] 3.1 Agregar `offlineEnabled`, `ownerBranchId` al array de deps del `useCallback` de `submit` (`app/(private)/quotes/_logic/hooks/useQuoteSubmission.ts:100`).
- [x] 3.2 Correr `npx eslint app/(private)/quotes/_logic/hooks/useQuoteSubmission.ts` → 0 warnings. ✓

## 4. Fix `useSalesList.ts`

- [x] 4.1 ~~Extraer `JSON.stringify(status)` a variable~~ — descartado: no elimina el warning (ver design.md D3). Fix aplicado: agregar `status` directo al array de deps del `useEffect` (`app/(private)/sales/_logic/hooks/useSalesList.ts`), tras verificar que el único caller (`SalesListPage.tsx`) pasa una referencia estable.
- [x] 4.2 ~~Reemplazar `JSON.stringify(status)` por `statusKey`~~ — n/a, ver 4.1.
- [x] 4.3 Correr `npx eslint app/(private)/sales/_logic/hooks/useSalesList.ts` → 0 warnings. ✓

## 5. Verificación

- [x] 5.1 Correr `npx eslint` sobre los 3 archivos juntos → 0 warnings, 0 errors. ✓
- [x] 5.2 Correr `npx tsc --noEmit` → sin nuevos errores introducidos en estos 3 archivos. ✓
- [x] 5.3 Correr suite de tests existente que cubra estos hooks: `useSaleSubmission.test.ts`, `useQuoteSubmission.test.ts`, `SalesListPage.padding.test.tsx` → 3 suites, 9 tests, todos verdes. ✓
- [x] 5.4 Correr `npm run build` completo → build limpio, sin regresiones. ✓
- [x] 5.5 Verificación manual (Playwright) en navegador real contra dev server local. Secuencia: login admin → POS → seleccionar sucursal (ZARIOZ) → "Fijar sucursal offline" (dispara resolución ASYNC de `offlineEnabled`/`ownerBranchId` DESPUÉS del montaje del componente, exactamente el escenario del bug) → `page.context().setOffline(true)` (corte de red real, no solo `navigator.onLine`) → agregar producto con precio ya cacheado → "Finalizar venta". **Resultado: "Venta guardada — pendiente de sincronizar", SIN el error "Fija tu sucursal de trabajo"** → confirma que `submit` ya lee `offlineEnabled`/`ownerBranchId` vigentes, no los del montaje. Repetido en modo Cotización con mismo resultado ("Cotización guardada — pendiente de sincronizar"). Al volver online (`setOffline(false)`), la venta sincronizó ("Todo sincronizado"). **Hallazgo colateral (bug preexistente, NO introducido por este change, fuera de alcance):** el sync engine reintenta el POST con el mismo `clientRequestId` tras un 201 ya exitoso; el backend no maneja el conflicto de idempotencia (constraint única en `client_request_id`, Postgres 23505 / Prisma P2002) devolviendo la venta/cotización ya creada, sino que propaga 500. Para la cotización esto deja la cola en "1 pendiente de sincronizar" indefinidamente (con backoff, no es loop agresivo). Afecta `PrismaSaleRepository.createCompleted` y `PrismaQuoteRepository.createWithItems`. Agregado a `TECH_DEBT_CHECKLIST.md` como ítem nuevo de prioridad alta — requiere su propio change/proposal, no se toca aquí.

## 6. Actualizar checklist de deuda técnica

- [x] 6.1 Marcados como resueltos en `TECH_DEBT_CHECKLIST.md` los 3 ítems de la sección "1. Bug-risk — react-hooks exhaustive-deps". Agregada sección nueva "1-bis" con el bug de idempotencia del sync engine descubierto durante la verificación manual (fuera de alcance, requiere su propio change).
