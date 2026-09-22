## Historia de Usuario

| # | Rol | Tarea | Motivo | Criterios de Aceptación | Criterios de Seguridad |
|---|---|---|---|---|---|
| 1 | Administrador del panel (`roles:read`/`roles:write`) | Como administrador del panel, quiero que el editor de permisos de `/roles` agrupe TODOS los recursos con encabezado en español para poder ubicar y auditar rápido los permisos de cualquier módulo | Hoy 16 de ~23 recursos caen en un fallback capitalizado crudo (ej. "Tax_rates", "Payment_methods"), obligando a interpretar slugs técnicos en inglés al asignar permisos | - Given el catálogo de permisos trae recursos `vehicles`, `drivers`, `tax_rates`, `waybills`, `payments`, `purchases`, `quotes`, `returns`, `billing`, `folios`, `payment_methods` (los actualmente sin mapear), when se renderiza `RolePermissionsEditor`, then cada grupo muestra su header en español (ej. "Vehículos", "Tasas de Impuesto", "Traspasos", "Abonos") en vez del fallback capitalizado<br>- Given un recurso futuro no contemplado en el diccionario, when se renderiza su grupo, then se aplica el fallback existente (capitalizar primera letra) sin romper el render<br>- El texto de cada permiso individual sigue mostrando `perm.description` (ya en español, sin cambios) | - No se expone ninguna key técnica nueva; el cambio es puramente de presentación (frontend), no toca `PermissionKey` ni el backend<br>- El gate de acceso a la página (`roles:read`) y al editor (`roles:write`) no cambia |
| 2 | Administrador del panel (`roles:read`) gestionando roles, y administrador (`users:write`) asignando roles a otros usuarios | Como administrador, quiero ver los nombres de rol traducidos ("Administrador", "Operador", "Visor") o humanizados (roles custom tipo `supervisor_almacen` → "Supervisor Almacen") en vez del slug técnico crudo, para identificar roles sin tener que decodificar snake_case en inglés/mixto | El campo `role.name` es un slug obligatorio (`^[a-z][a-z0-9_]{1,31}$`, forzado también al crear roles custom) que hoy se muestra crudo con sólo CSS `capitalize` (o sin nada, en `UserEditModal`), dejando guiones bajos literales visibles | - Given los 3 roles sembrados `admin`/`operator`/`viewer`, when aparecen en `RolesList`, `RoleDetailHeader` o el selector de roles de `UserEditModal`, then se muestran como "Administrador"/"Operador"/"Visor"<br>- Given un rol custom `supervisor_almacen` (creado vía `RoleCreateModal`), when aparece en esos mismos 3 puntos, then se muestra como "Supervisor Almacen" (guion bajo → espacio, cada palabra capitalizada)<br>- Given un rol con nombre de una sola palabra (ej. `contador`), when se muestra, then aparece "Contador" (sin error por falta de guion bajo)<br>- El campo `name` que se envía al backend en creación de rol (`POST /admin/roles`) sigue siendo el slug crudo sin normalizar a Título — la traducción es sólo de presentación, no de dato persistido | - No se envía el nombre humanizado al backend por error (la humanización ocurre sólo en la capa de presentación, nunca en el payload de `createRole`/`assignRoleToUser`)<br>- El gate de acceso (`roles:read` para `/roles`, `users:write` para editar roles de un usuario) no cambia |

Nota: el hallazgo de `RolePermissionsList.tsx` (componente muerto, cero imports, muestra keys crudas) no genera historia propia — no tiene comportamiento visible para ningún usuario real hoy. Se resuelve como limpieza dentro de la implementación de la historia 2, eliminando el archivo para no perpetuar el antipatrón si alguien lo reconecta a futuro.

## Why

La sección `/roles` ya está implementada end-to-end (backend RBAC maduro, UI master-detail, spec `roles-ui` archivada) pero su traducción a español quedó incompleta desde que se agregaron permisos de módulos posteriores (POS, cotizaciones, devoluciones, abonos, compras, facturación, traspasos, tasas de impuesto, vehículos, operadores). El diccionario `PERMISSION_GROUP_LABELS` se congeló con los 7 primeros recursos y nunca se extendió; y el nombre de rol (`role.name`) nunca tuvo tratamiento de traducción — se apoyó únicamente en CSS `capitalize`, que no humaniza guiones bajos. El resultado es una UI que mezcla español (descripciones de permisos, textos fijos) con fragmentos técnicos en inglés/snake_case crudo, lo cual además incumple el Requirement "Permissions grouped by resource with human-readable labels" ya definido en `openspec/specs/roles-ui/spec.md`.

## What Changes

- Crear diccionario compartido `app/_lib/rbacLabels.ts`: `RESOURCE_LABELS` con los ~23 recursos reales del seed (`prisma/seed.ts`) + `getPermissionGroupLabel()` (mismo contrato que hoy, fallback capitalizado preservado), y `getRoleNameLabel()` con mapeo fijo para `admin`/`operator`/`viewer` y humanización genérica (snake_case → Palabras Capitalizadas) para roles custom.
- Eliminar `app/(private)/roles/_logic/labels.ts`, reemplazado por el diccionario compartido; actualizar su único consumidor (`RolePermissionsEditor.tsx`).
- Eliminar `app/(private)/roles/_blocks/RolePermissionsList.tsx` (componente muerto, cero imports, mostraba keys técnicas crudas violando la spec vigente).
- Aplicar `getRoleNameLabel()` en los 3 puntos que hoy muestran `role.name` crudo: `RolesList.tsx`, `RoleDetailHeader.tsx` (quitando el CSS `capitalize` ya innecesario) y `UserEditModal.tsx` (selector de roles asignables a un usuario).
- **BREAKING**: ninguno — es un cambio de presentación puro, no toca contratos HTTP, DTOs ni el valor persistido de `role.name`.

## Capabilities

### New Capabilities
(ninguna)

### Modified Capabilities
- `roles-ui`: se agrega un Requirement de traducción de nombres de rol (hoy no cubierto por la spec) y se precisa el Requirement existente "Permissions grouped by resource with human-readable labels" para exigir cobertura completa del catálogo de recursos, no sólo un subconjunto.

## Impact

- **Código afectado**: `app/_lib/rbacLabels.ts` (nuevo), `app/(private)/roles/_logic/labels.ts` (eliminado), `app/(private)/roles/_blocks/RolePermissionsList.tsx` (eliminado), `app/(private)/roles/_blocks/RolePermissionsEditor.tsx`, `app/(private)/roles/_blocks/RolesList.tsx`, `app/(private)/roles/_blocks/RoleDetailHeader.tsx`, `app/(private)/users/_blocks/UserEditModal.tsx`.
- **APIs**: ninguna — no se toca `src/modules/rbac/` ni los endpoints `/api/v1/admin/roles*`/`/api/v1/admin/permissions`.
- **Dependencias**: ninguna nueva (no se instala librería i18n).
- **Fuera de alcance**: `UpdateRoleUseCase`/`DeleteRoleUseCase` y endpoints PATCH/DELETE de rol (no existen hoy, no se agregan en este cambio).
