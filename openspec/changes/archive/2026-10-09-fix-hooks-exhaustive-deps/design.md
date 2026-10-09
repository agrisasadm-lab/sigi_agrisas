## Context

Ver `proposal.md` - Why. `useOfflineSync()` expone `offlineEnabled: boolean` y `ownerBranchId: string | null` — ambos primitivos, actualizados vía `setState` real dentro de `OfflineSyncProvider` solo cuando `resolveBranchScope` resuelve (no en cada render). `submit` en `useSaleSubmission`/`useQuoteSubmission` los captura por closure con `useCallback(..., [])`, quedando pegado a los valores del primer render.

`useSalesList` ya incluye `JSON.stringify(status)` en el array de deps de su `useEffect`; el warning de ESLint es porque la expresión inline no es estáticamente verificable, no porque falte una dependencia real.

## Goals / Non-Goals

**Goals:**
- Filas 1 y 2 de la Historia de Usuario: `submit` debe leer siempre el `offlineEnabled`/`ownerBranchId` vigente, no el del montaje inicial.
- Fila 3: eliminar el warning de ESLint en `useSalesList` sin cambiar el comportamiento de refetch.
- 0 warnings de `react-hooks/exhaustive-deps` en los 3 archivos tras el cambio.

**Non-Goals:**
- No se toca `OfflineSyncProvider.tsx` ni la lógica de `resolveBranchScope`/`fixWorkingBranch` — su contrato ya es correcto (ver spec `offline-sync`).
- No se añade spec nueva ni se modifica ninguna existente (`skip_specs: true`).
- No se corrige ningún otro warning de ESLint del proyecto fuera de estos 3 archivos (quedan en `TECH_DEBT_CHECKLIST.md` punto 5, fuera de alcance).

## Decisions

**D1 — Agregar `offlineEnabled`, `ownerBranchId` al array de deps de `submit` (filas 1 y 2).**
Alternativa descartada: usar un `useRef` que se actualice vía `useEffect` cada vez que cambien esos valores, y leer `ref.current` dentro de `submit` (así `submit` no necesita deps y mantiene identidad estable entre renders). Se descarta porque añade una capa de indirección (ref + effect sincronizador) para un problema que el fix directo resuelve en una línea, y porque ambos valores son primitivos — agregarlos a las deps no causa el problema que normalmente justifica un ref (invalidar memoización costosa o romper otra dependencia downstream). `submit` no se pasa como prop estable a ningún `memo`/`PureComponent` sensible a su identidad (se verifica en D2), así que recrear la función cuando cambian 2 primitivos es aceptable y más legible.

**D2 — Verificación de no-regresión (loop de render/fetch).**
`offlineEnabled`/`ownerBranchId` son primitivos (boolean/string|null), no objetos recreados en cada render de `OfflineSyncProvider` — solo cambian vía `setOwnerBranchId`/`setOfflineEnabled` dentro del `useEffect` que llama `resolveBranchScope`. Por lo tanto agregar ambos a las deps de `submit` no genera un ciclo (la nueva identidad de `submit` solo se crea cuando esos dos valores realmente cambian, lo cual ocurre una vez por resolución de sucursal, no en cada render). Se audita además que ningún componente consumidor de `submit`/`reset` lo pase a un array de deps de otro efecto que dispare side-effects en cascada (grep de usos en `PosPage`/`QuotePage` antes de aplicar).

**D3 — Fila 3: agregar `status` directo al array de deps (en vez de `JSON.stringify(status)`).**
Al implementar se verificó que extraer `JSON.stringify(status)` a una variable NO elimina el warning: ESLint sigue exigiendo `status` literal en las deps porque el cuerpo del efecto lo referencia directamente (la variable derivada no sustituye al identificador real para la regla). Se auditó al único consumidor real (`SalesListPage.tsx`) y `status` llega siempre como la misma referencia del `useState` (`statusFilter`) o `undefined` — nunca un array literal nuevo por render — por lo que agregar `status` tal cual a las deps no reintroduce fetches innecesarios en la práctica. Alternativas descartadas: (a) `eslint-disable-next-line` — oculta el problema, sin precedente en el proyecto; (b) `useMemo(() => status, [JSON.stringify(status)])` para estabilizar la identidad — innecesariamente complejo dado que el único caller ya es estable; se puede revisar si en el futuro aparece un caller que pase un literal inline.

## Risks / Trade-offs

- [Riesgo] Recrear `submit` en cada cambio de `offlineEnabled`/`ownerBranchId` podría, en teoría, re-disparar algún efecto downstream que dependa de la identidad de `submit`. → Mitigación: D2 ya audita los consumidores antes de aplicar; además estos valores cambian con baja frecuencia (una vez al resolver la sucursal de trabajo, no por cada tecla/render).
- [Riesgo] El fix podría exponer que, en algún punto intermedio de carga (`offlineEnabled` todavía `false` mientras se resuelve), un usuario presione "confirmar venta" justo en esa ventana y reciba el error "Fija tu sucursal de trabajo" de forma legítima (no es el bug, es el estado real transitorio). → Mitigación: comportamiento esperado y ya cubierto por el AC de la fila 1 ("offlineEnabled=false → sí aparece el error"); no requiere loading guard adicional, fuera de alcance de este fix.

## Migration Plan

Cambio de solo-frontend, sin migración de datos ni flag. Deploy estándar (PR → `develop`). Rollback: revert del commit, sin estado persistente afectado.
