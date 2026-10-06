## MODIFIED Requirements

### Requirement: Create quote
The system SHALL expose `POST /api/v1/admin/quotes` that emits a new quote in `draft` status. Requires `quotes:create`. Required body:

- `branchId: string` (UUID of an active branch)
- `customerId: string` (UUID of an active customer)
- `folioId: string` (UUID of an active folio — typically a folio whose `code` identifies quotes, e.g. "COT")
- `items: QuoteItemInput[]` (at least 1 item)

Each `QuoteItemInput`:

- `productId: string` (UUID of an active product)
- `productPriceId: string` (UUID of a price belonging to `productId`)
- `quantity: number` (decimal `> 0`; max 14 integer + 4 decimal digits)

Optional body: `notes: string | null` (max 1000 chars), `expiresAt: string | null` (ISO 8601; if non-null SHALL be in the future), `clientRequestId: string | null` (UUID; idempotency key used by offline-created quotes queued via `offline-sync` — see "Idempotent replay via clientRequestId" below; defaults to `null` for online-created quotes).

**Branch scoping**: callers without `branches:access_all` MUST pass `branchId === x-user-branch-id`; mismatch returns HTTP 403. Callers without an assigned branch (`x-user-branch-id` empty) and without `branches:access_all` return HTTP 403.

**Idempotent replay via `clientRequestId`**: when the body includes a non-null `clientRequestId`, the controller SHALL, BEFORE any other validation in the atomic flow below, look up an existing `quotes` row with `client_request_id = clientRequestId`. If found, the system SHALL return HTTP 201 with that existing quote's `QuoteDetailDto` unchanged — it SHALL NOT re-validate the body, re-allocate a folio, or insert a new row. If not found, the atomic flow proceeds as normal and, on success, persists `client_request_id = clientRequestId` on the new `quotes` row. `client_request_id` is nullable and unique; online-created quotes (no `clientRequestId` in the body) leave it `null` and are never matched by this lookup.

**Atomic flow (inside a Prisma transaction)**:

0. If `clientRequestId` is non-null, perform the idempotent-replay lookup described above; short-circuit on a match before any of the following steps.
1. Validate `customer.isActive`, `branch.isActive`, `folio.isActive`. Any inactive → HTTP 400.
2. For each item: load the `Product` and `ProductPrice`; verify `productPrice.productId === item.productId` (else `ProductPriceMismatchError` → HTTP 400), that `productPrice` belongs to a product whose `isActive = true` (else HTTP 400), and that `productPrice.branchId === null OR productPrice.branchId === branchId` — the price is either a global base price or an override belonging to the quote's own branch (else `ProductPriceNotAvailableForBranchError` → HTTP 400 `{"error": "Product price does not belong to this branch"}`; the error message SHALL NOT disclose the price or the other branch it belongs to). **Additionally, when `productPrice.branchId === null` (a base price was selected) AND the product has at least one `ProductPrice` override for the quote's `branchId`, the system SHALL reject with the same `ProductPriceNotAvailableForBranchError` → HTTP 400** — same rule `pos-api` applies to sale creation: once a branch has its own price for a product, the global base price is no longer a valid selection for that branch. `quantity > 0` (else HTTP 400 via Zod). If `item.quantity` is NOT an integer (`quantity % 1 !== 0`), resolve the currently configured `dosificationSurchargePct` from `settings-api` (default `5.0` when unconfigured) and compute `unitPrice = price.price * (1 + surchargePct / 100)`; if `item.quantity` IS an integer, `unitPrice = price.price` unchanged. This applies uniformly to every product — no per-product or per-department opt-out — and is the same rule `pos-api` applies to normal-price sale lines.
3. Snapshot `productCodeSnapshot = product.code`, `productNameSnapshot = product.name`, `priceNameSnapshot = price.name`, `unitPrice` per step 2 above (recharged when `quantity` is fractional, else `price.price` unchanged), `discountPct = price.discountPct`, `ivaRate = product.ivaRate`, `iepsRate = product.iepsRate`. This server-computed snapshot is authoritative even for offline-originated quotes — a `clientRequestId`-bearing request carries only IDs/quantities, never client-computed snapshot values, so catalog drift between offline creation and sync time is always resolved in favor of the server's live catalog. The snapshot does NOT record which branch's price (base or override) was used — only the resolved `unitPrice` value; this snapshot is what `pos-api`'s "Convert quote to sale" carries forward unchanged, so a converted sale is never re-validated against branch price at conversion time.
4. Compute totals using `QuoteTotalsCalculator` (domain service) — unchanged by the fractional-quantity surcharge (operates on `quantity * unitPrice`, agnostic to how `unitPrice` was resolved).
5. Allocate the next folio number atomically: `UPDATE folios SET current_number = current_number + 1 WHERE id = ? AND is_active = true RETURNING current_number, code, prefix`. If `RETURNING` is empty (folio inactive) → HTTP 400.
6. `INSERT` the `quotes` row with `status='draft'`, `creator_id=<userId from x-user-id>`, snapshotted folio info, `expires_at` from the body, and `client_request_id = clientRequestId` (or `null`).
7. `INSERT` the `quote_items` rows.

The endpoint SHALL NOT touch `branch_inventory` at any point. Returns HTTP 201 with the `QuoteDetailDto` (including items).

#### Scenario: Successful quote creation
- **WHEN** an `operator` with `x-user-branch-id: B1` and `quotes:create` sends a valid body for branch B1 with 2 items
- **THEN** the system returns HTTP 201 with the `QuoteDetailDto`, `folios.current_number` incremented by 1, and `branch_inventory.quantity` for the involved products UNCHANGED

#### Scenario: Branch scoping violation
- **WHEN** an `operator` with `x-user-branch-id: B1` posts a body with `branchId: B2`
- **THEN** the system returns HTTP 403 `{"error": "Forbidden", "required": "branches:access_all"}`

#### Scenario: Inactive customer
- **WHEN** the body's `customerId` references a customer with `isActive=false`
- **THEN** the system returns HTTP 400 `{"error": "Customer is inactive"}` and the transaction does not commit

#### Scenario: Inactive folio
- **WHEN** the body's `folioId` references a folio with `isActive=false`
- **THEN** the system returns HTTP 400

#### Scenario: Mismatched productPrice
- **WHEN** an item has `productId: A` but `productPriceId: P` where `P.product_id !== A`
- **THEN** the system returns HTTP 400 `{"error": "Product price does not belong to product"}` and the transaction does not commit

#### Scenario: Empty items
- **WHEN** the body has `items: []`
- **THEN** the system returns HTTP 400 `{"error": "Quote must include at least one item"}`

#### Scenario: expiresAt in the past
- **WHEN** the body has `expiresAt: "2020-01-01T00:00:00Z"`
- **THEN** the system returns HTTP 400 `{"error": "expiresAt must be in the future"}`

#### Scenario: Forbidden without quotes:create
- **WHEN** a caller without `quotes:create` calls the endpoint
- **THEN** the system returns HTTP 403 `{"error": "Forbidden", "required": "quotes:create"}`

#### Scenario: Quote can be created for a customer with debt
- **WHEN** the customer's `current_balance > 0` (the customer owes money)
- **THEN** the system still returns HTTP 201 — the quote does not check credit, this is a sales proposal not a sale

#### Scenario: Quote can be created without inventory record
- **WHEN** the target branch has no `branch_inventory` row for the item's `productId`
- **THEN** the system returns HTTP 201 — the quote does not require existing inventory

#### Scenario: Fractional quantity applies the same surcharge as a sale
- **WHEN** the body has an item with `price.price = 100`, `quantity = 0.5`, and `dosificationSurchargePct = 5` (default)
- **THEN** the system returns HTTP 201 with `unitPrice = 105` on that line (`100 * 1.05`), matching what `POST /api/v1/admin/sales` would compute for the same line

#### Scenario: Integer quantity never gets the surcharge
- **WHEN** the body has an item with `price.price = 100`, `quantity = 3`
- **THEN** the system returns HTTP 201 with `unitPrice = 100` (unchanged)

#### Scenario: Idempotent replay of an offline-queued quote
- **WHEN** a caller sends a body with `clientRequestId: X` and there already exists a `quotes` row with `client_request_id = X` (from a previous, already-committed request with the exact same `clientRequestId`, e.g. a retry of an `offline-sync` outbox item whose original response was lost)
- **THEN** the system returns HTTP 201 with that existing quote's `QuoteDetailDto`; no new row is inserted and no folio is allocated

#### Scenario: clientRequestId omitted behaves exactly as before
- **WHEN** the body does not include `clientRequestId` (or sends it as `null`)
- **THEN** the system behaves exactly as the pre-existing online flow: no idempotency lookup is attempted, `client_request_id` is persisted as `null`

#### Scenario: Quote synced offline discovered expired at sync time
- **WHEN** an offline-queued quote's `expiresAt` (computed client-side from a cached default) would already be in the past by the time the sync request reaches the server
- **THEN** the system rejects it with the same HTTP 400 `expiresAt must be in the future` as any online request — `offline-sync` surfaces this as a non-retriable business failure in its sync queue UI, it does not retry automatically

#### Scenario: Quote uses the branch's own override price
- **WHEN** the body's `branchId` is ZARIOZ and an item's `productPriceId` references a `ProductPrice` whose `branchId = ZARIOZ`
- **THEN** the system returns HTTP 201 and `unitPrice` on that line is resolved from the ZARIOZ override, not from the product's global base price

#### Scenario: Quote rejects a price override belonging to another branch
- **WHEN** the body's `branchId` is HUAJUAPAN but an item's `productPriceId` references a `ProductPrice` whose `branchId = ZARIOZ`
- **THEN** the system returns HTTP 400 `{"error": "Product price does not belong to this branch"}` and the transaction does not commit

#### Scenario: Quote rejects the global base price when the branch has its own override
- **WHEN** the body's `branchId` is ZARIOZ, an item's `productPriceId` references a `ProductPrice` whose `branchId = null` (base, still active), and the same product has a separate `ProductPrice` row with `branchId = ZARIOZ`
- **THEN** the system returns HTTP 400 `{"error": "Product price does not belong to this branch"}` and the transaction does not commit — selecting the base price is no longer valid once ZARIOZ has its own price for that product
