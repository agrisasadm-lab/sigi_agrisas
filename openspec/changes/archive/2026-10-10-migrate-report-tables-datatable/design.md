## Context

Las 7 tablas objetivo (ver proposal.md § Historia de Usuario, fila 1) son componentes de presentación puros: reciben filas ya paginadas/filtradas/ordenadas por el hook del módulo (`_logic/`) y sólo renderizan markup. Ninguna mantiene estado de orden ni paginación local — se confirmó leyendo las 7: `LedgerTable.tsx` (156 líneas, la más compleja: grupos venta+abonos, fila de totales en `<tfoot>`, botón de imprimir anticipo, chip de estado cancelado), `SummaryTable.tsx`, `PaymentMethodBreakdownTable.tsx`, `ByCustomerTable.tsx`, `ByTicketTable.tsx`, `BreakdownTable.tsx`, `SalesListTable.tsx` (41-60 líneas cada una: header + filas + fila "sin resultados" con `colSpan`).

`app/_components/molecules/DataTable/DataTable.tsx` exporta `Table`, `THead`, `TBody`, `Tr`, `Th`, `Td` (todos envoltorios de `cn(...)` sobre el elemento nativo, aceptan cualquier prop HTML nativa incluyendo `colSpan`, `title`, `onClick`). **No exporta `TFoot`** — no hay precedente en el repo de una tabla ya migrada con fila de totales (`grep tfoot` sólo encuentra `LedgerTable.tsx` y `InvoiceItemsTable.tsx`, ambas aún sin migrar).

El guardarraíl automatizado (`tokens.test.ts`, regex `/<(?:button|table|select)[\s/>]/`) sólo detecta la etiqueta `<table>` cruda, no `<thead>/<tbody>/<tr>/<th>/<td>/<tfoot>` sueltos. Migrar sólo el `<table>` externo bastaría para pasar el test, pero no cumpliría el espíritu del requirement "DataTable como único dialecto de tabla" (consistencia de clases en header/celdas/hover). Este diseño migra las 7 tablas por completo, no sólo lo mínimo para pasar el test.

## Goals / Non-Goals

**Goals:**
- Reemplazar `table/thead/tbody/tr/th/td` crudos por `Table/THead/TBody/Tr/Th/Td` en las 7 tablas, preservando el comportamiento visual y funcional actual pieza por pieza (fila 1 de la Historia de Usuario).
- Definir un patrón único para los dos casos que `DataTable` no cubre hoy: (a) fila de "sin resultados" con `colSpan`, (b) fila de totales en `<tfoot>` (sólo en `LedgerTable`), para que una futura migración de otras tablas con totales lo reutilice.
- Dejar cada archivo migrable y verificable de forma independiente (commits/PRs separables por archivo si se quisiera).

**Non-Goals:**
- No se añade ordenamiento, paginación client-side ni ninguna capacidad nueva — estas tablas no la tienen hoy y no se les agrega.
- No se migra `InvoiceItemsTable.tsx` (billing) aunque comparta el patrón de `<tfoot>` — queda fuera del alcance acordado (ver pregunta del usuario: sólo "tablas de reportes"); es deuda declarada aparte.
- No se extiende `DataTable.tsx` con un componente `TFoot` nuevo — ver Decisión 2.

## Decisions

**Decisión 1 — Migración completa (`table` + `thead/tbody/tr/th/td`), no sólo la etiqueta `<table>`.**
Alternativa descartada: migrar únicamente `<table>` → `<Table>` para pasar el guardarraíl automatizado y dejar `th`/`td` crudos. Se descarta porque el requirement de `design-system` habla de "único dialecto de tabla" (consistencia de clases), no sólo de la etiqueta contenedora; dejar `th`/`td` crudos perpetuaría la inconsistencia de hover/tipografía que esta migración busca cerrar, y un futuro cambio al contrato de `Th`/`Td` en `DataTable.tsx` no se propagaría a estas tablas.

**Decisión 2 — Fila de totales de `LedgerTable` usa `<tfoot>` nativo envolviendo `Tr`/`Td` de `DataTable`, no un `TFoot` nuevo.**
`LedgerTable` es la única de las 7 con fila de totales (`tfoot`, `colSpan`, `border-t-2 border-outline-variant bg-surface-container font-medium`). Alternativas:
- (a) Añadir `TFoot` a `DataTable.tsx` — descartada por ahora: un solo consumidor no justifica expandir la API pública de la primitiva (regla del repo: "no add features beyond lo que la tarea requiere"); si una segunda tabla de reportes necesita totales, se revisita.
- (b) `<tfoot>` nativo (sin primitiva, igual que hoy) pero con `Tr`/`Td` de `DataTable` dentro para heredar clases base y permitir overrides vía `className` (`border-t-2 bg-surface-container font-medium` como className adicional sobre `Td`/`Tr`). Elegida: cero API nueva, mismo resultado visual, consistente con que `Td`/`Tr` acepten cualquier override de clase.

**Decisión 3 — Fila "sin resultados" usa `Tr` + `Td colSpan={N}` centrado, patrón único en las 6 tablas que la tienen.**
Hoy cada tabla declara su propio `<tr><td colSpan={N} className="px-4 py-4 text-center text-on-surface-variant">...` a mano. Se mantiene el mismo patrón pero con `Td` (que ya aporta `px-4 py-3` base; se añade `className="py-4 text-center"` como override, igual que hoy difiere ligeramente de la celda normal). No se introduce `EmptyState` del catálogo de primitivas porque esa primitiva está pensada para vaciar una página completa (ícono + título + descripción), no una fila de tabla — cambiarla sería una regresión visual dentro del alcance de "sin alterar comportamiento funcional" del proposal.

**Decisión 4 — Botón de imprimir anticipo (`LedgerTable`, icon button inline) se mantiene como `<button>` nativo.**
No forma parte del alcance de este change (el guardarraíl de `<button>` crudo es una deuda distinta, ya cubierta por su propia entrada en la allowlist general de `_blocks/`, no la de tablas). Tocarlo aquí ampliaría el alcance aprobado por el usuario (sólo "tablas de reportes → DataTable").

## Risks / Trade-offs

- **[Riesgo] Clases de `Td`/`Th` (`px-4 py-3`) difieren ligeramente de algunas clases actuales (`px-3 py-3` en `LedgerTable`, `px-3 py-2` en la fila "orphan").** → Mitigación: usar `className` override en cada `Td` puntual donde el padding actual difiera de `px-4`, documentado en `tasks.md` por archivo; no es un cambio de comportamiento sino de cumplir el contrato ya vigente del requirement (la Th/Td normativa usa `px-4`), consistente con el resto de tablas del panel ya migradas.
- **[Riesgo] Regresión visual sutil no capturada por tests (no hay snapshot tests de estas tablas).** → Mitigación: verificación manual con Playwright de cada página de reporte afectada (`/reports`, `/reports/sales-cut`, `/reports/collections`) tras migrar, comparando contra captura previa; no hay runner e2e automatizado en el repo para esto (ver `CLAUDE.md` — "E2E: sin runner aún").
- **[Riesgo] `designer.md` § Pendientes queda desactualizado si no se corrige en el mismo PR.** → Mitigación: `tasks.md` incluye una tarea explícita de actualizar esa sección, incluyendo la corrección de las menciones obsoletas (`BreakdownTable` ×2, `ProductBreakdownTable`).

## Migration Plan

Sin pasos de despliegue especiales (cambio de frontend puro, sin migración de datos ni flags). Orden sugerido en `tasks.md`: migrar primero las 6 tablas simples (sin `tfoot`) para validar el patrón de Decisión 3, luego `LedgerTable` (valida Decisión 2), y al final el guardarraíl (`tokens.test.ts`) + `designer.md`. Rollback: revertir el archivo individual migrado (cada tabla es independiente); no hay estado persistente que revertir.
