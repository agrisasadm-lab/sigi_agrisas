## 1. Componente compartido — generalizar ImageUploadField

- [x] 1.1 Grep de todos los usos de `ImageUploadField` en el repo para confirmar el alcance del rename (2 consumidores: `catalogs/products/_blocks/ProductGeneralTab.tsx` y `settings/_blocks/TicketSettingsForm.tsx`, más su test unitario)
- [x] 1.2 Renombrar prop `productId` → `entityId` en `app/_components/molecules/ImageUploadField/ImageUploadField.tsx` (además se agregó `confirmDeleteDescription?` opcional, con el texto anterior como default, para que consumidores nuevos —expenses— no hereden el copy "imagen del producto")
- [x] 1.3 Actualizar los dos consumidores (`ProductGeneralTab.tsx`, `TicketSettingsForm.tsx`) y el test unitario al nuevo nombre de prop
- [x] 1.4 `npm run build` para confirmar que no quedan referencias rotas al prop viejo

## 2. `_logic/` del módulo expenses

- [x] 2.1 `types/api.ts` (`ExpenseApiDto`, `ListExpensesResponse`, `CreateExpenseBody`, `UpdateExpenseBody`, `ExpenseHistoryRowDto`, `ExpensesReportDto`) y `types/domain.ts` (`Expense`, `ExpenseFilters`)
- [x] 2.2 `schemas/expense.schema.ts` — Zod create/update (concepto requerido, `amount > 0`, fecha requerida)
- [x] 2.3 `errors.ts` — errores tipados (`ExpenseNotFoundError`, `ExpenseInvalidAmountError`, `ExpensePhotoInvalidFormatError`, `ExpensePhotoTooLargeError`, `ReportTooLargeError`)
- [x] 2.4 `services/{listExpenses,getExpense,createExpense,updateExpense,softDeleteExpense,uploadExpensePhoto,deleteExpensePhoto}.ts` — wrappers sobre `authFetch`, aceptan `fetchImpl?`
- [x] 2.5 `services/getExpensesReport.ts` — soporta `format=json|pdf|xlsx` (json + downloadPdf + downloadXlsx)
- [x] 2.6 `hooks/useExpenses.ts` — fetch listado + paginación + filtros
- [x] 2.7 `hooks/useExpenseMutations.ts` — create (con encadenado de subida de foto si aplica, sin rollback si la foto falla)/update/softDelete
- [x] 2.8 `hooks/useExpensesReport.ts` — expone `report, isLoading, error, isExporting, exportPdf, exportXlsx`

## 3. Listado `/expenses`

- [x] 3.1-3.2 `app/(private)/expenses/page.tsx` — Server Component con `metadata` inline (sin `layout.tsx` separado: se siguió la convención real de rutas top-level operativas como `purchases/page.tsx`, no la de catálogos anidados)
- [x] 3.3 `_blocks/ExpensesPage.tsx` — orquesta estado (page/pageSize/filtros/modal), gating `can("expenses:read"/"expenses:write")`
- [x] 3.4 `_blocks/ExpensesToolbar.tsx` — filtros fecha (`input type="date"` x2), concepto (búsqueda server-side debounced 300ms), selector de sucursal (`Select` atom) condicionado a `branches:access_all`
- [x] 3.5 `_blocks/ExpensesTable.tsx` — columnas concepto/fecha/sucursal/registrado por/monto/estado/acciones
- [x] 3.6 Validación cliente de rango de fechas (desde ≤ hasta) antes de disparar el fetch

## 4. Modal create/edit

- [x] 4.1 `_blocks/ExpenseEditModal.tsx` — modo `create`/`edit`, campos concepto/cantidad/notas/fecha + selector de sucursal (sólo create+bypass) + foto
- [x] 4.2 Lógica de submit en create: `createExpense(json)` → si hay archivo, `uploadExpensePhoto(id, file)`; manejo de error parcial (gasto creado, foto falla) con aviso sin revertir
- [x] 4.3 Lógica de submit en edit: diff-only PATCH; foto gestionada por `ImageUploadField` (upload/delete inmediato, ya con `entityId` existente)
- [x] 4.4 Precarga de valores + miniatura de foto existente en modo edición
- [x] 4.5 Errores de mutación (incluye 403 de branch scoping) mostrados inline vía `mutationError`

## 5. Soft delete

- [x] 5.1 Acción "Desactivar" en `ExpensesTable` (`Button` icon-only), visible sólo con `can("expenses:write")`, confirmada con `ConfirmDialog`
- [x] 5.2 Filtro "Mostrar inactivos" en `ExpensesToolbar`, badge `CatalogStatusBadge` en la tabla. Sin acción "reactivar": el backend (`add-expenses-api`) no expone esa transición, consistente con el spec aprobado

## 6. Reporte `/expenses/report`

- [x] 6.1 `app/(private)/expenses/report/page.tsx`
- [x] 6.2 `_blocks/ExpensesReportPage.tsx` — `PageShell` sin prop `toolbar` (filtro en `children`)
- [x] 6.3 `_blocks/ExpensesReportToolbar.tsx` — filtros fecha/concepto/sucursal (`Select`, condicionada a bypass)/incluir inactivos
- [x] 6.4 `DownloadPdfButton` + `Button` "Exportar Excel", tabla (`Table`/`THead`/`TBody`/`Tr`/`Th`/`Td`) con totales al pie
- [x] 6.5 Manejo del error `tooLarge` (`ReportTooLargeError`) mostrado como toast

## 7. Navegación

- [x] 7.1 Item `{ key: "expenses", href: "/expenses", icon: "trending_down", label: "Gastos", requires: "expenses:read" }` agregado a `NavigationRail/items.ts` (icono `paid` no existe en el set fijo de `Icon/icons.ts`; se usó `trending_down`, libre y semánticamente correcto para egresos)

## 8. Tests y verificación

- [x] 8.1 Tests unitarios de schemas/hooks en `tests/unit/ui/(private)/expenses/_logic/` (RTL + jsdom): `schemas/expense.schema.test.ts`, `hooks/useExpenses.test.ts`, `hooks/useExpenseMutations.test.ts` (incluye caso de foto fallida sin rollback)
- [x] 8.2 `tests/unit/ui/design-system/tokens.test.ts` — **requirió refactor real**: los `_blocks/` nuevos usaban `<button>/<table>/<select>` crudos (patrón copiado de código existente, pero ese código está en una allowlist de deuda ya declarada que sólo puede encoger, no crecer). Se migraron `ExpensesToolbar`, `ExpenseEditModal`, `ExpensesTable`, `ExpensesReportPage` y `ExpensesReportToolbar` a los átomos/moléculas reales (`Button`, `Select`, `Table`/`THead`/`TBody`/`Tr`/`Th`/`Td`). Test en verde sin tocar la allowlist.
- [x] 8.3 `npm test` completo: unit 100% verde (528 suites / 3896 tests, backend+ui). Los 75 fallos de `tests/integration/` son preexistentes (`productPrice.branch_id` null constraint en módulo `products`/`pos`, no tocado por este change) — ver nota en `add-expenses-api/tasks.md`
- [x] 8.4 `npm run build` sin errores de tipos
- [x] 8.5 QA manual con Playwright — hecho para todo el flujo excepto fotografía (bloqueada: bucket `expense-photos` no existe, ver `add-expenses-api/tasks.md` § 1.4). Verificado con `admin@example.com`/`admin1234` en dev server local:
  - Login → nav item "Gastos" visible y funcional.
  - Crear gasto (con selector de sucursal, admin bypass) → `POST 201`, aparece en tabla.
  - Editar gasto (diff-only) → `PATCH`, toast "Gasto actualizado.", tabla refleja el cambio.
  - Desactivar (soft delete) → `ConfirmDialog` → toast "Gasto desactivado.", desaparece del listado activo, aparece con badge "Inactivo" al activar "Mostrar inactivos", sin acciones (sin reactivar, como diseñado).
  - Reporte `/expenses/report`: filtro "Incluir inactivos" refleja el registro + fila y totales correctos; `Descargar PDF` y `Exportar Excel` generan archivos válidos (`file` confirma PDF 1.3/1 página y XLSX Excel 2007+, tamaños no-cero).
  - **Bug real encontrado y corregido durante la QA**: `Tr` en `app/_components/molecules/DataTable/DataTable.tsx` no reenviaba `ref` (warning de React "Function components cannot be given refs"), rompiendo silenciosamente la navegación por teclado (`useTableKeyboard`) en `ExpensesTable`. Se envolvió `Tr` en `forwardRef` — fix retrocompatible, sin otros consumidores de `Tr` pasando `ref` hoy. Verificado sin warnings tras el fix; `npm run build` y suite unitaria siguen en verde.
  - No probado en esta sesión: gating con usuario sin `expenses:write` (viewer), 403 de branch scoping (requiere un segundo usuario no-bypass), subida/reemplazo/eliminación de fotografía (bloqueado por el bucket).

## 9. Correcciones de `/opsx:verify`

- [x] 9.1 `specs/expenses-ui/spec.md` — corregida la redacción del escenario "Filtro de fecha inválido bloqueado en cliente": decía "no envía la petición al backend", pero `ExpensesPage.tsx` sigue llamando a `useExpenses` (y por tanto al backend) cuando `dateRangeError` está activo, sólo omite los parámetros `from`/`to` inválidos. Texto corregido para describir el comportamiento real; no se tocó código (comportamiento ya es seguro: filtros inválidos simplemente se ignoran, no se envían al backend).
- [x] 9.2 **Bug real encontrado al escribir el test de componente**: en `ExpenseEditModal.tsx`, el cálculo de `isDirty` en modo `create` contaba el `branchId` autollenado (sucursal propia del operador, cuando no tiene `branches:access_all`) como "cambio del usuario", dejando el botón "Guardar" habilitado desde el primer render sin que el usuario tocara nada. Corregido: `branchId` sólo cuenta para `isDirty` cuando `isBypass` es `true` (el único caso en que el usuario lo edita explícitamente vía el selector).
- [x] 9.3 `tests/unit/ui/(private)/expenses/_blocks/ExpenseEditModal.test.tsx` — 16 tests nuevos cubriendo título/modo create-edit, selector de sucursal condicionado a bypass, validación cliente (concepto vacío, cantidad ≤0) bloqueando `onSave`, precarga de campos en edición, `isDirty`/diff-only, y `mutationError` inline. Sigue el patrón de `DepartmentEditModal.test.tsx`.
- [x] 9.4 `npm test` completo tras los fixes: 100% verde (530 suites / 3946 tests, backend+ui). `npm run build` sin errores de tipos.
