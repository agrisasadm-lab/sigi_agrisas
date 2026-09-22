## MODIFIED Requirements

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

## ADDED Requirements

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
