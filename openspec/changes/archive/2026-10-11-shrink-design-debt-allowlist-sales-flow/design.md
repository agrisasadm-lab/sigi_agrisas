## Context

Ver `proposal.md` § Why para la motivación. Este documento cubre el *cómo*.

**Inventario cuantificado** (56 archivos del flujo de Ventas, conteo de elementos crudos por submódulo vía regex multilínea `/<(?:button|table|select)[\s/>]/` sobre el contenido completo del archivo — grep por línea falla porque JSX suele partir el tag en varias líneas):

| Submódulo | Archivos | `<button>` | `<table>` | `<select>` |
|---|---|---|---|---|
| `pos/_blocks/` | 9 | 23 | 2 | 2 |
| `quotes/_blocks/` | 8 | 14 | 2 | 4 |
| `sales/_blocks/` (+ anidados) | 11 | 21 | 2 | 1 |
| `returns/_blocks/` | 5 | 9 | 2 | 1 |
| `payments/_blocks/` | 9 | 13 | 3 | 8 |
| `billing/_blocks/` | 13 | 33 | 1 | 6 |
| **Total** | **55\*** | **113** | **12** | **22** |

\* `CsdManagerPage.tsx` tiene 2 `<button>` pero su `<input type="file">` no es detectado por el regex (fuera de alcance del guardarraíl); se cuenta igual dentro de los 56 archivos de scope.

**Primitivas ya existentes y estables** (no se modifican en este change):
- `Button`/`IconButton` — `app/_components/atoms/{Button,IconButton}/`. `variant`, `size`, `loading`, `icon`/`iconPosition`, `href`; `IconButton` con `icon`+`ariaLabel` obligatorios, `iconSize` opcional.
- `Select` — `app/_components/atoms/Select/Select.tsx`. `forwardRef`, extiende `SelectHTMLAttributes`, prop `error?: string` (solo estiliza `border-error`/`aria-invalid`, no renderiza texto).
- `DataTable` — `app/_components/molecules/DataTable/DataTable.tsx`. Exporta `Table`/`THead`/`TBody`/`Tr`(`hoverable?`)/`Th`(`align?`)/`Td`(`align?`) como funciones independientes, no un componente monolítico. No existe `TFoot` (decisión ya tomada en el change precedente de reportes: un solo consumidor no justifica expandir la API — se usa `<tfoot>` nativo envolviendo `Tr`/`Td`).

**Patrón de migración ya validado dos veces** (`2026-10-10-shrink-design-debt-allowlist-catalogs`, `2026-10-10-migrate-report-tables-datatable`): migración mecánica 1:1, sin crear abstracciones nuevas, shrink de allowlist atómico por archivo, verificación visual manual con Playwright antes de cerrar.

## Goals / Non-Goals

**Goals:**
- Migrar los 113 `<button>`, 10 `<table>` (12 menos las 2 exclusiones) y 22 `<select>` crudos de los 56 archivos del flujo de Ventas a las primitivas existentes, preservando exactamente el comportamiento, los datos renderizados y los estados de accesibilidad (ARIA) actuales (Historia #1, #2, #3 de `proposal.md`).
- Resolver los 8 casos de riesgo identificados sin regresión: control segmentado de `CartLine`, navegación por teclado de `ProductCatalogTable`, tarjetas seleccionables de `PriceTierPicker`, genericidad+render-props de `GroupedPaymentsTable`, columna condicional de `PaymentsHistoryPage`, inputs dinámicos de `RegisterPaymentModal`, filas expandibles de `SalePaymentsSection`, tabla+fila-hija acoplada de `PartialInvoiceForm`/`PartialInvoiceLineRow`, y manejo de errores tipados de `StampSaleForm`.
- Shrink atómico de `RAW_ELEMENT_ALLOWLIST` (Historia #4): remover cada ruta solo tras confirmar 0 matches en ese archivo específico.

**Non-Goals:**
- No se tocan los archivos de Compras/Logística/Inventario (Parte 2) ni de Administración (Parte 3) — changes separados, fuera de alcance.
- No se modifican las primitivas `Button`/`IconButton`/`Select`/`DataTable` — ya tienen toda la superficie de API necesaria (confirmado en el inventario de primitivas arriba); si algún caso exigiera una prop nueva, es una decisión a elevar antes de aplicar, no a resolver ad-hoc durante la migración.
- No se crean abstracciones nuevas (ej. un `SalesLineRow` genérico compartido) aunque existan patrones repetidos entre `PartialInvoiceLineRow`/`WaybillLineRow` (ese último es de la Parte 2) — eso sería refactor estructural, no migración de deuda declarada.
- No se migra `sales/_blocks/PrintableTicket.tsx` ni el `<table>` de `pos/_blocks/PosShortcutsOverlay.tsx` (ver Decisión 5).
- No se toca lógica de negocio: cálculo de totales (`SaleTotalsCalculator`/`QuoteTotalsCalculator`/`computeTotalsClient`), validación fiscal/CFDI, impresión térmica, RBAC/branch scoping, ni los `fetch`/services de `_logic/`.

## Decisions

1. **Mapeo de `variant` de `Button` por intención semántica, no por clase CSS copiada.** Alternativa descartada: copiar literalmente las clases Tailwind de cada botón crudo dentro de un `className` override sobre `Button` — se descarta porque perpetúa la inconsistencia que el change busca eliminar (cada botón seguiría divergiendo visualmente) y no es más rápido de escribir. Regla: primario (Guardar/Crear/Confirmar) → `filled`; secundario (Cancelar/Cerrar) → `text` u `outlined` según si hoy tiene borde visible; destructivo (Cancelar venta/pago, Eliminar) → `destructive`; paginación → `text`/`tonal` (página activa); icon-only → `IconButton`, nunca `<Icon>` manual dentro de `Button`.

2. **Controles no-estándar (`CartLine` toggle %/$, disclosures tipo toggle) se migran a `Button` preservando sus atributos ARIA vía props nativas (`aria-pressed`, `role="group"` en el contenedor), sin crear una primitiva "ToggleButton"/"SegmentedControl" nueva.** Alternativa descartada: crear un nuevo átomo `SegmentedButton` genérico — ya existe `SegmentedButton` en `app/_components/molecules/` (usado en POS para el selector Venta/Cotización), pero su contrato (`options[]` + `value` único) no calza con el patrón de `CartLine` (dos botones independientes con estado booleano cada uno, no una selección mutuamente excluyente de N opciones). Forzar el molecule existente ahí sería un cambio de comportamiento, no una migración de presentación. Se mantiene como `Button` individual con `aria-pressed` + estilos condicionales por `variant` (`tonal` si activo, `outlined` si no).

3. **`GroupedPaymentsTable` conserva su firma genérica `<T extends GroupablePayment>` y el patrón render-prop (`headerRow`, `renderPaymentRow`); solo el markup interno (`<table>`→`Table`, `<tr>`→`Tr`, etc.) cambia.** Alternativa descartada: aplanar el componente a un `DataTable` no genérico específico de pagos — se descarta porque `GroupedPaymentsTable` se reutiliza en múltiples pantallas de pagos (`PaymentsListPage`, `PaymentsHistoryPage`) precisamente por su genericidad; perderla rompería esa reutilización y obligaría a duplicar lógica de agrupación/expansión en cada consumidor.

4. **Columnas condicionales por permiso (`PaymentsHistoryPage` con `isBypass`) y filas expandibles (`SalePaymentsSection` con `Fragment`+`colSpan`+toggle) se resuelven con composición JSX normal dentro de `THead`/`TBody`, no con una prop especial de `DataTable`.** El molecule ya soporta esto de forma nativa porque `Th`/`Td`/`Tr` aceptan cualquier prop HTML (`colSpan`, `onClick`, etc.) vía spread — no hace falta extender su API. Alternativa descartada: agregar una prop `columns`/`renderExpandedRow` a `DataTable` para "oficializar" el patrón — rechazada por ser expansión de API no solicitada por el proposal (non-goal).

5. **Exclusión de `PrintableTicket.tsx` y del `<table>` de `PosShortcutsOverlay.tsx`.** `PrintableTicket.tsx` usa `<table><tbody>` como formato físico de impresión térmica (estilos inline, `colSpan` para alinear columnas del ticket) — no es una tabla de datos de negocio navegable, es un layout de impresión que debe permanecer pixel-exacto. `PosShortcutsOverlay.tsx` usa `<table>` para una lista estática de atajos de teclado (`<kbd>`) sin datos dinámicos de negocio. Ambos quedan en `RAW_ELEMENT_ALLOWLIST` con comentario inline explicando el motivo, exactamente como el precedente dejó el `<button>` de "imprimir anticipo" en `LedgerTable` fuera de alcance de su migración de tablas.

6. **Orden de ejecución: compartidos primero, billing al final.** `CustomerPicker`, `CustomerQuickAddModal` y `PriceTierPicker` se migran primero porque `billing/_blocks/PartialInvoiceForm.tsx` los consume — migrar `billing` antes dejaría esa página orquestando una mezcla de componentes ya migrados y pendientes, dificultando la verificación visual intermedia. El orden completo vive en `tasks.md`.

7. **El `<p>` de mensaje de error externo de cada `<select>` migrado se mantiene, no se elimina.** `Select` solo aplica estilo (`border-error`/`aria-invalid`) vía la prop `error`, no tiene slot de texto — eliminar el `<p>` dejaría el error invisible al usuario. Esto resuelve explícitamente la ambigüedad que el patrón precedente dejó abierta (su ejemplo concreto mantuvo el `<p>` pero el texto de su `design.md` sugería removerlo; aquí se fija la regla: **siempre se mantiene**).

## Risks / Trade-offs

- **[Riesgo] Romper la navegación por teclado de `ProductCatalogTable`** (`useTableKeyboard`, `getRowProps`, refs de foco por fila) al envolver filas en `Tr`. → **Mitigación**: `Tr` es `forwardRef` y acepta cualquier prop HTML vía spread, por lo que `{...getRowProps(idx)}` se aplica igual sobre `Tr` que sobre `<tr>` nativo; verificación manual específica de teclado (Tab/flechas/Enter) en Playwright antes de cerrar esta parte.
- **[Riesgo] Romper el manejo de errores fiscales tipados de `StampSaleForm`** (4 variantes de botón "×" dentro de bloques `instanceof SaleAlreadyInvoicedError`/`ReceiverFiscalDataIncompleteError`/`FacturamaStampError`/genérico) al migrar los botones. → **Mitigación**: migrar solo el elemento de presentación (`<button>`→`IconButton` o `Button` variant `text`) sin tocar la cadena `instanceof` ni el texto/condición de cada bloque; revisar cada uno individualmente, no con un find-replace masivo.
- **[Riesgo] Confundir el input-file de `CsdManagerPage.tsx` con un elemento a migrar.** → **Mitigación**: el regex del guardarraíl no detecta `<input type="file">`, así que no requiere cambio — se documenta explícitamente en `tasks.md` para que no se le "agregue" trabajo fuera de scope por error.
- **[Riesgo] Doble-contar o perder alguna de las 2 exclusiones al hacer el shrink final de la allowlist**, dejando `PrintableTicket.tsx`/`PosShortcutsOverlay.tsx` removidos por error (rompería el test del guardarraíl) o, al revés, dejando rutas ya migradas sin remover (el test de "allowlist no crece" no lo detecta porque no exige que encoja, solo que no crezca — el fallo real sería el primer test de 0-offenders). → **Mitigación**: shrink atómico archivo por archivo con verificación de 0 matches inmediatamente antes de cada remoción, nunca un reemplazo masivo de la lista completa.
- **[Trade-off] No hay snapshot tests ni e2e automatizado en el repo** (confirmado en los 2 `design.md` precedentes) — la única red de seguridad real es: tests RTL existentes en verde + `tsc --noEmit` + verificación visual manual con Playwright. Se acepta este nivel de verificación porque es el mismo usado en ambos changes precedentes y no ha producido regresiones reportadas.

## Migration Plan

1. Aplicar en el orden fijado en `tasks.md` (compartidos → pos → quotes → returns → sales → payments → billing), un archivo o un grupo pequeño acoplado (ej. `PartialInvoiceForm`+`PartialInvoiceLineRow`) a la vez.
2. Por archivo: migrar, correr el regex del guardarraíl localmente (debe dar 0 matches, salvo las 2 exclusiones), remover esa ruta puntual de `RAW_ELEMENT_ALLOWLIST`.
3. Al completar cada submódulo: correr `npm test` filtrado a esa área + `tsc --noEmit`.
4. Al completar las 56: `npm test` completo, `tsc --noEmit` global, verificación visual manual con Playwright (nunca Claude-in-Chrome) sobre POS/Cotizaciones/Ventas/Devoluciones/Pagos/Facturación en datos de dev, con foco en los 8 casos de riesgo listados en Goals.
5. Actualizar `designer.md` § Pendientes (107 → 51 archivos restantes, quitar menciones de archivos ya migrados, agregar comentario de las 2 exclusiones si no están ya anotadas).
6. **Rollback**: no hay estado persistente ni migración de datos — revertir es un `git revert` del commit o de los commits de esta parte; cada archivo es independiente entre sí (excepto el par `PartialInvoiceForm`/`PartialInvoiceLineRow`, que se revierte junto).
