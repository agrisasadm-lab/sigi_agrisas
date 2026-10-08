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
- `discountPctOverride: number | null` (optional; decimal `0–100`). When present, overrides the catalog's `price.discountPct` for this line.
- `discountAmount: number | null` (optional; decimal `0–100`, MXN). A flat-amount discount for this line, mutually exclusive with `discountPctOverride`/the catalog `discountPct` on the same line — both `> 0` on the same item → HTTP 400.

Optional body: `notes: string | null` (max 1000 chars), `expiresAt: string | null` (ISO 8601; if non-null SHALL be in the future), `clientRequestId: string | null` (UUID; idempotency key used by offline-created quotes queued via `offline-sync` — see "Idempotent replay via clientRequestId" below; defaults to `null` for online-created quotes).

**Branch scoping**: callers without `branches:access_all` MUST pass `branchId === x-user-branch-id`; mismatch returns HTTP 403. Callers without an assigned branch (`x-user-branch-id` empty) and without `branches:access_all` return HTTP 403.

**Idempotent replay via `clientRequestId`**: when the body includes a non-null `clientRequestId`, the controller SHALL, BEFORE any other validation in the atomic flow below, look up an existing `quotes` row with `client_request_id = clientRequestId`. If found, the system SHALL return HTTP 201 with that existing quote's `QuoteDetailDto` unchanged — it SHALL NOT re-validate the body, re-allocate a folio, or insert a new row. If not found, the atomic flow proceeds as normal and, on success, persists `client_request_id = clientRequestId` on the new `quotes` row. `client_request_id` is nullable and unique; online-created quotes (no `clientRequestId` in the body) leave it `null` and are never matched by this lookup.

**Atomic flow (inside a Prisma transaction)**:

0. If `clientRequestId` is non-null, perform the idempotent-replay lookup described above; short-circuit on a match before any of the following steps.
1. Validate `customer.isActive`, `branch.isActive`, `folio.isActive`. Any inactive → HTTP 400.
2. For each item: load the `Product` and `ProductPrice`; verify `productPrice.productId === item.productId` (else `ProductPriceMismatchError` → HTTP 400), that `productPrice` belongs to a product whose `isActive = true` (else HTTP 400), and that `productPrice.branchId === null OR productPrice.branchId === branchId` — the price is either a global base price or an override belonging to the quote's own branch (else `ProductPriceNotAvailableForBranchError` → HTTP 400 `{"error": "Product price does not belong to this branch"}`; the error message SHALL NOT disclose the price or the other branch it belongs to). **Additionally, when `productPrice.branchId === null` (a base price was selected) AND the product has at least one `ProductPrice` override for the quote's `branchId`, the system SHALL reject with the same `ProductPriceNotAvailableForBranchError` → HTTP 400** — same rule `pos-api` applies to sale creation: once a branch has its own price for a product, the global base price is no longer a valid selection for that branch. `quantity > 0` (else HTTP 400 via Zod). If `item.quantity` is NOT an integer (`quantity % 1 !== 0`), resolve the currently configured `dosificationSurchargePct` from `settings-api` (default `5.0` when unconfigured) and compute `unitPrice = price.price * (1 + surchargePct / 100)`; if `item.quantity` IS an integer, `unitPrice = price.price` unchanged. This applies uniformly to every product — no per-product or per-department opt-out — and is the same rule `pos-api` applies to normal-price sale lines.
3. Snapshot `productCodeSnapshot = product.code`, `productNameSnapshot = product.name`, `priceNameSnapshot = price.name`, `unitPrice` per step 2 above (recharged when `quantity` is fractional, else `price.price` unchanged), `discountPct = item.discountPctOverride ?? price.discountPct`, `discountAmount = item.discountAmount ?? 0`, `ivaRate = product.ivaRate`, `iepsRate = product.iepsRate`. This server-computed snapshot is authoritative even for offline-originated quotes — a `clientRequestId`-bearing request carries only IDs/quantities/discount selections, never client-computed line totals, so catalog drift between offline creation and sync time is always resolved in favor of the server's live catalog. The snapshot does NOT record which branch's price (base or override) was used — only the resolved `unitPrice` value; this snapshot is what `pos-api`'s "Convert quote to sale" carries forward unchanged (including `discountAmount`), so a converted sale is never re-validated against branch price or discount at conversion time.
4. Compute totals using `QuoteTotalsCalculator` (domain service) — unchanged by the fractional-quantity surcharge (operates on `quantity * unitPrice`, agnostic to how `unitPrice` was resolved); now also receives `discountAmount` per line (see "QuoteTotalsCalculator (domain service)").
5. Allocate the next folio number **for the quote's own branch** atomically via `allocateBranchFolio(tx, folioId, branchId)` — same per-branch counter and `folioCode` format (`<prefix><BRANCH_CODE>-<NNNNNN>`, e.g. `COT-ZARIOZ-000001`) described in `pos-api` — "Create sale (atomic emission)". If the folio is inactive → HTTP 400. Legacy `folioCode`s issued before this change are preserved unchanged.
6. `INSERT` the `quotes` row with `status='draft'`, `creator_id=<userId from x-user-id>`, snapshotted folio info, `expires_at` from the body, and `client_request_id = clientRequestId` (or `null`).
7. `INSERT` the `quote_items` rows.

The endpoint SHALL NOT touch `branch_inventory` at any point. Returns HTTP 201 with the `QuoteDetailDto` (including items).

#### Scenario: Successful quote creation
- **WHEN** an `operator` with `x-user-branch-id: B1` and `quotes:create` sends a valid body for branch B1 with 2 items
- **THEN** the system returns HTTP 201 with the `QuoteDetailDto`, the `(folioId, B1)` row in `folio_branch_counters` incremented by 1 (not `folios.current_number`), and `branch_inventory.quantity` for the involved products UNCHANGED

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

#### Scenario: Folio numbering is independent per branch
- **WHEN** branch ZARIOZ has already issued 5 quotes under folio `COT` and branch PRADERA issues its first quote under the same folio
- **THEN** PRADERA's quote receives `COT-PRADERA-000001`, independent of ZARIOZ's `COT-ZARIOZ-000005`

#### Scenario: Legacy folioCode is preserved, not renumbered
- **WHEN** a quote exists with the legacy global-format `folioCode = "COT-000012"` (issued before branch-scoped counters were introduced)
- **THEN** no new quote is ever assigned that same `folioCode`, and the legacy quote's `folioCode` is never modified

#### Scenario: Flat-amount discount applied to a line
- **WHEN** the body has an item with `quantity=1`, `price.price=500`, and `discountAmount=100` (no `discountPctOverride`)
- **THEN** the system returns HTTP 201 with that line's `lineGross = 400` before tax extraction, and `discountPct=0` persisted on the `quote_item`

#### Scenario: discountPctOverride now actually persists (bug fix)
- **WHEN** the body has an item whose catalog `price.discountPct = 5` but the body sends `discountPctOverride: 15`
- **THEN** the system returns HTTP 201 with `discountPct=15` persisted on the `quote_item` (the override wins) — previously this field was silently discarded and the catalog value was always used instead

#### Scenario: discountAmount and discountPctOverride mutually exclusive on the same line
- **WHEN** an item's body includes both `discountPctOverride: 10` and `discountAmount: 50`, both `> 0`
- **THEN** the system returns HTTP 400 and the transaction does not commit

#### Scenario: discountAmount out of range rejected
- **WHEN** an item's `discountAmount` is `150` (exceeds the 100 MXN cap) or negative
- **THEN** the system returns HTTP 400 and the transaction does not commit

#### Scenario: discountAmount exceeding the line's gross clamps to zero, never negative
- **WHEN** an item has `quantity=1`, `price.price=80`, `discountAmount=100`
- **THEN** the system returns HTTP 201 with that line's `lineGross = 0` (not `-20`)

### Requirement: QuoteTotalsCalculator (domain service)
The system SHALL provide a pure domain service `QuoteTotalsCalculator` in `src/modules/quotes/domain/services/QuoteTotalsCalculator.ts` with a static method:

```
computeTotals(lines: QuoteLineInput[]): QuoteTotalsResult
```

`QuoteLineInput`: `{ quantity, unitPrice, discountPct?, discountAmount?, ivaRate?, iepsRate? }` — all decimals; `discountPct` defaults to `0` when absent; `discountAmount` defaults to `0` when absent; `ivaRate`/`iepsRate` default to `0` when `null`/absent.

`QuoteTotalsResult`: `{ lines: QuoteLineTotals[], subtotal, taxTotal, total }`. Each `QuoteLineTotals`: `{ lineSubtotal, lineIva, lineIeps, lineTax, lineTotal }`.

The formula and rounding strategy SHALL match `SaleTotalsCalculator` exactly. `unitPrice` is the final tax-inclusive price; tax is extracted, not added:

```
lineGross    = max(0, round(quantity * unitPrice * (1 - discountPct / 100), 4) - discountAmount)
divisor      = 1 + ivaRate + iepsRate
lineSubtotal = round(lineGross / divisor, 4)
lineIva      = round(lineSubtotal * ivaRate, 4)
lineIeps     = round(lineSubtotal * iepsRate, 4)
lineTax      = lineIva + lineIeps
lineTotal    = lineGross
```

Header totals = sum across lines. Rounding: banker's rounding (half-to-even) at 4 decimal places. The service SHALL throw if `quantity <= 0`, `unitPrice < 0`, `discountPct < 0 || discountPct > 100`, `discountAmount < 0 || discountAmount > 100`, `(discountPct > 0 && discountAmount > 0)` (mutually exclusive), `ivaRate < 0 || ivaRate > 1`, or `iepsRate < 0 || iepsRate > 1`. No I/O dependencies.

A unit test SHALL include an **equivalence block** that iterates over the same input vectors used by `SaleTotalsCalculator`'s tests (including vectors exercising `discountAmount`) and asserts identical outputs, guarding against silent divergence.

#### Scenario: Same fixture as SaleTotalsCalculator
- **WHEN** `computeTotals` is invoked with the same input as a `SaleTotalsCalculator` fixture
- **THEN** the returned `subtotal`, `taxTotal`, `total`, and per-line breakdown (including the tax-extraction formula and any `discountAmount`) are exactly equal

#### Scenario: Invalid input rejected
- **WHEN** `computeTotals([{ quantity: 0, unitPrice: 100 }])` is invoked
- **THEN** the method throws a validation error

#### Scenario: Domain purity
- **WHEN** unit tests run against the calculator
- **THEN** no Prisma, no fetch, no environment access is required

#### Scenario: With flat-amount discount
- **WHEN** `computeTotals([{ quantity: 1, unitPrice: 500, discountAmount: 100 }])` is invoked
- **THEN** `lineGross = 400`, `lineTotal = 400`, matching the equivalent `SaleTotalsCalculator` call exactly
