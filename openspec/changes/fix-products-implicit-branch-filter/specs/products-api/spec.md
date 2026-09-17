## MODIFIED Requirements

### Requirement: List products
The system SHALL expose `GET /api/v1/admin/products` that returns a paginated list of products. Requires the `products:read` permission. Query parameters control the result set: `page` (default 1), `pageSize` (default 20, max 100), `includeInactive` (default `false`), `search` (optional, min 2 chars when present; matches `name` OR `code` via `OR ILIKE '%search%'`), `departmentId` (optional UUID filter), `branchId` (optional UUID). Response: `{ items: ProductDto[], total: number, page: number, pageSize: number }`. Each `ProductDto` includes `id`, `code`, `name`, `unit` (clave SAT `c_ClaveUnidad`), `unitDescription` (string or `null` — human-readable description resolved against the SAT unit-of-measure catalog; `null` if `unit` does not match any catalog entry), `satProductCode` (string or `null`), `departmentId`, `departmentName` (joined), `ivaRate` (decimal 0–1 or `null`), `iepsRate` (decimal 0–1 or `null`), `imageUrl` (string or `null`), `isTaxable` (boolean), `isActive`, `createdAt`, `updatedAt`, and `stock: number | null`. Results ordered by `createdAt DESC`.

**`stock` field**: when the request includes `branchId`, the system SHALL join `branch_inventory` filtered by `(branch_id = branchId, product_id = product.id)` (unique pair) and set `stock = branch_inventory.quantity` for that product, or `stock = null` if no `branch_inventory` row exists for that pair. When the request omits `branchId`, `stock` is always `null` (no branch context to resolve stock against). This does NOT require the `inventory:read` permission — `products:read` alone is sufficient, since it is the same list endpoint, only enriched with an extra field.

**Branch scope mode (`inventory-api` — Configurable inventory scope mode)**: the endpoint only applies branch-scope filtering (and only resolves/enforces a caller's own branch) when the request **explicitly includes `branchId`** in the query string. When `branchId` is present AND the deployment's inventory scope mode is `branch`, the endpoint additionally SHALL filter the result set — not just the `stock` field — to only products that have a `branch_inventory` row for that `branchId` (a row with `quantity = 0` still counts as present; the row represents assignment, not just quantity). The `total` count SHALL reflect this filter. The explicit `branchId` is resolved server-side per branch scoping (`rbac` — `branches:access_all` bypass semantics): a caller without the bypass permission passing a `branchId` MUST match their own `x-user-branch-id` (mismatch → 403); a caller with the bypass may pass any `branchId`. **When `branchId` is omitted, the result set is NEVER filtered by branch — regardless of the inventory scope mode, and regardless of whether the caller has `branches:access_all` or an assigned branch at all.** When the scope mode is `general` (the default), an explicit `branchId` continues to affect ONLY the `stock` field, exactly as before this change — the result set is never filtered by branch in `general` mode even with an explicit `branchId`.

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

#### Scenario: Branch scope mode with explicit branchId excludes unassigned products
- **WHEN** the inventory scope mode is `branch`, the request includes `?branchId=<B1>`, and product `P2` has no `branch_inventory` row for `(B1, P2)`
- **THEN** the response does NOT include `P2`, and `total` does not count it

#### Scenario: Branch scope mode with explicit branchId includes assigned product with zero stock
- **WHEN** the inventory scope mode is `branch`, the request includes `?branchId=<B1>`, and product `P3` has a `branch_inventory` row for `(B1, P3)` with `quantity = 0`
- **THEN** the response includes `P3` with `stock: 0`

#### Scenario: Branch scope mode without branchId never filters, regardless of caller
- **WHEN** the inventory scope mode is `branch` and any authenticated user with `products:read` (with or without `branches:access_all`, with or without an assigned branch) sends `GET /api/v1/admin/products` without `branchId`
- **THEN** the system returns the unfiltered catalog — identical to `general` mode behavior — and does not require an assigned branch or `branches:access_all` to succeed

#### Scenario: Branch scope mode rejects an explicit mismatched branchId
- **WHEN** the inventory scope mode is `branch` and an operator without `branches:access_all` (assigned to `B1`) sends `GET /api/v1/admin/products?branchId=B2`
- **THEN** the system returns HTTP 403 `{ "error": "Forbidden", "required": "branches:access_all" }` — it does not silently override to `B1`

#### Scenario: Branch scope mode with explicit branchId matching own branch filters correctly
- **WHEN** the inventory scope mode is `branch` and an operator without `branches:access_all` (assigned to `B1`) sends `GET /api/v1/admin/products?branchId=B1`
- **THEN** the system filters the catalog to `B1`'s assigned products, exactly as when any other caller passes an authorized `branchId`
