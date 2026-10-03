## ADDED Requirements

### Requirement: Branch-scoped numbering for sales/quotes/purchases folios

For folios with `code` in `{TK, TC, COT, CP}`, the system SHALL maintain an independent numbering counter PER BRANCH, instead of the single global `folios.current_number` used by every other folio (`RB`, `AB`, `DEV`, `PP`, `TS`). A new table `folio_branch_counters` (`folioId`, `branchId`, `currentNumber`) SHALL hold one row per `(folio, branch)` pair, created on demand the first time that branch issues a document under that folio — there is no backfill or migration of existing counts; each branch starts its own sequence at `1` on its first document after this capability ships.

The resulting `folioCode` for a branch-scoped document SHALL be `<prefix><BRANCH_CODE>-<currentNumber padded to 6 digits>` (e.g. `TK-ZARIOZ-000001`, `CP-PRADERA-000001`), where `<BRANCH_CODE>` is the issuing branch's `code`. Documents issued before this capability existed keep their original `folioCode` (the legacy global format, e.g. `TK-000038`) unchanged — the new format cannot collide with it. `sales.folioCode`, `quotes.folioCode` and `purchases.folioCode` (and `inventory_movements.folioCode`, which copies the sale/purchase code) SHALL be `VARCHAR(64)` (widened from `VARCHAR(40)`) to fit the longer format. The uniqueness constraint on `(sales|quotes|purchases).(folioId, folioNumber)` SHALL be replaced by a uniqueness constraint on `folioCode` alone, since `folioNumber` is no longer globally unique per folio (it resets per branch).

Folios with a `scope` other than the four listed above, or any folio not in `{TK, TC, COT, CP}` regardless of scope, are NOT affected — they keep using the existing single global counter (`folios.current_number` via the pre-existing allocation path), unchanged by this capability.

#### Scenario: Two branches issue the same folio code independently
- **WHEN** branch ZARIOZ has already issued 9 purchases under folio `CP` and branch PRADERA issues its first purchase ever under the same folio
- **THEN** PRADERA's purchase receives `CP-PRADERA-000001`, independent of ZARIOZ's `CP-ZARIOZ-000009`

#### Scenario: Concurrent documents from the same branch never collide
- **WHEN** two sales for the same branch are created concurrently under folio `TK`
- **THEN** each receives a distinct, sequential `folioCode` — the counter increment is atomic per `(folioId, branchId)`

#### Scenario: Legacy folioCode is never reassigned
- **WHEN** a sale exists with the legacy global-format `folioCode = "TK-000038"` (issued before this capability)
- **THEN** no new sale under this capability is ever assigned that same `folioCode`, and the legacy sale's `folioCode` is never modified

#### Scenario: Non-branch-scoped folios are unaffected
- **WHEN** a customer payment is registered under folio `RB` (scope OPERATIONS, not one of TK/TC/COT/CP)
- **THEN** it continues to consume the single global `folios.current_number` counter, exactly as before this capability

## MODIFIED Requirements

### Requirement: List folios
The system SHALL expose `GET /api/v1/admin/folios` that returns a paginated list of folios. The endpoint requires the `folios:read` permission. Query parameters `page` (default 1), `pageSize` (default 20, max 100), `includeInactive` (default `false`) and `branchId` (optional UUID) control the result set. By default the system SHALL return only folios with `isActive = true`. The response SHALL be `{ items: FolioDto[], total: number, page: number, pageSize: number }`. Each `FolioDto` includes `id`, `code`, `name`, `prefix` (string or `null`), `currentNumber` (number ≥ 0, the legacy global counter), `isActive`, `createdAt`, `updatedAt`.

**Branch-scoped preview (`?branchId=`)**: when the request includes `branchId`, the system SHALL resolve it per standard branch scoping (`rbac` — a caller without `branches:access_all` MUST pass their own `x-user-branch-id`; mismatch → HTTP 403; a non-existent branch → HTTP 404 `{"error": "Branch not found"}`). For each folio whose `code` is one of `{TK, TC, COT, CP}`, the `FolioDto` additionally includes `branchCurrentNumber: number` (that branch's counter from `folio_branch_counters`, `0` if no row exists yet) and `nextFolioCode: string` (the code that would be assigned to the next document from that branch, computed server-side). For folios NOT in that set, both fields are `null` (they have no per-branch counter). When `branchId` is omitted, both fields are `null` on every item.

#### Scenario: Admin lists active folios
- **WHEN** an authenticated user with `folios:read` sends `GET /api/v1/admin/folios`
- **THEN** the system returns HTTP 200 with active folios only

#### Scenario: Admin lists including inactive folios
- **WHEN** the request includes `?includeInactive=true`
- **THEN** the response includes inactive folios as well

#### Scenario: pageSize exceeds max
- **WHEN** the request includes `?pageSize=200`
- **THEN** the system returns HTTP 400 with a validation error

#### Scenario: Unauthorized user
- **WHEN** an authenticated user without `folios:read` calls the endpoint
- **THEN** the system returns HTTP 403 `{"error": "Forbidden", "required": "folios:read"}`

#### Scenario: branchId preview shows the next folio code
- **WHEN** the request includes `?branchId=<ZARIOZ>` and ZARIOZ has already issued 5 `TK` documents
- **THEN** the `TK` item in the response includes `branchCurrentNumber: 5` and `nextFolioCode: "TK-ZARIOZ-000006"`

#### Scenario: branchId preview omits fields for non-branch-scoped folios
- **WHEN** the request includes `?branchId=<ZARIOZ>`
- **THEN** the `RB` item in the response includes `branchCurrentNumber: null` and `nextFolioCode: null`

#### Scenario: branchId of a non-existent branch rejected
- **WHEN** the request includes `?branchId=<uuid>` that does not match any branch
- **THEN** the system returns HTTP 404 `{"error": "Branch not found"}`

#### Scenario: Non-bypass caller cannot preview another branch
- **WHEN** an operator without `branches:access_all`, assigned to ZARIOZ, sends `?branchId=<PRADERA>`
- **THEN** the system returns HTTP 403 `{"error": "Forbidden", "required": "branches:access_all"}`
