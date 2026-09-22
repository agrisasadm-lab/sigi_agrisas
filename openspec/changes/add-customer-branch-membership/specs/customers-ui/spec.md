## MODIFIED Requirements

### Requirement: Customers list screen with server-side search
The system SHALL provide a screen at `/catalogs/customers` that lists customers in a paginated table. The screen SHALL require the `customers:read` permission (gated via `useCurrentUser().can("customers:read")`), rendered optimistically while the check is `"loading"`. The toolbar SHALL include: a search input that submits its value to the backend `?search=` query parameter (server-side search, minimum 2 characters) with a 300 ms debounce and a caption "Búsqueda en servidor · 2+ caracteres" below the input; a `Switch` "Mostrar inactivos" that toggles the `?includeInactive=true` query parameter; and a button "Nuevo cliente" that opens the create modal (gated by `customers:write`). When the current user has `branches:access_all`, the toolbar additionally SHALL include a branch `Select` ("Todas las sucursales" default, plus one option per active branch via `useBranchesOptions()`) that adds `?branchId=` to the list request; when the user does NOT have `branches:access_all`, this selector is NOT rendered — the backend already scopes the list to their own branch regardless. The table SHALL show columns: `Código`, `Nombre` (with `legalName` as a smaller subtitle when present), `RFC` (monospace, or `—` when `null`), `Límite de crédito` (formatted currency or `—` when `null`), `Saldo inicial` (`initialBalance`, formatted currency), `Saldo actual` (`currentBalance`, formatted currency), `Plazo (días)` (`creditDays`), `Sucursales` (comma-separated branch codes from `branchIds`, rendered ONLY when the user has `branches:access_all` — hidden for an operator, since it is always their own single branch), `Estado` (badge Activo/Inactivo), `Acciones`. The actions column SHALL only render when the user has `customers:write`. Active rows SHALL show "Editar" and "Eliminar"; inactive rows SHALL show "Reactivar".

#### Scenario: Admin opens the customers screen
- **WHEN** an authenticated user with `customers:read` navigates to `/catalogs/customers`
- **THEN** the screen renders the toolbar, table, and pagination, and dispatches `GET /api/v1/admin/customers?page=1&pageSize=20`

#### Scenario: Search shorter than 2 characters does not fetch
- **WHEN** the user types `"a"` in the search input
- **THEN** no `?search=` parameter is sent

#### Scenario: Search with 2+ characters fetches debounced
- **WHEN** the user types `"acme"` in the search input
- **THEN** after 300 ms a `GET /api/v1/admin/customers?page=1&pageSize=20&search=acme` request is dispatched, replacing any in-flight request

#### Scenario: Toggle inactive shows inactive customers
- **WHEN** the user enables the "Mostrar inactivos" switch
- **THEN** the next list request adds `?includeInactive=true` and rows with `isActive=false` appear

#### Scenario: pageSize respects backend maximum
- **WHEN** the pageSize selector offers options up to the UI maximum
- **THEN** no option exceeds the backend's `pageSize` maximum of 100

#### Scenario: Empty results render empty state
- **WHEN** a search or filter combination returns zero customers
- **THEN** the screen renders `CatalogEmpty` instead of an empty table

#### Scenario: Fetch failure renders error state
- **WHEN** the list request fails (network error or 5xx)
- **THEN** the screen renders `CatalogError` with a retry action

#### Scenario: Viewer cannot see write actions
- **WHEN** an authenticated user with only `customers:read` opens the screen
- **THEN** the "Nuevo cliente" button and the actions column are not rendered

#### Scenario: User without customers:read sees no access
- **WHEN** a user without `customers:read` navigates to `/catalogs/customers`
- **THEN** the route guard prevents the table from rendering / dispatching the list request (page treats it as unauthorized, optimistic while `can()` resolves)

#### Scenario: RFC column shows em-dash when null
- **WHEN** a customer row has `rfc: null`
- **THEN** the `RFC` column renders `—` instead of an empty cell

#### Scenario: Saldo inicial column present
- **WHEN** the table renders a customer with `initialBalance: 1200`
- **THEN** the `Saldo inicial` column shows the formatted currency value `$1,200.00`

#### Scenario: Bypass sees the branch filter and column
- **WHEN** a user with `branches:access_all` opens the screen
- **THEN** the toolbar shows a branch `Select` and the table shows a `Sucursales` column listing each row's branch codes

#### Scenario: Operator does not see the branch filter or column
- **WHEN** an operator without `branches:access_all` opens the screen
- **THEN** the toolbar shows no branch selector and the table has no `Sucursales` column (every row is implicitly their own branch)

#### Scenario: Selecting a branch filters the list
- **WHEN** a bypass user selects "ZARIOZ" from the branch filter
- **THEN** the next request adds `?branchId=<ZARIOZ>` and only customers with membership there are shown

---

### Requirement: Customer create/edit modal with grouped sections including credit fields
The system SHALL provide a single modal component `CustomerEditModal` handling both creation and edition via a `mode` prop (`"create" | "edit"`). Fields SHALL be grouped into FOUR labelled sections: "Datos básicos" (`code`, `name`, `rfc`), "Datos fiscales" (`legalName`, `taxRegime`, `cfdiUse`, `taxZipCode`, collapsible/optional), "Contacto y crédito" (`email`, `phone`, `address`, `contactName`, `notes`, `creditLimit`, `creditDays`, `initialBalance`), and "Sucursales" (`branchIds`). The field `rfc` SHALL be optional and SHALL NOT be marked with the required-field indicator (`*`); the fields `code` (uppercase-forced) SHALL keep its own required marker. The field `code` SHALL be disabled in `edit` mode. The `taxRegime` and `cfdiUse` fields SHALL be rendered as comboboxes backed by the SAT reference catalogs (`GET /api/v1/admin/sat-codes/regimen-fiscal` and `GET /api/v1/admin/sat-codes/uso-cfdi`), using the shared molecule `SatCatalogCombobox` (located in `app/_components/molecules/SatCatalogCombobox/`): they SHALL load in BOTH `mode="create"` and `mode="edit"`; the user SHALL be able to filter options by name (description) or code; selecting an option SHALL store the `code` value in the field. Selection SHALL be enforced: a free-typed value that does not match an option of the catalog SHALL be reverted when the field loses focus, so only catalog codes can be saved. Client-side validation SHALL mirror the backend: `code` `^[A-Z0-9_]{1,32}$`, `rfc` `^([A-ZÑ&]{3,4})\d{6}([A-Z\d]{3})$` when non-empty (empty value maps to `null`, no format error shown), `taxRegime` `^\d{3}$`, `cfdiUse` `^[A-Z]{1,2}\d{2}$`, `taxZipCode` `^\d{5}$`, `creditLimit` a non-negative number or empty (maps to `null`), `creditDays` a non-negative integer (left empty on create lets the backend apply its default of 30; left empty on edit is not sent as part of the diff unless explicitly cleared), `initialBalance` a non-negative number or empty (maps to `0` on create, unchanged on edit unless modified). In `create` mode the save button SHALL be enabled once `code` and `name` are filled and valid (`rfc` is no longer required). In `edit` mode the save button SHALL be disabled while the diff against the loaded entity is empty.

**"Sucursales" section**: when the current user has `branches:access_all`, this section SHALL render a multi-select checklist of active branches (via `useBranchesOptions()`), pre-checking the headquarters branch (via `useHeadquarters()`) in `create` mode when no other selection has been made, and requiring at least one checked branch before save (client-side mirror of the backend's `branchIds must contain at least one branch`). When the current user does NOT have `branches:access_all`, this section SHALL render read-only — a single chip naming the user's own branch (via `useCurrentUser().branchId`), with no checklist and no way to change it; the section is informational only in this case, since the backend ignores any `branchIds` an operator submits.

#### Scenario: Create mode renders all fields editable
- **WHEN** the modal opens in `mode="create"`
- **THEN** all fields across the four sections are editable and `code` is enabled (branch selection editable only for a bypass user, per the "Sucursales" section rule)

#### Scenario: RFC is not marked required
- **WHEN** the modal opens in `mode="create"` or `mode="edit"`
- **THEN** the RFC field label does not show the required-field indicator (`*`)

#### Scenario: Create without RFC succeeds
- **WHEN** a user with `customers:write` fills only `code` and `name`, leaves `rfc` empty, and clicks "Guardar"
- **THEN** the modal calls `POST /api/v1/admin/customers` without an `rfc` field (or with `rfc: null`); on HTTP 201 it closes and the table refreshes

#### Scenario: Edit mode locks code
- **WHEN** the modal opens in `mode="edit"` with an existing customer
- **THEN** the `code` field renders disabled and pre-filled; the remaining fields are pre-filled and editable

#### Scenario: Tax regime and CFDI use catalogs load on create
- **WHEN** the modal opens in `mode="create"`
- **THEN** the `taxRegime` and `cfdiUse` comboboxes fetch their SAT catalog and the user can search options by name

#### Scenario: Tax regime and CFDI use catalogs load on edit with prefilled code
- **WHEN** the modal opens in `mode="edit"` for a customer with `taxRegime: "612"` and `cfdiUse: "G03"`
- **THEN** both comboboxes load their catalog and render `612` and `G03` as the current selection

#### Scenario: Filter by name and select stores the code
- **WHEN** the user types "general" in the tax regime combobox and selects the `601` option
- **THEN** the field stores `601` (the code, not the description) and the create/update payload carries `taxRegime: "601"`

#### Scenario: Free text not matching the catalog is reverted
- **WHEN** the user types an arbitrary string in the CFDI use combobox that matches no catalog option and the field loses focus
- **THEN** the input reverts to the previous valid selection (or empty) and the arbitrary string is not saved

#### Scenario: Successful creation
- **WHEN** a user with `customers:write` fills `code`, `name` (required) and clicks "Guardar"
- **THEN** the modal calls `POST /api/v1/admin/customers`; on HTTP 201 it closes and the table refreshes

#### Scenario: Creation omitting creditDays lets backend apply default
- **WHEN** the user submits a new customer without touching the `creditDays` field
- **THEN** the request body does not force a `creditDays` value, and the created customer shows `creditDays: 30` (backend default) in the refreshed table

#### Scenario: Invalid RFC client-side
- **WHEN** the user types an RFC that does not match the expected pattern and tries to submit
- **THEN** the modal shows an inline error under the RFC field and does not dispatch the request

#### Scenario: 409 duplicate code shows inline error
- **WHEN** the create request returns HTTP 409 for a duplicate `code`
- **THEN** the modal stays open and shows an inline error under the `code` field

#### Scenario: 409 duplicate RFC shows inline error
- **WHEN** the create or update request returns HTTP 409 for a duplicate `rfc`
- **THEN** the modal stays open and shows an inline error under the `rfc` field

#### Scenario: Empty diff in edit disables save
- **WHEN** the modal is in `edit` mode and the user has not changed any field
- **THEN** the save button is disabled

#### Scenario: Diff-only submit on edit
- **WHEN** the user changes only `creditDays` from 30 to 60 in edit mode
- **THEN** the modal calls `PATCH /api/v1/admin/customers/:id` with body `{ "creditDays": 60 }` exclusively

#### Scenario: Optional field cleared via null
- **WHEN** the user clears the `creditLimit` field in edit mode and submits
- **THEN** the request sends `{ "creditLimit": null }`

#### Scenario: Create with initial balance
- **WHEN** the user enters `1200` in "Saldo inicial" during creation and submits
- **THEN** the request body includes `{ "initialBalance": 1200 }`, and on success the table shows `1200` as both saldo inicial and saldo actual for the new customer

#### Scenario: Edit initial balance shows inline note about the adjustment
- **WHEN** the user changes "Saldo inicial" in `edit` mode from `1000` to `1300` and submits
- **THEN** the modal calls `PATCH /api/v1/admin/customers/:id` with `{ "initialBalance": 1300 }`, and on success the refreshed table reflects the backend-adjusted `currentBalance`

#### Scenario: Negative initial balance rejected client-side
- **WHEN** the user types `-50` in "Saldo inicial" and tries to submit
- **THEN** the modal shows an inline error and does not dispatch the request

#### Scenario: Bypass sees an editable branch checklist
- **WHEN** a user with `branches:access_all` opens the modal in `mode="create"`
- **THEN** the "Sucursales" section shows a checklist of active branches, with the headquarters branch pre-checked

#### Scenario: Bypass must keep at least one branch checked
- **WHEN** a bypass user unchecks every branch in the "Sucursales" section and tries to save
- **THEN** the modal shows an inline error and does not dispatch the request

#### Scenario: Operator sees a read-only branch chip
- **WHEN** an operator without `branches:access_all`, assigned to ZARIOZ, opens the modal
- **THEN** the "Sucursales" section shows a single read-only chip "ZARIOZ", with no checklist and no way to edit it

#### Scenario: Bypass edits a customer's branch set
- **WHEN** a bypass user opens `mode="edit"` for a customer with `branchIds: ["<ZARIOZ>"]`, checks "PRADERA" as well, and saves
- **THEN** the modal calls `PATCH /api/v1/admin/customers/:id` with `{ "branchIds": ["<ZARIOZ>", "<PRADERA>"] }`
