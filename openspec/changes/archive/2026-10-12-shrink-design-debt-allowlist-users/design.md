## Context

Ver `proposal.md` § Why para la motivación. Este documento cubre el *cómo*.

**Inventario cuantificado** (6 archivos de `users/_blocks`, conteo de elementos crudos por archivo vía regex `/<(?:button|table|select)[\s/>]/` — verificado con `grep -o "<button"`/`"<table"`/`"<select"` sobre cada archivo):

| Archivo | `<button>` | `<table>` | `<select>` |
|---|---|---|---|
| `UserEditModal.tsx` | 5 | 0 | 1 |
| `UsersTable.tsx` | 2 | 1 | 0 |
| `UsersToolbar.tsx` | 2 | 0 | 0 |
| `UsersPagination.tsx` | 2 | 0 | 1 |
| `UsersEmpty.tsx` | 1 | 0 | 0 |
| `UsersError.tsx` | 1 | 0 | 0 |
| **Total** | **13** | **1** | **2** |

**Primitivas ya existentes y estables** (no se modifican en este change — mismo inventario confirmado en los tres changes precedentes):
- `Button`/`IconButton` — `app/_components/atoms/{Button,IconButton}/`. `variant`, `loading`, `icon`, acepta `className` (merge vía `tailwind-merge` extendido en `cn.ts`).
- `Select` — `app/_components/atoms/Select/Select.tsx`. `forwardRef`, extiende `SelectHTMLAttributes`, prop `error?: string`.
- `DataTable` — `app/_components/molecules/DataTable/DataTable.tsx`. Exporta `Table`/`THead`/`TBody`/`Tr`(`hoverable?`)/`Th`(`align?`)/`Td`(`align?`); acepta cualquier prop HTML vía spread.
- `ConfirmDialog` — ya en uso en `UserEditModal.tsx` para el reenvío de correo de contraseña; no se toca, sólo cambia el trigger.

**Casos particulares relevados en este bloque**:
- `UserEditModal.tsx`: dos botones con `loading` manual ya implementado — resend password ("Enviando...") y submit ("Creando..."/"Guardando...") — ambos con ícono `progress_activity animate-spin`. El botón "Resetear a Gravatar" es un link-style (`text-primary underline`), no un CTA. El `<select>` de sucursal tiene opción `"Sin sucursal"` con `value=""` → `branchId: null`.
- `UsersTable.tsx`: 2 `IconButton` de acción (editar/eliminar) con `disabled={isSelf}` + `title` condicional — guard de negocio "no puedes editar/eliminar tu propia cuenta" (regla ya documentada en `CLAUDE.md` § Users). `useTableKeyboard`/`getRowProps` aplican sobre cada `<tr>`.
- `UsersToolbar.tsx`: chips de filtro de rol (`"Todos"` + `availableRoles.map(...)`) con estado activo/inactivo vía clase condicional (`bg-primary` vs `bg-surface-container`) — no hay primitiva "Chip interactivo" en el sistema (el único `Chip` existente en `app/_components/atoms/Chip/` es un `<span>` no interactivo de sólo lectura); se resuelve con `Button` + `className` override, mismo mecanismo que `SatInvoiceUploader` en el change de Compras/Logística.
- `UsersPagination.tsx` y `UsersError.tsx`/`UsersEmpty.tsx` (rama `filtered`) son prácticamente idénticos en estructura a `CatalogPagination.tsx`/`CatalogError.tsx`/`CatalogEmpty.tsx` ya migrados — mismo patrón de referencia exacto, sin casos nuevos.

**Patrón de migración ya validado tres veces** (`shrink-design-debt-allowlist-catalogs`, `-sales-flow`, `-purchases-logistics`): migración mecánica 1:1, sin crear abstracciones nuevas, shrink de allowlist atómico por archivo, verificación visual manual con Playwright antes de cerrar.

## Goals / Non-Goals

**Goals:**
- Migrar los 13 `<button>`, 1 `<table>` y 2 `<select>` crudos de los 6 archivos de `users/_blocks` a las primitivas existentes, preservando exactamente comportamiento, datos renderizados y estados de accesibilidad actuales (Historia #1, #2, #3 de `proposal.md`).
- Resolver sin regresión el caso particular de los chips de filtro de rol en `UsersToolbar` (Decisión 1) y los dos estados `loading` manuales de `UserEditModal` (Decisión 2).
- Shrink atómico de `RAW_ELEMENT_ALLOWLIST` (Historia #4): remover cada ruta sólo tras confirmar 0 matches en ese archivo específico.

**Non-Goals:**
- No se tocan los archivos de `dashboard`, `reports`, `roles`, `settings` — changes separados, fuera de alcance.
- No se modifican las primitivas `Button`/`IconButton`/`Select`/`DataTable`/`ConfirmDialog` ni se crea un nuevo átomo "Chip interactivo" para los filtros de rol — se resuelve con `className` override puntual sobre `Button` (ver Decisión 1).
- No se restructura `UsersEmpty`/`UsersError` para envolverlos en `EmptyState` donde hoy no lo usan (p.ej. `UsersError` usa `<div>`/`<p>` plano) — eso sería refactor estructural adicional fuera del mandato de esta migración (sólo swap de `<button>` → `Button` preservando el layout exacto).
- No se toca lógica de negocio: guard de auto-edición/auto-eliminación (`isSelf`), validación Zod (`createUserSchema`/`updateUserSchema`), diff de roles/sucursal, reenvío de correo de contraseña, RBAC (`users:read`/`users:write`), ni los `fetch`/services de `_logic/`.

## Decisions

1. **Los chips de filtro de rol en `UsersToolbar` migran a `Button` con `className` override para el layout pill (`rounded-full px-3 py-1`), sin crear un átomo "Chip interactivo" nuevo.** El `Chip` existente (`app/_components/atoms/Chip/Chip.tsx`) es un `<span>` de sólo lectura sin `onClick`/estado interactivo — expandirlo introduciría superficie de API no solicitada para un único consumidor. Alternativa descartada: crear `ToggleChip` — rechazada por el mismo criterio que rechazó una primitiva "Dropzone" para `SatInvoiceUploader` en el change de Compras/Logística (Decisión 2 de ese design.md): sigue siendo un `<button>` semánticamente simple, `Button` ya soporta el override de layout vía `cn()` extendido.

2. **Los dos estados `loading` manuales de `UserEditModal` (resend password, submit) migran a la prop nativa `loading` de `Button`, preservando el texto visible exacto** ("Enviando...", "Creando...", "Guardando...") **en lugar del ícono `progress_activity animate-spin` hardcodeado.** `Button` ya soporta `loading` (mismo patrón usado en `sales-flow`/`purchases-logistics` para `RebuildArticleButton`/botones de confirmación con estado async). Si la implementación de `loading` en `Button` no permite customizar el texto junto al spinner, se preserva el `<>...</>` manual con `Icon name="progress_activity" className="animate-spin"` dentro de `children` de `Button` en vez de forzar la prop — decisión a verificar contra el componente real durante `apply`, sin bloquear el diseño.

3. **`UsersTable` migra sus 2 `IconButton` de acción preservando `disabled={isSelf}` y `title` condicional exactamente como están.** Es el guard de negocio documentado en `CLAUDE.md` § Users ("admin no puede editar/eliminar su propia cuenta") — no se toca la condición, sólo el componente que la renderiza. **Corrección aplicada durante verificación visual (2026-10-12)**: el original (`<button title=...>` sin `aria-label`) exponía el `title` como nombre accesible, por lo que cambiaba dinámicamente al bloquear auto-edición ("No puedes editar tu propia cuenta"). `IconButton` requiere `ariaLabel` explícito, que inicialmente se dejó fijo ("Editar usuario"/"Eliminar usuario") — se corrigió para que `ariaLabel` siga la misma condición que `title` (`isSelf ? "No puedes editar/eliminar tu propia cuenta" : "Editar/Eliminar usuario"`), igualando el comportamiento de accesibilidad original.

4. **`UsersPagination`/`UsersEmpty`/`UsersError` migran siguiendo línea por línea el patrón ya aplicado en `CatalogPagination`/`CatalogEmpty`/`CatalogError`** (estructura casi idéntica, confirmado por lectura de ambos pares de archivos) — sin alternativas evaluadas, es la migración más mecánica de las tres.

5. **El `<select>` de sucursal en `UserEditModal` preserva la opción `"Sin sucursal"` (`value=""`) y el mapeo `branchId: e.target.value === "" ? null : e.target.value` sin cambios.** Regla ya fijada en los tres changes precedentes para selects con opción "ninguno"/"todas".

6. **Orden de ejecución: componentes compartidos/hoja antes que el contenedor que los usa** — `UsersTable`, `UsersToolbar`, `UsersPagination`, `UsersEmpty`, `UsersError` (todos independientes entre sí, sin acoplamiento cruzado dentro del módulo) antes de `UserEditModal` (el más grande, con 5 botones + 1 select + `ConfirmDialog`). El orden completo vive en `tasks.md`.

## Risks / Trade-offs

- **[Riesgo] Perder el guard `disabled={isSelf}` o su `title` condicional al migrar `UsersTable` a `IconButton`.** → **Mitigación**: verificar manualmente (Playwright, usuario de prueba `admin@example.com`) que el usuario autenticado no puede editar/eliminar su propia fila antes de cerrar el archivo.
- **[Riesgo] Romper el estilo activo/inactivo de los chips de rol en `UsersToolbar` al envolverlos en `Button`.** → **Mitigación**: verificación visual manual comparando el estado "Todos" seleccionado vs. un rol específico seleccionado, antes/después de la migración.
- **[Riesgo] Perder el texto exacto de los estados `loading` de `UserEditModal` (p.ej. que `Button` renderice un spinner genérico sin el texto "Enviando...").** → **Mitigación**: inspeccionar la implementación real de `Button.loading` antes de migrar ese archivo (Decisión 2); si no soporta texto custom junto al spinner, preservar el `children` manual.
- **[Trade-off] No hay snapshot tests ni e2e automatizado en el repo** (mismo trade-off aceptado en los tres changes precedentes) — la red de seguridad es: tests RTL existentes en verde + `tsc --noEmit` + verificación visual manual con Playwright.

## Migration Plan

1. Aplicar en el orden fijado en `tasks.md` (hoja → contenedor, ver Decisión 6).
2. Por archivo: migrar, correr el regex del guardarraíl localmente (debe dar 0 matches), remover esa ruta puntual de `RAW_ELEMENT_ALLOWLIST`.
3. Al completar los 6 archivos: `npm test` completo, `tsc --noEmit` global, verificación visual manual con Playwright (nunca Claude-in-Chrome) sobre `/users` (listado, crear, editar, reenvío de contraseña, eliminar propio bloqueado) en datos de dev con el usuario de prueba `admin@example.com`.
4. Actualizar `designer.md` § Pendientes quitando la mención de `users` del bloque de Administración pendiente.
5. **Rollback**: no hay estado persistente ni migración de datos — revertir es un `git revert` del commit de esta parte; los 6 archivos son independientes entre sí salvo que `UserEditModal` sea el último en migrar (no depende de ningún otro de los 5).
