## MODIFIED Requirements

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
