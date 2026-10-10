## Context

`RAW_ELEMENT_ALLOWLIST` en `tests/unit/ui/design-system/tokens.test.ts` lista 27 archivos bajo `app/(private)/catalogs/**/_blocks/` con `<button>`, `<table>` o `<select>` crudos. Las primitivas objetivo ya existen y son estables:

- `Button` (`app/_components/atoms/Button/Button.tsx`) — props `variant` (`filled|tonal|outlined|text|destructive|tertiary`), `size`, `loading`, `icon`, `iconPosition`, `href`. Renderiza `<button>` o `<Link>` según `href`.
- `Table`/`THead`/`TBody`/`Tr`/`Th`/`Td` (`app/_components/molecules/DataTable/DataTable.tsx`) — wrappers delgados sobre los elementos nativos homónimos; mismo DOM, clases Tailwind M3 ya aplicadas. `Th`/`Td` aceptan `align="left"|"right"`.
- `Select` (`app/_components/atoms/Select/Select.tsx`) — wrapper sobre `<select>` nativo con ícono `expand_more`, prop `error`, mismos `SelectHTMLAttributes`.

Conteo real de elementos crudos por archivo (verificado con match multilínea, no por línea — JSX suele partir `<button\n  className=...` en varias líneas):

| Archivo | button | table | select |
|---|---|---|---|
| `_blocks/CatalogEmpty.tsx` | 2 | — | — |
| `_blocks/CatalogError.tsx` | 1 | — | — |
| `_blocks/CatalogPagination.tsx` | 3 | — | 1 (vía `select` en algún control, ver nota) |
| `branches/_blocks/BranchEditModal.tsx` | 3 | — | — |
| `branches/_blocks/BranchesTable.tsx` | 1 | 1 | — |
| `customers/_blocks/CustomerEditModal.tsx` | 3 | — | — |
| `customers/_blocks/CustomersTable.tsx` | 1 | 1 | — |
| `departments/_blocks/DepartmentEditModal.tsx` | 1 | — | 1 |
| `departments/_blocks/DepartmentsTable.tsx` | 1 | 1 | — |
| `folios/_blocks/FolioAuditModal.tsx` | 1 | 1 | 1 |
| `folios/_blocks/FolioEditModal.tsx` | 1 | — | 1 |
| `folios/_blocks/FoliosTable.tsx` | 1 | 1 | — |
| `payment-methods/_blocks/PaymentMethodEditModal.tsx` | 3 | — | — |
| `payment-methods/_blocks/PaymentMethodsTable.tsx` | 1 | 1 | — |
| `products/_blocks/ProductDetailPage.tsx` | 1 | — | — |
| `products/_blocks/ProductDosificationsTab.tsx` | 1 | 1 | 1 (varios) |
| `products/_blocks/ProductEditModal.tsx` | 1 | — | 1 |
| `products/_blocks/ProductGeneralTab.tsx` | 1 | — | 1 |
| `products/_blocks/ProductPricesTab.tsx` | 1 | 1 | 1 (varios) |
| `products/_blocks/ProductsPage.tsx` | 1 | — | 1 |
| `products/_blocks/ProductsTable.tsx` | 1 | 1 | — |
| `products/_blocks/SatCodeCombobox.tsx` | 1 | — | — |
| `products/_blocks/TaxRateSelect.tsx` | — | — | 1 |
| `providers/_blocks/ProviderEditModal.tsx` | 3 | — | — |
| `providers/_blocks/ProvidersTable.tsx` | 1 | 1 | — |
| `tax-rates/_blocks/TaxRateEditModal.tsx` | 1 | — | 1 |
| `tax-rates/_blocks/TaxRatesTable.tsx` | 1 | 1 | — |

Ningún archivo listado importa hoy `Button`/`Select`/`Table*` — la migración es greenfield dentro de cada archivo (no hay mezcla previa de primitiva + crudo que resolver).

## Goals / Non-Goals

**Goals:**
- Cero `<button>`/`<table>`/`<select>` crudos en los 27 archivos tras la migración (historias 1–3 de proposal.md)
- Allowlist de `tokens.test.ts` sin las 27 rutas de catalogs (historia 4)
- Cero cambio de comportamiento observable: mismo texto, mismo `onClick`/`onChange`, mismo gating RBAC, misma estructura de columnas/filas

**Non-Goals:**
- No se tocan los demás módulos de la allowlist (billing, pos, purchases, quotes, reports, returns, sales, users, waybills, inventory, roles) — quedan para changes futuros que repitan este patrón
- No se introduce ninguna primitiva nueva — `Button`/`Table*`/`Select` ya existen y no cambian su API
- No se corrige deuda de accesibilidad adicional más allá de la que los atoms ya resuelven (p. ej. no se auditan todos los `aria-label` existentes salvo que el wrapper los requiera)

## Decisions

**Migración archivo por archivo, no por componente compartido nuevo.** Cada `_blocks/` ya es específico de su módulo (`BranchEditModal`, `ProductEditModal`, etc.) y no comparten lógica entre sí más allá de las primitivas. Crear un wrapper intermedio por catálogo sería abstracción prematura — el CLAUDE.md del proyecto ya desaconseja eso. Alternativa descartada: extraer un `CatalogModalFooter` genérico para los botones Cancelar/Guardar repetidos en los 7 `*EditModal.tsx` — se descarta en este change porque mezclaría refactor estructural con migración de deuda declarada; si se quiere, es un change aparte.

**Mapeo de `variant` de `Button` por intención semántica, no por clase Tailwind previa.** Se infiere variant del rol del botón en el flujo, no se copian las clases crudas tal cual (eso perpetuaría inconsistencias, no las resolvería):
- Acción primaria de formulario (Guardar/Crear) → `variant="filled"`
- Acción secundaria (Cancelar/Cerrar modal) → `variant="text"` u `"outlined"` según si hoy tiene borde visible
- Acción destructiva (Eliminar/Desactivar) → `variant="destructive"`
- Paginación (anterior/siguiente/número de página) → `variant="text"` o `"tonal"` si representa la página activa
- Iconos sueltos (toggle, expandir) → usar prop `icon` del atom en vez de `<Icon>` manual dentro de un `<button>` crudo

**`Table*` es sustitución literal 1:1, no reinterpretación.** `Table`/`THead`/`TBody`/`Tr`/`Th`/`Td` son wrappers delgados que emiten el mismo elemento HTML con clases ya aplicadas — la migración es mecánica: reemplazar el tag y mover `className` custom (si alguno sobrevive) al wrapper vía su prop `className` (se hace merge con `cn()` internamente). Alineación numérica (montos, cantidades) pasa de clase manual `text-right tabular-nums` a prop `align="right"` de `Th`/`Td`.

**`Select` sustitución 1:1 salvo mensaje de error.** Donde el `<select>` crudo ya muestra un error de validación con clase condicional manual, se mueve ese string a la prop `error` del atom (el atom ya aplica `border-error`/`aria-invalid` — eliminar la duplicación de lógica de estilo de error es parte del objetivo del requirement "Campos de formulario tokenizados").

**Orden de migración: shells genéricos primero, luego por catálogo.** `CatalogEmpty`/`CatalogError`/`CatalogPagination` se usan transversalmente en varios catálogos — migrarlos primero reduce el riesgo de que un catálogo posterior dependa de un comportamiento no migrado. Luego se migra catálogo por catálogo (branches → customers → departments → folios → payment-methods → products → providers → tax-rates), shrinkeando la allowlist al final de cada catálogo verificado en vez de esperar al final de los 27 archivos — así un fallo de test aísla rápido a qué catálogo pertenece.

## Risks / Trade-offs

- **[Riesgo] Cambio visual sutil por mapeo de `variant` mal inferido** (p. ej. un botón que hoy se ve "filled" migrado a "outlined") → Mitigación: comparar visualmente cada modal/tabla migrada en `npm run dev` antes de remover su entrada de la allowlist; no confiar sólo en que los tests pasen (RTL no verifica apariencia).
- **[Riesgo] `Table`/`Th`/`Td` no cubren un patrón existente** (p. ej. `colSpan`, celdas con contenido complejo tipo badge+texto) → Mitigación: los wrappers extienden `HTMLAttributes`/`TdHTMLAttributes` nativos vía spread de `...props`, así que `colSpan`, `rowSpan`, etc. siguen funcionando sin cambios.
- **[Riesgo] Allowlist shrink parcial deja el guardarraíl rojo si un archivo migra incompleto** (sobrevive un `<button>` crudo mezclado con los ya migrados) → Mitigación: remover la entrada de la allowlist sólo después de confirmar `0` matches del regex `<(?:button|table|select)[\s/>]/g` en ese archivo específico (ver comando de verificación en tasks.md), no por catálogo completo de una vez.
- **[Trade-off] No se extrae el footer repetido Cancelar/Guardar de los 7 `*EditModal.tsx`** — deuda de duplicación menor que persiste, aceptada explícitamente para no mezclar scope (ver Decisions).
