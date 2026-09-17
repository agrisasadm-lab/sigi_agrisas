## MODIFIED Requirements

### Requirement: Product detail screen with tabs
The system SHALL provide a detail screen at `/catalogs/products/[id]` reachable from the list's "Gestionar" action, requiring `products:read`. The screen SHALL load the product via `GET /api/v1/admin/products/:id` and render its `code` and `name` as a header plus three tabs: "General", "Precios", "Dosificaciones". The "General" tab SHALL embed the same editable fields as `ProductEditModal` — including `manufactureDate` — with a "Guardar cambios" button (diff submit, disabled when no changes) gated by `products:write`. A 404 on load SHALL render a "Producto no encontrado" state with a link back to `/catalogs/products`. The initially active tab SHALL be determined by the `tab` query parameter (`?tab=general|prices|dosifications`) when present and valid; an absent or invalid value SHALL default to "General". Manually switching tabs after load does not update the URL.

#### Scenario: Detail loads and shows tabs
- **WHEN** a user with `products:read` opens `/catalogs/products/<id>` for an existing product
- **THEN** the header shows the product `code` and `name` and the three tabs (General, Precios, Dosificaciones) are rendered with "General" active by default

#### Scenario: 404 on missing product
- **WHEN** the product id does not exist and the backend returns 404
- **THEN** the screen renders "Producto no encontrado" with a link back to `/catalogs/products`

#### Scenario: General tab save is gated and diff-based
- **WHEN** a user with `products:write` edits a field in the General tab
- **THEN** the "Guardar cambios" button enables and on submit dispatches `PATCH /api/v1/admin/products/:id` with only the changed fields

#### Scenario: Viewer sees General tab read-only
- **WHEN** a user with only `products:read` opens the detail
- **THEN** the General tab fields are disabled and the "Guardar cambios" button is not rendered

#### Scenario: Deep-link opens directly on the Precios tab
- **WHEN** a user opens `/catalogs/products/<id>?tab=prices`
- **THEN** the "Precios" tab is active on load, without needing to click the tab

#### Scenario: Invalid tab query param falls back to General
- **WHEN** a user opens `/catalogs/products/<id>?tab=unknown` (or with no `tab` param)
- **THEN** the "General" tab is active on load, same as today

### Requirement: Branch scope mode notice in products catalog
The `/catalogs/products` screen SHALL display an informational notice, when the deployment's inventory scope mode (`inventory-api` — Configurable inventory scope mode) is `branch`, clarifying that a product created here is not yet sellable in any branch until it is assigned via `/inventory` (Assign product to branch modal). The catalog list itself SHALL remain unfiltered by branch — this is an informational notice only, not a behavior change to the admin catalog. Additionally, when a product is successfully created (`POST /api/v1/admin/products`) while the inventory scope mode is `branch`, the screen SHALL show a dismissible success banner naming the created product (`code`/`name`). When the current user has `inventory:write`, the banner SHALL include a link "Asignar a sucursal" pointing to `/inventory`. When the user does NOT have `inventory:write`, the banner SHALL show only the creation confirmation, without the link. This banner is additional to (does not replace) the permanent notice described above. No such banner is shown when the inventory scope mode is `general`, nor when editing an existing product.

#### Scenario: Notice shown in branch mode
- **WHEN** the inventory scope mode is `branch` and a user with `products:read` opens `/catalogs/products`
- **THEN** the screen displays a notice explaining that products must be assigned per branch from Inventario

#### Scenario: No notice in general mode
- **WHEN** the inventory scope mode is `general`
- **THEN** the screen renders exactly as before this capability, with no additional notice

#### Scenario: Catalog list stays unfiltered regardless of mode
- **WHEN** the inventory scope mode is `branch`
- **THEN** `/catalogs/products` still lists the full catalog (active and, if requested, inactive products), unaffected by branch assignment — only the POS/Cotizaciones catalog is filtered (`products-api`)

#### Scenario: Success banner with inventory link after creating a product in branch mode
- **WHEN** a user with `products:write` and `inventory:write` creates a product successfully while the inventory scope mode is `branch`
- **THEN** a success banner appears naming the product and includes a link "Asignar a sucursal" to `/inventory`

#### Scenario: Success banner without link for a user lacking inventory:write
- **WHEN** a user with `products:write` but without `inventory:write` creates a product successfully in `branch` mode
- **THEN** a success banner appears confirming the creation, without the "Asignar a sucursal" link

#### Scenario: No post-create banner in general mode
- **WHEN** the inventory scope mode is `general` and a product is created successfully
- **THEN** no post-create banner appears (the permanent list notice is also absent in this mode, per the existing "No notice in general mode" scenario)

#### Scenario: No post-create banner when editing
- **WHEN** an existing product is updated (not created) via `ProductEditModal`
- **THEN** no post-create banner appears, regardless of inventory scope mode
