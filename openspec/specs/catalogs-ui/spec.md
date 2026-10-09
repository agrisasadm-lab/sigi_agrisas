# Spec: Catalogs UI

## Purpose

Pantallas de gestión de los ocho catálogos administrativos (`payment-methods`, `folios`, `departments`, `branches`, `providers`, `products`, `tax-rates`, `customers`) bajo la ruta privada `/catalogs`. Incluye hub de acceso, listado paginado con toggle de inactivos, modal de creación/edición con diff submit, soft delete con confirmación, reactivación directa, errores tipados por módulo, búsqueda configurable client/server, y el átomo `Switch`.

---

## Requirements

### Requirement: Catalogs hub page
The system SHALL expose a private route `/catalogs` that serves as a hub for the catalog modules. The hub SHALL render a grid of entry cards in this order: `payment-methods`, `folios`, `departments`, `branches`, `providers`, `products`, `tax-rates`, `customers`. Each card SHALL display the catalog icon, title, a short description, and an "Abrir" link to `/catalogs/<módulo>`. Cards SHALL be visually marked as disabled when the current user lacks the corresponding `<recurso>:read` permission, and SHALL render normally otherwise. The hub itself SHALL be reachable by any authenticated user. The fifth (`providers`) card SHALL be `{ icon: "local_shipping", title: "Proveedores", description: "Gestiona los proveedores y sus datos fiscales.", href: "/catalogs/providers", permission: "providers:read" }`. The sixth (`products`) card SHALL be `{ icon: "inventory_2", title: "Productos", description: "Gestiona el catálogo de productos, precios y dosificaciones.", href: "/catalogs/products", permission: "products:read" }`. The eighth (`customers`) card SHALL be `{ icon: "groups", title: "Clientes", description: "Gestiona los clientes, sus datos fiscales y crédito.", href: "/catalogs/customers", permission: "customers:read" }`.

#### Scenario: Authenticated user opens the hub
- **WHEN** an authenticated user navigates to `/catalogs`
- **THEN** the page SHALL render entry cards including Formas de pago, Folios, Departamentos, Sucursales, Proveedores, Productos, Tasas de Impuesto, and Clientes, each with their icons and short descriptions

#### Scenario: Card states for missing permission
- **WHEN** the current user does not have `payment_methods:read`
- **THEN** the "Formas de pago" card SHALL render disabled with a tooltip "Requiere permiso payment_methods:read" and its link SHALL NOT navigate

#### Scenario: Providers card disabled without providers:read
- **WHEN** the current user does not have `providers:read`
- **THEN** the "Proveedores" card SHALL render disabled with a "Sin acceso" state

#### Scenario: Products card disabled without products:read
- **WHEN** the current user does not have `products:read`
- **THEN** the "Productos" card SHALL render disabled with a "Sin acceso" state

#### Scenario: Products card navigates to the products list
- **WHEN** the user holds `products:read` and clicks the "Productos" card
- **THEN** the router SHALL navigate to `/catalogs/products`

#### Scenario: Card click navigates to submodule
- **WHEN** the user clicks an enabled catalog card
- **THEN** the router SHALL navigate to `/catalogs/<módulo>` (e.g., `/catalogs/payment-methods` or `/catalogs/providers`)

#### Scenario: Unauthenticated request to hub
- **WHEN** a user without a valid `refreshToken` cookie navigates to `/catalogs`
- **THEN** the middleware SHALL redirect to `/auth/login` before rendering

#### Scenario: Customers card visible with permission
- **WHEN** the current user has `customers:read`
- **THEN** the "Clientes" card SHALL render enabled, with icon `groups` and description "Gestiona los clientes, sus datos fiscales y crédito."

#### Scenario: Customers card disabled without customers:read
- **WHEN** the current user does not have `customers:read`
- **THEN** the "Clientes" card SHALL render disabled with a tooltip "Requiere permiso customers:read" and its link SHALL NOT navigate

#### Scenario: Customers card navigates to the customers catalog
- **WHEN** the user holds `customers:read` and clicks the "Clientes" card
- **THEN** the router SHALL navigate to `/catalogs/customers`

---

### Requirement: Catalog list screen with pagination and inactive toggle
For each catalog `<módulo>` (`payment-methods`, `folios`, `departments`, `branches`), the system SHALL expose a private route `/catalogs/<módulo>` that renders a paginated table connected to `GET /api/v1/admin/<recurso>`. The screen SHALL include:
- A toolbar with: a search input (client-side filter over the loaded page), a `Switch` labeled "Mostrar inactivos" that toggles the `?includeInactive=true` query parameter, and a "Nuevo" button gated by `<recurso>:write`.
- A table with columns: `code` (font-mono), `name`, the module-specific extra columns (see Module-specific columns below), a status badge (Activo/Inactivo), and an actions column.
- A pagination component with "Anterior"/"Siguiente" controls, an "X-Y de N" indicator and a `pageSize` selector (10/20/50; max 50 in UI even though backend allows up to 100).
- A loading skeleton while the request is in flight, an `EmptyState` when `total === 0`, and an error state with a "Reintentar" action when the request fails.

**Module-specific columns:**
| Módulo | Columnas extra |
|---|---|
| `payment-methods` | `description` (truncado a 60 chars) |
| `folios` | `prefix`, `currentNumber` |
| `departments` | `description` (truncado a 60 chars) |
| `branches` | `address` (truncado a 60 chars), `phone`, `email` |

#### Scenario: Authorized user loads the list
- **WHEN** a user with `<recurso>:read` navigates to `/catalogs/<módulo>`
- **THEN** the page SHALL request `GET /api/v1/admin/<recurso>?page=1&pageSize=20` and render the resulting rows

#### Scenario: User toggles "Mostrar inactivos"
- **WHEN** the user enables the "Mostrar inactivos" `Switch`
- **THEN** the page SHALL re-fetch with `?includeInactive=true&page=1&pageSize=<current>` and merge active + inactive rows in the table

#### Scenario: Client-side search filters the loaded page
- **WHEN** the user types into the search input
- **THEN** the rendered rows SHALL be filtered client-side by matching `code` OR `name` (case-insensitive); the count indicator SHALL reflect the visible-after-filter count

#### Scenario: Pagination navigation
- **WHEN** the user clicks "Siguiente" with current page 1 and 80 results
- **THEN** the page SHALL re-fetch with `?page=2&pageSize=20` and update the indicator to "21-40 de 80"

#### Scenario: pageSize change resets the page to 1
- **WHEN** the user changes `pageSize` from 20 to 50 while on page 3
- **THEN** the page SHALL re-fetch with `?page=1&pageSize=50` and update the UI

#### Scenario: Missing read permission
- **WHEN** a user without `<recurso>:read` navigates to `/catalogs/<módulo>`
- **THEN** the page SHALL render an `EmptyState` "Sin acceso a este catálogo" instead of the table

#### Scenario: Status badge renders correctly
- **WHEN** the row's `isActive` is `true`
- **THEN** the badge SHALL render with text "Activo" and the success color
- **WHEN** the row's `isActive` is `false`
- **THEN** the badge SHALL render with text "Inactivo" and the muted/outline color

---

### Requirement: Create modal per catalog
The system SHALL provide, per catalog module, a single modal component `<Módulo>EditModal` that operates in two modes: `mode="create"` (POST) and `mode="edit"` (PATCH). When the user clicks "Nuevo" in the toolbar, the modal opens in `create` mode with empty defaults. The modal SHALL render the following editable inputs (depending on module):

- **Common (todos los módulos)**: `code` (text input, required, regex `^[A-Z0-9_]{1,32}$`), `name` (text input, required, 1–100 chars), `isActive` (`Switch`, default `true`).
- **`payment-methods`**: + `description` (textarea, 0–500 chars, empty maps to `null`); + `isCredit` (`Switch`, default `false`) — editable only in `mode="create"`; in `mode="edit"` the switch SHALL render disabled, reflecting the entity's current value without allowing changes, matching the immutability already enforced by the backend for this field.
- **`departments`**: + `description` (textarea, 0–500 chars, empty maps to `null`).
- **`folios`**: + `prefix` (text input, regex `^[A-Z0-9-]{1,8}$`, empty maps to `null`), + `currentNumber` (number input, integer ≥ 0, default `0`).
- **`branches`**: + `address` (textarea, 0–300 chars, empty maps to `null`), + `phone` (text input, 0–30 chars, empty maps to `null`), + `email` (email input, valid when not empty, 0–120 chars, empty maps to `null`).

On submit:
1. Validate with the module's create Zod schema.
2. If valid, call `create<Módulo>({ body })`. On HTTP 201, close modal and refresh the table.
3. On HTTP 409 (`code` duplicado), display inline error "Ese código ya está en uso" en el campo `code` y mantener el modal abierto.
4. On HTTP 400 (validation), display the first error message in a generic banner.
5. On HTTP 403, display "Sin permisos para crear este recurso" en banner.

#### Scenario: Successful creation
- **WHEN** the user with `<recurso>:write` fills valid required fields and clicks "Guardar"
- **THEN** the modal SHALL call `POST /api/v1/admin/<recurso>` with the parsed body; on 201 it SHALL close and the table SHALL refresh

#### Scenario: Duplicate code shows inline error
- **WHEN** the create call returns HTTP 409 with `"code already in use"`
- **THEN** the modal SHALL stay open, render an inline error "Ese código ya está en uso" attached to the `code` field, and keep the user's input untouched

#### Scenario: Invalid client-side input
- **WHEN** the user enters `code="abc"` (lowercase)
- **THEN** the client-side Zod schema SHALL reject it and the submit button SHALL remain disabled until corrected

#### Scenario: User without write permission cannot reach the modal
- **WHEN** a user without `<recurso>:write` looks at the screen
- **THEN** the "Nuevo" button SHALL NOT be rendered and the modal SHALL NOT be opened by any UI path

#### Scenario: Create payment method with isCredit enabled
- **WHEN** the user opens `PaymentMethodEditModal` in `mode="create"`, toggles "Es crédito" to `true`, fills `code`/`name`, and clicks "Guardar"
- **THEN** the modal calls `createPaymentMethod` with a body including `isCredit: true`, and on HTTP 201 closes the modal and refreshes the table

#### Scenario: Create payment method without touching isCredit defaults to false
- **WHEN** the user opens `PaymentMethodEditModal` in `mode="create"`, leaves "Es crédito" untouched, fills `code`/`name`, and clicks "Guardar"
- **THEN** the modal calls `createPaymentMethod` with a body where `isCredit` is `false` (or omitted), preserving current behavior for non-credit methods

#### Scenario: isCredit switch is disabled in edit mode
- **WHEN** the user opens `PaymentMethodEditModal` in `mode="edit"` for a payment method with `isCredit=true`
- **THEN** the "Es crédito" switch renders checked and disabled, and no user interaction can change its value

#### Scenario: isCredit never appears in the edit diff
- **WHEN** the user edits a payment method's `name`, `description`, or `isActive` in `mode="edit"` and clicks "Guardar"
- **THEN** the computed diff sent via `PATCH` never includes an `isCredit` key, regardless of the entity's current `isCredit` value

---

### Requirement: Edit modal per catalog with diff submit
When the user clicks "Editar" on a table row, the catalog modal SHALL open in `mode="edit"` pre-filled with the row's data. The `code` field SHALL be rendered as read-only with the value visible (the backend ignores `code` in PATCH; the UI explicitly disables editing). Other fields are editable. On "Guardar":
1. Compute the diff against the original entity.
2. If the diff is empty, the "Guardar" button SHALL remain disabled.
3. Otherwise, call `update<Módulo>({ id, body: diff })`. On HTTP 200, close the modal and refresh the table.
4. On HTTP 404, display "Recurso no encontrado" en banner y cerrar tras 2 segundos.
5. On HTTP 400 (empty body — should not happen because of the diff guard), log a warning and display the validation message.

Setting an optional field input to empty SHALL send `null` in the PATCH (i.e., the user can clear a `description`, `prefix`, `address`, `phone`, or `email`).

#### Scenario: Pre-fill from row
- **WHEN** the user clicks "Editar" on a payment method with `code="CASH"`, `name="Efectivo"`, `description="…"`, `isActive=true`
- **THEN** the modal SHALL render with those values pre-filled and `code` disabled

#### Scenario: Empty diff disables save
- **WHEN** the user opens the modal and does not change any field
- **THEN** the "Guardar" button SHALL be disabled

#### Scenario: Diff-only submit
- **WHEN** the user changes only `name`, leaving `description` and `isActive` unchanged
- **THEN** the modal SHALL call `PATCH /api/v1/admin/<recurso>/:id` with body `{ "name": "<nuevo>" }` exclusively

#### Scenario: Clearing an optional field sends null
- **WHEN** the user clears the `description` field of a payment method and clicks "Guardar"
- **THEN** the modal SHALL call PATCH with body `{ "description": null }`

#### Scenario: Toggling isActive in edit
- **WHEN** the user flips the `isActive` `Switch` from `true` to `false` and clicks "Guardar"
- **THEN** the modal SHALL call PATCH with body `{ "isActive": false }`

#### Scenario: Read-only code in edit mode
- **WHEN** the modal is in `edit` mode
- **THEN** the `code` input SHALL be `disabled` with the original value displayed; the form SHALL NOT include `code` in the diff under any circumstance

---

### Requirement: Soft delete from row action
Each table row SHALL render a "Eliminar" action button (icon `delete`) when the user has `<recurso>:write` AND the row is currently `isActive=true`. On click, the system SHALL render a `ConfirmDialog` with the message "¿Desactivar este <recurso>? Quedará oculto a menos que actives "Mostrar inactivos"." and primary action "Desactivar". On confirm, the system SHALL call `DELETE /api/v1/admin/<recurso>/:id`. On HTTP 204, the row SHALL disappear from the current view (because the default list excludes inactive rows) and an inline toast SHALL announce "<Recurso> desactivado.".

#### Scenario: User confirms soft delete
- **WHEN** the user with `<recurso>:write` clicks "Eliminar" and confirms the dialog
- **THEN** the system SHALL call `DELETE /api/v1/admin/<recurso>/:id`; on 204 the table SHALL refetch and the toast SHALL be shown

#### Scenario: User cancels confirmation
- **WHEN** the user clicks "Eliminar" and cancels the dialog
- **THEN** no request SHALL be made and the row SHALL remain unchanged

#### Scenario: Delete action hidden without write permission
- **WHEN** the user lacks `<recurso>:write`
- **THEN** the "Eliminar" action SHALL NOT be rendered on any row

#### Scenario: Delete fails with 404
- **WHEN** the DELETE returns 404
- **THEN** the toast SHALL display "El recurso ya no existe; la lista se actualizó." and the table SHALL refetch

---

### Requirement: Reactivate from row action for inactive entities
When the table is displaying inactive entities (because `includeInactive=true`), each row with `isActive=false` SHALL render a "Reactivar" action button (icon `restore`) when the user has `<recurso>:write`. On click, the system SHALL call `PATCH /api/v1/admin/<recurso>/:id` with body `{ "isActive": true }` WITHOUT a confirmation dialog (action is reversible and benign). On HTTP 200, the table SHALL refetch and an inline toast SHALL announce "<Recurso> reactivado.".

#### Scenario: User reactivates an inactive entity
- **WHEN** the user with `<recurso>:write` clicks "Reactivar" on an inactive row
- **THEN** the system SHALL call PATCH with `{ "isActive": true }` directly and refetch on success

#### Scenario: Reactivate action hidden for active rows
- **WHEN** a row's `isActive` is `true`
- **THEN** the "Reactivar" action SHALL NOT be rendered on that row

#### Scenario: Reactivate without write permission
- **WHEN** the user lacks `<recurso>:write`
- **THEN** the "Reactivar" action SHALL NOT be rendered on any row

---

### Requirement: Typed errors per module
Each catalog module SHALL expose typed errors in `app/(private)/catalogs/<módulo>/_logic/errors.ts`:
- `<Módulo>NotFoundError` — mapped from HTTP 404 responses.
- `<Módulo>CodeAlreadyInUseError` — mapped from HTTP 409 responses whose body contains "code already in use".

All services SHALL re-throw `UnauthenticatedError`, `ForbiddenError`, and `NetworkError` from `app/_lib/authFetch.ts` without wrapping. Services SHALL accept an optional `fetchImpl?: typeof fetch` parameter to allow injecting a mocked fetch in tests.

#### Scenario: Service maps 404 to NotFound error
- **WHEN** `update<Módulo>({ id, body })` receives HTTP 404
- **THEN** it SHALL throw `<Módulo>NotFoundError` (instance of the module's specific class)

#### Scenario: Service maps 409 to CodeAlreadyInUse error
- **WHEN** `create<Módulo>({ body })` receives HTTP 409 with `{"error":"<Recurso> code already in use"}`
- **THEN** it SHALL throw `<Módulo>CodeAlreadyInUseError`

#### Scenario: Service passes through 403
- **WHEN** any service receives HTTP 403
- **THEN** it SHALL throw `ForbiddenError(required)` propagated from `authFetch`

#### Scenario: Service injection of fetchImpl
- **WHEN** a test calls `list<Módulo>({ fetchImpl: jest.fn().mockResolvedValue(...) })`
- **THEN** the service SHALL use the injected fetch and NOT touch the global `fetch` or `sessionStorage`

---

### Requirement: Switch atom
The system SHALL expose a reusable atom `app/_components/atoms/Switch/Switch.tsx` implementing a Material 3 switch. Props: `{ checked: boolean; onChange: (next: boolean) => void; disabled?: boolean; "aria-label": string; id?: string }`. The component SHALL be presentational (no fetch, no router, no storage access). Visually, it renders a 36×20 track that toggles between `bg-primary` and `bg-surface-container-high`, with a 16×16 thumb that slides on toggle.

#### Scenario: Switch toggles on click
- **WHEN** the user clicks an enabled `Switch` with `checked={false}`
- **THEN** `onChange(true)` SHALL be called exactly once

#### Scenario: Disabled switch does not toggle
- **WHEN** the user clicks a `disabled` `Switch`
- **THEN** `onChange` SHALL NOT be called

#### Scenario: Switch is keyboard-accessible
- **WHEN** the switch has focus and the user presses `Space`
- **THEN** `onChange` SHALL be called with the negation of the current `checked`

#### Scenario: Switch has appropriate ARIA
- **WHEN** the component renders
- **THEN** the root element SHALL be a `<button role="switch">` with `aria-checked` reflecting `checked` and the `aria-label` from props

---

### Requirement: CatalogToolbar with optional server-side search scope, min-length hint, and custom button label
The `CatalogToolbar` component SHALL accept optional props: `searchScope?: "client" | "server"` (default `"client"`), `searchMinLength?: number` (default `2`), `searchPlaceholder?: string` (default `"Buscar..."`), and `createButtonLabel?: string` (default `"Nuevo"`). When `searchScope === "server"` and the search field is empty or has `searchValue.length >= searchMinLength`, the toolbar SHALL render a static caption "Búsqueda en servidor · N+ caracteres" below the search input (styled `text-label-sm text-on-surface-variant`). When `searchScope === "server"` and `0 < searchValue.length < searchMinLength`, the toolbar SHALL replace the static caption with a conditional hint "Mínimo N caracteres" styled `text-label-sm text-error`. When `searchScope === "client"` (default), no caption or hint is rendered. The `createButtonLabel` prop sets the label of the "Nuevo" button; callers can pass `"Nuevo producto"` or any other string.

The create button SHALL render via `CreateButton` (`app/_components/molecules/CreateButton/CreateButton.tsx`, see the `design-system` capability) bound to `onCreate` via its `onClick` prop and `createButtonLabel` via its `label` prop, instead of a raw `<button>` with hardcoded classes or a direct `Button` instantiation.

Every catalog page SHALL pass an explicit `createButtonLabel` naming its resource with correct grammatical gender, instead of relying on the generic `"Nuevo"` default: `payment-methods` → `"Nuevo método de pago"`, `folios` → `"Nuevo folio"`, `departments` → `"Nuevo departamento"`, `branches` → `"Nueva sucursal"`, `providers` → `"Nuevo proveedor"`, `tax-rates` → `"Nueva tasa de impuesto"`, `products` → `"Nuevo producto"`, `customers` → `"Nuevo cliente"`, `vehicles` → `"Nuevo vehículo"`, `drivers` → `"Nuevo operador"`.

#### Scenario: Default scope is client
- **WHEN** `CatalogToolbar` is rendered without a `searchScope` prop
- **THEN** no scope caption is rendered (existing four catalogs are unaffected)

#### Scenario: Server scope renders static caption when search is empty
- **WHEN** `CatalogToolbar` is rendered with `searchScope="server"` and the search input is empty
- **THEN** the caption "Búsqueda en servidor · 2+ caracteres" appears below the search input

#### Scenario: Server scope shows min-length hint when search is too short
- **WHEN** `CatalogToolbar` is rendered with `searchScope="server"` and `searchValue.length === 1`
- **THEN** the caption changes to "Mínimo 2 caracteres" in error color

#### Scenario: createButtonLabel customizes the button
- **WHEN** `CatalogToolbar` is rendered with `createButtonLabel="Nuevo producto"`
- **THEN** the create button renders the label "Nuevo producto" instead of "Nuevo"

#### Scenario: Existing four catalogs do not pass searchScope
- **WHEN** the `payment-methods`, `folios`, `departments`, and `branches` pages render `CatalogToolbar`
- **THEN** they do NOT pass `searchScope` and the toolbar behavior is identical to the prior release

#### Scenario: Create button shares the CreateButton look
- **WHEN** any catalog page renders `CatalogToolbar` with `canWrite` true
- **THEN** the create button is a `CreateButton` instance (`rounded-full`, `variant="filled"`, `icon="add"` at the start, internally via `Button`), not a raw `<button>` or a directly-instantiated `Button` with independently maintained props

#### Scenario: All six previously-generic catalogs now pass an explicit label
- **WHEN** the `payment-methods`, `folios`, `departments`, `branches`, `providers`, or `tax-rates` pages render `CatalogToolbar`
- **THEN** each passes its own `createButtonLabel` ("Nuevo método de pago", "Nuevo folio", "Nuevo departamento", "Nueva sucursal", "Nuevo proveedor", "Nueva tasa de impuesto" respectively) instead of falling back to the generic `"Nuevo"` default

---

### Requirement: FolioScopeMismatch error typed in POS frontend

El módulo frontend de POS (`app/(private)/pos/_logic/`) SHALL definir la clase `FolioScopeMismatchError extends Error` con propiedades públicas `expected: string` y `actual: string`. El servicio `createSale` SHALL detectar la respuesta `{"error":"FolioScopeMismatch","expected":"...","actual":"..."}` (HTTP 400) y lanzar `FolioScopeMismatchError(expected, actual)` en lugar de `NetworkError`. El toast de error existente en `PosPage` mostrará el mensaje del error automáticamente ya que usa `submitError.message`.

#### Scenario: Backend retorna FolioScopeMismatch al crear venta

- **WHEN** el servicio `createSale` recibe HTTP 400 con body `{"error":"FolioScopeMismatch","expected":"POS","actual":"OPERATIONS"}`
- **THEN** el servicio lanza `FolioScopeMismatchError` (en vez de `NetworkError`) y el toast del POS muestra el mensaje en español

#### Scenario: Otros errores 400 no se ven afectados

- **WHEN** el servicio `createSale` recibe HTTP 400 con cualquier otro error (e.g. "Folio inactive")
- **THEN** el comportamiento existente se mantiene sin cambios

---

### Requirement: Scope badge labels in FoliosTable are human-readable

La columna "Ámbito" en `FoliosTable` SHALL mostrar etiquetas legibles en español en lugar de los valores raw del enum (`POS`, `INVENTORY`, `OPERATIONS`). Las etiquetas SHALL provenir de una constante `SCOPE_LABEL: Record<FolioScope, string>` definida en `app/(private)/catalogs/folios/_logic/scopeLabels.ts` y reutilizada también por `FolioEditModal`. Los valores de `SCOPE_LABEL` SHALL ser: `POS` → `"Punto de Venta"`, `INVENTORY` → `"Inventario"`, `OPERATIONS` → `"Operaciones"`.

#### Scenario: Tabla muestra etiqueta legible en badge de scope

- **WHEN** un folio con `scope="POS"` aparece en `FoliosTable`
- **THEN** el badge muestra "Punto de Venta" en lugar de "POS"

#### Scenario: Tabla muestra etiqueta para todos los scopes

- **WHEN** la tabla contiene folios con `scope="INVENTORY"` y `scope="OPERATIONS"`
- **THEN** los badges muestran "Inventario" y "Operaciones" respectivamente

#### Scenario: FolioEditModal usa las mismas etiquetas

- **WHEN** un usuario abre el modal para crear o editar un folio
- **THEN** el select de "Ámbito" muestra opciones derivadas de `SCOPE_LABEL` (consistente con la tabla)

---

### Requirement: Structured fiscal address section in the branch modal
The branch catalog's edit modal (`BranchEditModal`) SHALL include a "Domicilio fiscal (Carta Porte)" section, independent of the pre-existing free-text `address` field, exposing the 8 structured address fields already supported by the backend (`admin-branches` spec): `addressStreet`, `addressExteriorNumber`, `addressInteriorNumber`, `addressNeighborhood`, `addressMunicipality`, `addressState`, `addressCountry`, `addressZipCode`.

The modal SHALL follow the multi-section layout pattern established by `ProviderEditModal` (grouped `<section>` blocks with a bordered separator between them, a wider dialog, and an `h3` section heading), rather than the flat single-column layout `BranchEditModal` currently uses.

`addressZipCode` SHALL be validated client-side against `^\d{5}$` and `addressState` against `^[A-Z]{2,3}$`, mirroring the backend's validation, before the "Guardar" button is enabled.

Saving only the structured address fields (leaving `code`, `name`, `address`, `phone`, `email`, `isActive` unchanged) SHALL compute a diff containing exclusively the changed structured fields and submit `PATCH /api/v1/admin/branches/:id` with that partial body.

#### Scenario: Structured address section renders independently of free-text address
- **WHEN** the branch modal opens in either `create` or `edit` mode
- **THEN** the "Domicilio fiscal (Carta Porte)" section is visible with all 8 fields, separate from the existing "Dirección" free-text field

#### Scenario: Saving only the fiscal address
- **WHEN** the user fills only `addressStreet`, `addressExteriorNumber`, `addressNeighborhood`, `addressMunicipality`, `addressState`, `addressZipCode` on an existing branch and clicks "Guardar"
- **THEN** the PATCH body contains only those changed fields, not `code`, `name`, `address`, `phone`, or `email`

#### Scenario: Invalid zip code blocks save
- **WHEN** the user enters `addressZipCode: "12"` (not 5 digits)
- **THEN** an inline validation error is shown and "Guardar" remains disabled

#### Scenario: Invalid state key blocks save
- **WHEN** the user enters `addressState: "son"` (lowercase)
- **THEN** an inline validation error is shown and "Guardar" remains disabled

#### Scenario: Completing the fiscal address unblocks Carta Porte transfers
- **WHEN** a branch previously missing structured address fields has all 8 fields saved from this modal
- **THEN** the branch can subsequently be selected as origin or destination of a `type='carta_porte'` waybill without triggering `BranchAddressIncomplete`
