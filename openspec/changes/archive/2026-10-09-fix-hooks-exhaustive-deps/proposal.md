## Historia de Usuario

| # | Rol | Tarea | Motivo | Criterios de Aceptación | Criterios de Seguridad |
|---|---|---|---|---|---|
| 1 | Cajero (operador POS) | Como cajero, quiero que el registro de ventas funcione correctamente en modo offline aunque la resolución de mi sucursal de trabajo llegue después de abrir el POS, para no perder ventas cuando se corta la conexión | - Given el POS se monta y `OfflineSyncProvider` resuelve `offlineEnabled`/`ownerBranchId` async después del primer render, When pierdo conexión y confirmo una venta, Then `submit` usa los valores actuales de `offlineEnabled`/`ownerBranchId` (no los del primer render) y la venta se encola en el outbox si corresponde.<br>- Given `ownerBranchId` ya resuelto coincide con `draft.branchId`, When confirmo venta offline, Then NO aparece el error "Fija tu sucursal de trabajo".<br>- Given `offlineEnabled=false` (sucursal no fijada), When confirmo venta sin conexión, Then sí aparece el error y la venta no se encola (comportamiento ya correcto, no debe romperse).<br>- Regresión: ningún loop infinito de render/fetch al agregar las deps. | - El fix no altera el branch scoping existente: `ownerBranchId !== draft.branchId` sigue bloqueando el encolado cross-sucursal.<br>- No se modifica validación Zod ni el contrato HTTP de `POST /sales`.<br>- No se introduce ningún nuevo permiso RBAC; el fix es puro frontend. |
| 2 | Operador (cotizaciones) | Como operador de cotizaciones, quiero que el registro offline de cotizaciones use mi sucursal de trabajo y el estado offline vigentes al momento de confirmar, para no perder cotizaciones cuando se corta la conexión | - Mismos AC que la fila 1 pero sobre `useQuoteSubmission.ts` / flujo `createQuote` + `enqueueQuote`.<br>- Given `offlineEnabled`/`ownerBranchId` cambian después del montaje inicial, When confirmo una cotización offline, Then el closure usa el valor vigente, no el inicial. | - `ownerBranchId !== draft.branchId` sigue bloqueando cross-sucursal.<br>- No se modifica validación Zod ni contrato HTTP de `POST /quotes`.<br>- Sin nuevo permiso RBAC. |
| 3 | Desarrollador que mantiene el código | Como desarrollador, quiero que `useSalesList` declare explícitamente la dependencia `status` del `useEffect` extrayéndola a una variable, para que ESLint quede en 0 warnings y el efecto sea verificable estáticamente sin depender de inferencia implícita | - El array de deps ya refetchea correctamente hoy (`JSON.stringify(status)` ya está presente) — ítem de cleanup de lint/legibilidad, no fix de bug funcional.<br>- Extraer `const statusKey = JSON.stringify(status)` antes del efecto y usarla en el array de deps.<br>- `npx eslint app/(private)/sales/_logic/hooks/useSalesList.ts` → 0 warnings.<br>- El comportamiento de refetch ante cambio de filtro `status` no cambia. | - N/A — sin superficie de seguridad; cambio puramente de legibilidad interna. |

## Why

`useSaleSubmission` y `useQuoteSubmission` memoizan su función `submit` con `useCallback(..., [])`, pero el closure lee `offlineEnabled` y `ownerBranchId` desde `useOfflineSync()`. Ese contexto resuelve ambos valores de forma **asíncrona** después del montaje (`OfflineSyncProvider` arranca con `ownerBranchId=null`/`offlineEnabled=false` y los actualiza tras `resolveBranchScope`). Con deps vacías, `submit` queda congelado para siempre con los valores iniciales (`null`/`false`): el camino de encolado offline (`enqueueOffline`) evalúa `!offlineEnabled || ownerBranchId !== draft.branchId` contra datos obsoletos, de modo que — una vez montado el componente — la venta/cotización offline previsiblemente **siempre** cae en el error "Fija tu sucursal de trabajo…", incluso cuando el provider ya resolvió correctamente la sucursal de trabajo. Esto contradice el requirement ya existente en `openspec/specs/offline-sync/spec.md` ("Bypass users must fix a working branch before operating offline": *"from that point the user's offline experience is identical to a regular cashier scoped to that branch"*) — el bug es de implementación, no de spec.

De forma relacionada, `useSalesList` dispara el warning `react-hooks/exhaustive-deps` por traer `JSON.stringify(status)` inline en el array de deps en vez de una variable — el efecto ya refetchea correctamente hoy, pero el lint no puede verificarlo estáticamente.

Corregirlo ahora evita que una venta/cotización offline real se pierda silenciosamente en producción, y deja el lint de estos 3 hooks limpio.

## What Changes

- `app/(private)/pos/_logic/hooks/useSaleSubmission.ts`: agregar `offlineEnabled`, `ownerBranchId` al array de deps de `useCallback` de `submit`.
- `app/(private)/quotes/_logic/hooks/useQuoteSubmission.ts`: mismo fix, mismas deps faltantes.
- `app/(private)/sales/_logic/hooks/useSalesList.ts`: extraer `JSON.stringify(status)` a una variable (`statusKey`) antes del `useEffect` y usarla en el array de deps — sin cambio de comportamiento.
- Verificar ausencia de loops de render/fetch tras el cambio (los valores de `useOfflineSync()` solo cambian cuando el provider realmente actualiza su estado, no en cada render).
- `npx eslint` en los 3 archivos debe quedar en 0 warnings.

## Capabilities

Sin capabilities nuevas ni modificadas — es un bugfix de implementación que restaura el comportamiento ya exigido por `openspec/specs/offline-sync/spec.md` (requirement "Bypass users must fix a working branch before operating offline"). No se altera ningún requirement ni se agrega texto de spec. `skip_specs: true` en `.openspec.yaml`.

## Impact

- **Archivos:** 3 hooks de frontend (`useSaleSubmission.ts`, `useQuoteSubmission.ts`, `useSalesList.ts`). Sin cambios de backend, Prisma, ni contratos HTTP.
- **Riesgo:** bajo — cambio mecánico de dependency arrays; el riesgo principal a vigilar es introducir un loop de render/fetch si `offlineEnabled`/`ownerBranchId` cambiaran de identidad en cada render (se verifica que `OfflineSyncProvider` solo los actualiza via `setState` real, no en cada render).
- **Tests:** correr suite existente de estos 3 hooks (si existen) + `npx eslint` sobre los 3 archivos + verificación manual rápida del flujo offline en POS/Cotizaciones.
