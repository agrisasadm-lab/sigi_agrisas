# Spec: quotes-api

## Purpose

Define the Quotes API: quote lifecycle (draft → authorized → converted | cancelled | expired), atomic emission, conversion to sale (delegating to the POS pipeline), the `QuoteTotalsCalculator` domain service, and branch scoping rules for all quote endpoints under `/api/v1/admin/quotes`. Quotes never touch `branch_inventory` — only conversion does, via the POS sale-creation pipeline.

---
## Requirements
### Requirement: Quote aggregate model
The system SHALL persist a quote as the aggregate `Quote` (header) + `QuoteItem` (lines) with the following invariants:

- `Quote.status` is one of `draft`, `authorized`, `converted`, `cancelled`, `expired`. Transitions are:
  - `draft → authorized` (via `POST /quotes/:id/authorize`)
  - `draft → cancelled` (via `DELETE /quotes/:id`)
  - `authorized → converted` (via `POST /quotes/:id/convert`)
  - `authorized → cancelled` (via `DELETE /quotes/:id`)
  - `authorized → expired` (computed implicitly when `expires_at < NOW()`; persisted only when `ConvertQuoteToSaleUseCase` detects expiry and refuses conversion — the row's `status` MAY remain `authorized` and the system MUST treat `(status='authorized' AND expires_at < NOW())` as logically "expired" on read).
  - `converted` and `cancelled` are terminal — no further transitions allowed.
- `Quote` references `branchId`, `customerId`, `creatorId` (the authenticated user who created the quote), `folioId`. All FKs `ON DELETE RESTRICT`. `customerId` and `branchId` are **immutable** after creation.
- `Quote.folioNumber` is an integer assigned atomically at creation; `(folioId, folioNumber)` is UNIQUE on `quotes`.
- `Quote.folioCode` is a snapshot of the folio's `code` and `prefix` (concatenated consistently with the convention used by `pos-api`).
- `Quote.subtotal`, `Quote.taxTotal`, `Quote.total` are persisted (computed at creation and at edit).
- `Quote.expiresAt` is nullable. `null` means "no expiration".
- `Quote.authorizedAt`, `Quote.authorizedBy` (UUID), `Quote.cancelledAt`, `Quote.cancellationReason`, `Quote.convertedAt`, `Quote.convertedSaleId` are nullable; populated only when the corresponding transition occurs.
- Each `QuoteItem` snapshots `productCodeSnapshot`, `productNameSnapshot`, `priceNameSnapshot`, `unitPrice`, `discountPct`, `ivaRate`, `iepsRate` (same fields and semantics as `SaleItem`). `productId` (FK `ON DELETE RESTRICT`) and `productPriceId` (FK `ON DELETE SET NULL`) are retained.
- Each `QuoteItem` persists `lineSubtotal`, `lineTax`, `lineTotal`.
- The quote SHALL NOT touch `branch_inventory` at any point in its lifecycle. Inventory is only affected via the conversion endpoint, which delegates to the existing POS pipeline.

#### Scenario: Snapshot survives product rename
- **WHEN** a quote is created for product `FERT_001 ("Fertilizante NPK")`, and later the product is renamed to `"Fertilizante NPK 16-16-16"`
- **THEN** `GET /api/v1/admin/quotes/:id` for the prior quote still returns `productNameSnapshot: "Fertilizante NPK"` on that line

#### Scenario: Snapshot survives price deletion
- **WHEN** a quote is created using `productPriceId = X`, and later the price `X` is hard-deleted via `DELETE /products/:id/prices/:priceId`
- **THEN** `GET /api/v1/admin/quotes/:id` still returns the persisted `unitPrice`, `discountPct`, and `priceNameSnapshot` from when the quote was emitted, with `productPriceId: null`

#### Scenario: Quote creation does not change inventory
- **WHEN** the inventory record for product P in branch B has `quantity = 50` and a quote with item `{ productId: P, quantity: 30 }` is created in B
- **THEN** the inventory record's `quantity` remains `50` after the POST

---

### Requirement: List quotes
The system SHALL expose `GET /api/v1/admin/quotes` that returns a paginated list of quotes. Requires the `quotes:read` permission. Query parameters: `page` (default 1), `pageSize` (default 20, max 100), `branchId` (optional UUID, subject to scoping), `customerId` (optional UUID), `status` (optional, comma-separated; one or more of `draft`, `authorized`, `converted`, `cancelled`, `expired`), `from` (optional ISO date — inclusive lower bound on `created_at`), `to` (optional ISO date — inclusive upper bound on `created_at`), `search` (optional, min 2 chars; matches `folio_code`, `folio_number::text`, or joined `customer.name`/`customer.rfc`).

`?status=expired` SHALL match quotes whose stored `status` is `expired` OR whose stored `status` is `authorized` AND `expires_at < NOW()`. This avoids requiring a cron to transition states.

Each `QuoteDto` includes `id`, `folioId`, `folioCode`, `folioNumber`, `branchId`, `branchName` (joined), `customerId`, `customerName` (joined), `customerRfc` (joined), `creatorId`, `creatorName` (joined), `status`, `isExpired` (computed: `status='authorized' AND expiresAt < NOW()`), `subtotal`, `taxTotal`, `total`, `notes`, `expiresAt`, `authorizedAt`, `authorizedBy` (or null), `cancelledAt`, `cancellationReason`, `convertedAt`, `convertedSaleId`, `createdAt`, `updatedAt`. `items` is NOT included in the list response.

Sorted by `created_at DESC`.

**Branch scoping**: identical to `pos-api`. If the caller does NOT have `branches:access_all`:

- If `?branchId=` is absent → the system implicitly applies `branchId = x-user-branch-id`. If `x-user-branch-id` is empty, returns HTTP 403.
- If `?branchId=<X>` is present and `X !== x-user-branch-id` → HTTP 403.

If the caller HAS `branches:access_all`: `?branchId=` is honored as a filter; absent → returns quotes across all branches.

#### Scenario: Operator lists own branch
- **WHEN** an `operator` with `x-user-branch-id: B1` (no `branches:access_all`) calls `GET /api/v1/admin/quotes`
- **THEN** the system implicitly filters to `branchId = B1` and returns HTTP 200

#### Scenario: Operator tries another branch
- **WHEN** an `operator` with `x-user-branch-id: B1` calls `GET /api/v1/admin/quotes?branchId=B2`
- **THEN** the system returns HTTP 403 `{"error": "Forbidden", "required": "branches:access_all"}`

#### Scenario: Admin lists all branches
- **WHEN** an `admin` (has `branches:access_all`) calls `GET /api/v1/admin/quotes` with no `?branchId=`
- **THEN** the system returns quotes from all branches

#### Scenario: Operator without branch tries to list
- **WHEN** an `operator` with `x-user-branch-id: ""` calls `GET /api/v1/admin/quotes` without `?branchId=`
- **THEN** the system returns HTTP 403

#### Scenario: Filter expired by computed condition
- **WHEN** the request includes `?status=expired` and there exists a quote with `status='authorized'`, `expires_at='2025-01-01T00:00:00Z'`
- **THEN** that quote is included in the response (its persisted status is still `authorized`, but it logically counts as expired)

#### Scenario: Filter by multiple statuses
- **WHEN** the request includes `?status=draft,authorized`
- **THEN** the response excludes quotes whose status is `cancelled`, `converted`, or `expired`

#### Scenario: Search by folio number
- **WHEN** the request includes `?search=42` and there exists a quote with `folio_number = 42` in folio code `COT`
- **THEN** that quote is included (also any quote where `customer.name` or `customer.rfc` contains "42")

#### Scenario: Search shorter than 2 chars rejected
- **WHEN** the request includes `?search=x`
- **THEN** the system returns HTTP 400

#### Scenario: pageSize exceeds max
- **WHEN** the request includes `?pageSize=200`
- **THEN** the system returns HTTP 400

#### Scenario: Forbidden without permission
- **WHEN** an authenticated user without `quotes:read` calls the endpoint
- **THEN** the system returns HTTP 403 `{"error": "Forbidden", "required": "quotes:read"}`

---

### Requirement: Get quote detail
The system SHALL expose `GET /api/v1/admin/quotes/:id` that returns a single quote with its items. Requires `quotes:read`. Returns HTTP 404 if not found. Branch scoping applies (callers without `branches:access_all` can only fetch quotes whose `branchId === x-user-branch-id`).

`QuoteDetailDto` extends `QuoteDto` with `items: QuoteItemDto[]`. Each `QuoteItemDto` includes `id`, `productId`, `productPriceId` (or `null`), `productCodeSnapshot`, `productNameSnapshot`, `priceNameSnapshot`, `quantity`, `unitPrice`, `discountPct`, `ivaRate`, `iepsRate`, `lineSubtotal`, `lineIva`, `lineIeps`, `lineTax`, `lineTotal`.

`lineIva` and `lineIeps` are derived fields — `QuoteItem` only persists `lineSubtotal`, `lineTax`, and `lineTotal`. The mapper SHALL compute `lineIva = roundHalfToEven(lineSubtotal * (ivaRate ?? 0), 4)` and `lineIeps = roundHalfToEven(lineSubtotal * (iepsRate ?? 0), 4)`, using the same banker's-rounding function (`roundHalfToEven`, half-to-even at 4 decimals) that `QuoteTotalsCalculator` uses when the line was first computed — never `Math.round` or any other rounding mode — so that `lineIva + lineIeps` always equals the persisted `lineTax` for that line.

The detail SHALL include `isExpired: boolean` (true if `status='authorized' AND expires_at < NOW()`) as a computed convenience flag for the UI.

The endpoint SHALL accept an optional query parameter `format` with allowed values `json` (default) and `pdf`. Any other value SHALL return HTTP 400. When `format=json` (or omitted), the response behaves exactly as described above (`QuoteDetailDto` as JSON). When `format=pdf`:
- The system SHALL render a PDF document (`QuotePdf`, via `@react-pdf/renderer`) built from the same `QuoteDetailDto` that `format=json` would return, plus issuer data (`businessName`, `businessRfc`, `businessAddress`, `businessPhone`, `logoUrl`) resolved server-side from `TicketSettings` (`GetTicketSettingsUseCase` → `toPdfIssuer`) — never from client input.
- The PDF header SHALL render the business logo: the tenant's uploaded logo (`TicketSettings.logoUrl`) when set, falling back to the bundled default logo (`public/logo.png`) when not set, resolved via the shared `resolvePdfLogoSource`/`PdfLogo` infrastructure (never a browser-relative path).
- The PDF's colors (table headers, alternating rows, totals band, borders, muted text) SHALL come from the shared brand palette (`pdfTheme`) instead of module-specific arbitrary hex values.
- The response SHALL have `Content-Type: application/pdf` and `Content-Disposition: attachment; filename="cotizacion-<folioCode>-<folioNumber>.pdf"`.
- All existing checks (UUID validation, `quotes:read`, branch scoping, 404 on not found) SHALL apply identically before the `format` branch, so `format=pdf` cannot be used to bypass authorization or existence checks.
- The `logoUrl` used SHALL be resolved with the same branch-scoping context already used for `businessName`/`businessRfc` — a caller SHALL never receive another branch's/tenant's logo.

#### Scenario: Authorized fetch
- **WHEN** a caller with `quotes:read` and access to the quote's branch fetches a valid `:id`
- **THEN** the system returns HTTP 200 with the `QuoteDetailDto`

#### Scenario: Out-of-branch fetch
- **WHEN** a caller without `branches:access_all` fetches a quote whose `branchId !== x-user-branch-id`
- **THEN** the system returns HTTP 403 (after resolving existence: if the quote does not exist, returns HTTP 404 — existence is NOT used as an oracle by 403)

#### Scenario: Quote not found
- **WHEN** the `:id` does not match any quote
- **THEN** the system returns HTTP 404 `{"error": "Quote not found"}`

#### Scenario: Invalid UUID format
- **WHEN** the `:id` is not a valid UUID
- **THEN** the system returns HTTP 400

#### Scenario: isExpired flag on logically expired quote
- **WHEN** the quote has `status='authorized'` and `expires_at='2025-01-01T00:00:00Z'` (in the past)
- **THEN** the response includes `isExpired: true`

#### Scenario: PDF download of an existing quote
- **WHEN** a caller with `quotes:read` and access to the quote's branch fetches `GET /quotes/:id?format=pdf` for a valid `:id`
- **THEN** the system returns HTTP 200 with `Content-Type: application/pdf`, a non-empty PDF buffer body, and `Content-Disposition: attachment` naming the file `cotizacion-<folioCode>-<folioNumber>.pdf`

#### Scenario: PDF download of a quote without an assigned customer
- **WHEN** `format=pdf` is requested for a quote whose `customerId` is `null`
- **THEN** the generated PDF renders "Cliente general" in the customer block instead of leaving it blank or failing

#### Scenario: PDF download respects branch scoping
- **WHEN** a caller without `branches:access_all` requests `format=pdf` for a quote whose `branchId !== x-user-branch-id`
- **THEN** the system returns HTTP 403, identically to the `format=json` case, without rendering any PDF

#### Scenario: PDF download of a non-existent quote
- **WHEN** `format=pdf` is requested for an `:id` that does not match any quote
- **THEN** the system returns HTTP 404 `{"error": "Quote not found"}`, identically to the `format=json` case

#### Scenario: Invalid format value
- **WHEN** the `format` query parameter is present with a value other than `json` or `pdf` (e.g. `format=xyz`)
- **THEN** the system returns HTTP 400

#### Scenario: PDF shows tenant logo when configured
- **WHEN** `format=pdf` is requested and the resolved `TicketSettings.logoUrl` is a valid `https://` URL
- **THEN** the generated PDF header renders that URL as the business logo

#### Scenario: PDF falls back to default logo when tenant has none configured
- **WHEN** `format=pdf` is requested and the resolved `TicketSettings.logoUrl` is `null`
- **THEN** the generated PDF header renders the bundled default logo (`public/logo.png`) instead of leaving the logo area blank or failing to render

#### Scenario: PDF uses brand color palette
- **WHEN** `format=pdf` is requested
- **THEN** the table header, alternating row, and totals band backgrounds in the generated PDF match the shared `pdfTheme` brand colors, not the previous arbitrary grays

#### Scenario: lineIva and lineIeps use the same rounding as lineTax
- **WHEN** a quote item has `lineSubtotal = 100.0002` and `iepsRate = 0.25` (a value where half-up and half-to-even rounding disagree at the 4th decimal)
- **THEN** the returned `lineIeps` SHALL equal `roundHalfToEven(100.0002 * 0.25, 4) = 25.0000`, and `lineIva + lineIeps` SHALL equal the persisted `lineTax` for that item — never the half-up result `25.0001`

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

**Idempotent replay via `clientRequestId`**: when the body includes a non-null `clientRequestId`, the controller SHALL, BEFORE any other validation in the atomic flow below, look up an existing `quotes` row with `client_request_id = clientRequestId`. If found, the system SHALL return HTTP 201 with that existing quote's `QuoteDetailDto` unchanged — it SHALL NOT re-validate the body, re-allocate a folio, or insert a new row. If not found, the atomic flow proceeds as normal and, on success, persists `client_request_id = clientRequestId` on the new `quotes` row. `client_request_id` is nullable and unique; online-created quotes (no `clientRequestId` in the body) leave it `null` and are never matched by this lookup. **This lookup-then-insert sequence is not itself atomic against a second, concurrent request carrying the same `clientRequestId`** (e.g. an `offline-sync` outbox retry fired before the first attempt's response is acknowledged): if both requests pass the lookup and attempt to insert, the database's unique constraint on `client_request_id` lets only one `INSERT` succeed. Because this `INSERT` is a raw `$executeRaw` statement (needed to support a nullable `customerId` ahead of a pending Prisma Client regeneration), the resulting conflict surfaces as Prisma error `P2010` ("Raw query failed") with `meta.code === "23505"`, not as the `P2002` Prisma raises for ORM-level unique violations. The system SHALL treat this conflict identically to the pre-insert lookup match regardless of which error shape it takes — it SHALL discard the failed attempt, re-query the now-existing `quotes` row by `client_request_id`, and return HTTP 201 with that row's `QuoteDetailDto`. It SHALL NOT surface this as an HTTP 500.

**Atomic flow (inside a Prisma transaction)**:

0. If `clientRequestId` is non-null, perform the idempotent-replay lookup described above; short-circuit on a match before any of the following steps.
1. Validate `customer.isActive`, `branch.isActive`, `folio.isActive`. Any inactive → HTTP 400.
2. For each item: load the `Product` and `ProductPrice`; verify `productPrice.productId === item.productId` (else `ProductPriceMismatchError` → HTTP 400), that `productPrice` belongs to a product whose `isActive = true` (else HTTP 400), and that `productPrice.branchId === null OR productPrice.branchId === branchId` — the price is either a global base price or an override belonging to the quote's own branch (else `ProductPriceNotAvailableForBranchError` → HTTP 400 `{"error": "Product price does not belong to this branch"}`; the error message SHALL NOT disclose the price or the other branch it belongs to). **Additionally, when `productPrice.branchId === null` (a base price was selected) AND the product has at least one `ProductPrice` override for the quote's `branchId`, the system SHALL reject with the same `ProductPriceNotAvailableForBranchError` → HTTP 400** — same rule `pos-api` applies to sale creation: once a branch has its own price for a product, the global base price is no longer a valid selection for that branch. `quantity > 0` (else HTTP 400 via Zod). If `item.quantity` is NOT an integer (`quantity % 1 !== 0`), resolve the currently configured `dosificationSurchargePct` from `settings-api` (default `5.0` when unconfigured) and compute `unitPrice = price.price * (1 + surchargePct / 100)`; if `item.quantity` IS an integer, `unitPrice = price.price` unchanged. This applies uniformly to every product — no per-product or per-department opt-out — and is the same rule `pos-api` applies to normal-price sale lines.
3. Snapshot `productCodeSnapshot = product.code`, `productNameSnapshot = product.name`, `priceNameSnapshot = price.name`, `unitPrice` per step 2 above (recharged when `quantity` is fractional, else `price.price` unchanged), `discountPct = item.discountPctOverride ?? price.discountPct`, `discountAmount = item.discountAmount ?? 0`, `ivaRate = product.ivaRate`, `iepsRate = product.iepsRate`. This server-computed snapshot is authoritative even for offline-originated quotes — a `clientRequestId`-bearing request carries only IDs/quantities/discount selections, never client-computed line totals, so catalog drift between offline creation and sync time is always resolved in favor of the server's live catalog. The snapshot does NOT record which branch's price (base or override) was used — only the resolved `unitPrice` value; this snapshot is what `pos-api`'s "Convert quote to sale" carries forward unchanged (including `discountAmount`), so a converted sale is never re-validated against branch price or discount at conversion time.
4. Compute totals using `QuoteTotalsCalculator` (domain service) — unchanged by the fractional-quantity surcharge (operates on `quantity * unitPrice`, agnostic to how `unitPrice` was resolved); now also receives `discountAmount` per line (see "QuoteTotalsCalculator (domain service)").
5. Allocate the next folio number **for the quote's own branch** atomically via `allocateBranchFolio(tx, folioId, branchId)` — same per-branch counter and `folioCode` format (`<prefix><BRANCH_CODE>-<NNNNNN>`, e.g. `COT-ZARIOZ-000001`) described in `pos-api` — "Create sale (atomic emission)". If the folio is inactive → HTTP 400. Legacy `folioCode`s issued before this change are preserved unchanged.
6. `INSERT` the `quotes` row with `status='draft'`, `creator_id=<userId from x-user-id>`, snapshotted folio info, `expires_at` from the body, and `client_request_id = clientRequestId` (or `null`).
7. `INSERT` the `quote_items` rows.

If step 6 fails with a unique-constraint violation on `client_request_id` (the concurrent-replay case described above, surfaced as Prisma `P2010`/`23505` because of the raw INSERT), the system SHALL abandon step 7 for this attempt, re-query the existing `quotes` row by `client_request_id`, and return it instead.

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

#### Scenario: Concurrent duplicate clientRequestId resolved idempotently
- **WHEN** two requests carrying the exact same non-null `clientRequestId` reach the atomic flow close enough together that both pass the pre-insert lookup (step 0) before either has committed, and the database's unique constraint on `client_request_id` lets only one raw `INSERT` (step 6) succeed, surfacing Prisma error `P2010` with `meta.code === "23505"` on the loser
- **THEN** the request whose `INSERT` loses the race returns HTTP 201 with the winning request's `QuoteDetailDto` (same `id`, same folio) instead of HTTP 500; no duplicate `quote_items` rows are created

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

---

### Requirement: Update quote (draft only)
The system SHALL expose `PATCH /api/v1/admin/quotes/:id`. Requires `quotes:write`. The body MAY include `items: QuoteItemInput[]` (full replacement; min 1), `notes: string | null`, `expiresAt: string | null`. Body MUST contain at least one of these fields, else HTTP 400.

The body MUST NOT change `folioId`, `folioNumber`, `branchId`, or `customerId`. Any of these fields present in the body SHALL be ignored silently.

The endpoint SHALL reject any quote whose `status !== 'draft'` with HTTP 409 `{"error": "Quote cannot be edited in current status", "status": "<actual>"}`.

Behavior (inside a Prisma transaction) when `items` is present:

- Validate each item (same rules as creation: active product, matching `productPrice.productId`, `quantity > 0`).
- Snapshot each item (same fields as creation, including the fractional-quantity surcharge resolution: `unitPrice` recharged when `item.quantity` is not an integer, unchanged otherwise).
- Delete all rows from `quote_items` for this `quoteId`.
- Insert new `quote_items`.
- Recompute totals via `QuoteTotalsCalculator` and `UPDATE quotes SET subtotal=?, tax_total=?, total=?, notes=?, expires_at=?`.

When `items` is absent, only `notes` and/or `expires_at` are updated; totals are not recomputed.

Branch scoping applies (cannot edit a quote in another branch without bypass).

#### Scenario: Edit draft items
- **WHEN** an authorized caller PATCHes a `draft` quote with a new `items` array
- **THEN** the system returns HTTP 200 with the recomputed `QuoteDetailDto`

#### Scenario: Update only notes
- **WHEN** the body is `{ "notes": "Cliente solicitó descuento al cerrar" }` on a `draft` quote
- **THEN** the system returns HTTP 200 and `subtotal`/`tax_total`/`total` remain unchanged

#### Scenario: Edit authorized rejected
- **WHEN** the quote has `status='authorized'` and PATCH is called
- **THEN** the system returns HTTP 409 `{"error": "Quote cannot be edited in current status", "status": "authorized"}`

#### Scenario: Edit converted rejected
- **WHEN** the quote has `status='converted'` and PATCH is called
- **THEN** the system returns HTTP 409 `{"error": "Quote cannot be edited in current status", "status": "converted"}`

#### Scenario: Folio invariants preserved
- **WHEN** the body includes `folioId` or `folioNumber`
- **THEN** the system silently ignores those fields and persists the original folio data

#### Scenario: Customer/branch invariants preserved
- **WHEN** the body includes `customerId` or `branchId` different from the quote's persisted values
- **THEN** the system silently ignores them and persists the original values

#### Scenario: Empty body
- **WHEN** the body is `{}` or contains only ignored fields
- **THEN** the system returns HTTP 400 `{"error": "At least one updatable field must be provided"}`

#### Scenario: Edit zeroes out items
- **WHEN** the body has `items: []`
- **THEN** the system returns HTTP 400 `{"error": "Quote must include at least one item"}`

#### Scenario: Edit changes a line from integer to fractional quantity
- **WHEN** the body replaces an item that previously had `quantity=2` (no surcharge) with the same `productPriceId` but `quantity=2.5`
- **THEN** the system recomputes `unitPrice` for that line WITH the configured surcharge applied, and the resulting totals reflect it

---

### Requirement: Authorize quote
The system SHALL expose `POST /api/v1/admin/quotes/:id/authorize`. Requires `quotes:authorize`. Body MAY be empty or `{ "notes": "..." }` (optional `notes` appended to the quote, max 1000 chars).

Behavior:

- If `quote.status !== 'draft'` → HTTP 409 `{"error": "Quote cannot be authorized in current status", "status": "<actual>"}`.
- If `quote.expiresAt !== null && quote.expiresAt < NOW()` → HTTP 409 `{"error": "Quote has expired"}`. (An expired draft cannot be authorized; the user must extend `expires_at` via PATCH first or cancel and create a new one.)
- Set `status='authorized'`, `authorized_at=NOW()`, `authorized_by=<userId from x-user-id>`. If body includes `notes`, append it to existing `quote.notes` (or set if `notes` was null).

Branch scoping applies.

Returns HTTP 200 with the updated `QuoteDetailDto`.

#### Scenario: Authorize draft
- **WHEN** an authorized caller authorizes a `draft` quote
- **THEN** the system returns HTTP 200 with `status='authorized'` and `authorizedAt`/`authorizedBy` populated

#### Scenario: Authorize already authorized
- **WHEN** the quote is `authorized` (not `draft`)
- **THEN** the system returns HTTP 409

#### Scenario: Authorize cancelled
- **WHEN** the quote is `cancelled`
- **THEN** the system returns HTTP 409

#### Scenario: Authorize expired draft
- **WHEN** the quote has `status='draft'` and `expires_at < NOW()`
- **THEN** the system returns HTTP 409 `{"error": "Quote has expired"}`

#### Scenario: Out-of-branch
- **WHEN** an operator in branch B1 tries to authorize a quote whose `branchId=B2` and lacks `branches:access_all`
- **THEN** the system returns HTTP 403

#### Scenario: Forbidden without quotes:authorize
- **WHEN** a caller without `quotes:authorize` calls the endpoint
- **THEN** the system returns HTTP 403 `{"error": "Forbidden", "required": "quotes:authorize"}`

---

### Requirement: Cancel quote
The system SHALL expose `DELETE /api/v1/admin/quotes/:id`. Requires `quotes:cancel`. Body MAY include `{ "reason": string | null }` (max 500 chars).

Behavior:

- If `quote.status === 'cancelled'` → HTTP 409 `{"error": "Quote is already cancelled"}` (NOT silently idempotent — duplicate clicks should warn the operator).
- If `quote.status === 'converted'` → HTTP 409 `{"error": "Converted quotes cannot be cancelled. Cancel the related sale instead.", "saleId": "<convertedSaleId>"}`.
- Otherwise (`draft` or `authorized`) → set `status='cancelled'`, `cancelled_at=NOW()`, `cancellation_reason=<reason>`. The folio number stays consumed (no reuse).

Branch scoping applies.

Returns HTTP 200 with the updated `QuoteDetailDto`.

#### Scenario: Cancel draft
- **WHEN** an authorized caller cancels a `draft` quote
- **THEN** the system returns HTTP 200 with `status='cancelled'`

#### Scenario: Cancel authorized
- **WHEN** an authorized caller cancels an `authorized` quote
- **THEN** the system returns HTTP 200 with `status='cancelled'`

#### Scenario: Cancel already cancelled
- **WHEN** the quote is `cancelled`
- **THEN** the system returns HTTP 409 `{"error": "Quote is already cancelled"}`

#### Scenario: Cancel converted forbidden
- **WHEN** the quote is `converted`
- **THEN** the system returns HTTP 409 with the related `saleId` in the body so the UI can deep-link to the sale-cancellation flow

#### Scenario: Folio stays consumed
- **WHEN** a quote with `folio_number = 42` (folio code "COT") is cancelled
- **THEN** the next created quote on the same folio takes `folio_number = 43`, not `42`

#### Scenario: Quote not found
- **WHEN** the `:id` does not match any quote
- **THEN** the system returns HTTP 404

#### Scenario: Forbidden without quotes:cancel
- **WHEN** a caller without `quotes:cancel` calls the endpoint
- **THEN** the system returns HTTP 403

---

### Requirement: Convert quote to sale
The system SHALL expose `POST /api/v1/admin/quotes/:id/convert`. Requires `quotes:convert`. Required body:

- `paymentMethodId: string` (UUID of an active payment method)
- `folioId: string` (UUID of an active **fiscal** folio for the resulting sale — distinct from the quote's folio)

Optional body: `notes: string | null` (max 1000 chars; if present, overrides the quote's `notes` in the resulting sale; if absent, the sale inherits `quote.notes`).

Behavior (inside a Prisma transaction):

- If `quote.status === 'converted'` AND `quote.convertedSaleId !== null` → idempotent: return HTTP 200 with the existing `SaleDetailDto` (loaded via `SaleRepository.findByIdWithItems`). No second decrement, no second folio increment.
- If `quote.status !== 'authorized'` → HTTP 409 `{"error": "Quote must be authorized before converting", "status": "<actual>"}`.
- If `quote.expiresAt !== null && quote.expiresAt < NOW()` → HTTP 409 `{"error": "Quote has expired"}`.
- Validate `paymentMethod.isActive` and `folio.isActive` (each → HTTP 400 on inactive).
- Reuse the POS sale-creation pipeline (`SaleRepository.createCompletedFromQuote(input, tx)`) with:
  - `branchId = quote.branchId`
  - `customerId = quote.customerId`
  - `paymentMethodId = body.paymentMethodId`
  - `folioId = body.folioId` (fiscal folio, separate atomic increment from the quote's folio)
  - `cashierId = userId` (from `x-user-id`)
  - `items` constructed by mapping each `quote_item` → `{ productId, productPriceId, quantity, productCodeSnapshot, productNameSnapshot, priceNameSnapshot, unitPrice, discountPct, ivaRate, iepsRate }`. The snapshot fields are passed through directly (NOT re-resolved) to guarantee the cotizado price is what is billed.
  - `notes = body.notes ?? quote.notes`
  - `quoteId = quote.id`
- The created sale follows all POS rules: fiscal folio incremented, `branch_inventory.quantity` decremented per item (allowed to go negative), `sale.status='completed'`, `sale.quoteId = quote.id`.
- **Credit flow (non-blocking)**: if `paymentMethod.isCredit === true`, the system SHALL NOT reject the conversion for lacking a credit line or for exceeding `creditLimit` — the conversion always completes (same rule as `POST /api/v1/admin/sales`, see `pos-api` "Create sale (atomic emission)" § Credit flow auto-activation). The resulting `SaleDetailDto` includes the informational flag `creditLimitExceeded = customer.creditLimit !== null && (customer.currentBalance + sale.total) > customer.creditLimit` (`false` when `creditLimit === null`).
- `UPDATE quotes SET status='converted', converted_at=NOW(), converted_sale_id=<saleId>`.

Branch scoping applies (the quote's `branchId` must match `x-user-branch-id` unless the caller has `branches:access_all`).

Returns HTTP 200 with the resulting `SaleDetailDto` (including `creditLimitExceeded: boolean`).

**BREAKING**: this endpoint no longer returns HTTP 409 for a credit limit or missing credit line on the resulting sale. Callers MUST read `creditLimitExceeded` from the HTTP 200 body instead.

#### Scenario: Convert authorized quote successfully
- **WHEN** an authorized caller converts an `authorized` quote with a valid `paymentMethodId` and fiscal `folioId`
- **THEN** the system returns HTTP 200 with the `SaleDetailDto`, `quote.status='converted'`, `quote.convertedSaleId` populated, `sale.quoteId` populated, fiscal folio incremented by 1, `branch_inventory.quantity` decremented per item

#### Scenario: Idempotent re-convert
- **WHEN** the caller invokes `/convert` a second time on a quote that already has `convertedSaleId` set
- **THEN** the system returns HTTP 200 with the same `SaleDetailDto` as the first call; no second decrement, no second folio increment, no second sale row

#### Scenario: Convert draft rejected
- **WHEN** the quote has `status='draft'`
- **THEN** the system returns HTTP 409 `{"error": "Quote must be authorized before converting", "status": "draft"}`

#### Scenario: Convert cancelled rejected
- **WHEN** the quote has `status='cancelled'`
- **THEN** the system returns HTTP 409

#### Scenario: Convert expired rejected
- **WHEN** the quote is `authorized` and `expires_at < NOW()`
- **THEN** the system returns HTTP 409 `{"error": "Quote has expired"}`

#### Scenario: Inactive payment method
- **WHEN** the body's `paymentMethodId` references a payment method with `isActive=false`
- **THEN** the system returns HTTP 400

#### Scenario: Inactive fiscal folio
- **WHEN** the body's `folioId` references a folio with `isActive=false`
- **THEN** the system returns HTTP 400

#### Scenario: Out-of-branch conversion
- **WHEN** an operator in branch B1 tries to convert a quote whose `branchId=B2` and lacks `branches:access_all`
- **THEN** the system returns HTTP 403

#### Scenario: Inventory decrements on conversion
- **WHEN** the quote has an item `{ productId: P, quantity: 10 }` and `branch_inventory.quantity` for P in the target branch is `25`
- **THEN** after a successful conversion, `branch_inventory.quantity` for P is `15`

#### Scenario: Conversion allows negative stock
- **WHEN** the quote has an item `{ productId: P, quantity: 30 }` and `branch_inventory.quantity` for P is `10`
- **THEN** after conversion, `branch_inventory.quantity` is `-20` (same rule as direct POS sales)

#### Scenario: notes inheritance
- **WHEN** the quote has `notes="Cliente prefiere entrega martes"` and the convert body has no `notes`
- **THEN** the resulting `sale.notes = "Cliente prefiere entrega martes"`

#### Scenario: notes override
- **WHEN** the quote has `notes="A"` and the convert body has `notes="B"`
- **THEN** the resulting `sale.notes = "B"`; `quote.notes` is NOT modified

#### Scenario: Forbidden without quotes:convert
- **WHEN** a caller without `quotes:convert` calls the endpoint
- **THEN** the system returns HTTP 403 `{"error": "Forbidden", "required": "quotes:convert"}`

#### Scenario: Quote cancellation after conversion forbidden
- **WHEN** a converted quote is sent to `DELETE /api/v1/admin/quotes/:id`
- **THEN** the system returns HTTP 409 with the related `saleId`, instructing to cancel the sale instead (see "Cancel quote" requirement)

#### Scenario: Credit conversion exceeds creditLimit — conversion still completes with warning flag
- **WHEN** the conversion selects a `paymentMethod` with `isCredit=true` for a customer with `creditLimit=10000`, `currentBalance=8000`, and the resulting sale `total=5000`
- **THEN** the system returns HTTP 200 (NOT 409) with `creditLimitExceeded=true`; the sale, folio increment, and inventory decrement are all persisted; `customer.currentBalance` becomes `13000`

#### Scenario: Credit conversion for customer without credit line — conversion still completes
- **WHEN** the conversion selects a `paymentMethod` with `isCredit=true` for a customer with `creditLimit=null`
- **THEN** the system returns HTTP 200 (NOT 409) with `creditLimitExceeded=false`; the sale is persisted normally

---

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

### Requirement: Branch scoping pattern for quote endpoints
Every route handler in `quotes-api` that operates on a quote or on a branch-filtered listing SHALL enforce the branch-scoping pattern via the shared helper `enforceBranchScope(req, resourceBranchId)` from `src/modules/rbac/infrastructure/http/enforceBranchScope.ts`. The pattern matches `pos-api`: callers without `branches:access_all` whose `x-user-branch-id` differs from `resourceBranchId` receive HTTP 403 `{"error": "Forbidden", "required": "branches:access_all"}`.

For reads (`GET /quotes/:id`, `POST /quotes/:id/authorize|cancel|convert`), the handler SHALL resolve the quote's `branchId` BEFORE applying the check — if the quote does not exist, return HTTP 404 (existence is not leaked as 403 vs 404).

For creates (`POST /quotes`), `resourceBranchId` is the `branchId` in the request body.

For listings (`GET /quotes`), the scoping resolves the implicit `branchId` filter as described in the "List quotes" requirement.

#### Scenario: Existence is not leaked
- **WHEN** an unauthorized user requests `GET /api/v1/admin/quotes/<id-of-quote-in-other-branch>` for a quote that DOES exist
- **THEN** the system returns HTTP 403 (after resolving the quote and finding its `branchId !== x-user-branch-id`); the same path for an ID that does NOT exist returns HTTP 404 — but only to callers who would have been authorized had the quote existed

#### Scenario: Helper reused, not re-implemented
- **WHEN** the `quotes` module is integrated
- **THEN** `QuotesController` imports `enforceBranchScope` from the shared RBAC location; it does NOT duplicate the helper

---

### Requirement: Quote entity in domain
The system SHALL provide `Quote` and `QuoteItem` domain entities in `src/modules/quotes/domain/entities/` with factories `Quote.create()` and `QuoteItem.create()` that construct valid instances. `Quote.create()` SHALL initialize `status='draft'`, `subtotal/taxTotal/total=0` (placeholders before the totals are recomputed), and timestamps. `Quote` SHALL expose typed errors `QuoteNotFoundError`, `QuoteNotEditableError(status)`, `QuoteAlreadyAuthorizedError`, `QuoteNotAuthorizedError(status)`, `QuoteAlreadyConvertedError(saleId)`, `QuoteAlreadyCancelledError`, `QuoteExpiredError`, `EmptyQuoteError`, `ProductPriceMismatchError`.

#### Scenario: Valid construction
- **WHEN** `Quote.create({ branchId, customerId, folioId, folioNumber, folioCode, creatorId, ... })` is invoked
- **THEN** an instance is returned with `status='draft'`, `convertedSaleId=null`, `cancelledAt=null`, and `authorizedAt=null`

#### Scenario: Status transitions enforced
- **WHEN** `quote.markAuthorized(userId)` is invoked on a quote whose `status !== 'draft'`
- **THEN** the method throws `QuoteAlreadyAuthorizedError` or the appropriate transition error

---

### Requirement: Folio scope must be POS for quotes

`CreateQuoteUseCase` y `ConvertQuoteToSaleUseCase` SHALL validar, después de cargar el `Folio` desde el `folioId` recibido, que `folio.scope === 'POS'`. Si el scope no coincide, el use case SHALL lanzar `FolioScopeMismatchError(expected='POS', actual=<folio.scope>)` que el controller mapea a HTTP 400 `{"error":"FolioScopeMismatch","expected":"POS","actual":"<scope>"}`. La validación SHALL ocurrir en el mismo paso que `folio.isActive`, antes de cualquier asignación de folio. `UpdateQuoteUseCase` no admite cambios de `folioId` (folio inmutable tras creación), por lo que NO requiere chequeo adicional: el folio original ya fue validado contra `scope='POS'` en la creación.

#### Scenario: Crear cotización con folio COT (POS)

- **WHEN** un usuario con `quotes:create` envía `POST /api/v1/admin/quotes` con `folioId` apuntando al folio `COT` (`scope='POS'`)
- **THEN** el sistema procede con la creación normal y retorna HTTP 201

#### Scenario: Crear cotización con folio OPERATIONS rechazada

- **WHEN** la request usa `folioId` apuntando a un folio cuyo `scope='OPERATIONS'` (e.g. `RB`)
- **THEN** el sistema retorna HTTP 400 `{"error":"FolioScopeMismatch","expected":"POS","actual":"OPERATIONS"}` SIN incrementar `current_number`

#### Scenario: Convertir cotización con folio fiscal scope mismatch rechazada

- **WHEN** un usuario con `quotes:convert` envía `POST /api/v1/admin/quotes/:id/convert` con `folioId` apuntando a un folio cuyo `scope='OPERATIONS'`
- **THEN** el sistema retorna HTTP 400 `{"error":"FolioScopeMismatch","expected":"POS","actual":"OPERATIONS"}` y NO crea la venta ni incrementa `current_number`

---

### Requirement: No inventory side-effects in quote lifecycle
The system SHALL NOT modify `branch_inventory.quantity`, `branch_inventory.reserved_quantity`, or any other inventory column at any point during quote creation, editing, authorization, or cancellation. The only quote-related operation that modifies inventory is `POST /quotes/:id/convert`, which delegates to the POS sale-creation pipeline (`SaleRepository.createCompletedFromQuote`) — and that decrement is attributed to the resulting sale, not to the quote.

#### Scenario: Quote create does not decrement
- **WHEN** a quote with item `{ productId: P, quantity: 10 }` is created in branch B
- **THEN** `branch_inventory.quantity` for (B, P) is unchanged

#### Scenario: Quote authorize does not reserve
- **WHEN** a `draft` quote is authorized
- **THEN** no `branch_inventory` row is created, modified, or locked; `reserved_quantity` is NOT incremented

#### Scenario: Quote cancel does not restore
- **WHEN** an `authorized` quote is cancelled
- **THEN** `branch_inventory.quantity` is unchanged (since nothing was decremented at any prior step)

#### Scenario: Only conversion touches inventory
- **WHEN** an `authorized` quote is converted to a sale
- **THEN** the inventory decrement happens as part of the POS pipeline (the same SQL UPDATE used by `POST /sales`), driven by the resulting `Sale`, and is reversible only by cancelling that `Sale` via `POST /api/v1/admin/sales/:id/cancel`

### Requirement: Product availability gate on quote creation and update
When the inventory scope mode (`inventory-api` — Configurable inventory scope mode) is `branch`, creating a quote (`POST /api/v1/admin/quotes`) or updating a draft quote (`PATCH /api/v1/admin/quotes/:id`) SHALL reject any line item whose `productId` has no `branch_inventory` row for the quote's `branchId`, with the same HTTP 400 `ProductNotAvailableInBranch` error defined in `pos-api` (Requirement: Product availability gate on sale creation and edit). This mirrors the sale-side gate so that a quote is not authorizable/convertible into a sale that would itself be rejected later.

When the inventory scope mode is `general`, this gate does not apply — quote creation and update behave exactly as before this capability.

#### Scenario: Quote creation rejects unassigned product in branch mode
- **WHEN** the inventory scope mode is `branch` and `POST /api/v1/admin/quotes` includes a line item for a product with no `branch_inventory` row in the quote's `branchId`
- **THEN** the system returns HTTP 400 `ProductNotAvailableInBranch` and creates no quote

#### Scenario: Draft quote update enforces the same gate
- **WHEN** the inventory scope mode is `branch` and `PATCH /api/v1/admin/quotes/:id` (status `draft`) replaces line items with one referencing a product not assigned to the quote's branch
- **THEN** the system returns HTTP 400 `ProductNotAvailableInBranch` and does not apply the update

#### Scenario: Gate does not apply in general mode
- **WHEN** the inventory scope mode is `general` and a quote includes a product with no `branch_inventory` row anywhere
- **THEN** the quote is created normally (unchanged behavior)

#### Scenario: Authorize and cancel are unaffected
- **WHEN** the inventory scope mode is `branch` and an already-created quote is authorized or cancelled
- **THEN** neither operation re-evaluates product availability — the gate only applies at creation, draft update, and conversion (see below), consistent with quotes having no inventory side-effects until conversion (`quotes-api` — No inventory side-effects in quote lifecycle)

### Requirement: Product availability gate on quote conversion
When the inventory scope mode is `branch`, converting an authorized quote to a sale (`POST /api/v1/admin/quotes/:id/convert`) SHALL re-check availability for every line item's `productId` against the quote's `branchId`, and reject with the same HTTP 400 `ProductNotAvailableInBranchError` used by sale and quote creation, before allocating a fiscal folio or touching inventory. This re-check exists because availability can change between quote creation/authorization and conversion — e.g. an administrator unassigns the product from the branch via `DELETE /inventory/:productId` after the quote was authorized. Without this requirement, conversion would only be stopped by the low-level write-layer guard in `inventory-api` (Sale movements do not auto-create missing branch inventory rows in branch scope mode), which throws an unhandled internal error instead of a clean 400.

#### Scenario: Conversion rejects a product unassigned since quote creation
- **WHEN** the inventory scope mode is `branch`, a quote was created and authorized while its product was assigned to the branch, the assignment was later removed, and `POST /api/v1/admin/quotes/:id/convert` is called
- **THEN** the system returns HTTP 400 `ProductNotAvailableInBranchError` and does not allocate a folio, decrement inventory, or mark the quote converted

#### Scenario: Conversion succeeds when availability is unchanged
- **WHEN** the inventory scope mode is `branch` and every line item's product remains assigned to the quote's branch at conversion time
- **THEN** conversion proceeds normally (unchanged behavior)

#### Scenario: Gate does not apply in general mode
- **WHEN** the inventory scope mode is `general`
- **THEN** conversion behaves exactly as before this capability, with no availability re-check

### Requirement: Customer branch membership gate on quote creation

Creating a quote (`POST /api/v1/admin/quotes`) SHALL reject the request when a non-null `customerId` does not have branch membership in the quote's `branchId` (`customers-api` — Customer branch membership), with the same HTTP 400 `CustomerNotAvailableInBranch` error defined in `pos-api` (Requirement: Customer branch membership gate on sale creation and edit). This check is UNCONDITIONAL (not gated by `INVENTORY_SCOPE_MODE`), consistent with the sale-side gate. `customerId` is immutable after quote creation (`quotes-api` — Update quote (draft only): the body MUST NOT change `customerId`), so no equivalent check is needed on `PATCH /api/v1/admin/quotes/:id` or on conversion — the customer was already validated at creation and cannot change afterward.

#### Scenario: Quote creation rejects a customer not assigned to the quote's branch
- **WHEN** `POST /api/v1/admin/quotes` has `branchId: <PRADERA>` and `customerId` referencing a customer whose `branchIds` is `["<ZARIOZ>"]` only
- **THEN** the system returns HTTP 400 `CustomerNotAvailableInBranch` and creates no quote

#### Scenario: Quote creation succeeds for a customer with multi-branch membership
- **WHEN** `POST /api/v1/admin/quotes` has `branchId: <PRADERA>` and `customerId` referencing a customer whose `branchIds` includes both `<ZARIOZ>` and `<PRADERA>`
- **THEN** the quote is created normally

#### Scenario: Gate is unconditional regardless of inventory scope mode
- **WHEN** the inventory scope mode is `general` and a quote references a customer not assigned to the quote's branch
- **THEN** the system still returns HTTP 400 `CustomerNotAvailableInBranch`

#### Scenario: Update and conversion do not re-check (customerId is immutable)
- **WHEN** a quote was validly created with a customer belonging to its branch, then `PATCH /api/v1/admin/quotes/:id` or `POST /api/v1/admin/quotes/:id/convert` is called
- **THEN** neither operation re-validates customer branch membership — `customerId` cannot have changed since creation

