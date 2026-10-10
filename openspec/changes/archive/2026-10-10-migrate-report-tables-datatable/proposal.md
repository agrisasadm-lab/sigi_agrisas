## Historia de Usuario

| # | Rol | Tarea | Motivo | Criterios de Aceptación | Criterios de Seguridad |
|---|---|---|---|---|---|
| 1 | Equipo de desarrollo (mantenimiento del design system) | Como equipo de desarrollo, quiero migrar las tablas de reportes (`LedgerTable`, `SummaryTable`, `PaymentMethodBreakdownTable`, `ByCustomerTable`, `ByTicketTable`, `BreakdownTable`, `SalesListTable`) de markup `<table>`/`<th>`/`<td>` crudo a la primitiva `DataTable` para reducir la deuda técnica declarada en `designer.md` § Pendientes | Mantener consistencia visual y de accesibilidad del design system sin alterar el comportamiento funcional de los reportes, y permitir que la allowlist de `tokens.test.ts` siga encogiendo según su contrato | - Cada una de las 7 tablas reemplaza `<table>/<th>/<td>` crudos por `Table`/`THead`/`TBody`/`Tr`/`Th`/`Td` de `DataTable`<br>- Columnas numéricas usan `align="right"` (cifras tabulares)<br>- Paginación, orden de columnas, filtros y datos mostrados permanecen idénticos a los actuales (sin cambios de API ni de datos)<br>- Edge case: estado sin resultados (tabla vacía) sigue mostrando el mismo mensaje/estado vacío que hoy<br>- Los 7 archivos se eliminan de `RAW_ELEMENT_ALLOWLIST` en `tests/unit/ui/design-system/tokens.test.ts` y el test de guardarraíl pasa<br>- `designer.md` § Pendientes actualiza su conteo/lista para reflejar que estas 7 tablas ya no están pendientes (y corrige las menciones obsoletas a archivos que ya no existen, como un segundo `BreakdownTable` o `ProductBreakdownTable`) | - No se modifica lógica de permisos (`reports:read`, `payments:report_read`, `expenses:report_read`, `returns:read`, etc.) — el cambio es exclusivamente de markup<br>- No se expone ni se omite ninguna columna/dato respecto al comportamiento actual<br>- `Td`/`Th` de `DataTable` escapan contenido igual que los nodos React previos (sin `dangerouslySetInnerHTML` nuevo) |

Nota: una sola historia cubre las 7 tablas porque el criterio de aceptación y el patrón de migración son idénticos en cada caso (sustitución mecánica de markup, sin lógica de negocio); se divide en tareas por archivo en `tasks.md`, no en historias separadas. El escaneo del repo confirmó 7 archivos reales con `<table>` crudo bajo `reports/` (`LedgerTable`, `SummaryTable`, `PaymentMethodBreakdownTable`, `ByCustomerTable`, `ByTicketTable`, `BreakdownTable`, `SalesListTable`) — `designer.md` § Pendientes menciona además "`BreakdownTable` (×2)" y "`ProductBreakdownTable`", que no corresponden a archivos existentes hoy; se corrige esa mención como parte de este change.

## Why

`designer.md` § Pendientes declara como deuda explícita que varias tablas de reportes (texto actual, parcialmente desactualizado: menciona `BreakdownTable` ×2 y `ProductBreakdownTable`, que no existen hoy) ya heredan la tipografía correcta del design system (Fase 1 de `standardize-design-system`) pero conservan `<table>`/`<th>`/`<td>` crudos en lugar de las primitivas de `DataTable`. El escaneo actual del repo identifica 7 archivos reales: `LedgerTable`, `SummaryTable`, `PaymentMethodBreakdownTable`, `ByCustomerTable`, `ByTicketTable`, `BreakdownTable`, `SalesListTable`. La capability `design-system` (`openspec/specs/design-system/spec.md`, requirement "DataTable como único dialecto de tabla") ya PROHÍBE declarar un `<table>` crudo con clases de estilo en `_blocks/`, salvo la allowlist explícita y decreciente de `tests/unit/ui/design-system/tokens.test.ts`. Este change no introduce ni modifica ningún requirement — aplica uno ya vigente a los 7 archivos que todavía están exceptuados, reduciendo la superficie de la allowlist y la inconsistencia visual/de accesibilidad (alineación numérica, tipografía de header, hover de fila) entre tablas de reportes y el resto del panel.

## What Changes

- Migrar `app/(private)/reports/_blocks/LedgerTable.tsx`, `app/(private)/reports/_blocks/SummaryTable.tsx`, `app/(private)/reports/collections/_blocks/global/PaymentMethodBreakdownTable.tsx`, `app/(private)/reports/collections/_blocks/by-customer/ByCustomerTable.tsx`, `app/(private)/reports/collections/_blocks/by-customer/ByTicketTable.tsx`, `app/(private)/reports/sales-cut/_blocks/BreakdownTable.tsx`, `app/(private)/reports/sales-cut/_blocks/SalesListTable.tsx` de `<table>/<th>/<td>` crudo a `Table/THead/TBody/Tr/Th/Td` de `app/_components/molecules/DataTable/`.
- Aplicar `align="right"` en columnas numéricas de cada tabla migrada, según el contrato ya vigente del requirement "DataTable como único dialecto de tabla".
- Eliminar las constantes locales de clases de `th`/`td` por módulo que estuvieran duplicadas (si existen en estos archivos), según la prohibición ya vigente.
- Remover las 7 rutas correspondientes de `RAW_ELEMENT_ALLOWLIST` en `tests/unit/ui/design-system/tokens.test.ts`.
- Actualizar `designer.md` § Pendientes para reflejar la lista reducida de tablas de reportes aún no migradas (si alguna queda fuera de alcance de este change, documentarla explícitamente).

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

Ninguna — el requirement "DataTable como único dialecto de tabla" de `design-system` no cambia; este change es implementación que cierra la excepción de la allowlist para estos 7 archivos. `skip_specs: true` en `.openspec.yaml` de este change, dado que no hay comportamiento de spec nuevo ni modificado (refactor puro de markup).

## Impact

- **Archivos afectados**: los 7 componentes de tabla listados arriba, todos bajo `app/(private)/**/_blocks/`.
- **Guardarraíl**: `tests/unit/ui/design-system/tokens.test.ts` (reduce `RAW_ELEMENT_ALLOWLIST`).
- **Documentación**: `designer.md` § Pendientes.
- **Sin impacto en**: backend (`src/modules/`), APIs, esquema de datos, permisos RBAC, contratos de props públicos de las páginas que consumen estas tablas (siguen recibiendo los mismos datos/paginación/filtros).
- **Riesgo**: bajo — cambio de markup contenido por archivo; cada tabla se puede migrar y verificar de forma independiente.
