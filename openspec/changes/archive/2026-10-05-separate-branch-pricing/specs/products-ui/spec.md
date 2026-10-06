## MODIFIED Requirements

### Requirement: Product prices management in the Precios tab
The "Precios" tab SHALL show a branch selector above the prices table listing one option per active branch **the user is authorized to select**, and SHALL NOT offer any "todas las sucursales" / "precio base" option — every price belongs to exactly one branch. When the user has `branches:access_all`, the selector SHALL list every active branch and default to the headquarters branch (or the first active branch when no headquarters exists). When the user does NOT have `branches:access_all`, the selector SHALL list only the user's own assigned branch (`branchId` from `useCurrentUser()`) and default to it; if the user has no assigned branch, the tab SHALL render an empty state explaining that a branch assignment is required to manage prices, and SHALL NOT dispatch any price request. Selecting a branch dispatches `GET /api/v1/admin/products/:id/prices?branchId=<id>` and lists only that branch's own prices.

The table columns are: `Nombre`, `Precio` (currency), `Cantidad mín.` (`minQuantity`), `Descuento` (`discountPct` as `"%"` or `"—"`), `Default` (a badge on the default row of the selected branch), and `Acciones`. There SHALL be no `Origen` column — with no inheritance there is no base/override distinction to display. A "Nuevo precio" button (gated by `products:write`) SHALL open a `ProductPriceModal` for creation, pre-filling `branchId` with the currently selected branch. Rows SHALL offer "Editar" and "Eliminar" (hard delete with `ConfirmDialog`); every listed row belongs to the selected branch, so both actions are always available. The modal SHALL validate `name` (required), `price >= 0`, `minQuantity >= 1`, `discountPct` 0–100 (or empty → null), and `isDefault` (boolean); `branchId` is not editable once a price is created. After any mutation that changes the default price, the table SHALL re-fetch so the moved default badge is reflected. When the user lacks `products:write`, the table SHALL render read-only with a caption "Solo lectura — requiere products:write". When a price mutation fails with a 403 whose `required` field is `"branches:access_all"` (the backend's branch-scope guard), the error banner SHALL show "No puedes crear precios para otra sucursal." instead of the raw backend error text.

#### Scenario: Prices table lists the selected branch's prices with default badge
- **WHEN** the Precios tab opens for a product
- **THEN** a `GET /api/v1/admin/products/:id/prices?branchId=<selected>` request is dispatched and the row with `isDefault === true` shows a "Default" badge

#### Scenario: Create a price
- **WHEN** a user with `products:write` clicks "Nuevo precio", fills `name` and `price`, and submits
- **THEN** a `POST /api/v1/admin/products/:id/prices` request is dispatched with the selected `branchId` and the table refreshes with the new row

#### Scenario: Duplicate price name shows inline error
- **WHEN** the user submits a price `name` already used by the product in that branch and the backend returns 409
- **THEN** the modal stays open and an inline error "Ya existe un precio con ese nombre." appears under the `name` field

#### Scenario: Second default price on create shows inline error
- **WHEN** the user submits a new price with `isDefault: true` while that branch already has a default and the backend returns 409
- **THEN** the modal stays open and an inline error "El producto ya tiene un precio default." appears

#### Scenario: Setting a new default reflows the badge
- **WHEN** the user edits a non-default price to `isDefault: true` and the backend accepts it (the previous default of that branch is deactivated)
- **THEN** the table re-fetches and the "Default" badge moves to the edited row

#### Scenario: Delete a price with confirmation
- **WHEN** the user clicks "Eliminar" on a price row and confirms the dialog
- **THEN** a `DELETE /api/v1/admin/products/:id/prices/:priceId` request is dispatched and the row disappears

#### Scenario: Viewer sees prices read-only
- **WHEN** a user with only `products:read` opens the Precios tab
- **THEN** the "Nuevo precio" button and row actions are not rendered and a "Solo lectura — requiere products:write" caption is shown

#### Scenario: Switching branches reloads that branch's own prices
- **WHEN** a user with `branches:access_all` switches the selector from "Matriz" to "Zarioz"
- **THEN** a `GET .../prices?branchId=<Zarioz>` request is dispatched and the table shows only Zarioz prices — no Matriz row remains visible

#### Scenario: Branch with no prices shows an empty table, not another branch's prices
- **WHEN** the selected branch has no prices for the product
- **THEN** the table renders empty with a "Nuevo precio" call to action, and no price from another branch is listed

#### Scenario: Branch selector is limited to the user's own branch without access_all
- **WHEN** a user without `branches:access_all` and with `branchId` set to "ZARIOZ" opens the branch selector in the Precios tab
- **THEN** the selector shows only "ZARIOZ" — no other active branches and no "todas las sucursales" option

#### Scenario: Branch selector lists every branch with access_all
- **WHEN** a user with `branches:access_all` (e.g. `admin`) opens the branch selector in the Precios tab
- **THEN** the selector shows every active branch, with the headquarters branch selected by default

#### Scenario: User without an assigned branch cannot manage prices
- **WHEN** a user without `branches:access_all` and with `branchId: null` opens the Precios tab
- **THEN** an empty state explains that a branch assignment is required and no price request is dispatched

#### Scenario: Branch-scope 403 shows a translated error instead of the raw backend text
- **WHEN** a price create/update request fails with a 403 response whose `required` field is `"branches:access_all"`
- **THEN** the error banner shows "No puedes crear precios para otra sucursal." instead of the raw "Forbidden" text from the backend

### Requirement: Product dosifications management in the Dosificaciones tab
The "Dosificaciones" tab SHALL list the product's dosifications via `GET /api/v1/admin/products/:id/dosifications?branchId=<id>`, using the same branch selection as the Precios tab, in a table with columns: `Nombre`, `Partes` (`numParts`), `Precio unitario` (`computedUnitPrice` as currency, or the notice "Requiere precio default en esta sucursal" when `requiresDefaultPrice === true`), `Estado` (badge), and `Acciones`. A "Nueva dosificación" button (gated by `products:write`) SHALL open a `ProductDosificationModal`; rows SHALL offer "Editar" and "Eliminar" (soft delete with `ConfirmDialog`) plus "Reactivar" for inactive rows. The modal SHALL validate `name` (required) and `numParts >= 2`. When the user lacks `products:write`, the table SHALL render read-only with a caption "Solo lectura — requiere products:write".

#### Scenario: Unit price reflects the selected branch's default price
- **WHEN** the product has a default price of `100.00` in the selected branch and a dosification with `numParts=10`
- **THEN** the "Precio unitario" column shows the value computed from that branch's default price

#### Scenario: Branch without default price shows the notice
- **WHEN** the selected branch has no default price for the product
- **THEN** the row shows "Requiere precio default en esta sucursal" instead of a currency value, even if another branch does have a default price
