## MODIFIED Requirements

### Requirement: Branch scope mode notice in products catalog
The `/catalogs/products` screen SHALL display an informational notice, when the deployment's inventory scope mode (`inventory-api` — Configurable inventory scope mode) is `branch`, clarifying that a product created here is not yet sellable in any branch until it is assigned via `/inventory` (Assign product to branch modal). The catalog list itself SHALL remain unfiltered by branch — this is an informational notice only, not a behavior change to the admin catalog. Additionally, when a product is successfully created (`POST /api/v1/admin/products`) while the inventory scope mode is `branch`, the screen SHALL show a dismissible success banner naming the created product (`code`/`name`). The banner's link depends on the response's `autoAssignedBranchId` (`products-api` — Create product):

- When `autoAssignedBranchId` is present (the caller's own branch was auto-assigned), the banner SHALL include a link **"Gestionar producto"** pointing to `/catalogs/products/{id}` (the product's detail screen, General tab — same destination as the "Gestionar" row action in the products table).
- When `autoAssignedBranchId` is `null` (no auto-assignment happened — caller has `branches:access_all`, has no assigned branch, or the scope mode is `general`) AND the current user has `inventory:write`, the banner SHALL include a link **"Asignar a sucursal"** pointing to `/inventory`.
- When `autoAssignedBranchId` is `null` and the user does NOT have `inventory:write`, the banner SHALL show only the creation confirmation, without any link.

This banner is additional to (does not replace) the permanent notice described above. No such banner is shown when the inventory scope mode is `general`, nor when editing an existing product.

#### Scenario: Notice shown in branch mode
- **WHEN** the inventory scope mode is `branch` and a user with `products:read` opens `/catalogs/products`
- **THEN** the screen displays a notice explaining that products must be assigned per branch from Inventario

#### Scenario: No notice in general mode
- **WHEN** the inventory scope mode is `general`
- **THEN** the screen renders exactly as before this capability, with no additional notice

#### Scenario: Catalog list stays unfiltered regardless of mode
- **WHEN** the inventory scope mode is `branch`
- **THEN** `/catalogs/products` still lists the full catalog (active and, if requested, inactive products), unaffected by branch assignment — only the POS/Cotizaciones catalog is filtered (`products-api`)

#### Scenario: Success banner links to product management when auto-assigned
- **WHEN** a user creates a product successfully and the response includes a non-null `autoAssignedBranchId` (operator with their own branch, in `branch` mode)
- **THEN** a success banner appears naming the product and includes a link "Gestionar producto" to `/catalogs/products/{id}` — NOT a link to `/inventory`

#### Scenario: Success banner links to Inventario when not auto-assigned and user can write inventory
- **WHEN** a user with `inventory:write` creates a product successfully and the response's `autoAssignedBranchId` is `null` (e.g. an admin with `branches:access_all`)
- **THEN** a success banner appears naming the product and includes a link "Asignar a sucursal" to `/inventory`

#### Scenario: Success banner without any link for a user lacking inventory:write and not auto-assigned
- **WHEN** a user without `inventory:write` creates a product successfully and the response's `autoAssignedBranchId` is `null`
- **THEN** a success banner appears confirming the creation, without any link

#### Scenario: No post-create banner in general mode
- **WHEN** the inventory scope mode is `general` and a product is created successfully
- **THEN** no post-create banner appears (the permanent list notice is also absent in this mode, per the existing "No notice in general mode" scenario)

#### Scenario: No post-create banner when editing
- **WHEN** an existing product is updated (not created) via `ProductEditModal`
- **THEN** no post-create banner appears, regardless of inventory scope mode
