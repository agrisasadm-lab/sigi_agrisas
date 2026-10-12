## 1. UsersTable.tsx

- [x] 1.1 Migrar `<table>`/`<thead>`/`<tbody>`/`<tr>`/`<th>`/`<td>` a `Table`/`THead`/`TBody`/`Tr`/`Th`/`Td`, preservando `useTableKeyboard`/`getRowProps` sobre `Tr` y la columna condicional "Acciones" (`canWrite`).
- [x] 1.2 Migrar los 2 `<button>` de acción (editar/eliminar) a `IconButton`, preservando `disabled={isSelf}` y `title` condicional.
- [x] 1.3 Verificar regex del guardarraíl en 0 matches; remover `app/(private)/users/_blocks/UsersTable.tsx` de `RAW_ELEMENT_ALLOWLIST`.

## 2. UsersToolbar.tsx

- [x] 2.1 Migrar el chip "Todos" y los chips de `availableRoles.map(...)` a `Button` con `className` override preservando el layout pill y el estilo activo/inactivo (Decisión 1 de `design.md`).
- [x] 2.2 Verificar regex del guardarraíl en 0 matches; remover `app/(private)/users/_blocks/UsersToolbar.tsx` de `RAW_ELEMENT_ALLOWLIST`.

## 3. UsersPagination.tsx

- [x] 3.1 Migrar el `<select>` de tamaño de página a `Select`, preservando `PAGE_SIZE_OPTIONS` y el cast `Number(e.target.value)`.
- [x] 3.2 Migrar los 2 `<button>` de navegación (anterior/siguiente) a `IconButton`, preservando `aria-label` y `disabled` en los extremos (mismo patrón que `CatalogPagination`).
- [x] 3.3 Verificar regex del guardarraíl en 0 matches; remover `app/(private)/users/_blocks/UsersPagination.tsx` de `RAW_ELEMENT_ALLOWLIST`.

## 4. UsersEmpty.tsx

- [x] 4.1 Migrar el `<button>` "Limpiar filtros" (rama `filtered`) a `Button` variant `text` preservando `underline underline-offset-2`.
- [x] 4.2 Verificar regex del guardarraíl en 0 matches; remover `app/(private)/users/_blocks/UsersEmpty.tsx` de `RAW_ELEMENT_ALLOWLIST`.

## 5. UsersError.tsx

- [x] 5.1 Migrar el `<button>` "Reintentar" a `Button` variant `text` preservando `underline underline-offset-2` y el layout `<div>`/`<p>` existente (sin envolver en `EmptyState`, ver Non-Goals de `design.md`).
- [x] 5.2 Verificar regex del guardarraíl en 0 matches; remover `app/(private)/users/_blocks/UsersError.tsx` de `RAW_ELEMENT_ALLOWLIST`.

## 6. UserEditModal.tsx

- [x] 6.1 Migrar el botón cerrar (ícono `close`) a `IconButton`.
- [x] 6.2 Migrar "Resetear a Gravatar" a `Button` variant `text` preservando el estilo link (`text-primary underline underline-offset-2`).
- [x] 6.3 Migrar el botón de reenvío de correo de contraseña a `Button`, preservando el estado `loading`/texto "Enviando..." (Decisión 2 de `design.md`) y el `ConfirmDialog` que dispara, intacto.
- [x] 6.4 Migrar "Cancelar" a `Button` variant `text`/`outlined` (según borde visible actual) preservando `disabled={isBusy}`.
- [x] 6.5 Migrar el botón submit ("Crear usuario"/"Guardar Cambios") a `Button` variant `filled`, preservando `disabled={isSubmitDisabled}` y el estado `loading`/texto "Creando..."/"Guardando...".
- [x] 6.6 Migrar el `<select>` de sucursal a `Select`, preservando la opción "Sin sucursal" (`value=""` → `branchId: null`) y el mapeo de `branchOptions`.
- [x] 6.7 Verificar regex del guardarraíl en 0 matches; remover `app/(private)/users/_blocks/UserEditModal.tsx` de `RAW_ELEMENT_ALLOWLIST`.

## 7. Verificación global

- [x] 7.1 Correr `npm test` completo — todos los tests existentes en verde, incluyendo `tests/unit/ui/design-system/tokens.test.ts` con las 6 rutas de `users` ya removidas de `RAW_ELEMENT_ALLOWLIST`.
- [x] 7.2 Correr `npx tsc --noEmit` — 0 errores de tipos nuevos (24 preexistentes en baseline `develop`, ninguno en `users/_blocks`, verificado por comparación directa con `git stash` y reverificado en `opsx:verify` 2026-10-12).
- [x] 7.3 Verificación visual manual con Playwright (nunca Claude-in-Chrome) sobre `/users` con el usuario de prueba `admin@example.com`: listado ✓, filtro por rol ✓ (chip "admin" filtra correctamente, estilo pill activo/inactivo preservado), crear usuario ✓ (modal, select sucursal, checkboxes roles), editar usuario ✓ (roles/sucursal/avatar, "Resetear a Gravatar"), reenvío de correo de contraseña ✓ (abre `ConfirmDialog` intacto, cancelado sin enviar), intento de editar/eliminar la propia cuenta ✓ (sigue bloqueado — fila `admin@example.com` con botones `disabled`), paginación ✓, estado vacío filtrado ✓ ("Limpiar filtros" restaura listado). Estado de error no simulado (requiere backend caído; cobertura por paridad mecánica con `CatalogError` ya migrado + lectura de código). Corrección aplicada durante verificación: `ariaLabel` de los IconButton editar/eliminar en `UsersTable` ahora refleja el `title` dinámico (antes fijo), igualando el comportamiento original de accesibilidad cuando `isSelf=true`.
- [x] 7.4 Actualizar `designer.md` § Pendientes removiendo la mención de `users` del bloque de Administración pendiente.
