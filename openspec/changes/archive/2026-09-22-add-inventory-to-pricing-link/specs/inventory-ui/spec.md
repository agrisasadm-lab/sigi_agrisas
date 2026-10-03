## ADDED Requirements

### Requirement: Post-assign success banner with pricing link
After a successful product assignment via `InventoryAssignModal` (`POST /api/v1/admin/branches/:id/inventory` returns 201), the `/inventory` screen SHALL show a dismissible success banner naming the assigned product (`productCode`/`productName`). When the current user has `products:write`, the banner SHALL include a link "Asignar precio de venta" pointing to `/catalogs/products/{productId}?tab=prices`. When the user does NOT have `products:write`, the banner SHALL show only the assignment confirmation, without the link. The banner is local UI state — it is cleared when the user opens another modal, dismisses it, or navigates away; it is not persisted.

#### Scenario: Success banner with pricing link for a user with products:write
- **WHEN** a user with `inventory:write` and `products:write` successfully assigns a product via `InventoryAssignModal`
- **THEN** a success banner appears naming the product and includes a link "Asignar precio de venta" to `/catalogs/products/{productId}?tab=prices`

#### Scenario: Clicking the link lands directly on the Precios tab
- **WHEN** the user clicks "Asignar precio de venta" in the success banner
- **THEN** the browser navigates to `/catalogs/products/{productId}?tab=prices` and the product detail screen opens with the "Precios" tab active (not "General")

#### Scenario: Success banner without link for a user lacking products:write
- **WHEN** a user with `inventory:write` but without `products:write` successfully assigns a product
- **THEN** a success banner appears confirming the assignment, without the "Asignar precio de venta" link

#### Scenario: Banner can be dismissed and does not block further assignments
- **WHEN** the success banner is showing and the user opens "Asignar producto" again to assign another product
- **THEN** the previous banner clears and a new one appears (or none, if the new assignment fails) reflecting only the latest assignment
