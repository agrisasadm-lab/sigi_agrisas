## Context

`/roles` (spec `roles-ui`) ya está implementada; el gap es puramente de presentación de texto. Hoy existen dos diccionarios/fallbacks distintos y desalineados:

- `app/(private)/roles/_logic/labels.ts` → `PERMISSION_GROUP_LABELS` (7 de ~23 recursos), consumido sólo por `RolePermissionsEditor.tsx` (historia 1 de `proposal.md`).
- Ningún diccionario para `role.name` → se apoya en CSS `capitalize`, consumido por `RolesList.tsx`, `RoleDetailHeader.tsx` y, sin ni eso, `UserEditModal.tsx` en el módulo `users` (historia 2).

`role.name` es un slug (`RoleName` regex `^[a-z][a-z0-9_]{1,31}$`, forzado también en `RoleCreateModal.tsx` al crear roles custom), no texto libre — por eso necesita una función de humanización genérica además del mapeo fijo de los 3 roles sembrados.

Como el diccionario de nombres de rol se consume desde dos módulos distintos (`roles/` y `users/`), no puede vivir en `_logic/` de ninguno de los dos (regla de capas: `_logic/` es acoplado a un solo feature) — corresponde a `app/_lib/`, la carpeta ya designada en CLAUDE.md para "Utilidades puras... reutilizable en ≥2 módulos".

## Goals / Non-Goals

**Goals:**
- Un único diccionario `app/_lib/rbacLabels.ts` que resuelve ambos criterios de seguridad/presentación de la tabla de historias: labels de recurso completos (historia 1) y labels de rol traducidos/humanizados (historia 2).
- Eliminar la duplicación de lógica de traducción hoy dispersa (`labels.ts` local + CSS `capitalize` repetido en 3 archivos).
- Eliminar `RolePermissionsList.tsx` (componente muerto que perpetúa el antipatrón de mostrar keys crudas).

**Non-Goals:**
- No se introduce ninguna librería de i18n (`next-intl` u otra) — el panel es mono-idioma y el patrón de diccionario local ya es el establecido en el repo (`*StatusBadge.tsx`, etc.).
- No se normaliza ni transforma `role.name` en el payload enviado al backend (`POST /admin/roles`, `POST /users/:id/roles`) — la humanización es sólo de presentación; el criterio de seguridad de la historia 2 lo exige explícitamente.
- No se agrega CRUD de edición/eliminación de rol (`UpdateRoleUseCase`/`DeleteRoleUseCase`) — confirmado fuera de alcance con el usuario.
- No se cambian los guards de permisos (`roles:read`, `roles:write`, `users:write`) en ningún componente — sólo cambia qué texto se renderiza una vez que el guard ya permitió el acceso.

## Decisions

**1. Ubicación: `app/_lib/rbacLabels.ts` (no `_logic/` de ningún módulo).**
Alternativa considerada: mantener `labels.ts` dentro de `roles/_logic/` y que `users/` importe cruzado desde ahí. Rechazada — viola la convención de capas del proyecto (`_logic/` es acoplado a un único feature, ver CLAUDE.md "Arquitectura Frontend"); un import cruzado entre módulos de `_logic/` sería la primera instancia de ese patrón en el repo y generaría acoplamiento oculto. `app/_lib/` ya es el lugar establecido para utilidades puras reutilizables entre módulos.

**2. `getPermissionGroupLabel()` conserva su firma y contrato de fallback actuales.**
Sólo se expande la tabla `RESOURCE_LABELS` de 7 a ~23 entradas (todos los recursos reales en `prisma/seed.ts`). El fallback (`resource.charAt(0).toUpperCase() + resource.slice(1)`) se mantiene como red de seguridad ante un recurso futuro no mapeado — no se introduce lógica nueva de fallback para no romper el criterio de aceptación "recurso futuro no mapeado no rompe el render".

**3. `getRoleNameLabel()`: mapeo fijo + humanización genérica, no traducción por IA/heurística compleja.**
Alternativa considerada: intentar "traducir" cualquier slug con alguna heurística de diccionario de palabras sueltas (ej. mapear `supervisor`→ ya está en español, `almacen`→ ya está en español). Rechazada por sobre-ingeniería — los roles sembrados (`admin`/`operator`/`viewer`) son los únicos con nombre técnico en inglés; los roles custom los crea un administrador humano y típicamente ya los nombra en español dentro de las reglas del slug (ver placeholder `supervisor_almacen` en `RoleCreateModal.tsx`). La humanización se limita a reemplazar `_` por espacio y capitalizar cada palabra — suficiente para cumplir el criterio de aceptación sin inventar traducción semántica.

**4. Eliminar `RolePermissionsList.tsx` en vez de corregirlo.**
Alternativa: arreglarlo para que también use el nuevo diccionario y `perm.description`. Rechazada — el componente no tiene ningún import real (verificado en exploración previa), por lo que "arreglarlo" no cambia el comportamiento de ningún usuario y sólo mantiene código muerto. Corresponde eliminarlo (regla general del proyecto: código sin uso confirmado se borra, no se parchea).

## Risks / Trade-offs

- **[Riesgo] Un recurso nuevo agregado a `prisma/seed.ts` en el futuro no se agrega a `RESOURCE_LABELS` de inmediato** → Mitigación: el fallback capitalizado ya existente sigue activo, degradando a un label legible aunque no traducido (mismo comportamiento de hoy para recursos no mapeados, no es una regresión).
- **[Riesgo] Un rol custom con nombre de una sola palabra muy larga o siglas (ej. `rh`) se humaniza de forma poco natural** → Mitigación: cubierto explícitamente en el criterio de aceptación de la historia 2 ("rol de una sola palabra... sin error"); el caso de siglas cortas es aceptable dado que el administrador elige el nombre y puede usar guion bajo para separar palabras si lo desea (ej. `rh_regional` → "Rh Regional").
- **Sin trade-offs de migración de datos** — el cambio no toca BD ni contratos HTTP, es deploy-safe sin pasos de rollback especiales (revertir el commit/PR es suficiente).

## Migration Plan

No aplica migración de datos ni de API. Deploy estándar: merge a `develop`, verificación visual manual (Playwright) en `/roles` y `/users`, sin pasos adicionales de rollout.
