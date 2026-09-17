# Spec: products-api

## Purpose

Define the Products API: CRUD endpoints for the product catalog (SKUs), sub-resource management for prices and dosifications, and the domain service for computing dosification unit prices.

---
## Requirements
### Requirement: List products
The system SHALL expose `GET /api/v1/admin/products` that returns a paginated list of products. Requires the `products:read` permission. Query parameters control the result set: `page` (default 1), `pageSize` (default 20, max 100), `includeInactive` (default `false`), `search` (optional, min 2 chars when present; matches `name` OR `code` via `OR ILIKE '%search%'`), `departmentId` (optional UUID filter), `branchId` (optional UUID). Response: `{ items: ProductDto[], total: number, page: number, pageSize: number }`. Each `ProductDto` includes `id`, `code`, `name`, `unit` (clave SAT `c_ClaveUnidad`), `unitDescription` (string or `null` — human-readable description resolved against the SAT unit-of-measure catalog; `null` if `unit` does not match any catalog entry), `satProductCode` (string or `null`), `departmentId`, `departmentName` (joined), `ivaRate` (decimal 0–1 or `null`), `iepsRate` (decimal 0–1 or `null`), `imageUrl` (string or `null`), `isTaxable` (boolean), `isActive`, `createdAt`, `updatedAt`, and `stock: number | null`. Results ordered by `createdAt DESC`.

**`stock` field**: when the request includes `branchId`, the system SHALL join `branch_inventory` filtered by `(branch_id = branchId, product_id = product.id)` (unique pair) and set `stock = branch_inventory.quantity` for that product, or `stock = null` if no `branch_inventory` row exists for that pair. When the request omits `branchId`, `stock` is always `null` (no branch context to resolve stock against). This does NOT require the `inventory:read` permission — `products:read` alone is sufficient, since it is the same list endpoint, only enriched with an extra field.

**Branch scope mode (`inventory-api` — Configurable inventory scope mode)**: when the deployment's inventory scope mode is `branch` AND the request includes `branchId`, the endpoint additionally SHALL filter the result set — not just the `stock` field — to only products that have a `branch_inventory` row for that `branchId` (a row with `quantity = 0` still counts as present; the row represents assignment, not just quantity). The `total` count SHALL reflect this filter. `branchId` is resolved server-side per branch scoping (`rbac` — `branches:access_all` bypass semantics): a caller without the bypass permission is forced to their own `x-user-branch-id`; a caller with the bypass and no `branchId` sees the unfiltered catalog. When the scope mode is `general` (the default), `branchId` continues to affect ONLY the `stock` field, exactly as before this change — the result set is never filtered.

#### Scenario: Admin lists active products
- **WHEN** an authenticated user with `products:read` sends `GET /api/v1/admin/products`
- **THEN** the system returns HTTP 200 with active products only, includes `departmentName` joined from the `departments` table, and each item includes `imageUrl` (string URL or `null`) and `isTaxable: boolean`

#### Scenario: Search by code and name
- **WHEN** the request includes `?search=ARROZ`
- **THEN** the response includes any product whose `name` or `code` contains `ARROZ` case-insensitively

#### Scenario: Filter by department
- **WHEN** the request includes `?departmentId=<uuid>`
- **THEN** the response includes only products whose `department_id` matches

#### Scenario: Search shorter than 2 chars rejected
- **WHEN** the request includes `?search=a`
- **THEN** the system returns HTTP 400

#### Scenario: pageSize exceeds max
- **WHEN** the request includes `?pageSize=200`
- **THEN** the system returns HTTP 400

#### Scenario: Forbidden without permission
- **WHEN** an authenticated user without `products:read` calls the endpoint
- **THEN** the system returns HTTP 403 `{"error": "Forbidden", "required": "products:read"}`

#### Scenario: branchId present returns stock per product (general mode)
- **WHEN** the inventory scope mode is `general` (default) and an authenticated user with `products:read` sends `GET /api/v1/admin/products?branchId=<B1>` and product `P1` has a `branch_inventory` row for `(B1, P1)` with `quantity=42`
- **THEN** the response item for `P1` includes `stock: 42`, and every other active product is still present in the list

#### Scenario: branchId present but no inventory row for product (general mode)
- **WHEN** the inventory scope mode is `general` and the request includes `?branchId=<B1>` and product `P2` has no `branch_inventory` row for `(B1, P2)`
- **THEN** the response item for `P2` is still present and includes `stock: null`

#### Scenario: branchId omitted — stock always null
- **WHEN** the request omits `branchId`
- **THEN** every item in the response includes `stock: null`, regardless of any existing `branch_inventory` data

#### Scenario: Invalid branchId format rejected
- **WHEN** the request includes `?branchId=not-a-uuid`
- **THEN** the system returns HTTP 400

#### Scenario: Product with valid SAT code includes resolved description
- **WHEN** a listed product has `unit: "KGM"` and the SAT catalog is seeded
- **THEN** the corresponding item includes `unitDescription: "Kilogramo"`

#### Scenario: Product with legacy data includes unitDescription null
- **WHEN** a listed product has `unit` as free text not captured from the catalog (data prior to this change)
- **THEN** the corresponding item includes `unitDescription: null`

#### Scenario: Branch scope mode excludes unassigned products
- **WHEN** the inventory scope mode is `branch`, the request includes `?branchId=<B1>`, and product `P2` has no `branch_inventory` row for `(B1, P2)`
- **THEN** the response does NOT include `P2`, and `total` does not count it

#### Scenario: Branch scope mode includes assigned product with zero stock
- **WHEN** the inventory scope mode is `branch`, the request includes `?branchId=<B1>`, and product `P3` has a `branch_inventory` row for `(B1, P3)` with `quantity = 0`
- **THEN** the response includes `P3` with `stock: 0`

#### Scenario: Branch scope mode implicitly scopes to the caller's own branch when branchId is omitted
- **WHEN** the inventory scope mode is `branch` and an operator without `branches:access_all` (assigned to `B1`) sends `GET /api/v1/admin/products` without `branchId`
- **THEN** the system resolves the effective `branchId` to `B1` and filters the catalog accordingly (same `resolveScopedBranchId` pattern already used by other list endpoints — `inventory-api`, `sales`, etc.)

#### Scenario: Branch scope mode rejects an explicit mismatched branchId
- **WHEN** the inventory scope mode is `branch` and an operator without `branches:access_all` (assigned to `B1`) sends `GET /api/v1/admin/products?branchId=B2`
- **THEN** the system returns HTTP 403 `{ "error": "Forbidden", "required": "branches:access_all" }` — it does not silently override to `B1`

#### Scenario: Branch scope mode rejects an operator with no assigned branch
- **WHEN** the inventory scope mode is `branch` and an operator without `branches:access_all` and without an assigned branch (`x-user-branch-id` empty) calls the endpoint
- **THEN** the system returns HTTP 403 `{ "error": "Forbidden", "required": "branches:access_all" }`

#### Scenario: Branch scope mode with bypass and no branchId returns the full catalog
- **WHEN** the inventory scope mode is `branch` and an authenticated user with `branches:access_all` sends `GET /api/v1/admin/products` without `branchId`
- **THEN** the system returns the unfiltered catalog, identical to `general` mode behavior

### Requirement: Get product detail
The system SHALL expose `GET /api/v1/admin/products/:id` that returns a single product by UUID. Requires `products:read`. Returns the entity regardless of `isActive`. The response includes `imageUrl: string | null`. Returns HTTP 404 if not found.

#### Scenario: Admin gets product
- **WHEN** the request targets a valid UUID
- **THEN** the system returns HTTP 200 with the `ProductDto` including `imageUrl`

#### Scenario: Product not found
- **WHEN** the `:id` does not match any product
- **THEN** the system returns HTTP 404 `{"error": "Product not found"}`

#### Scenario: Invalid UUID format
- **WHEN** the `:id` is not a valid UUID
- **THEN** the system returns HTTP 400

---

### Requirement: Create product
The system SHALL expose `POST /api/v1/admin/products`. Requires `products:write`. Required body fields:

- `code: string` matching `^[A-Z0-9_]{1,32}$`
- `name: string` (1–200 chars)
- `unit: string` matching `^[A-Za-z0-9]{2,3}$` (SAT unit-of-measure catalog code, `c_ClaveUnidad`; e.g. `"KGM"`, `"H87"`, `"LTR"`)
- `departmentId: string` (UUID of an existing `Department`)

Optional fields:

- `satProductCode: string | null` matching `^\d{8}$`
- `ivaRate: number | null` (decimal 0–1; e.g. `0.16` for 16% — controller accepts also `16` and normalizes to `0.16`)
- `iepsRate: number | null` (same semantics as `ivaRate`)
- `acquisitionPrice: number | null` (decimal ≥ 0, precio de adquisición/costo del producto; default `null`)
- `imageUrl: string | null` (URL https válida, ≤2048 chars; default `null`)
- `isActive: boolean` (default `true`)
- `isTaxable: boolean` (default `false`)

The controller SHALL trim and uppercase `code` before persisting. The controller SHALL validate `isTaxable` as a boolean (non-boolean value → HTTP 400). The controller SHALL validate `unit` against the SAT unit-of-measure code format — this is a format check only (no FK to the catalog table), consistent with `satProductCode`: a full catalog re-seed cannot orphan an existing product's `unit`. Returns HTTP 201 with the new `ProductDto` including `isTaxable` and `acquisitionPrice`, plus `autoAssignedBranchId: string | null` (see auto-assignment below). Duplicate `code` returns HTTP 409. `departmentId` not found returns HTTP 400 (or 422 — implementer's choice, must be documented). When `imageUrl` is provided in `POST` it MUST be a URL pointing to the configured Supabase Storage public bucket (`product-images`); URLs from other origins SHALL be rejected with HTTP 400. The body does NOT accept a `branchId` field — branch assignment on creation, when it happens, is always resolved server-side (see below), never client-supplied.

**Auto-assignment to the caller's own branch (`inventory-api` — Configurable inventory scope mode)**: when the deployment's inventory scope mode is `branch` and the caller does NOT have `branches:access_all`, the system SHALL resolve the caller's own branch from `x-user-branch-id` and, on successful product creation, attempt to create a `branch_inventory` row for `(that branch, the new product)` with `quantity = 0`. This assignment attempt is best-effort: a failure to create the `branch_inventory` row SHALL NOT fail the product creation, SHALL NOT be surfaced as an error to the caller, and SHALL only be logged server-side. The response's `autoAssignedBranchId` reflects the resolved branch the system attempted to assign to (`null` if no attempt was made — caller has `branches:access_all`, has no assigned branch, or the scope mode is `general`), regardless of whether the underlying insert succeeded. When the scope mode is `general`, or the caller has `branches:access_all`, or the caller has no assigned branch, `autoAssignedBranchId` is always `null` and no `branch_inventory` row is created by this endpoint.

#### Scenario: Minimal creation
- **WHEN** the body is `{ "code": "ARROZ_001", "name": "Arroz", "unit": "KGM", "departmentId": "<uuid>" }` with an existing department
- **THEN** the system returns HTTP 201 with `satProductCode`, `ivaRate`, `iepsRate`, `acquisitionPrice`, `imageUrl` all `null` and `isActive: true`

#### Scenario: Minimal creation defaults isTaxable to false
- **WHEN** the body omits `isTaxable`
- **THEN** the system persists `is_taxable = false` and returns `isTaxable: false` in HTTP 201

#### Scenario: Explicit isTaxable true
- **WHEN** the body includes `isTaxable: true`
- **THEN** the system persists `is_taxable = true` and returns `isTaxable: true` in HTTP 201

#### Scenario: Non-boolean isTaxable rejected
- **WHEN** the body includes `isTaxable: "yes"`
- **THEN** the system returns HTTP 400

#### Scenario: Full fiscal creation
- **WHEN** the body includes valid `satProductCode`, `ivaRate: 16`, `iepsRate: 0`
- **THEN** the system persists `iva_rate = 0.16` and `ieps_rate = 0` and returns the product in HTTP 201

#### Scenario: Creation with acquisitionPrice
- **WHEN** the body includes `acquisitionPrice: 45.5`
- **THEN** the system persists `acquisition_price = 45.5000` and returns it in HTTP 201

#### Scenario: Negative acquisitionPrice rejected
- **WHEN** the body includes `acquisitionPrice: -1`
- **THEN** the system returns HTTP 400

#### Scenario: Duplicate code
- **WHEN** the body contains a `code` already in use
- **THEN** the system returns HTTP 409 `{"error": "Product code already in use"}`

#### Scenario: Department not found
- **WHEN** the body's `departmentId` does not match any active department
- **THEN** the system returns HTTP 400 with an error indicating the department is missing

#### Scenario: Invalid satProductCode
- **WHEN** the body contains `satProductCode: "ABC123"` (not 8 digits)
- **THEN** the system returns HTTP 400

#### Scenario: Invalid unit format rejected
- **WHEN** the body contains `unit: "kilogramos"` (free text, does not match the SAT unit code format)
- **THEN** the system returns HTTP 400

#### Scenario: imageUrl from foreign origin rejected
- **WHEN** the body contains `imageUrl: "https://evil.example.com/x.jpg"` (not the configured Supabase Storage bucket)
- **THEN** the system returns HTTP 400 `{"error": "Invalid image URL"}`

#### Scenario: Forbidden
- **WHEN** an authenticated user without `products:write` calls the endpoint
- **THEN** the system returns HTTP 403

#### Scenario: Operator with own branch auto-assigns the new product
- **WHEN** the inventory scope mode is `branch` and an authenticated user without `branches:access_all`, assigned to branch `B1`, creates a product successfully
- **THEN** the system creates a `branch_inventory` row for `(B1, the new product)` with `quantity: 0`, and the response includes `autoAssignedBranchId: "B1"`

#### Scenario: Admin (branches:access_all) does not trigger auto-assignment
- **WHEN** the inventory scope mode is `branch` and an authenticated user with `branches:access_all` creates a product successfully
- **THEN** the system does NOT create any `branch_inventory` row, and the response includes `autoAssignedBranchId: null`

#### Scenario: General mode never auto-assigns
- **WHEN** the inventory scope mode is `general` and any authenticated user creates a product successfully
- **THEN** the system does NOT create any `branch_inventory` row, and the response includes `autoAssignedBranchId: null`

#### Scenario: Operator without an assigned branch does not trigger auto-assignment
- **WHEN** the inventory scope mode is `branch` and an authenticated user without `branches:access_all` and without an assigned branch (`x-user-branch-id` empty) creates a product successfully
- **THEN** the system does NOT create any `branch_inventory` row, and the response includes `autoAssignedBranchId: null` — the product creation itself still succeeds with HTTP 201

#### Scenario: Auto-assignment failure does not fail product creation
- **WHEN** the inventory scope mode is `branch`, the caller is eligible for auto-assignment, and the underlying `branch_inventory` insert fails unexpectedly
- **THEN** the system still returns HTTP 201 with the created product, `autoAssignedBranchId` reflects the resolved branch regardless, and the failure is only logged server-side — never surfaced as an error to the caller

---

### Requirement: Update product
The system SHALL expose `PATCH /api/v1/admin/products/:id`. Requires `products:write`. The body MAY include any of `name`, `unit`, `satProductCode`, `departmentId`, `ivaRate`, `iepsRate`, `acquisitionPrice`, `imageUrl`, `isActive`, `isTaxable`. The field `code` MUST NOT be updatable; if present it SHALL be ignored silently. `unit`, when present, MUST match the SAT unit code format `^[A-Za-z0-9]{2,3}$` (same rule as creation). `isTaxable` MAY be included and SHALL be validated as boolean. `acquisitionPrice`, when present, MUST be a number ≥ 0 or `null`. Body MUST contain at least one updatable field, else HTTP 400. Optional fields set to `null` clear the value. Setting `imageUrl: null` clears the persisted URL but does NOT delete the underlying object in Supabase Storage (use `DELETE /products/:id/image` for that). Setting `imageUrl` to a non-bucket URL SHALL return HTTP 400. Returns HTTP 200 with updated `ProductDto` including `isTaxable` and `acquisitionPrice`.

#### Scenario: Update name and tax
- **WHEN** the body is `{ "name": "Arroz Integral", "ivaRate": 0 }`
- **THEN** the system returns HTTP 200 with the updated entity

#### Scenario: Toggle isTaxable to true
- **WHEN** the body includes `isTaxable: true` on an existing product with `isTaxable: false`
- **THEN** the system returns HTTP 200 with `isTaxable: true`

#### Scenario: Toggle isTaxable to false
- **WHEN** the body includes `isTaxable: false` on an existing product with `isTaxable: true`
- **THEN** the system returns HTTP 200 with `isTaxable: false`

#### Scenario: Clear optional field
- **WHEN** the body is `{ "satProductCode": null }`
- **THEN** the system stores `null` in `sat_product_code` and returns HTTP 200

#### Scenario: Update acquisitionPrice
- **WHEN** the body is `{ "acquisitionPrice": 52.3 }` on an existing product
- **THEN** the system stores `acquisition_price = 52.3000` and returns HTTP 200 with the updated value

#### Scenario: Clear acquisitionPrice
- **WHEN** the body is `{ "acquisitionPrice": null }`
- **THEN** the system stores `null` in `acquisition_price` and returns HTTP 200

#### Scenario: Clear imageUrl preserves storage object
- **WHEN** the body is `{ "imageUrl": null }`
- **THEN** the system stores `null` in `image_url`, returns HTTP 200, and does NOT delete the object from Supabase Storage

#### Scenario: Change department
- **WHEN** the body is `{ "departmentId": "<new-uuid>" }` referring to an existing active department
- **THEN** the system updates the FK and returns HTTP 200

#### Scenario: Empty body
- **WHEN** the body is `{}` or only contains `code`
- **THEN** the system returns HTTP 400

#### Scenario: Product not found
- **WHEN** the `:id` does not match any product
- **THEN** the system returns HTTP 404

### Requirement: Soft delete product
The system SHALL expose `DELETE /api/v1/admin/products/:id` that marks the product as `isActive=false` without removing the row. Requires `products:write`. Returns HTTP 204. Sub-resources (`product_prices`, `product_dosifications`, `branch_inventory`) are NOT cascade-removed by the soft delete (they remain accessible for historical reference).

#### Scenario: Soft delete success
- **WHEN** the request targets an active product
- **THEN** the system returns HTTP 204 and the entity has `is_active = false`

#### Scenario: Reactivate via update
- **WHEN** an admin sends `PATCH /api/v1/admin/products/:id` with `{"isActive": true}` to a previously soft-deleted product
- **THEN** the system returns HTTP 200 with `isActive: true`

#### Scenario: Product not found
- **WHEN** the `:id` does not match any product
- **THEN** the system returns HTTP 404

---

### Requirement: List product prices
El sistema SHALL exponer `GET /api/v1/admin/products/:id/prices`. Requiere `products:read`. Acepta querystring opcional `branchId` (UUID de una sucursal existente; formato inválido → HTTP 400, sucursal inexistente → HTTP 404 `{"error":"Branch not found"}`).

Cada `ProductPrice` tiene un `branchId` (`string | null`): `null` = **precio base** (aplica a toda sucursal sin override propio); no-null = **override** exclusivo de esa sucursal. Cada `ProductPriceDto` incluye `id`, `productId`, `branchId`, `isOverride` (= `branchId !== null`), `name`, `price`, `minQuantity`, `discountPct` (o `null`), `isDefault`, `createdAt`, `updatedAt`.

- **Sin `branchId`**: retorna únicamente los precios base (`branchId: null`) del producto, ordenados por prioridad de negocio (igual que hoy): primero el `isDefault=true`, luego `subdis` (case-insensitive), luego `distri`, luego el resto por `name ASC`.
- **Con `branchId=<uuid>`**: retorna el conjunto **efectivo** para esa sucursal — para cada `name` de precio base, si existe un override de esa sucursal con el mismo `name` se retorna el override (`isOverride: true`); si no, se retorna el base sin cambios (`isOverride: false`). El orden de prioridad de negocio se aplica sobre el conjunto efectivo resultante, no sobre las filas crudas.

#### Scenario: List prices
- **WHEN** an authorized user gets prices for an existing product
- **THEN** the response includes all prices, default first

#### Scenario: Orden de prioridad para descuentos por volumen
- **WHEN** un producto tiene precios "Precio Publico" (`isDefault=true`), "Precio Subdis 10%", "Precio Distri 15%" y "Precio 4"
- **THEN** el orden de la respuesta es exactamente: Precio Publico, Precio Subdis 10%, Precio Distri 15%, Precio 4

#### Scenario: Precios sin patrón conocido van al final por nombre
- **WHEN** un producto tiene un precio no-default cuyo `name` no matchea `subdis` ni `distri` (ej. "General")
- **THEN** ese precio aparece después de los precios "subdis"/"distri" del mismo producto, ordenado alfabéticamente junto a otros precios en la misma situación

#### Scenario: Product not found
- **WHEN** the URL `:id` does not match any product
- **THEN** the system returns HTTP 404

#### Scenario: Precio efectivo por sucursal — override presente
- **WHEN** un producto tiene precio base "Precio Publico" ($3,666.65) y un override para la sucursal ZARIOZ con el mismo nombre ($699.35), y se pide `?branchId=<ZARIOZ>`
- **THEN** la respuesta incluye "Precio Publico" con `price: 699.35`, `branchId: <ZARIOZ>`, `isOverride: true`

#### Scenario: Precio efectivo por sucursal — hereda el base
- **WHEN** un producto tiene precios base "Precio Publico" y "Precio Subdis 10%", y sólo existe override de "Precio Publico" para la sucursal HUAJUAPAN, y se pide `?branchId=<HUAJUAPAN>`
- **THEN** la respuesta incluye "Precio Subdis 10%" con el valor base y `isOverride: false`

#### Scenario: Eliminar un override revierte esa sucursal al base
- **WHEN** existe un override "Precio Publico" para la sucursal ZARIOZ y se elimina vía `DELETE /prices/:priceId`, y luego se pide `GET .../prices?branchId=<ZARIOZ>`
- **THEN** la respuesta muestra "Precio Publico" con el valor base (`isOverride: false`) y las demás sucursales no se ven afectadas

#### Scenario: branchId con formato inválido
- **WHEN** `?branchId=` recibe un valor que no es UUID
- **THEN** the system returns HTTP 400

#### Scenario: branchId de sucursal inexistente
- **WHEN** `?branchId=<uuid>` no corresponde a ninguna sucursal
- **THEN** the system returns HTTP 404 `{"error":"Branch not found"}`

### Requirement: Create product price
The system SHALL expose `POST /api/v1/admin/products/:id/prices`. Requires `products:write`. Required body: `name: string` (1–60 chars), `price: number` (>= 0, max 12 integer digits + 4 decimals). Optional: `minQuantity: number` (integer >= 1, default 1), `discountPct: number | null` (0–100), `isDefault: boolean` (default `false`), `branchId: string | null` (UUID of an active branch; omitted or `null` = base price, applies to every branch without its own override).

Uniqueness and default constraints are scoped per `(productId, branchId)` bucket, treating `branchId: null` as its own bucket distinct from any specific branch:
- A product may have at most ONE price with `isDefault: true` PER bucket (one global default, plus at most one default per branch that has overrides). A second default within the same bucket returns HTTP 409 `{"error": "Product already has a default price"}`.
- Two prices with the same `name` in the same bucket return HTTP 409. The same `name` MAY be reused across different buckets (e.g. a base "Precio Publico" and a ZARIOZ-override "Precio Publico" coexist).

**Branch scoping**: when `branchId` is present (creating an override), a caller without `branches:access_all` MUST pass `branchId === x-user-branch-id`; mismatch returns HTTP 403 `{"error": "Forbidden", "required": "branches:access_all"}`. Creating a base price (`branchId` omitted or `null`) is NOT branch-scoped — any caller with `products:write` may create it, same as today. A non-existent or inactive `branchId` returns HTTP 400.

#### Scenario: Create non-default price
- **WHEN** the body is `{ "name": "Mayoreo", "price": 10.50, "minQuantity": 10 }`
- **THEN** the system returns HTTP 201

#### Scenario: Create first default price
- **WHEN** the body is `{ "name": "Menudeo", "price": 12.00, "isDefault": true }` and no default exists
- **THEN** the system returns HTTP 201

#### Scenario: Reject second default price
- **WHEN** the product already has a default price and the body sets `isDefault: true`
- **THEN** the system returns HTTP 409

#### Scenario: Duplicate price name
- **WHEN** a price named "Menudeo" already exists for the product
- **THEN** the system returns HTTP 409

#### Scenario: Invalid price
- **WHEN** the body contains `price: -5`
- **THEN** the system returns HTTP 400

#### Scenario: Crear override de sucursal
- **WHEN** un caller con `products:write` envía `{ "name": "Precio Publico", "price": 699.35, "branchId": "<ZARIOZ>" }` para un producto cuyo precio base "Precio Publico" ya existe
- **THEN** the system returns HTTP 201 — no colisiona con el nombre del base porque pertenece a un bucket distinto

#### Scenario: Override con mismo nombre en la misma sucursal colisiona
- **WHEN** la sucursal ZARIOZ ya tiene un override "Precio Publico" y se intenta crear otro override "Precio Publico" para ZARIOZ
- **THEN** the system returns HTTP 409

#### Scenario: Default de sucursal no colisiona con el default global
- **WHEN** el producto ya tiene un default global (`branchId: null`) y se crea un override con `isDefault: true` y `branchId: "<ZARIOZ>"`
- **THEN** the system returns HTTP 201 — son buckets distintos, cada uno con su propio default

#### Scenario: Operador crea override fuera de su sucursal
- **WHEN** un `operator` con `x-user-branch-id: B1` (sin `branches:access_all`) envía `{ "name": "Precio Publico", "price": 500, "branchId": "B2" }`
- **THEN** the system returns HTTP 403 `{"error": "Forbidden", "required": "branches:access_all"}`

#### Scenario: Operador crea override de su propia sucursal
- **WHEN** un `operator` con `x-user-branch-id: B1` envía `{ "name": "Precio Publico", "price": 500, "branchId": "B1" }`
- **THEN** the system returns HTTP 201

#### Scenario: branchId de sucursal inactiva o inexistente
- **WHEN** el body incluye `branchId` que no corresponde a una sucursal activa
- **THEN** the system returns HTTP 400

---

### Requirement: Update product price
The system SHALL expose `PATCH /api/v1/admin/products/:id/prices/:priceId`. Requires `products:write`. Body MAY include `name`, `price`, `minQuantity`, `discountPct`, `isDefault`. At least one field required. Toggling `isDefault: true` SHALL automatically unset `isDefault` on the prior default price of the SAME `(productId, branchId)` bucket (atomic) — it SHALL NOT affect the default of any other bucket.

`branchId` is **immutable** after creation, same as `code` in other catalogs: if the body includes `branchId`, it SHALL be silently ignored.

#### Scenario: Update price value
- **WHEN** the body is `{ "price": 13.50 }`
- **THEN** the system returns HTTP 200 with the new value

#### Scenario: Promote to default
- **WHEN** the body is `{ "isDefault": true }` for a non-default price and another price is currently default IN THE SAME BUCKET
- **THEN** the system atomically sets the new price as default and unsets the previous default; returns HTTP 200

#### Scenario: Promote branch override to default does not touch the global default
- **WHEN** a ZARIOZ override with `isDefault: false` is PATCHed to `{ "isDefault": true }`, and the product's global (`branchId: null`) default is currently some other price
- **THEN** the ZARIOZ override becomes default within its own bucket; the global default is unchanged

#### Scenario: Price not found
- **WHEN** `:priceId` does not exist
- **THEN** the system returns HTTP 404

#### Scenario: branchId is ignored on update
- **WHEN** the body includes `{ "price": 15.00, "branchId": "<other-branch>" }` on an existing override for branch A
- **THEN** the system returns HTTP 200, updates `price`, and the row's `branchId` remains A

---

### Requirement: Delete product price
The system SHALL expose `DELETE /api/v1/admin/products/:id/prices/:priceId`. Requires `products:write`. Returns HTTP 204. **Hard delete** — the row is removed permanently. Deleting the default price leaves the product without a default; the next `POST /prices` may set a new default.

#### Scenario: Delete price success
- **WHEN** an authorized user deletes an existing price
- **THEN** the system returns HTTP 204 and the row is removed

#### Scenario: Price not found
- **WHEN** `:priceId` does not exist
- **THEN** the system returns HTTP 404

---

### Requirement: List product dosifications with computed unit price
The system SHALL expose `GET /api/v1/admin/products/:id/dosifications`. Requires `products:read`. Returns `{ items: ProductDosificationDto[] }`. Each `ProductDosificationDto` includes `id`, `productId`, `name`, `numParts`, `isActive`, `computedUnitPrice: number | null`, `requiresDefaultPrice: boolean`, `createdAt`, `updatedAt`.

The `computedUnitPrice` is computed by the domain service `DosificationPriceCalculator` using the product's default price (`is_default = true`) as `basePrice`, and the surcharge percentage currently configured in `settings-api` (`GET /settings/pricing` → `dosificationSurchargePct`, default `5.0` when unconfigured). Formula: `basePrice / numParts * (1 + dosificationSurchargePct / 100)`. If the product has no default price, `computedUnitPrice` is `null` and `requiresDefaultPrice` is `true`.

#### Scenario: With default price
- **WHEN** the product has a default price of `100.00`, a dosification with `numParts=10`, and no `pricing_settings` row exists yet
- **THEN** the response includes that dosification with `computedUnitPrice ≈ 10.50` (100 / 10 * 1.05, using the 5% default) and `requiresDefaultPrice: false`

#### Scenario: With a configured surcharge
- **WHEN** an admin has configured `dosificationSurchargePct = 8` via `PATCH /settings/pricing`, and the product has a default price of `100.00` with a dosification of `numParts=10`
- **THEN** the response includes `computedUnitPrice ≈ 10.80` (100 / 10 * 1.08)

#### Scenario: Without default price
- **WHEN** the product has no `is_default = true` price
- **THEN** the response includes each dosification with `computedUnitPrice: null` and `requiresDefaultPrice: true`

#### Scenario: Inactive dosifications included by default
- **WHEN** the product has dosifications with `is_active = false`
- **THEN** the response includes them (no filtering in the list endpoint; UI filters as needed)

---

### Requirement: Create product dosification
The system SHALL expose `POST /api/v1/admin/products/:id/dosifications`. Requires `products:write`. Required body: `name: string` (1–60 chars), `numParts: number` (integer >= 2). Optional: `isActive: boolean` (default `true`). Duplicate `name` for the same product returns HTTP 409.

#### Scenario: Create dosification
- **WHEN** the body is `{ "name": "Por dosis", "numParts": 50 }`
- **THEN** the system returns HTTP 201

#### Scenario: Reject numParts < 2
- **WHEN** the body is `{ "name": "X", "numParts": 1 }`
- **THEN** the system returns HTTP 400 (a dosification must split into at least 2 parts)

#### Scenario: Duplicate name
- **WHEN** the product already has a dosification with that name
- **THEN** the system returns HTTP 409

---

### Requirement: Update product dosification
The system SHALL expose `PATCH /api/v1/admin/products/:id/dosifications/:dosificationId`. Requires `products:write`. Body MAY include `name`, `numParts`, `isActive`. At least one field required.

#### Scenario: Update numParts
- **WHEN** the body is `{ "numParts": 24 }`
- **THEN** the system returns HTTP 200 with the new value; next GET shows recomputed `computedUnitPrice`

#### Scenario: Deactivate dosification
- **WHEN** the body is `{ "isActive": false }`
- **THEN** the system returns HTTP 200 with `isActive: false`

#### Scenario: Dosification not found
- **WHEN** `:dosificationId` does not exist
- **THEN** the system returns HTTP 404

---

### Requirement: Delete product dosification (soft)
The system SHALL expose `DELETE /api/v1/admin/products/:id/dosifications/:dosificationId`. Requires `products:write`. This is a **soft delete**: the row is marked `isActive = false` (the same effect as `PATCH { "isActive": false }`). Returns HTTP 204.

#### Scenario: Soft delete success
- **WHEN** an authorized user deletes a dosification
- **THEN** the system returns HTTP 204 and the row has `is_active = false`

#### Scenario: Reactivate via update
- **WHEN** an admin sends `PATCH /dosifications/:id` with `{"isActive": true}` later
- **THEN** the dosification is active again

---

### Requirement: Upload product image
The system SHALL expose `POST /api/v1/admin/products/:id/image` that receives a multipart request with field `file: File` and stores the image in Supabase Storage bucket `product-images`. Requires `products:write`.

Validation rules:
- MIME type MUST be one of: `image/jpeg`, `image/png`, `image/webp`. Otherwise HTTP 400 `{"error": "Invalid image format"}`.
- File size MUST be ≤ 2 MB (2 * 1024 * 1024 bytes). Otherwise HTTP 413 `{"error": "Image too large", "maxBytes": 2097152}`.
- Multipart body MUST contain exactly one `file` field. Otherwise HTTP 400.

Side effects:
- Upload object with key `products/{productId}/{newUuid}.{ext}` to bucket `product-images`.
- If the product already had `image_url` from this bucket, the previous object SHALL be deleted from Storage after the new one is persisted (best-effort; failure to delete the old object is logged but does not fail the request).
- Persist new public URL in `products.image_url`.

Returns HTTP 200 with `{ imageUrl: string }` (the new public URL).

Returns HTTP 404 if `:id` does not match any product. Returns HTTP 403 if user lacks `products:write`.

#### Scenario: Successful upload
- **WHEN** an authenticated user with `products:write` posts multipart with a 500 KB `image/png`
- **THEN** the system returns HTTP 200 with `{ imageUrl: "https://<supabase>/storage/v1/object/public/product-images/products/<id>/<uuid>.png" }` and `products.image_url` is updated

#### Scenario: Invalid MIME
- **WHEN** the uploaded file has MIME `application/pdf`
- **THEN** the system returns HTTP 400 `{"error": "Invalid image format"}`

#### Scenario: File too large
- **WHEN** the uploaded file is 3 MB
- **THEN** the system returns HTTP 413 `{"error": "Image too large", "maxBytes": 2097152}`

#### Scenario: Re-upload deletes previous object
- **WHEN** the product already has `image_url` pointing to a prior object in the bucket and a new valid upload arrives
- **THEN** the system uploads the new object, persists the new URL, and deletes the prior object from Storage (best-effort)

#### Scenario: Product not found
- **WHEN** the `:id` does not match any product
- **THEN** the system returns HTTP 404

#### Scenario: Forbidden
- **WHEN** the user lacks `products:write`
- **THEN** the system returns HTTP 403

---

### Requirement: Delete product image
The system SHALL expose `DELETE /api/v1/admin/products/:id/image` that removes the persisted image. Requires `products:write`. If `products.image_url` is non-null and points to the configured bucket, the underlying Storage object SHALL be deleted. Then `image_url` is set to `null` and the system returns HTTP 204.

If `products.image_url` is already `null`, returns HTTP 204 (idempotent).

#### Scenario: Delete existing image
- **WHEN** the product has a non-null `image_url`
- **THEN** the system deletes the Storage object, sets `image_url = null`, and returns HTTP 204

#### Scenario: Delete is idempotent
- **WHEN** the product already has `image_url = null`
- **THEN** the system returns HTTP 204 without contacting Storage

#### Scenario: Forbidden
- **WHEN** the user lacks `products:write`
- **THEN** the system returns HTTP 403

#### Scenario: Product not found
- **WHEN** the `:id` does not match any product
- **THEN** the system returns HTTP 404

---

### Requirement: Product image storage configuration
The Supabase project SHALL host a bucket named `product-images` configured as: SELECT (read) public; INSERT/UPDATE/DELETE restricted to the `service_role`. The backend SHALL read `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from environment; the service role key MUST NOT be exposed to the browser. The `ProductImageStorage` adapter SHALL be the single integration point with Supabase Storage (`@supabase/supabase-js` server client).

#### Scenario: Service role key only on server
- **WHEN** the frontend bundle is inspected
- **THEN** `SUPABASE_SERVICE_ROLE_KEY` SHALL NOT appear anywhere in the client bundle

#### Scenario: Bucket policy enforces public read
- **WHEN** an unauthenticated `GET` is made to the public URL of any uploaded image
- **THEN** the request succeeds with HTTP 200 (public read)

#### Scenario: Bucket policy rejects anonymous writes
- **WHEN** an unauthenticated `POST` attempts to upload to the bucket
- **THEN** Supabase rejects the request (only `service_role` may write)

---

### Requirement: Dosification price calculator (domain service)
The system SHALL provide a pure domain service `DosificationPriceCalculator` with a single static method `computeUnitPrice(basePrice: number, numParts: number, surchargePct: number): number` that returns `(basePrice / numParts) * (1 + surchargePct / 100)`. The surcharge percentage is NOT a hardcoded constant — the caller resolves it from the current `pricing_settings` configuration (default `5.0`) and passes it explicitly. The method SHALL throw if `numParts < 1`. The service SHALL have no I/O dependencies (no DB, no HTTP) — resolving the configured percentage happens in the caller, not inside this pure function.

#### Scenario: Standard calculation
- **WHEN** `computeUnitPrice(100, 10, 5)` is invoked
- **THEN** the result is `10.5` (within floating-point precision)

#### Scenario: Standard calculation with a custom surcharge
- **WHEN** `computeUnitPrice(100, 10, 7)` is invoked
- **THEN** the result is `10.7` (within floating-point precision) — the same numeric behavior as the old fixed-7% formula, now parameterized

#### Scenario: With decimals
- **WHEN** `computeUnitPrice(99.99, 7, 5)` is invoked
- **THEN** the result is approximately `14.9985` (`99.99 / 7 * 1.05`)

#### Scenario: Zero base price
- **WHEN** `computeUnitPrice(0, 10, 5)` is invoked
- **THEN** the result is `0`

#### Scenario: Reject invalid numParts
- **WHEN** `computeUnitPrice(100, 0, 5)` or `computeUnitPrice(100, -1, 5)` is invoked
- **THEN** the method throws an Error

#### Scenario: Domain purity
- **WHEN** unit tests are run against the calculator
- **THEN** no Prisma, no fetch, no environment access is required

### Requirement: ProductDto includes providerName
The `ProductDto` (list and detail) SHALL include `providerName: string | null` derived from the join `products → departments → providers`. When the department has no provider, `providerName` is `null`. The list response SHALL also include `providerId: string | null` as a flat field.

#### Scenario: List products includes providerName
- **WHEN** GET /api/v1/admin/products returns items
- **THEN** each item includes `providerName: string | null` and `providerId: string | null`

#### Scenario: Detail includes providerName
- **WHEN** GET /api/v1/admin/products/:id is called
- **THEN** response includes `providerName` from the department's provider

---

### Requirement: Filter products by provider
`GET /api/v1/admin/products` SHALL accept an optional query parameter `providerId: string (UUID)`. When provided, only products whose department has `provider_id = providerId` are returned. Combined with existing filters (`departmentId`, `search`, pagination).

#### Scenario: Filter by provider
- **WHEN** request includes `?providerId=<uuid>`
- **THEN** response contains only products whose department belongs to that provider

`GET /api/v1/admin/products` SHALL accept an optional query parameter `satProductCode: string (exact, 8 digits)`. When provided, only products whose `satProductCode` equals the value are returned (exact match, not partial). This is used by the purchases UI to auto-match invoice line items to products by SAT code. Combined with existing filters (`search`, `departmentId`, `providerId`, pagination).

#### Scenario: Filter by satProductCode
- **WHEN** request includes `?satProductCode=01010101`
- **THEN** response contains only products with `satProductCode === "01010101"`
- **AND** an invalid value (not 8 digits) SHALL return HTTP 400

#### Scenario: Combined filter providerId + departmentId
- **WHEN** request includes both `?providerId=<uuid>&departmentId=<uuid>`
- **THEN** both filters are applied (AND condition); if the department doesn't belong to that provider, result is empty

---

### Requirement: Taxable flag drives total calculation
The system SHALL propagate `isTaxable` from the product catalog through `PosLookupService` to `SaleTotalsCalculator` and `QuoteTotalsCalculator`. When a line item has `isTaxable = false`, the calculators SHALL use `effectiveIvaRate = 0` and `effectiveIepsRate = 0` regardless of the stored `ivaRate`/`iepsRate` on the product price.

#### Scenario: Non-taxable product generates zero tax in sale totals
- **WHEN** a sale line item references a product with `isTaxable = false` and `ivaRate = 0.16`
- **THEN** `lineIva = 0` and `lineIeps = 0` for that line

#### Scenario: Taxable product generates tax normally
- **WHEN** a sale line item references a product with `isTaxable = true` and `ivaRate = 0.16`
- **THEN** `lineIva = round(lineSubtotal * 0.16, 4)`

---

### Requirement: Product taxRateId field
The `ProductDto` SHALL include `taxRateId: string | null` and, in the detail endpoint (`GET /products/:id`), an embedded `taxRate: { id, code, name, rate } | null`. The list endpoint SHALL include `taxRateId` and `taxRateCode: string | null` as flat fields (no full object, to avoid N+1).

`POST /admin/products` and `PATCH /admin/products/:id` SHALL accept `taxRateId: string (UUID) | null`. If `taxRateId` is provided and non-null, the referenced tax rate MUST exist and be active; otherwise 400 `{"error":"Tax rate not found or inactive"}`. Setting `taxRateId: null` disassociates the product from any tax rate.

#### Scenario: Create product with tax rate
- **WHEN** POST body includes `taxRateId: "<uuid of IVA_16>"`
- **THEN** product is created with `taxRateId` set and detail response includes `taxRate: { id, code: "IVA_16", name: "IVA 16%", rate: 0.16 }`

#### Scenario: Create product with invalid taxRateId
- **WHEN** POST body includes `taxRateId: "<non-existent uuid>"`
- **THEN** system returns HTTP 400 `{"error":"Tax rate not found or inactive"}`

#### Scenario: PATCH to remove tax rate
- **WHEN** PATCH body is `{ "taxRateId": null }`
- **THEN** product's `taxRateId` is set to null; detail response has `taxRate: null`

#### Scenario: List products includes taxRateId and taxRateCode
- **WHEN** GET /admin/products returns list
- **THEN** each item includes `taxRateId: string | null` and `taxRateCode: string | null`

