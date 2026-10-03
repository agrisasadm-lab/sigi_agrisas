# Spec: Products UI

## Purpose

Pantalla de gestión del catálogo de productos (`/catalogs/products`) con listado paginado, búsqueda server-side, filtro por departamento, toggle de inactivos, modal de creación/edición, y vista de detalle en `/catalogs/products/[id]` con tres tabs (General / Precios / Dosificaciones) para gestionar el agregado completo (precios y dosificaciones) sin modales anidados.

---
## Requirements
### Requirement: Products list screen with server-side search and department filter
The system SHALL provide a screen at `/catalogs/products` that lists products in a paginated table connected to `GET /api/v1/admin/products`. The screen SHALL require the `products:read` permission (gated via `useCurrentUser().can("products:read")`). The toolbar SHALL include: a search input that submits its value to the backend `?search=` query parameter (server-side search) with a 300 ms debounce and a caption "Búsqueda en servidor · 2+ caracteres"; a department `<select>` filter that adds `?departmentId=` to the request and whose options are loaded once via `useDepartmentsOptions()`; a `Switch` "Mostrar inactivos" that toggles `?includeInactive=true`; and a button "Nuevo producto" gated by `products:write`. The table SHALL show columns: `Código` (font-mono), `Nombre`, `Departamento` (the `departmentName`), `Unidad`, `IVA` (the `ivaRate` rendered as percentage `"16%"` or `"—"` when null), `IEPS` (same rule), `Sujeto a impuestos` (badge "Sí"/"No" basado en `isTaxable`), `Estado` (badge "Activo"/"Inactivo"), y `Acciones`. Pagination SHALL follow the same shape as the other catalogs (`page`, `pageSize`, total count, page selector; max 50 in UI). The actions column SHALL only render when the user has `products:write`, except for the "Gestionar" action which navigates to the detail and SHALL always render for `products:read` users.

#### Scenario: Authorized user loads the products list
- **WHEN** an authenticated user with `products:read` navigates to `/catalogs/products`
- **THEN** the screen renders the toolbar, table, and pagination, and a `GET /api/v1/admin/products?page=1&pageSize=20` request is dispatched

#### Scenario: Authorized user loads the products list with isTaxable column
- **WHEN** an authenticated user with `products:read` navigates to `/catalogs/products`
- **THEN** the table renders a column "Sujeto a impuestos" showing badge "Sí" for `isTaxable: true` and "No" for `isTaxable: false`

#### Scenario: Search shorter than 2 characters does not fetch
- **WHEN** the user types `"a"` in the search input
- **THEN** no `?search=` parameter is sent and a conditional hint "Mínimo 2 caracteres" appears below the input

#### Scenario: Search with 2+ characters fetches debounced
- **WHEN** the user types `"glifo"` in the search input
- **THEN** after 300 ms a `GET /api/v1/admin/products?page=1&pageSize=20&search=glifo` request is dispatched, replacing any in-flight request

#### Scenario: Department filter narrows the list
- **WHEN** the user selects a department in the filter `<select>`
- **THEN** the next list request adds `?departmentId=<id>` and resets the page to 1

#### Scenario: Toggle inactive
- **WHEN** the user enables the "Mostrar inactivos" switch
- **THEN** the next list request adds `?includeInactive=true`

#### Scenario: IVA and IEPS rendered as percentage
- **WHEN** a row has `ivaRate === 0.16` and `iepsRate === null`
- **THEN** the IVA cell renders `"16%"` and the IEPS cell renders `"—"`

#### Scenario: Viewer cannot see write actions
- **WHEN** an authenticated user with only `products:read` opens the screen
- **THEN** the "Nuevo producto" button and the write actions (Editar/Eliminar) are not rendered, but the "Gestionar" action is still rendered

#### Scenario: User without products:read sees no access
- **WHEN** an authenticated user without `products:read` navigates to `/catalogs/products`
- **THEN** the screen renders an empty/forbidden state without dispatching the list request

#### Scenario: Empty result renders empty state
- **WHEN** the response has `total === 0`
- **THEN** the screen renders an `EmptyState` "No hay productos" instead of the table

---

### Requirement: Product create/edit modal
The system SHALL provide a single modal component `ProductEditModal` that handles both creation and edition based on a `mode` prop (`"create" | "edit"`). The modal SHALL render the editable fields: `code`, `name`, `departmentId` (a `<select>` of active departments), `unit`, `satProductCode`, `ivaRate` (numeric input with `%` suffix), `iepsRate` (numeric input with `%` suffix), `acquisitionPrice` (numeric input labeled "Precio de adquisición", no suffix, ≥ 0, empty → `null`), `isActive`, and `isTaxable` (toggle/checkbox labeled "Sujeto a impuestos", default unchecked = false). The `code` field SHALL be uppercase-forced as the user types and SHALL be disabled in `edit` mode. In `edit` mode `isTaxable` and `acquisitionPrice` SHALL be pre-filled from the loaded entity. In both modes `isTaxable` SHALL submit as boolean. In `edit` mode the save button SHALL be disabled when the diff against the loaded entity is empty. In `create` mode the save button SHALL be enabled when required fields (`code`, `name`, `departmentId`, `unit`) are filled and pass client validation. Validation SHALL mirror the backend: `code` `^[A-Z0-9_]{1,32}$`, `satProductCode` `^\d{8}$` (when present), `ivaRate`/`iepsRate` numeric 0–100 (or empty → null), `acquisitionPrice` numeric ≥ 0 (or empty → null). Validation errors SHALL be shown inline in Spanish. The `ivaRate`/`iepsRate` values SHALL be submitted as percentages (the backend normalizes values `> 1` to decimal); an empty tax field SHALL be submitted as `null`.

#### Scenario: Create mode defaults isTaxable to false
- **WHEN** the modal opens in `mode="create"`
- **THEN** the "Sujeto a impuestos" toggle is unchecked by default

#### Scenario: Edit mode pre-fills isTaxable
- **WHEN** the modal opens in `mode="edit"` with `entity.isTaxable = true`
- **THEN** the "Sujeto a impuestos" toggle is checked

#### Scenario: Toggle submits boolean
- **WHEN** the user checks the "Sujeto a impuestos" toggle and saves
- **THEN** the request body includes `isTaxable: true`

#### Scenario: Create mode renders required fields editable
- **WHEN** the modal opens in `mode="create"`
- **THEN** `code` is enabled, the department `<select>` lists active departments, and `isActive` defaults to `true`

#### Scenario: Edit mode locks code
- **WHEN** the modal opens in `mode="edit"` with an `entity`
- **THEN** the `code` field is rendered disabled and pre-filled; the other fields are pre-filled and editable

#### Scenario: code is uppercase-forced
- **WHEN** the user types `"prod_001"` in `code`
- **THEN** the field renders `"PROD_001"` immediately

#### Scenario: Invalid satProductCode client-side
- **WHEN** the user types `"123"` in `satProductCode` and tries to submit
- **THEN** the modal shows an inline error "Código SAT inválido. Debe tener 8 dígitos." and does not dispatch the request

#### Scenario: Tax fields submitted as percentage
- **WHEN** the user enters `16` in the IVA field and submits
- **THEN** the request body sends `{ "ivaRate": 16 }` (the backend normalizes to `0.16`)

#### Scenario: Empty tax field submitted as null
- **WHEN** the user clears the IEPS field and submits
- **THEN** the request body sends `{ "iepsRate": null }`

#### Scenario: Edit mode pre-fills acquisitionPrice
- **WHEN** the modal opens in `mode="edit"` with `entity.acquisitionPrice = 45.5`
- **THEN** the "Precio de adquisición" field shows `45.5`

#### Scenario: acquisitionPrice submitted as number
- **WHEN** the user enters `52.3` in "Precio de adquisición" and submits
- **THEN** the request body sends `{ "acquisitionPrice": 52.3 }`

#### Scenario: Empty acquisitionPrice submitted as null
- **WHEN** the user clears "Precio de adquisición" and submits
- **THEN** the request body sends `{ "acquisitionPrice": null }`

#### Scenario: Negative acquisitionPrice rejected client-side
- **WHEN** the user types `-5` in "Precio de adquisición" and tries to submit
- **THEN** the modal shows an inline error and does not dispatch the request

#### Scenario: Empty diff in edit disables save
- **WHEN** the modal is in `edit` mode and no field has changed
- **THEN** the save button is disabled

#### Scenario: 409 on duplicate code shows inline error
- **WHEN** the user submits a `code` already in use and the backend returns 409
- **THEN** the modal stays open and an inline error "Este código ya está en uso." appears under the `code` field

#### Scenario: 400 on inactive/invalid department shows inline error
- **WHEN** the user submits with a `departmentId` that the backend rejects as not found or inactive (400)
- **THEN** the modal stays open and an inline error "El departamento no existe o está inactivo." appears under the department field

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


### Requirement: Product prices management in the Precios tab
The "Precios" tab SHALL show a branch selector above the prices table: "Precio base (todas)" (default selection) plus one option per active branch **the user is authorized to select**. When the user has `branches:access_all`, the selector SHALL list "Precio base (todas)" plus one option per active branch (unchanged from prior behavior). When the user does NOT have `branches:access_all`, the selector SHALL list "Precio base (todas)" plus only the user's own assigned branch (`branchId` from `useCurrentUser()`); if the user has no assigned branch, the selector SHALL show only "Precio base (todas)". Selecting "Precio base" dispatches `GET /api/v1/admin/products/:id/prices` (no `branchId`) and lists only base prices. Selecting a branch dispatches `GET /api/v1/admin/products/:id/prices?branchId=<id>` and lists that branch's effective prices (its own overrides plus inherited base rows).

The table columns are: `Nombre`, `Precio` (currency), `Cantidad mín.` (`minQuantity`), `Descuento` (`discountPct` as `"%"` or `"—"`), `Default` (a badge on the default row of the selected bucket), `Origen` (badge "Base" or "Override <sucursal>" driven by the DTO's `isOverride`), and `Acciones`. A "Nuevo precio" button (gated by `products:write`) SHALL open a `ProductPriceModal` for creation, pre-filling `branchId` with the currently selected branch (or `null` for "Precio base"). Rows SHALL offer "Editar" and "Eliminar" (hard delete with `ConfirmDialog`); when a branch is selected and the row shown is an inherited base row (`isOverride: false`), the row action SHALL instead read "Crear override aquí" — editing an inherited row is not possible without first materializing an override for that branch. The modal SHALL validate `name` (required), `price >= 0`, `minQuantity >= 1`, `discountPct` 0–100 (or empty → null), and `isDefault` (boolean); `branchId` is not editable once a price is created. After any mutation that changes the default price, the table SHALL re-fetch so the moved default badge is reflected. When the user lacks `products:write`, the table SHALL render read-only with a caption "Solo lectura — requiere products:write". When a price mutation fails with a 403 whose `required` field is `"branches:access_all"` (the backend's branch-scope guard), the error banner SHALL show "No puedes crear precios para otra sucursal." instead of the raw backend error text.

#### Scenario: Prices table lists prices with default badge
- **WHEN** the Precios tab opens for a product with prices
- **THEN** a `GET /api/v1/admin/products/:id/prices` request is dispatched and the row with `isDefault === true` shows a "Default" badge

#### Scenario: Create a price
- **WHEN** a user with `products:write` clicks "Nuevo precio", fills `name` and `price`, and submits
- **THEN** a `POST /api/v1/admin/products/:id/prices` request is dispatched and the table refreshes with the new row

#### Scenario: Duplicate price name shows inline error
- **WHEN** the user submits a price `name` already used by the product and the backend returns 409
- **THEN** the modal stays open and an inline error "Ya existe un precio con ese nombre." appears under the `name` field

#### Scenario: Second default price on create shows inline error
- **WHEN** the user submits a new price with `isDefault: true` while the product already has a default and the backend returns 409
- **THEN** the modal stays open and an inline error "El producto ya tiene un precio default." appears

#### Scenario: Setting a new default reflows the badge
- **WHEN** the user edits a non-default price to `isDefault: true` and the backend accepts it (the previous default is deactivated)
- **THEN** the table re-fetches and the "Default" badge moves to the edited row

#### Scenario: Delete a price with confirmation
- **WHEN** the user clicks "Eliminar" on a price row and confirms the dialog
- **THEN** a `DELETE /api/v1/admin/products/:id/prices/:priceId` request is dispatched and the row disappears

#### Scenario: Viewer sees prices read-only
- **WHEN** a user with only `products:read` opens the Precios tab
- **THEN** the "Nuevo precio" button and row actions are not rendered and a "Solo lectura — requiere products:write" caption is shown

#### Scenario: Select a branch shows its effective prices
- **WHEN** the user selects "Zarioz" from the branch selector for a product with a Zarioz override on "Precio Publico"
- **THEN** a `GET .../prices?branchId=<Zarioz>` request is dispatched and the "Precio Publico" row shows the override value with an "Override Zarioz" badge

#### Scenario: Inherited row shows base value and offers to create an override
- **WHEN** a branch is selected and a price name has no override for that branch
- **THEN** the row shows the base value with a "Base" badge, and its row action reads "Crear override aquí" instead of "Editar"/"Eliminar"

#### Scenario: Creating an override from a branch view pre-fills branchId
- **WHEN** the user clicks "Crear override aquí" on an inherited row while "Huajuapan" is selected
- **THEN** `ProductPriceModal` opens pre-filled with that price's `name` and `branchId: <Huajuapan>`, ready to submit a new override

#### Scenario: Switching back to "Precio base" shows only global prices
- **WHEN** the user switches the selector from a branch back to "Precio base (todas)"
- **THEN** a `GET .../prices` request without `branchId` is dispatched and only base rows (`branchId: null`) are shown

#### Scenario: Branch selector is limited to the user's own branch without access_all
- **WHEN** a user without `branches:access_all` and with `branchId` set to "ZARIOZ" opens the branch selector in the Precios tab
- **THEN** the selector shows only "Precio base (todas)" and "ZARIOZ" — no other active branches are listed

#### Scenario: Branch selector stays unfiltered with access_all
- **WHEN** a user with `branches:access_all` (e.g. `admin`) opens the branch selector in the Precios tab
- **THEN** the selector shows "Precio base (todas)" plus every active branch, unchanged from prior behavior

#### Scenario: User without an assigned branch sees only the base option
- **WHEN** a user without `branches:access_all` and with `branchId: null` opens the branch selector in the Precios tab
- **THEN** the selector shows only "Precio base (todas)" — no branch-specific option is listed

#### Scenario: Branch-scope 403 shows a translated error instead of the raw backend text
- **WHEN** a price create/update request fails with a 403 response whose `required` field is `"branches:access_all"`
- **THEN** the error banner shows "No puedes crear precios para otra sucursal." instead of the raw "Forbidden" text from the backend

### Requirement: Product dosifications management in the Dosificaciones tab
The "Dosificaciones" tab SHALL list the product's dosifications via `GET /api/v1/admin/products/:id/dosifications` in a table with columns: `Nombre`, `Partes` (`numParts`), `Precio unitario` (`computedUnitPrice` as currency, or the notice "Requiere precio default" when `requiresDefaultPrice === true`), `Estado` (badge), and `Acciones`. A "Nueva dosificación" button (gated by `products:write`) SHALL open a `ProductDosificationModal`; rows SHALL offer "Editar" and "Eliminar" (soft delete with `ConfirmDialog`) plus "Reactivar" for inactive rows. The modal SHALL validate `name` (required) and `numParts >= 2`. When the user lacks `products:write`, the table SHALL render read-only with a caption "Solo lectura — requiere products:write".

#### Scenario: Dosifications table shows computed unit price
- **WHEN** the Dosificaciones tab opens for a product that has a default price
- **THEN** each row shows its `computedUnitPrice` formatted as currency

#### Scenario: Dosification without default price shows notice
- **WHEN** a dosification has `requiresDefaultPrice === true` and `computedUnitPrice === null`
- **THEN** the "Precio unitario" cell renders the notice "Requiere precio default" instead of a number

#### Scenario: Create a dosification
- **WHEN** a user with `products:write` clicks "Nueva dosificación", enters `name` and `numParts = 4`, and submits
- **THEN** a `POST /api/v1/admin/products/:id/dosifications` request is dispatched and the table refreshes

#### Scenario: numParts below 2 is rejected client-side
- **WHEN** the user enters `numParts = 1` and tries to submit
- **THEN** the modal shows an inline error "El número de partes debe ser al menos 2." and does not dispatch the request

#### Scenario: Duplicate dosification name shows inline error
- **WHEN** the user submits a dosification `name` already used by the product and the backend returns 409
- **THEN** the modal stays open and an inline error "Ya existe una dosificación con ese nombre." appears under the `name` field

#### Scenario: Soft delete and reactivate
- **WHEN** the user clicks "Eliminar" on an active dosification and confirms, then later clicks "Reactivar" on the inactive row
- **THEN** a `DELETE .../dosifications/:id` is dispatched first (badge → "Inactivo"), and a `PATCH .../dosifications/:id` with `{ "isActive": true }` is dispatched on reactivate (badge → "Activo")

---

### Requirement: Product image upload field in General tab
The "General" tab of the product detail (`/catalogs/products/[id]`) and the `ProductEditModal` (in both `create` and `edit` modes) SHALL render an `ImageUploadField` molecule that allows the user to upload, replace, or remove the product image. The field is **optional**: products can be saved without an image. It is gated by `products:write` (rendered read-only otherwise).

Behavior:
- A drop zone with label "Arrastra o haz click para subir" accepts image files.
- A preview SHALL be shown immediately after selection (using `URL.createObjectURL`).
- Client-side validation: MIME must be `image/jpeg`, `image/png`, or `image/webp`. Size must be ≤ 2 MB. Violations show inline error in Spanish and prevent dispatch.
- A "Eliminar imagen" button appears when the product already has an `imageUrl`; on click, dispatches `DELETE /api/v1/admin/products/:id/image` (after `ConfirmDialog`).
- On selection of a valid file, dispatches `POST /api/v1/admin/products/:id/image` as multipart; on success, the field reflects the new URL and the parent component re-fetches the product so the new image propagates to thumbnails elsewhere.
- In `create` mode the upload SHALL be deferred until the product exists (the modal first creates the product, then if a file was staged, dispatches the upload).
- When `imageUrl === null`, the placeholder SHALL render `<span className="material-symbols-outlined">image_not_supported</span>` over the `surface-container` background.

#### Scenario: Field renders in General tab
- **WHEN** a user with `products:write` opens the General tab
- **THEN** the `ImageUploadField` is visible with either the current image preview or the placeholder

#### Scenario: Viewer sees read-only field
- **WHEN** a user without `products:write` opens the General tab
- **THEN** the field renders without upload/delete actions (preview only or placeholder)

#### Scenario: Invalid MIME rejected client-side
- **WHEN** the user selects a `.pdf` file
- **THEN** an inline error "Formato no permitido. Usa JPG, PNG o WebP." is shown and no request is dispatched

#### Scenario: File too large rejected client-side
- **WHEN** the user selects a file larger than 2 MB
- **THEN** an inline error "La imagen excede 2 MB." is shown and no request is dispatched

#### Scenario: Successful upload updates preview
- **WHEN** the user selects a valid 800 KB JPG and the backend responds 200
- **THEN** the preview updates to the new public URL and the parent component re-fetches the product

#### Scenario: Delete image with confirmation
- **WHEN** the user clicks "Eliminar imagen" and confirms the dialog
- **THEN** `DELETE /api/v1/admin/products/:id/image` is dispatched, the field reverts to the placeholder, and the product is re-fetched

#### Scenario: Create mode defers upload
- **WHEN** the user opens `ProductEditModal` in `create` mode, stages an image, and submits the form
- **THEN** the modal first creates the product (`POST /products`), then uploads the staged image (`POST /products/:newId/image`), then closes; if the upload fails, the modal shows a warning ("Producto creado pero la imagen no pudo subirse") and stays open

---

### Requirement: Product thumbnail in list and detail header
The product list (`ProductsTable` at `/catalogs/products`) SHALL render a thumbnail column showing each product's image (40x40 px, rounded, `object-cover`) using the `ProductImage` atom. The product detail header (`/catalogs/products/[id]`) SHALL render a larger thumbnail (96x96 px) next to the `code`/`name`. When `imageUrl === null`, the `ProductImage` atom SHALL render the Material Symbol `image_not_supported` centered on a `surface-container` background; it MUST NOT issue HTTP requests or break the layout.

#### Scenario: Thumbnail rendered in list
- **WHEN** the products list renders an item with `imageUrl !== null`
- **THEN** an `<img>` with `loading="lazy"`, `width="40"`, `height="40"`, `className="rounded object-cover"` and the `imageUrl` as `src` is rendered as the first column

#### Scenario: Placeholder rendered in list
- **WHEN** the products list renders an item with `imageUrl === null`
- **THEN** the placeholder Material Symbol `image_not_supported` is shown in a 40x40 `surface-container` square

#### Scenario: Detail header thumbnail
- **WHEN** the detail screen loads with `imageUrl !== null`
- **THEN** a 96x96 thumbnail is rendered next to the `code`/`name` header

#### Scenario: Detail header placeholder
- **WHEN** the detail screen loads with `imageUrl === null`
- **THEN** the 96x96 placeholder Material Symbol is shown

#### Scenario: ProductImage never blocks render
- **WHEN** the `imageUrl` returns 404 or fails to load
- **THEN** the atom catches the error via `onError` and swaps to the placeholder without breaking the page

---

### Requirement: Product image services (client)
The frontend SHALL expose two services in `app/(private)/catalogs/products/_logic/services/`: `uploadProductImage(productId, file, fetchImpl?)` and `deleteProductImage(productId, fetchImpl?)`. They SHALL wrap `authFetch`, normalize HTTP errors to typed module errors (`ProductImageTooLargeError`, `ProductImageInvalidFormatError`, `ProductNotFoundError`), and accept an injectable `fetchImpl` for tests.

#### Scenario: uploadProductImage sends multipart
- **WHEN** the service is invoked with a valid `File`
- **THEN** the request is a `POST` with `Content-Type: multipart/form-data` and a `file` field; on success returns `{ imageUrl: string }`

#### Scenario: 413 maps to ProductImageTooLargeError
- **WHEN** the backend returns 413
- **THEN** the service throws `ProductImageTooLargeError(maxBytes: 2097152)`

#### Scenario: 400 invalid format maps to typed error
- **WHEN** the backend returns 400 with `{"error": "Invalid image format"}`
- **THEN** the service throws `ProductImageInvalidFormatError()`

#### Scenario: deleteProductImage idempotent
- **WHEN** the service is invoked for a product that has no image
- **THEN** the request returns 204 and the service resolves successfully

---

### Requirement: Typed service errors and frontend error mapping for products
The system SHALL expose service functions in `app/(private)/catalogs/products/_logic/services/` (`listProducts`, `getProduct`, `createProduct`, `updateProduct`, `softDeleteProduct`, `listPrices`, `createPrice`, `updatePrice`, `deletePrice`, `listDosifications`, `createDosification`, `updateDosification`, `softDeleteDosification`) that map HTTP responses to typed errors in `_logic/errors.ts`: `ProductNotFoundError` (404), `ProductCodeAlreadyInUseError` (409 with "code already in use"), `ProductDepartmentInvalidError` (400 with "Department not found or inactive"), `DuplicatePriceNameError` (409 with "price named"), `DuplicateDefaultPriceError` (409 with "already has a default price"), `DuplicateDosificationNameError` (409 with "dosification named"). Services SHALL accept an optional `fetchImpl` parameter and SHALL convert `createdAt`/`updatedAt` strings into `Date` instances before returning.

#### Scenario: 404 mapped on getProduct
- **WHEN** `getProduct({ id: "missing" })` is invoked and the backend returns 404
- **THEN** the call rejects with `ProductNotFoundError`

#### Scenario: 409 code mapped on createProduct
- **WHEN** `createProduct({ body })` is invoked with a duplicate `code` and the backend returns 409
- **THEN** the call rejects with `ProductCodeAlreadyInUseError`

#### Scenario: 400 invalid department mapped on createProduct
- **WHEN** `createProduct({ body })` is invoked with an inactive/missing department and the backend returns 400 "Department not found or inactive"
- **THEN** the call rejects with `ProductDepartmentInvalidError`

#### Scenario: 409 default price mapped on createPrice
- **WHEN** `createPrice(...)` is invoked with a second default and the backend returns 409 "Product already has a default price"
- **THEN** the call rejects with `DuplicateDefaultPriceError`

#### Scenario: Dates parsed in list response
- **WHEN** `listProducts(...)` receives a response with ISO date strings
- **THEN** each item's `createdAt` and `updatedAt` are instances of `Date`

#### Scenario: fetchImpl injection for tests
- **WHEN** a service is invoked with a `fetchImpl` mock
- **THEN** the service uses that mock instead of the global `authFetch`

---

### Requirement: useProducts hook with cancellation and useDepartmentsOptions
The system SHALL expose a hook `useProducts({ page, pageSize, search, departmentId, includeInactive })` that fetches the products list whenever any parameter changes, cancelling any in-flight request via `AbortController` on param change and on unmount, returning `{ items: Product[], total: number, isLoading: boolean, error: string | null, refresh: () => void }`. The `search` SHALL arrive already-debounced from the caller. The system SHALL also expose `useDepartmentsOptions()` returning `{ options: { id: string; name: string }[], isLoading: boolean }`, loading active departments once and caching the result at module level.

#### Scenario: Initial load
- **WHEN** `useProducts` mounts with default params
- **THEN** a fetch is dispatched and `isLoading` is `true` until it resolves

#### Scenario: Param change cancels previous request
- **WHEN** the `departmentId` changes while a previous request is still in flight
- **THEN** the previous request is aborted and a new request is dispatched

#### Scenario: Unmount cancels in-flight
- **WHEN** the component unmounts while a request is in flight
- **THEN** the request is aborted

#### Scenario: Department options cached at module level
- **WHEN** `useDepartmentsOptions()` is used by two components within the cache TTL
- **THEN** only one `GET /api/v1/admin/departments` request is dispatched and both receive the cached options

---

### Requirement: Provider column in products table
`ProductsTable` SHALL include a "Proveedor" column displaying `providerName` or "—" if null. Column positioned after "Departamento".

#### Scenario: Products table shows provider name
- **WHEN** a product's department belongs to a provider
- **THEN** "Proveedor" column shows the provider name

#### Scenario: Products table shows dash for no provider
- **WHEN** `providerName` is null
- **THEN** "Proveedor" column shows "—"

---

### Requirement: Provider filter in products page
`ProductsPage` toolbar SHALL include a "Proveedor" Combobox filter. Selecting a provider populates the "Departamento" filter with departments belonging to that provider (fetched via `GET /departments?providerId=<uuid>&pageSize=100`). Changing the provider filter clears the departmentId filter. Clearing the provider filter restores all departments.

#### Scenario: Select provider filters departments combobox
- **WHEN** user selects a provider in the toolbar
- **THEN** the department combobox updates to show only that provider's departments; previous department filter is cleared

#### Scenario: Clear provider restores all departments
- **WHEN** user clears the provider combobox
- **THEN** department combobox reloads with all active departments

---

### Requirement: Provider field derived in product form
`ProductGeneralTab` (and `ProductEditModal`) SHALL show a read-only "Proveedor" field that auto-populates when a department is selected (derived from `department.providerName`). The field is display-only and is not sent in the POST/PATCH body.

#### Scenario: Department selected shows provider
- **WHEN** user selects a department with an associated provider
- **THEN** the "Proveedor" read-only field shows the provider's name

#### Scenario: Department with no provider shows empty
- **WHEN** selected department has `providerId: null`
- **THEN** "Proveedor" field shows "Sin proveedor"

---

### Requirement: Provider field in department form
`DepartmentEditModal` SHALL include a "Proveedor" Combobox (required for new departments). The combobox fetches active providers (using an existing `useProvidersOptions` hook or equivalent). On edit, shows the current provider and allows changing. Existing departments with `providerId: null` show "Sin proveedor" and prompt the user to assign one.

#### Scenario: Create department requires provider
- **WHEN** user submits create form without selecting a provider
- **THEN** inline validation error "El proveedor es obligatorio"

#### Scenario: Edit department shows current provider
- **WHEN** user opens edit modal for a department with a provider
- **THEN** combobox is pre-selected with the current provider

#### Scenario: Department table shows provider column
- **WHEN** user views the departments table
- **THEN** a "Proveedor" column shows `providerName` or "—"

---

### Requirement: Tax rate selector in product form
`ProductGeneralTab` (and `ProductEditModal`) SHALL include a tax rate combobox field labeled "Tasa de impuesto" (optional). The combobox fetches active tax rates from `GET /api/v1/admin/tax-rates` (using the `useTaxRatesOptions` hook, analogous to `usePaymentMethodsOptions`). Display format: `"IVA_16 — IVA 16% (16.00%)"`. Clearing the field sends `taxRateId: null` on submit.

#### Scenario: Product form shows tax rate selector
- **WHEN** user opens create or edit product modal
- **THEN** "Tasa de impuesto" combobox appears with active tax rates as options

#### Scenario: Select and save tax rate
- **WHEN** user selects "IVA_16 — IVA 16% (16.00%)" and saves
- **THEN** `taxRateId` is included in the POST/PATCH body

#### Scenario: Clear tax rate
- **WHEN** user clears the combobox and saves
- **THEN** `taxRateId: null` is sent in the PATCH body

---

### Requirement: Tax rate column in products table
`ProductsTable` SHALL include a "Tasa" column that displays `taxRateCode` (e.g., `IVA_16`) or "—" if null. Column positioned after "Proveedor".

#### Scenario: Products table shows tax rate
- **WHEN** a product has `taxRateCode: "IVA_16"`
- **THEN** the "Tasa" column shows "IVA_16"

#### Scenario: Products table shows dash for no rate
- **WHEN** a product has `taxRateCode: null`
- **THEN** the "Tasa" column shows "—"

### Requirement: SAT code selector in product form
`ProductGeneralTab` (y `ProductEditModal`, tanto en `create` como en `edit`) SHALL reemplazar el input de texto libre de `satProductCode` por un combobox con búsqueda (`SatCodeCombobox`), que consulta `GET /api/v1/admin/sat-codes?search=` (mediante un hook `useSatCodesSearch`, con debounce ~300ms) y muestra sugerencias en formato `"<code> — <description>"`. Seleccionar una sugerencia establece `satProductCode` al `code` elegido. El campo SHALL seguir aceptando captura manual de un valor de 8 dígitos que no aparezca en las sugerencias (el catálogo completo tiene 52,513 códigos; el combobox sólo devuelve las 20 mejores coincidencias) — la validación de formato `^\d{8}$` sigue aplicando igual que hoy, tanto cliente como servidor. Limpiar el campo envía `satProductCode: null` igual que el comportamiento actual.

#### Scenario: Búsqueda de código SAT por nombre muestra sugerencias
- **WHEN** el administrador escribe "fertilizante" en el campo "Cód. SAT"
- **THEN** aparece una lista de sugerencias `"<code> — <description>"` provenientes de `GET /api/v1/admin/sat-codes?search=fertilizante`

#### Scenario: Búsqueda por código muestra sugerencias
- **WHEN** el administrador escribe un fragmento de código (ej. "10191") en el campo "Cód. SAT"
- **THEN** aparece una lista de sugerencias cuyo `code` contiene "10191"

#### Scenario: Listado SAT visible en crear y editar producto
- **WHEN** el administrador abre `ProductEditModal` en `mode="create"` o `mode="edit"`
- **THEN** el campo "Cód. SAT" es el `SatCodeCombobox` y abre el listado de sugerencias al enfocar/escribir, en ambos modos

#### Scenario: Edit mode pre-filla el código guardado y permite re-buscar
- **WHEN** el administrador abre el modal en `edit` con un producto que tiene `satProductCode = "01010101"`
- **THEN** el campo muestra "01010101" pre-cargado y sigue permitiendo buscar/seleccionar otro código del listado

#### Scenario: Seleccionar una sugerencia completa el campo
- **WHEN** el administrador selecciona una sugerencia de la lista
- **THEN** `satProductCode` se establece al `code` de esa sugerencia y la lista se cierra

#### Scenario: Captura manual sigue permitida
- **WHEN** el administrador escribe directamente 8 dígitos que no coinciden con ninguna sugerencia
- **THEN** el campo acepta el valor igual que el input de texto libre anterior, sujeto a la misma validación `^\d{8}$`

#### Scenario: Búsqueda con menos de 2 caracteres no muestra sugerencias
- **WHEN** el administrador escribe 1 carácter en el campo
- **THEN** no se muestra la lista de sugerencias (mínimo de 2 caracteres, igual que el endpoint)

#### Scenario: Limpiar el campo envía null
- **WHEN** el administrador borra el campo por completo y guarda
- **THEN** la solicitud envía `satProductCode: null`, igual que el comportamiento previo a este change

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

