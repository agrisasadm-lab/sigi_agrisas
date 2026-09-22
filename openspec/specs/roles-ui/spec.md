# Spec: roles-ui

## Purpose

Define la página de administración de roles y permisos del panel privado de Agrisas (`/roles`): vista master-detail para explorar el catálogo de roles, asignar y revocar permisos de forma batch, y gestionar el acceso según la capacidad RBAC del usuario autenticado.

---

## Requirements

### Requirement: Roles administration page
The system SHALL expose a private page at `/roles` under the `(private)` route group that presents the role catalogue and the permissions assigned to each role. The page MUST be a master-detail view: the master pane lists all roles fetched from `GET /api/v1/admin/roles`, the detail pane shows the selected role's name and description under the label "Configurando: [name]", plus a grouped toggle editor for all permissions in the catalogue (from `GET /api/v1/admin/permissions`), grouped by resource (the segment before `:`). A permission toggle is ON when the permission is assigned to the selected role (`GET /api/v1/admin/roles/:id/permissions`).

A page header shows the title "Roles y Permisos" and — when the user has `roles:write` — a "Crear Nuevo Rol" button.

#### Scenario: User with permission opens the roles page
- **WHEN** a user whose effective permissions include `roles:read` navigates to `/roles`
- **THEN** the page SHALL render the list of roles in the master pane, automatically select the first role, and render its permission toggles in the detail pane

#### Scenario: User without permission opens the roles page
- **WHEN** a user without the `roles:read` permission navigates to `/roles`
- **THEN** the page SHALL render an `EmptyState` with title "Sin acceso" and a description inviting them to contact an administrator — without redirecting

#### Scenario: Selecting a different role
- **WHEN** the user clicks a role in the master pane
- **THEN** the detail pane SHALL update to that role's permissions without a full-page reload; the previously selected role row loses its active styling and the new row gains it

#### Scenario: Roles list is empty
- **WHEN** the `GET /api/v1/admin/roles` response is `{ "roles": [] }`
- **THEN** the master pane SHALL render an `EmptyState` with title "Sin roles" and the detail pane SHALL be empty (or hidden)

---

### Requirement: Grant and revoke permissions via staged batch save
The page SHALL allow users with the `roles:write` permission to grant and revoke permissions on the selected role using toggle switches. Changes are staged locally — toggling a switch does NOT immediately trigger a network request. When the user clicks "Guardar Cambios", all pending changes (grants and revokes) are applied in parallel via `POST /api/v1/admin/roles/:id/permissions` and `DELETE /api/v1/admin/roles/:id/permissions/:permId`. "Descartar" resets all staged changes to the last saved state.

The "Guardar Cambios" and "Descartar" buttons SHALL be disabled when there are no pending changes (`isDirty = false`). While saving, the "Guardar Cambios" button SHALL show a spinner and be disabled.

#### Scenario: Toggling a permission enables Guardar Cambios
- **WHEN** the user clicks a toggle switch whose current state differs from the saved state
- **THEN** the toggle SHALL visually update immediately, and the "Guardar Cambios" and "Descartar" buttons SHALL become enabled

#### Scenario: Successful batch save
- **WHEN** the user clicks "Guardar Cambios" with pending changes
- **THEN** all grant and revoke requests SHALL be sent in parallel, and on success the saved state SHALL update to reflect the new assignments

#### Scenario: Descartar reverts pending changes
- **WHEN** the user clicks "Descartar" with pending changes
- **THEN** all toggles SHALL revert to the last saved state and the "Guardar Cambios" button SHALL become disabled again

#### Scenario: Save fails with a server error
- **WHEN** any network request during save returns a non-2xx response
- **THEN** the UI SHALL display the error message inline and the staged state SHALL remain as-is so the user can retry or discard

#### Scenario: Last permission revoked from a role
- **WHEN** the user turns off all toggles for a role and saves
- **THEN** the role SHALL have no assigned permissions; all toggles SHALL be in the OFF state after the save completes

---

### Requirement: Permissions grouped by resource with human-readable labels
Permissions in the toggle editor SHALL be grouped by their resource segment (the part before `:`). Each group SHALL have a human-readable section header in Spanish (e.g., "Usuarios" for `users`, "Roles y Permisos" for `roles`). The Spanish header mapping SHALL cover every resource present in the seeded permission catalogue (`users`, `roles`, `payment_methods`, `folios`, `departments`, `branches`, `providers`, `vehicles`, `drivers`, `products`, `inventory`, `customers`, `sales`, `quotes`, `returns`, `payments`, `purchases`, `reports`, `tax_rates`, `billing`, `waybills`, `settings`) — not a partial subset. A resource not present in the mapping SHALL fall back to a capitalized version of the resource segment rather than fail to render. Each permission item SHALL display its `description` field as the label; if `description` is null the key SHALL be used as fallback. No technical keys (`resource:action`) SHALL be visible to the user in the main display.

#### Scenario: Known resource shows Spanish group header
- **WHEN** the catalogue contains permissions with resource `users`
- **THEN** those permissions SHALL be listed under the section header "Usuarios"

#### Scenario: Previously unmapped resource shows Spanish group header
- **WHEN** the catalogue contains permissions with resource `vehicles`, `tax_rates`, `waybills`, `payments`, `purchases`, `quotes`, `returns`, `billing`, `folios`, or `payment_methods`
- **THEN** those permissions SHALL be listed under a Spanish section header (e.g., "Vehículos", "Tasas de Impuesto", "Traspasos", "Abonos") instead of a raw capitalized fallback

#### Scenario: Permission shows description, not key
- **WHEN** a permission has `description: "Leer usuarios"` and `key: "users:read"`
- **THEN** the toggle item SHALL display "Leer usuarios" — NOT "users:read"

#### Scenario: Unmapped future resource falls back gracefully
- **WHEN** the catalogue contains permissions with a resource segment not present in the Spanish mapping
- **THEN** the group SHALL render with a capitalized version of the resource segment as its header, without failing to render


### Requirement: Loading and error states
While any of the lists (roles, role permissions, permissions catalogue) are loading, the corresponding pane SHALL render a `Skeleton`-based placeholder. If the roles list fetch fails, the master pane SHALL render an inline error message with a "Reintentar" button that re-invokes the fetch.

#### Scenario: Initial roles load
- **WHEN** the page mounts and `GET /api/v1/admin/roles` has not yet resolved
- **THEN** the master pane SHALL render skeleton rows

#### Scenario: Failed roles fetch
- **WHEN** the network request fails (offline, 500)
- **THEN** the master pane SHALL render "No se pudo cargar la lista de roles" with a "Reintentar" button that calls `refresh()` on the hook

### Requirement: Role names are displayed in Spanish or humanized form
Role names (`role.name`) SHALL never be displayed to the user as a raw technical slug. The three seeded roles (`admin`, `operator`, `viewer`) SHALL display as their fixed Spanish translations ("Administrador", "Operador", "Visor") everywhere a role name is rendered, including the roles master pane, the role detail header, and the role-assignment control in the user edit modal. Any other role name (a custom role created via "Nuevo Rol") SHALL be humanized by replacing underscores with spaces and capitalizing each resulting word. This transformation applies only to presentation — the raw slug SHALL still be the value sent to the backend in any create-role or assign-role request.

#### Scenario: Seeded role shows Spanish name
- **WHEN** a role with `name: "admin"`, `"operator"`, or `"viewer"` is rendered in the roles list, the role detail header, or the user edit modal's role picker
- **THEN** it SHALL display as "Administrador", "Operador", or "Visor" respectively

#### Scenario: Custom multi-word role name is humanized
- **WHEN** a role with `name: "supervisor_almacen"` is rendered in any of those same three locations
- **THEN** it SHALL display as "Supervisor Almacen"

#### Scenario: Custom single-word role name is humanized without error
- **WHEN** a role with `name: "contador"` (no underscore) is rendered
- **THEN** it SHALL display as "Contador" without throwing or rendering an empty label

#### Scenario: Backend payload keeps the raw slug
- **WHEN** a user creates a role or assigns a role to a user through the UI
- **THEN** the `name`/`roleName` value sent to `POST /api/v1/admin/roles` or `POST /api/v1/admin/users/:id/roles` SHALL be the original lowercase slug, not the humanized display label
