## Historia de Usuario

| # | Rol | Tarea | Motivo | Criterios de Aceptación | Criterios de Seguridad |
|---|---|---|---|---|---|
| 1 | Ingeniero de software | Como ingeniero, quiero migrar los `<button>` crudos de los archivos `_blocks/` de catalogs (modales de edición, paginación, acciones de tabs) al atom `Button` para cumplir el requirement "Button como única fuente de botones" de `design-system` | Botones crudos no heredan estados hover/focus-visible/disabled ni variantes M3; cada instancia diverge visualmente sin que el guardarraíl lo detecte porque está en la allowlist | - Cada `<button>` migrado usa `variant`/`size`/`icon` según el estilo visual previo (filled/tonal/outlined/text/destructive según acción)<br>- Botones de creación de recurso usan `CreateButton`, no `Button` directo (requirement ya existente)<br>- Tests RTL de cada bloque migrado siguen en verde sin cambiar assertions de texto/rol accesible<br>- `tsc --noEmit` limpio | - Sin impacto de permisos — los `onClick`/`disabled`/gating RBAC existentes se preservan intactos, sólo cambia el elemento contenedor |
| 2 | Ingeniero de software | Como ingeniero, quiero migrar los `<table>` crudos de los archivos `*Table.tsx`/`*Modal.tsx` de catalogs al dialecto `DataTable` (`Table`/`THead`/`TBody`/`Tr`/`Th`/`Td`) para cumplir el requirement "DataTable como único dialecto de tabla" | `<table>` crudo reimplementa manualmente hover de fila, bordes y tipografía de celda; divergencia silenciosa y constantes de clase `th`/`td` duplicadas por archivo, explícitamente prohibidas por el spec | - Cada `<table>`/`<thead>`/`<tbody>`/`<tr>`/`<th>`/`<td>` crudo reemplazado 1:1 por su contraparte `DataTable`<br>- Ninguna constante local de clases `th`/`td` sobrevive la migración (ya prohibidas por spec)<br>- Columnas numéricas conservan alineación derecha vía prop `align="right"` de `Th`/`Td`, no clases manuales<br>- Tests RTL existentes de cada tabla migrada siguen en verde | - Sin impacto de permisos — row actions (editar/eliminar/activar) y su gating RBAC no cambian, sólo el wrapper de presentación |
| 3 | Ingeniero de software | Como ingeniero, quiero migrar los `<select>` crudos de los archivos `_blocks/` de catalogs restantes al atom `Select` para cumplir el requirement "Campos de formulario tokenizados" | `<select>` crudo no hereda el ícono `expand_more`, estado de error (`aria-invalid`) ni estilos de foco/disabled del atom — inconsistente con `FormField`/`Input` que ya usan primitivas | - Cada `<select>` migrado preserva `value`/`onChange`/`disabled`/opciones exactas<br>- Donde ya existe mensaje de error de validación, se pasa vía prop `error` del atom en vez de clase condicional manual<br>- Tests RTL de formularios migrados siguen en verde | - Sin impacto de permisos — validación Zod cliente/servidor no cambia, sólo el control de presentación |
| 4 | Ingeniero de software | Como ingeniero, quiero remover las entradas de catalogs de `RAW_ELEMENT_ALLOWLIST` en `tests/unit/ui/design-system/tokens.test.ts` una vez migrados sus archivos, para que el guardarraíl deje de tolerar esa deuda | La allowlist SHALL poder encoger pero no crecer (requirement "Guardarraíl automatizado de tokens") — si no se remueven las entradas tras migrar, el guardarraíl sigue sin detectar regresiones futuras en esos mismos archivos | - Las rutas de catalogs ya no aparecen en `RAW_ELEMENT_ALLOWLIST`<br>- `tests/unit/ui/design-system/tokens.test.ts` pasa sin esas entradas (cero `<button>`/`<table>`/`<select>` crudos restantes en los archivos migrados)<br>- El test "la allowlist no contiene archivos que ya no existen" sigue pasando | - N/A — cambio de configuración de test, sin superficie de seguridad |

Nota: dividido por tipo de elemento (button/table/select) en vez de por archivo — cada tipo tiene un mapeo de componente distinto y es testeable de forma independiente. La historia 4 (shrink del guardarraíl) depende de que 1–3 terminen; no se puede paralelizar con ellas.

## Why

`tests/unit/ui/design-system/tokens.test.ts` ya prohíbe `<button>`/`<table>`/`<select>` crudos **nuevos** en `app/(private)/**/_blocks/`, pero tolera una `RAW_ELEMENT_ALLOWLIST` de ~140 archivos que predatan la adopción de las primitivas del design system (`Button`, `DataTable`, `Select`). El spec `design-system` (`openspec/specs/design-system/spec.md`) ya declara explícitamente que esa allowlist "SHALL poder encoger pero NO crecer" — es deuda reconocida, no un requisito nuevo. El módulo `catalogs` concentra 27 de esas entradas (branches, customers, departments, folios, payment-methods, products, providers, tax-rates + shells genéricos como `CatalogEmpty`/`CatalogError`/`CatalogPagination`) y sirve de piloto representativo: incluye los tres tipos de elemento crudo (button/table/select), modales de edición y tablas de listado — el patrón de migración que resulte aquí es reusable para el resto de módulos pendientes (billing, pos, purchases, quotes, reports, returns, sales, users, waybills, inventory, roles).

Migrar ahora evita que la allowlist se congele como "la forma en que siempre se hizo": cada archivo nuevo que copia un patrón crudo existente expande la deuda en vez de seguir el guardarraíl, y un rediseño futuro de botones/tablas tendría que tocar los 27 archivos a mano en vez de heredarlo gratis de los atoms/molecules.

## What Changes

- Migrar `<button>` crudo → `Button` (atom) en los 14 archivos de catalogs que lo usan, preservando variant/size/icon equivalentes al estilo visual actual
- Migrar `<table>`/`<thead>`/`<tbody>`/`<tr>`/`<th>`/`<td>` crudos → `Table`/`THead`/`TBody`/`Tr`/`Th`/`Td` (`DataTable` molecule) en los 13 archivos `*Table.tsx`/`*Modal.tsx` de catalogs que lo usan
- Migrar `<select>` crudo → `Select` (atom) en los archivos de catalogs que lo usan (`ProductGeneralTab`, `TaxRateSelect` y los que combinan button+select en modales de edición)
- Remover las 27 rutas de `app/(private)/catalogs/**` de `RAW_ELEMENT_ALLOWLIST` en `tests/unit/ui/design-system/tokens.test.ts` una vez verificado que cada archivo queda libre de elementos crudos
- Sin cambios de comportamiento observable, sin nuevos endpoints, sin cambios de contrato — refactor puro de presentación que satisface requirements ya existentes en `design-system`

## Capabilities

### New Capabilities

_(ninguna)_

### Modified Capabilities

_(ninguna — los requirements "Button como única fuente de botones", "DataTable como único dialecto de tabla" y "Campos de formulario tokenizados" de `design-system` ya exigen esto; este change ejecuta la migración pendiente, no cambia el requirement)_

> **`skip_specs: true`** aplica: refactor puro de implementación que satisface requirements ya declarados en `openspec/specs/design-system/spec.md`. No modifica comportamiento observable, contratos de API, ni reglas de negocio.

## Impact

- **Frontend**: 27 archivos bajo `app/(private)/catalogs/**/_blocks/` (branches, customers, departments, folios, payment-methods, products, providers, tax-rates + shells genéricos); `app/_components/atoms/IconButton/IconButton.tsx` — prop opcional `iconSize` agregada (backward-compatible) para preservar los tamaños de ícono exactos (20px en cerrar de modal, 18px en acciones de fila, 14px en tablas internas de `ProductPricesTab`/`ProductDosificationsTab`) al migrar `<button>` icon-only al atom
- **Tests**: `tests/unit/ui/design-system/tokens.test.ts` (shrink de `RAW_ELEMENT_ALLOWLIST`), tests RTL existentes de cada bloque migrado (deben seguir pasando sin modificación de assertions)
- **Sin impacto**: endpoints de API, schema Prisma, lógica de negocio, permisos RBAC, resto de módulos con entradas en la allowlist (billing, pos, purchases, quotes, reports, returns, sales, users, waybills, inventory, roles quedan fuera de este piloto)
