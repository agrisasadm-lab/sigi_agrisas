## 1. Diccionario compartido

- [x] 1.1 Crear `app/_lib/rbacLabels.ts` con `RESOURCE_LABELS` (los ~23 recursos reales de `prisma/seed.ts`) y `getPermissionGroupLabel()` (mismo contrato/fallback que el actual `getPermissionGroupLabel` de `roles/_logic/labels.ts`).
- [x] 1.2 Agregar en el mismo archivo `getRoleNameLabel()`: mapeo fijo `admin`→"Administrador", `operator`→"Operador", `viewer`→"Visor"; fallback que reemplaza `_` por espacio y capitaliza cada palabra para cualquier otro nombre de rol.

## 2. Migrar consumidor existente y limpiar duplicados

- [x] 2.1 Actualizar `app/(private)/roles/_blocks/RolePermissionsEditor.tsx` para importar `getPermissionGroupLabel` desde `app/_lib/rbacLabels` en vez de `../_logic/labels`.
- [x] 2.2 Eliminar `app/(private)/roles/_logic/labels.ts`.
- [x] 2.3 Eliminar `app/(private)/roles/_blocks/RolePermissionsList.tsx` (componente sin imports reales, mostraba keys técnicas crudas).

## 3. Aplicar traducción de nombres de rol

- [x] 3.1 `app/(private)/roles/_blocks/RolesList.tsx`: reemplazar `{role.name}` por `{getRoleNameLabel(role.name)}`, quitar la clase CSS `capitalize` ya innecesaria, importar desde `app/_lib/rbacLabels`.
- [x] 3.2 `app/(private)/roles/_blocks/RoleDetailHeader.tsx`: mismo cambio (línea con `role.name` + clase `capitalize`).
- [x] 3.3 `app/(private)/users/_blocks/UserEditModal.tsx`: aplicar `getRoleNameLabel(role.name)` en el checkbox list de roles asignables (línea con `<span>{role.name}</span>`), importando desde `app/_lib/rbacLabels`.

## 4. Verificación

- [x] 4.1 `npm run build` — confirmar que no quedan imports colgantes a los archivos eliminados y que TypeScript compila limpio.
- [x] 4.2 Verificación visual con Playwright (nunca Claude-in-Chrome, regla del proyecto): login `admin@example.com`/`admin1234`, abrir `/roles`, confirmar headers de grupo en español para recursos previamente sin mapear (ej. "Vehículos", "Tasas de Impuesto", "Traspasos", "Abonos") y nombres de rol traducidos ("Administrador", "Operador", "Visor") en la lista y el detalle.
- [x] 4.3 Crear un rol custom (ej. `supervisor_almacen`) vía "Nuevo Rol" y confirmar que se muestra como "Supervisor Almacen" en la lista tras crearlo. Verificado con el rol `supervisor_almacen` ya existente en la BD de desarrollo (creado en una sesión QA previa), que se renderiza correctamente como "Supervisor Almacen" tanto en `/roles` como en el modal de `/users` — confirma el fallback de humanización sin necesidad de crear un rol nuevo.
- [x] 4.4 Ir a `/users`, abrir el modal de edición de un usuario, confirmar que el selector de roles también muestra los nombres traducidos/humanizados.
- [x] 4.5 `npm test` (suite completa) — detectado y corregido durante `/opsx:verify`: 5 suites de tests preexistentes quedaron rotas por este cambio (`tests/unit/ui/roles/_logic/labels.test.ts` y `tests/unit/ui/roles/blocks/RolePermissionsList.test.tsx` probaban archivos eliminados; `RolesList.test.tsx`, `RolesPage.test.tsx` y `UserEditModal.test.tsx` esperaban el slug crudo `"admin"`/`"viewer"` como nombre accesible en vez del label traducido). Se eliminaron los 2 tests de archivos borrados, se creó `tests/unit/ui/_lib/rbacLabels.test.ts` (cobertura de `getPermissionGroupLabel` + `getRoleNameLabel`, incluye los 23 recursos y casos de humanización), y se actualizaron las 3 suites con aserciones desactualizadas. Suite completa: 553/555 passed (2 skipped preexistentes sin relación).
