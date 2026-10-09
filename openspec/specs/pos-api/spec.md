# Spec: pos-api

## Purpose

Define the Point-of-Sale (POS) API: atomic sale emission, cancellation, editing, and listing under `/api/v1/admin/sales`. Includes the `SaleTotalsCalculator` domain service and branch scoping rules for all sale endpoints.

---
## Requirements
### Requirement: Sale aggregate model
The system SHALL persist a sale as the aggregate `Sale` (header) + `SaleItem` (lines) with the following invariants:

- `Sale.status` is one of `completed`, `cancelled`, `edited`. There is no `open`/`draft` state — the cart lives in the client.
- `Sale.paymentStatus` is one of `paid`, `partial`, `pending`. Computed and persisted at every mutation that affects `paidAmount`:
  - `paid` when `paidAmount >= total`.
  - `partial` when `0 < paidAmount < total`.
  - `pending` when `paidAmount === 0`.
  - For sales whose `paymentMethod.isCredit === false`, `paymentStatus` is ALWAYS `paid` from emission (no `CustomerPayment` rows ever attach to them — they're paid at the moment).
  - For sales whose `paymentMethod.isCredit === true`, `paymentStatus` starts at `pending` and progresses to `partial` and then `paid` as `CustomerPayment` rows accumulate.
- `Sale.paidAmount` is `Decimal(14,4) DEFAULT 0`. Updated atomically by `RegisterPaymentUseCase` and `CancelPaymentUseCase` of the `payments` module (and on cancellation/edit of the sale when no active payments exist).
- The "credit nature" of a sale is NOT a field on `Sale`; it is inferred from `Sale.paymentMethod.isCredit` via JOIN (or `include`). The application MAY expose a derived `isCredit: boolean` in DTOs at read time but SHALL NOT persist it as a column on `sales`. Consumers SHOULD treat `paymentMethod.isCredit` as the source of truth.
- `Sale` references `branchId`, `customerId`, `cashierId` (the authenticated user who emitted the sale), `paymentMethodId`, `folioId`. All FKs `ON DELETE RESTRICT` (cancelling these catalog rows requires reassigning or archiving sales first).
- `Sale.folioNumber` is an integer assigned atomically at emission; `(folioId, folioNumber)` is UNIQUE.
- `Sale.folioCode` is a snapshot of the folio's `code` (and `prefix` when present, concatenated as `"${prefix}${number}"` or `"${code}-${number}"` per implementation choice — documented in `pos-api`).
- `Sale.subtotal`, `Sale.taxTotal`, `Sale.total` are persisted (computed at emission).
- `Sale.quoteId` is a nullable reference to a `Quote` (FK `ON DELETE SET NULL`). Indexed via `sales(quote_id)`. When the sale was emitted directly via `POST /api/v1/admin/sales` without a quote, the column is `null`. When the sale was emitted via `POST /api/v1/admin/quotes/:id/convert`, the column points to the originating quote.
- Each `SaleItem` snapshots `productCodeSnapshot`, `productNameSnapshot`, `priceNameSnapshot`, `unitPrice`, `discountPct`, `ivaRate`, `iepsRate` so the ticket survives later changes to the catalog. `productId` (FK `ON DELETE RESTRICT`) and `productPriceId` (FK `ON DELETE SET NULL`) are retained for reporting.
- Each `SaleItem` persists `lineSubtotal`, `lineTax`, `lineTotal`.
- **Dosification lines**: a `SaleItem` MAY originate from a `ProductDosification` instead of a `ProductPrice`. In that case `productPriceId` SHALL be `null`, and the line additionally persists `dosificationId` (nullable FK to `product_dosifications`, `ON DELETE SET NULL`) and `numPartsSnapshot` (nullable `INT`, the dosification's `numParts` at the time of sale). `priceNameSnapshot` SHALL hold the dosification's `name` for these lines (same column, same display purpose as for price-based lines). Exactly one of `productPriceId`/`dosificationId` SHALL be non-null per `SaleItem` — never both, never neither. `unitPrice` for a dosification line is `DosificationPriceCalculator.computeUnitPrice(defaultPrice.price, numParts, surchargePct)`, where `surchargePct` is the value currently configured via `settings-api` (`GET /settings/pricing` → `dosificationSurchargePct`, default `5.0`) — NOT a fixed constant. `quantity` for a dosification line represents the number of dosification parts sold and MAY exceed `numParts` (selling more than one full container in a single line is allowed, e.g. 6 parts of a `numParts=4` dosification).
- **Inventory quantity for dosification lines**: any operation that moves `branch_inventory.quantity` from a `SaleItem` (creation, cancellation, edit) SHALL use `quantity / numPartsSnapshot` as the base-unit amount when `numPartsSnapshot` is non-null, instead of `quantity` directly. For lines without a dosification (`numPartsSnapshot = null`), the amount is `quantity` unchanged (no behavior change).

#### Scenario: Snapshot survives product rename
- **WHEN** a sale is completed for product `ARROZ_001 ("Arroz 1kg")`, and later the product is renamed to `"Arroz Integral 1kg"`
- **THEN** `GET /api/v1/admin/sales/:id` for the prior sale still returns `productNameSnapshot: "Arroz 1kg"` on that line

#### Scenario: Snapshot survives price deletion
- **WHEN** a sale is completed using `productPriceId = X`, and later the price `X` is hard-deleted via `DELETE /products/:id/prices/:priceId`
- **THEN** `GET /api/v1/admin/sales/:id` still returns the persisted `unitPrice`, `discountPct`, and `priceNameSnapshot` from when the sale was emitted, with `productPriceId: null` in the response

#### Scenario: Quote link exposed in detail
- **WHEN** a sale was emitted via `POST /api/v1/admin/quotes/:id/convert` from a quote whose id is `Q`
- **THEN** `GET /api/v1/admin/sales/:saleId` returns `quoteId: "Q"` in the `SaleDetailDto`

#### Scenario: Direct sale has null quote link
- **WHEN** a sale was emitted via `POST /api/v1/admin/sales` without a `quoteId` in the body
- **THEN** `GET /api/v1/admin/sales/:saleId` returns `quoteId: null`

#### Scenario: Deleting the originating quote does not break the sale
- **WHEN** a sale has `quoteId = Q` and the row in `quotes` with id `Q` is removed (manually or via a future purge module)
- **THEN** the sale row is preserved; `sale.quoteId` becomes `null` via the FK's `ON DELETE SET NULL`

#### Scenario: Cash sale has paymentStatus paid immediately
- **WHEN** a sale is emitted with a `paymentMethod` whose `isCredit=false` and `total=1000`
- **THEN** the persisted row has `paid_amount=1000`, `payment_status='paid'`

#### Scenario: Credit sale starts pending
- **WHEN** a sale is emitted with a `paymentMethod` whose `isCredit=true` and `total=1000`
- **THEN** the persisted row has `paid_amount=0`, `payment_status='pending'`

#### Scenario: SaleDetailDto exposes isCredit as derived field
- **WHEN** an authorized caller fetches `GET /api/v1/admin/sales/:id` for a sale whose `paymentMethod.isCredit=true`
- **THEN** the response includes `isCredit: true` derived from the JOIN; the field is read-only and not persisted on the `sales` table

#### Scenario: Dosification line snapshots numParts and dosificationId
- **WHEN** a sale is emitted with a line whose `dosificationId` references a dosification with `numParts=4`
- **THEN** the persisted `sale_items` row has `productPriceId: null`, `dosificationId` set, `numPartsSnapshot=4`, and `priceNameSnapshot` equal to the dosification's `name`

#### Scenario: Dosification quantity may exceed numParts
- **WHEN** a sale line sells `quantity=6` parts of a dosification with `numParts=4`
- **THEN** the line is accepted (no upper bound on `quantity` relative to `numParts`); `lineTotal = 6 * computedUnitPrice`

---

### Requirement: List sales
The system SHALL expose `GET /api/v1/admin/sales` that returns a paginated list of sales. Requires the `sales:read` permission. Query parameters: `page` (default 1), `pageSize` (default 20, max 100), `branchId` (optional UUID), `customerId` (optional UUID), `status` (optional, comma-separated; one or more of `completed`,`cancelled`,`edited`), `from` (optional ISO date — inclusive lower bound on `created_at`), `to` (optional ISO date — inclusive upper bound on `created_at`), `search` (optional, min 2 chars; matches `folio_code`, `folio_number::text`, or joined `customer.name`/`customer.rfc`).

Each `SaleDto` includes `id`, `folioId`, `folioCode`, `folioNumber`, `branchId`, `branchName` (joined), `customerId`, `customerName` (joined), `customerRfc` (joined), `customerAddress` (joined), `customerCreditDays` (joined), `cashierId`, `cashierName` (joined), `paymentMethodId`, `paymentMethodCode` (joined), `isCredit` (derived from `paymentMethod.isCredit`), `quoteId` (string or `null`), `status`, `paidAmount` (string, 4 decimals), `paymentStatus` (one of `paid`, `partial`, `pending`), `subtotal`, `taxTotal`, `total`, `notes`, `completedAt`, `cancelledAt`, `cancellationReason`, `editedAt`, `createdAt`, `updatedAt`. `items` is NOT included in the list response.

Sorted by `created_at DESC`.

**Branch scoping**: if the caller does NOT have `branches:access_all`, the system SHALL behave as follows:

- If `?branchId=` is absent → the system implicitly applies `branchId = x-user-branch-id`. If `x-user-branch-id` is empty (user has no assigned branch), the system returns HTTP 403 `{"error": "Forbidden", "required": "branches:access_all"}`.
- If `?branchId=<X>` is present and `X !== x-user-branch-id` → HTTP 403.

If the caller HAS `branches:access_all`:

- If `?branchId=` is absent → returns sales across all branches.
- If `?branchId=<X>` is present → filters to that branch.

#### Scenario: Operator lists own branch
- **WHEN** an `operator` with `x-user-branch-id: B1` (no `branches:access_all`) calls `GET /api/v1/admin/sales`
- **THEN** the system implicitly filters to `branchId = B1` and returns HTTP 200, including `quoteId` for each row (or `null` if the sale was direct)

#### Scenario: Operator tries another branch
- **WHEN** an `operator` with `x-user-branch-id: B1` calls `GET /api/v1/admin/sales?branchId=B2`
- **THEN** the system returns HTTP 403 `{"error": "Forbidden", "required": "branches:access_all"}`

#### Scenario: Admin lists all branches
- **WHEN** an `admin` (has `branches:access_all`) calls `GET /api/v1/admin/sales`
- **THEN** the system returns sales from all branches

#### Scenario: Operator without branch tries to list
- **WHEN** an `operator` with `x-user-branch-id: ""` (no branch assigned) calls `GET /api/v1/admin/sales` without `?branchId=`
- **THEN** the system returns HTTP 403

#### Scenario: Filter by date range
- **WHEN** the request includes `?from=2026-01-01&to=2026-01-31`
- **THEN** only sales with `created_at` within that range are returned

#### Scenario: Filter by multiple statuses
- **WHEN** the request includes `?status=completed,edited`
- **THEN** the response excludes sales whose status is `cancelled`

#### Scenario: Search by folio number
- **WHEN** the request includes `?search=1024`
- **THEN** sales whose `folio_number = 1024` OR whose `folio_code` contains "1024" are included

---

### Requirement: Get sale detail
The system SHALL expose `GET /api/v1/admin/sales/:id` that returns a single sale with its items. Requires `sales:read`. Returns HTTP 404 if not found. Branch scoping applies (a caller without `branches:access_all` can only fetch sales whose `branchId === x-user-branch-id`; otherwise HTTP 403).

 `SaleDetailDto` extends `SaleDto` with:

- `items: SaleItemDto[]`, each including `id`, `productId`, `productPriceId` (or `null`), `productCodeSnapshot`, `productNameSnapshot`, `priceNameSnapshot`, `quantity`, `unitPrice`, `discountPct`, `ivaRate`, `iepsRate`, `lineSubtotal`, `lineIva`, `lineIeps`, `lineTax`, `lineTotal`.
- `quoteId: string | null` (unchanged from `add-quotes-crud`).
- `returnedQuantityBySaleItem: Record<string, number>` — a map keyed by `sale_item.id` whose value is the SUM of `return_items.quantity` across all returns linked to this sale where `returns.status='completed'`. Keys for `sale_items` with no completed returns are OMITTED (consumers SHALL interpret "absent key" as `0`). Cancelled returns do NOT contribute to this aggregate.
- `customerAddress: string | null` — the customer's `address` joined from the sale's `customerId` (`null` for walk-in sales).
- `customerCreditDays: number | null` — the customer's `creditDays` joined from the sale's `customerId` (`null` for walk-in sales).

`lineIva` and `lineIeps` are derived fields — `SaleItem` only persists `lineSubtotal`, `lineTax`, and `lineTotal` (see "Sale aggregate model"). The mapper SHALL compute `lineIva = roundHalfToEven(lineSubtotal * (ivaRate ?? 0), 4)` and `lineIeps = roundHalfToEven(lineSubtotal * (iepsRate ?? 0), 4)`, using the same banker's-rounding function (`roundHalfToEven`, half-to-even at 4 decimals) that `SaleTotalsCalculator` uses when the line was first computed — never `Math.round` or any other rounding mode — so that `lineIva + lineIeps` always equals the persisted `lineTax` for that line.

Each `SaleDto` in the list response (`GET /api/v1/admin/sales`) SHALL also include `customerAddress` and `customerCreditDays` (same joined semantics, `null` for walk-in sales).

#### Scenario: Authorized fetch
- **WHEN** a caller with `sales:read` and access to the sale's branch fetches a valid `:id`
- **THEN** the system returns HTTP 200 with the `SaleDetailDto` (including `quoteId`, `returnedQuantityBySaleItem`, `customerAddress`, and `customerCreditDays`)

#### Scenario: Sale with customer exposes credit data
- **WHEN** a sale has `customerId` and the customer has `address` and `creditDays` set
- **THEN** the returned `SaleDetailDto` includes `customerAddress` and `customerCreditDays` with those values

#### Scenario: Walk-in sale exposes null credit data
- **WHEN** a sale has `customerId: null`
- **THEN** the returned `SaleDetailDto` includes `customerAddress: null` and `customerCreditDays: null`

#### Scenario: Out-of-branch fetch
- **WHEN** a caller without `branches:access_all` fetches a sale whose `branchId !== x-user-branch-id`
- **THEN** the system returns HTTP 403

#### Scenario: Sale not found
- **WHEN** the `:id` does not match any sale
- **THEN** the system returns HTTP 404 `{"error": "Sale not found"}`

#### Scenario: No returns on any line
- **WHEN** the sale has no `returns` rows (or only cancelled ones)
- **THEN** `returnedQuantityBySaleItem` is `{}` (empty record)

#### Scenario: Partial returns reported
- **WHEN** the sale has 3 items A, B, C and one `completed` return that returned 2 of A and 1 of C
- **THEN** `returnedQuantityBySaleItem` is `{ "<itemAId>": 2, "<itemCId>": 1 }` — B is absent (zero)

#### Scenario: Multiple completed returns aggregate per line
- **WHEN** the sale has item A returned twice (3 then 2, both completed)
- **THEN** `returnedQuantityBySaleItem["<itemAId>"] === 5`

#### Scenario: Cancelled return excluded from aggregate
- **WHEN** the sale has item A returned (4, status `completed`) and then that return is cancelled
- **THEN** `returnedQuantityBySaleItem["<itemAId>"]` is absent (cancelled returns contribute zero)

#### Scenario: Aggregate query is not paginated
- **WHEN** the sale has 50 returns across many lines (unusual but legal)
- **THEN** the aggregate still reflects the total per line; the query is a single `SUM`-grouped read against `return_items` joined to `returns`

#### Scenario: lineIva and lineIeps use the same rounding as lineTax
- **WHEN** a sale item has `lineSubtotal = 100.0002` and `iepsRate = 0.25` (a value where half-up and half-to-even rounding disagree at the 4th decimal)
- **THEN** the returned `lineIeps` SHALL equal `roundHalfToEven(100.0002 * 0.25, 4) = 25.0000`, and `lineIva + lineIeps` SHALL equal the persisted `lineTax` for that item — never the half-up result `25.0001`

---

### Requirement: Create sale (atomic emission)
The system SHALL expose `POST /api/v1/admin/sales` that emits a completed sale in a single transaction. Requires `sales:create`. Required body:

- `branchId: string` (UUID of an active branch)
- `customerId: string` (UUID of an active customer)
- `paymentMethodId: string` (UUID of an active payment method)
- `folioId: string` (UUID of an active folio)
- `items: SaleItemInput[]` (at least 1 item)

Each `SaleItemInput`:

- `productId: string` (UUID of an active product)
- `productPriceId: string` (UUID of a price belonging to `productId`) **OR** `dosificationId: string` (UUID of a dosification belonging to `productId`) — exactly one of the two SHALL be present; both present or both absent → HTTP 400.
- `quantity: number` (decimal `> 0`; max 14 integer + 4 decimal digits). For a dosification line, `quantity` is the number of parts sold (MAY exceed the dosification's `numParts`).
- `discountPctOverride: number | null` (optional; decimal `0–100`). When present on a `productPriceId`-based item, overrides the catalog's `price.discountPct` for this line. Ignored (never applied) on a `dosificationId`-based item.
- `discountAmount: number | null` (optional; decimal `0–100`, MXN). A flat-amount discount for this line, mutually exclusive with `discountPctOverride`/the catalog `discountPct` on the same line — both `> 0` on the same item → HTTP 400. Ignored (forced to `0`) on a `dosificationId`-based item regardless of what the body sends.

Optional body:

- `notes: string | null` (max 1000 chars)
- `quoteId: string | null` (UUID of an authorized, not-yet-converted quote; defaults to `null`)
- `clientRequestId: string | null` (UUID; idempotency key used by offline-created sales queued via `offline-sync` — see "Idempotent replay via clientRequestId" below; defaults to `null` for online-created sales)

The body MUST NOT include any explicit `isCredit` flag; the credit flow is activated automatically when the selected `paymentMethod` has `isCredit=true` (see "Credit flow auto-activation" below).

**Branch scoping**: callers without `branches:access_all` MUST pass `branchId === x-user-branch-id`; mismatch returns HTTP 403. Callers without an assigned branch (`x-user-branch-id` empty) and without `branches:access_all` return HTTP 403.

**Idempotent replay via `clientRequestId`**: when the body includes a non-null `clientRequestId`, the controller SHALL, BEFORE any other validation in the atomic flow below, look up an existing `sales` row with `client_request_id = clientRequestId`. If found, the system SHALL return HTTP 201 with that existing sale's `SaleDetailDto` unchanged — it SHALL NOT re-validate the body, re-allocate a folio, re-decrement inventory, or insert a new row. If not found, the atomic flow proceeds as normal and, on success, persists `client_request_id = clientRequestId` on the new `sales` row. `client_request_id` is nullable and unique; online-created sales (no `clientRequestId` in the body) leave it `null` and are never matched by this lookup.

**Credit flow auto-activation (non-blocking)**: after loading the `paymentMethod`, if `paymentMethod.isCredit === true`, the controller SHALL:

1. Verify the caller has `sales:create_credit`; otherwise HTTP 403 `{"error":"Forbidden","required":"sales:create_credit"}`.
2. The system SHALL NOT reject the sale for lacking a credit line or for exceeding `creditLimit`. Instead, once the final total is known, it computes an informational flag: `creditLimitExceeded = customer.creditLimit !== null && (customer.currentBalance + sale.total) > customer.creditLimit`. When `customer.creditLimit === null` (no credit line configured), `creditLimitExceeded` is `false` — there is no limit to exceed.

This computation runs AFTER total calculation but BEFORE folio allocation, all within the same transaction; it never aborts the transaction.

**`quoteId` validation when present**: if the body includes a non-null `quoteId`, the controller SHALL:

1. Load the quote; if it does not exist → HTTP 400 `{"error": "Quote not found", "reason": "not_found"}`.
2. Verify `quote.status === 'authorized'` AND `quote.convertedSaleId === null`. If not → HTTP 400 `{"error": "Quote cannot be linked to a new sale (status=<actual>)", "reason": "wrong_status"}`.
3. Verify `quote.branchId === branchId` and `quote.customerId === customerId` (the sale's branch/customer must match the quote's; mismatch → HTTP 400 `{"error": "...", "reason": "branch_mismatch" | "customer_mismatch"}`). The quote does NOT constrain `paymentMethodId`, `folioId`, or `items` — those are governed by the sale body.
4. Persist `sale.quoteId = quoteId`; ALSO update the quote in the same transaction: `quote.status='converted'`, `quote.convertedAt=NOW()`, `quote.convertedSaleId=<newSaleId>` (this keeps both sides consistent regardless of whether the caller used `POST /sales` or `POST /quotes/:id/convert`).

The `quoteId` does NOT constrain whether the sale is cash or credit — the `paymentMethodId` of the body decides.

**Atomic flow (inside a Prisma transaction)**:

0. If `clientRequestId` is non-null, perform the idempotent-replay lookup described above; short-circuit on a match before any of the following steps.
1. Validate `customer.isActive`, `branch.isActive`, `paymentMethod.isActive`, `folio.isActive`. Any inactive → HTTP 400.
2. Load `paymentMethod.isCredit` (via `include` or join) so the downstream branching is consistent within the transaction.
3. If `quoteId` is non-null: validate per the rules above; failure → HTTP 400.
4. For each item:
   - If `productPriceId` is present: load the `Product` and `ProductPrice`; verify `productPrice.productId === item.productId` (else `ProductPriceMismatchError` → HTTP 400), that the price belongs to a product whose `isActive = true` (else HTTP 400), and that `productPrice.branchId === branchId` — **every `ProductPrice` row belongs to exactly one branch; there is no global/base price and no fallback to another branch's price** (mismatch → `ProductPriceNotAvailableForBranchError` → HTTP 400 `{"error": "Product price does not belong to this branch"}`; the error message SHALL NOT disclose the price or the other branch it belongs to). If `item.quantity` is NOT an integer (`quantity % 1 !== 0`), resolve the currently configured `dosificationSurchargePct` from `settings-api` (default `5.0` when unconfigured) and compute `unitPrice = price.price * (1 + surchargePct / 100)`; if `item.quantity` IS an integer, `unitPrice = price.price` unchanged (no surcharge). This surcharge applies uniformly to every product — there is no per-product or per-department opt-out.
   - If `dosificationId` is present instead: load the `Product` and `ProductDosification`; verify `dosification.productId === item.productId` (else HTTP 400) and `dosification.isActive = true` (else HTTP 400); load the product's default `ProductPrice` for the sale's own `branchId` (`branchId = <sale's branchId> AND isDefault=true`) — if none exists for that exact branch → HTTP 400 `{"error": "Dosification requires a default price"}` (there is no fallback to any other branch's default); resolve the currently configured `dosificationSurchargePct` from `settings-api` (default `5.0` when unconfigured); compute `unitPrice = DosificationPriceCalculator.computeUnitPrice(defaultPrice.price, dosification.numParts, surchargePct)`. This is the ONLY surcharge applied to dosification lines — the fractional-quantity surcharge above SHALL NOT additionally apply here, regardless of whether `quantity` is itself fractional, to avoid double-charging the configured percentage on the same line.
   - `quantity > 0` (else HTTP 400) for either case. The system MAY skip enforcement of `minQuantity` in v1 (documented, applies only to price-based lines).
5. Snapshot `productCodeSnapshot = product.code`, `productNameSnapshot = product.name`; for price-based lines: `priceNameSnapshot = price.name`, `unitPrice` per step 4 above (recharged when `quantity` is fractional, else `price.price` unchanged), `discountPct = item.discountPctOverride ?? price.discountPct`, `discountAmount = item.discountAmount ?? 0`; for dosification lines: `priceNameSnapshot = dosification.name`, `unitPrice` per above, `discountPct = null`, `discountAmount = 0` (both forced regardless of body — a dosification line never carries either kind of discount), `dosificationId = dosification.id`, `numPartsSnapshot = dosification.numParts`. Both kinds set `ivaRate = product.ivaRate`, `iepsRate = product.iepsRate`. This server-computed snapshot is authoritative even for offline-originated sales — a `clientRequestId`-bearing request carries only IDs/quantities/discount selections, never client-computed line totals, so catalog drift between offline creation and sync time is always resolved in favor of the server's live catalog.
6. Compute totals using `SaleTotalsCalculator` (domain service) — unchanged by dosification lines or by the fractional-quantity surcharge (operates on `quantity * unitPrice`, agnostic to what `quantity` represents or how `unitPrice` was resolved); now also receives `discountAmount` per line (see "SaleTotalsCalculator (domain service)").
7. If `paymentMethod.isCredit === true`: compute the informational `creditLimitExceeded` flag per "Credit flow auto-activation" above. This step never aborts the transaction.
8. Allocate the next folio number **for the sale's own branch** atomically via `allocateBranchFolio(tx, folioId, branchId)`: `INSERT INTO folio_branch_counters (folio_id, branch_id, current_number) VALUES (?, ?, 1) ON CONFLICT (folio_id, branch_id) DO UPDATE SET current_number = folio_branch_counters.current_number + 1 RETURNING current_number`. The resulting `folioCode` SHALL be `<prefix><BRANCH_CODE>-<currentNumber padded to 6 digits>` (e.g. `TK-ZARIOZ-000001`), where `<BRANCH_CODE>` is the issuing branch's `code`. If the folio is inactive → HTTP 400. Folio numbers are allocated strictly in the order requests reach this step — for a sale queued offline and synced later, this MAY differ from the chronological order in which the sale was actually created at the register (this is expected and accepted behavior for `offline-sync`, not a bug). Legacy `folioCode`s issued before this change (global format, e.g. `TK-000038`) are preserved unchanged — the new format cannot collide with them.
9. For each item, decrement inventory using the base-unit amount (`quantity / numPartsSnapshot` for dosification lines, `quantity` otherwise — see "Sale aggregate model"): `UPDATE branch_inventory SET quantity = quantity - ${amount}, updated_at = NOW() WHERE branch_id = ? AND product_id = ?`. If the update affects 0 rows (no inventory record exists for this pair), the system SHALL `INSERT INTO branch_inventory (branch_id, product_id, quantity) VALUES (?, ?, -${amount})` (creates the record with negative initial quantity). The result `quantity` MAY be negative — this is the implementation of the rule "selling with stock 0 leaves negative quantity awaiting transfer", and is the same mechanism that allows an offline-queued sale to succeed at sync time even if the branch's real stock dropped below the sale's quantity while it was queued. **After each such decrement**, the system SHALL evaluate the low-stock notification trigger per `admin-notifications-api` "Notify admin on low stock" (best-effort, never blocks or fails this endpoint).
10. Compute `paidAmount` and `paymentStatus`:
    - If `paymentMethod.isCredit === false`: `paidAmount = total`, `paymentStatus = 'paid'`.
    - If `paymentMethod.isCredit === true`: `paidAmount = 0`, `paymentStatus = 'pending'` (regardless of `creditLimitExceeded`).
11. `INSERT` the `sales` row with `status='completed'`, `completedAt=NOW()`, snapshotted folio info, `quote_id = quoteId` (or `null`), `paid_amount`, `payment_status`, `client_request_id = clientRequestId` (or `null`).
12. `INSERT` the `sale_items` rows.
13. If `paymentMethod.isCredit === true`: `UPDATE customers SET current_balance = current_balance + ? WHERE id = ?` (sale.customerId) — regardless of `creditLimitExceeded`.
14. If `quoteId` non-null: `UPDATE quotes SET status='converted', converted_at=NOW(), converted_sale_id=<newSaleId> WHERE id = quoteId`.

Returns HTTP 201 with the `SaleDetailDto` (including items, `quoteId`, `paidAmount`, `paymentStatus`, the derived `isCredit` from the JOIN, and `creditLimitExceeded: boolean` — always `false` for non-credit sales).

**BREAKING**: this endpoint no longer returns HTTP 409 for `CreditLimitExceededError` or `CustomerHasNoCreditLineError`. Callers that previously branched on those 409 responses MUST instead read `creditLimitExceeded` from the HTTP 201 body.

#### Scenario: Successful cash sale
- **WHEN** an `operator` with `x-user-branch-id: B1` and `sales:create` sends a valid body for branch B1 with 2 items, selecting a `paymentMethod` whose `isCredit=false` (no `quoteId`)
- **THEN** the system returns HTTP 201 with the `SaleDetailDto` (`quoteId: null`, `isCredit: false`, `paidAmount: total`, `paymentStatus: 'paid'`, `creditLimitExceeded: false`), `branch_inventory.quantity` decremented by each item's quantity, and the `(folioId, B1)` row in `folio_branch_counters` incremented by 1 (not `folios.current_number`)
- **AND** `customer.currentBalance` is NOT modified

#### Scenario: Successful credit sale via CREDITO payment method
- **WHEN** an `operator` with `sales:create` and `sales:create_credit` sends a body selecting the `paymentMethod` whose `code='CREDITO'` and `isCredit=true` for a customer with `creditLimit=10000`, `currentBalance=2000`, and the new sale `total=5000`
- **THEN** the system returns HTTP 201 with `paidAmount=0`, `paymentStatus='pending'`, `isCredit=true` (derived), `creditLimitExceeded=false` (7000 ≤ 10000); `customer.currentBalance` becomes `7000` after the transaction commits

#### Scenario: Credit payment method selected without sales:create_credit
- **WHEN** a caller with `sales:create` (but NOT `sales:create_credit`) selects a `paymentMethod` whose `isCredit=true`
- **THEN** the system returns HTTP 403 `{"error":"Forbidden","required":"sales:create_credit"}`

#### Scenario: Credit sale exceeds creditLimit — sale still completes with warning flag
- **WHEN** the body selects a `paymentMethod` with `isCredit=true` for a customer with `creditLimit=10000`, `currentBalance=8000`, and `sale.total=5000`
- **THEN** the system returns HTTP 201 (NOT 409) with `creditLimitExceeded=true`, `paidAmount=0`, `paymentStatus='pending'`; the sale, sale items, folio increment, and inventory decrement are all persisted; `customer.currentBalance` becomes `13000`

#### Scenario: Credit sale for customer without credit line — sale still completes
- **WHEN** the body selects a `paymentMethod` with `isCredit=true` for a customer with `creditLimit=null`
- **THEN** the system returns HTTP 201 (NOT 409) with `creditLimitExceeded=false` (no limit configured, so nothing to exceed); the sale is persisted normally with `paidAmount=0`, `paymentStatus='pending'`

#### Scenario: Successful sale with quoteId (cash)
- **WHEN** the body includes `quoteId: Q` and a `paymentMethod` whose `isCredit=false`, where `Q` is an authorized quote with `convertedSaleId: null` and matching `branchId`/`customerId`
- **THEN** the system returns HTTP 201 with `quoteId: Q`, `isCredit=false`, `paidAmount=total`, `paymentStatus='paid'`; and the quote row has `status='converted'`, `convertedSaleId=<newSaleId>`

#### Scenario: Conversion from quote to credit sale
- **WHEN** the body includes both `quoteId: Q` and a `paymentMethod` whose `isCredit=true`, and the caller has `sales:create_credit`
- **THEN** the system applies BOTH the quote conversion AND the credit flow: the sale has `quoteId=Q`, `isCredit=true` (derived), `paidAmount=0`, `paymentStatus='pending'`; `customer.currentBalance += total`; the quote is marked converted

#### Scenario: Invalid quoteId (already converted)
- **WHEN** the body includes `quoteId: Q` where `Q` has `status='converted'`
- **THEN** the system returns HTTP 400 `{"error": "Quote cannot be linked to a new sale (status=converted)", "reason": "wrong_status"}` and the transaction does not commit

#### Scenario: Invalid quoteId (draft)
- **WHEN** the body includes `quoteId: Q` where `Q` has `status='draft'`
- **THEN** the system returns HTTP 400 `{"error": "Quote cannot be linked to a new sale (status=draft)", "reason": "wrong_status"}`

#### Scenario: Quote branch mismatch
- **WHEN** the body has `branchId: B1` but `quoteId: Q` where `Q.branchId = B2`
- **THEN** the system returns HTTP 400 and the transaction does not commit

#### Scenario: Quote customer mismatch
- **WHEN** the body has `customerId: C1` but `quoteId: Q` where `Q.customerId = C2`
- **THEN** the system returns HTTP 400

#### Scenario: Selling product with no inventory record
- **WHEN** the body includes a `productId` that has no `branch_inventory` row for the target branch
- **THEN** the system creates the row with `quantity = -item.quantity` and returns HTTP 201

#### Scenario: Selling product with stock 0
- **WHEN** the current `branch_inventory.quantity = 0` and the item `quantity = 5`
- **THEN** the system updates the row to `quantity = -5` and returns HTTP 201

#### Scenario: Selling more than available (still allowed)
- **WHEN** the current `branch_inventory.quantity = 3` and the item `quantity = 10`
- **THEN** the system updates the row to `quantity = -7` and returns HTTP 201

#### Scenario: Branch scoping violation
- **WHEN** an `operator` with `x-user-branch-id: B1` posts a body with `branchId: B2`
- **THEN** the system returns HTTP 403 `{"error": "Forbidden", "required": "branches:access_all"}`

#### Scenario: Inactive customer
- **WHEN** the body's `customerId` references a customer with `isActive=false`
- **THEN** the system returns HTTP 400 `{"error": "Customer is inactive"}` and the transaction does not commit

#### Scenario: Mismatched productPrice
- **WHEN** an item has `productId: A` but `productPriceId: P` where `P.product_id !== A`
- **THEN** the system returns HTTP 400 `{"error": "Product price does not belong to product"}` and the transaction does not commit

#### Scenario: Empty items
- **WHEN** the body has `items: []`
- **THEN** the system returns HTTP 400 `{"error": "Sale must include at least one item"}`

#### Scenario: Inactive folio
- **WHEN** the body's `folioId` references a folio with `isActive=false`
- **THEN** the system returns HTTP 400

#### Scenario: Forbidden without sales:create
- **WHEN** a caller without `sales:create` calls the endpoint
- **THEN** the system returns HTTP 403 `{"error": "Forbidden", "required": "sales:create"}`

#### Scenario: Sale creation crossing reorder point triggers admin notification
- **WHEN** a sale item's decrement leaves `branch_inventory.quantity < reorder_point` for that (branch, product), and no notification for that pair was sent in the last 24h
- **THEN** the system still returns HTTP 201 as normal, AND — per `admin-notifications-api` — an email is sent to the configured admin address and `lastLowStockNotifiedAt` is updated; a failure to send this email does NOT affect the HTTP 201 response

#### Scenario: Dosification sale decrements a fraction of base stock
- **WHEN** the body has one item with `dosificationId` referencing a dosification with `numParts=4` and `quantity=3`, for a product whose default price (for the sale's own branch) is `100` and whose `branch_inventory.quantity = 10`, and no `pricing_settings` row exists yet (default 5% surcharge applies)
- **THEN** the system returns HTTP 201 with `unitPrice = (100/4)*1.05 = 26.25` on that line; `branch_inventory.quantity` becomes `10 - (3/4) = 9.25`

#### Scenario: Dosification without default price rejected
- **WHEN** the body has an item with `dosificationId` referencing a dosification whose product has no default `ProductPrice` for the sale's own branch
- **THEN** the system returns HTTP 400 `{"error": "Dosification requires a default price"}` and the transaction does not commit — there is no fallback to another branch's default

#### Scenario: Dosification/productPrice mutual exclusivity
- **WHEN** an item includes both `productPriceId` and `dosificationId`, or neither
- **THEN** the system returns HTTP 400

#### Scenario: Dosification not belonging to product
- **WHEN** an item has `productId: A` but `dosificationId: D` where `D.product_id !== A`
- **THEN** the system returns HTTP 400 and the transaction does not commit

#### Scenario: Inactive dosification rejected
- **WHEN** an item's `dosificationId` references a dosification with `isActive=false`
- **THEN** the system returns HTTP 400

#### Scenario: Fractional quantity on a normal-price line applies the surcharge
- **WHEN** the body has an item with `productPriceId` (no `dosificationId`) whose `price.price = 100`, `quantity = 0.5`, and `dosificationSurchargePct = 5` (default)
- **THEN** the system returns HTTP 201 with `unitPrice = 105` on that line (`100 * 1.05`) and `lineTotal` computed from that recharged `unitPrice * 0.5`, before tax extraction

#### Scenario: Integer quantity on a normal-price line never gets the surcharge
- **WHEN** the body has an item with `productPriceId`, `price.price = 100`, `quantity = 2`
- **THEN** the system returns HTTP 201 with `unitPrice = 100` (unchanged) — the surcharge is not applied because `quantity` is a whole number

#### Scenario: Fractional quantity applies regardless of product or department
- **WHEN** the body has items for two different products in two different departments, both `productPriceId`-based with `quantity = 1.25`
- **THEN** both lines get the same configured `dosificationSurchargePct` applied to their `unitPrice` — there is no per-product or per-department exclusion

#### Scenario: Dosification line with fractional quantity does not get the surcharge twice
- **WHEN** the body has an item with `dosificationId` (numParts=4, default price 100) and `quantity = 1.5` (a fractional number of parts)
- **THEN** the system returns HTTP 201 with `unitPrice = (100/4)*1.05 = 26.25` — the same single dosification surcharge as an integer-quantity dosification line; the fractional-quantity surcharge for normal-price lines is NOT additionally applied

#### Scenario: Idempotent replay of an offline-queued sale
- **WHEN** a caller sends a body with `clientRequestId: X` and there already exists a `sales` row with `client_request_id = X` (from a previous, already-committed request with the exact same `clientRequestId`, e.g. a retry of an `offline-sync` outbox item whose original response was lost)
- **THEN** the system returns HTTP 201 with that existing sale's `SaleDetailDto`; no new row is inserted, no folio is allocated, and `branch_inventory` is not decremented again

#### Scenario: clientRequestId omitted behaves exactly as before
- **WHEN** the body does not include `clientRequestId` (or sends it as `null`)
- **THEN** the system behaves exactly as the pre-existing online flow: no idempotency lookup is attempted, `client_request_id` is persisted as `null`

#### Scenario: Sale synced offline may leave stock negative beyond the pre-existing tolerance
- **WHEN** an offline-queued sale (via `clientRequestId`) is synced and, by the time it reaches step 9, `branch_inventory.quantity` for an item is now lower than the sale's quantity because other sales (online or from other offline queues) consumed stock while this one was queued
- **THEN** the system still returns HTTP 201 and updates `branch_inventory.quantity` to a negative value, exactly as it already does for any sale (online or offline) selling more than available (see "Selling more than available (still allowed)")

#### Scenario: Sale uses the branch's own price
- **WHEN** the body's `branchId` is B1 and an item's `productPriceId` references a `ProductPrice` whose `branchId = B1`
- **THEN** the system returns HTTP 201 and `unitPrice` on that line is resolved from that price

#### Scenario: Sale rejects a price belonging to another branch
- **WHEN** the body's `branchId` is B1 but an item's `productPriceId` references a `ProductPrice` whose `branchId = B2`
- **THEN** the system returns HTTP 400 `{"error": "Product price does not belong to this branch"}` and the transaction does not commit; the response body does not include the B2 price value — this is the ONLY branch-price resolution rule; there is no global/base price and no fallback between branches

#### Scenario: Dosification default price is resolved strictly from the sale's own branch
- **WHEN** the body's `branchId` is B1, the item has `dosificationId` referencing a dosification whose product has a default `ProductPrice` for branch B2 but none for B1
- **THEN** the system returns HTTP 400 `{"error": "Dosification requires a default price"}` — a default price belonging to a different branch is never used as a substitute

#### Scenario: Folio numbering is independent per branch
- **WHEN** branch B1 has already issued 5 sales under folio `TK` and branch B2 issues its first sale under the same folio
- **THEN** B2's sale receives `TK-<B2_CODE>-000001`, independent of B1's `TK-<B1_CODE>-000005`

#### Scenario: Legacy folioCode is preserved, not renumbered
- **WHEN** a sale exists with the legacy global-format `folioCode = "TK-000038"` (issued before branch-scoped counters were introduced)
- **THEN** no new sale is ever assigned that same `folioCode`, the legacy sale's `folioCode` is never modified, and branch-scoped counter assignment always produces the new format (`<prefix><BRANCH_CODE>-NNNNNN`) which cannot collide with the legacy format

#### Scenario: Flat-amount discount applied to a line
- **WHEN** the body has an item with `productPriceId`, `quantity=1`, `price.price=500`, and `discountAmount=100` (no `discountPctOverride`)
- **THEN** the system returns HTTP 201 with that line's `lineGross = 500 - 100 = 400` before tax extraction, and `discountPct=0` (no catalog override applied) persisted on the `sale_item`

#### Scenario: discountPctOverride now actually persists (bug fix)
- **WHEN** the body has an item whose catalog `price.discountPct = 5` but the body sends `discountPctOverride: 15`
- **THEN** the system returns HTTP 201 with `discountPct=15` persisted on the `sale_item` (the override wins) — previously this field was silently discarded and the catalog value was always used instead

#### Scenario: discountAmount and discountPctOverride mutually exclusive on the same line
- **WHEN** an item's body includes both `discountPctOverride: 10` and `discountAmount: 50`, both `> 0`
- **THEN** the system returns HTTP 400 and the transaction does not commit

#### Scenario: discountAmount out of range rejected
- **WHEN** an item's `discountAmount` is `150` (exceeds the 100 MXN cap) or negative
- **THEN** the system returns HTTP 400 and the transaction does not commit

#### Scenario: discountAmount exceeding the line's gross clamps to zero, never negative
- **WHEN** an item has `quantity=1`, `price.price=80`, `discountAmount=100`
- **THEN** the system returns HTTP 201 with that line's `lineGross = 0` (not `-20`)

#### Scenario: Dosification line ignores discountAmount and discountPctOverride even if sent
- **WHEN** the body has an item with `dosificationId` that also includes `discountAmount: 50` (or `discountPctOverride: 10`)
- **THEN** the system returns HTTP 201 with `discountPct=null` and `discountAmount=0` persisted on that line, identical to a dosification line that sent neither field — the body's discount fields are ignored for dosification lines, not rejected

### Requirement: Cancel sale
The system SHALL expose `POST /api/v1/admin/sales/:id/cancel`. Requires `sales:cancel`. Body MAY include `reason: string | null` (max 500 chars). Branch scoping applies (callers without `branches:access_all` can only cancel sales in their assigned branch).

Behavior (inside a Prisma transaction):

- If `sale.status === 'cancelled'`: the operation is idempotent — returns HTTP 200 with the unchanged `SaleDetailDto` and the original `cancelledAt`/`cancellationReason`.
- If `sale.status === 'completed'` or `'edited'`:
  1. Load `sale.paymentMethod.isCredit` (via JOIN/include) so the credit-aware logic is consistent within the transaction.
  2. **Pre-check active payments**: if there is at least one `CustomerPayment` with `status='completed'` linked to this sale → HTTP 409 `{"error":"SaleHasActivePayments","paymentIds":["<id1>","<id2>",...]}`. The transaction does NOT commit. The operator MUST cancel each listed payment first. (In practice only credit sales can have active payments; the check applies unconditionally to all sales.)
  3. For each item, restore stock using the base-unit amount (`quantity / numPartsSnapshot` when the line has a dosification, `quantity` otherwise — see "Sale aggregate model"): `UPDATE branch_inventory SET quantity = quantity + ${amount}, updated_at = NOW() WHERE branch_id = ? AND product_id = ?`.
  4. If `paymentMethod.isCredit === true`: `UPDATE customers SET current_balance = current_balance - (sale.total - sale.paidAmount) WHERE id = sale.customerId`. (Since active payments are required to be already cancelled, `paidAmount` reflects only cancelled payments which don't affect balance — so this subtracts the original outstanding.)
  5. `UPDATE sales SET status='cancelled', cancelled_at=NOW(), cancellation_reason=?`.
- **After the transaction commits**, the system SHALL trigger the "Notify admin on sale cancellation" behavior per `admin-notifications-api` (best-effort, never blocks or fails this endpoint, never runs inside the Prisma transaction above).

The folio is NOT reusable — the folio number stays consumed. `paidAmount`, `paymentStatus`, `paymentMethodId` are preserved (frozen at the moment of cancellation; not reset).

**Interaction with returns**: cancelling a sale that has one or more `completed` returns DOES NOT cancel those returns and DOES NOT double-restore stock. The cancellation restores ONLY the stock matching the CURRENT `sale_items.quantity` (the original sold quantity, converted to base units per dosification when applicable). Returns continue to exist as standalone records; the operator who wants a fully clean state can cancel each return separately (which decrements stock back) BEFORE cancelling the sale. **Recommended order documented**: cancel returns first, then cancel the sale. The system does NOT enforce this order in v1 — if the sale is cancelled while completed returns exist, the resulting stock will be inflated relative to the post-return state by exactly the returned amount (the returns previously incremented stock; the cancel sale now also increments stock by the full sold quantity). Operators are expected to reconcile manually until a future change introduces a guard.

#### Scenario: Cancel completed cash sale
- **WHEN** an authorized caller cancels a `completed` sale whose `paymentMethod.isCredit=false` and items totalling X units
- **THEN** the system returns HTTP 200, the sale `status` becomes `cancelled`, and `branch_inventory.quantity` for each item is incremented by the respective quantity
- **AND** `customer.currentBalance` is NOT modified

#### Scenario: Cancel credit sale with no payments
- **WHEN** a `completed` sale has `paymentMethod.isCredit=true`, `total=1000`, `paidAmount=0`, and no `CustomerPayment` rows
- **THEN** the cancellation proceeds: stock restored, `customer.currentBalance -= 1000`, `sale.status='cancelled'`

#### Scenario: Cancel credit sale with active payments rejected
- **WHEN** a `completed` sale has `paymentMethod.isCredit=true` and 2 `CustomerPayment` rows with `status='completed'`
- **THEN** the system returns HTTP 409 `{"error":"SaleHasActivePayments","paymentIds":[...]}` and nothing is persisted

#### Scenario: Cancel credit sale with only cancelled payments
- **WHEN** a `completed` sale has `paymentMethod.isCredit=true`, two `CustomerPayment` rows both `status='cancelled'`, `paidAmount=0`
- **THEN** the cancellation proceeds normally (the cancelled payments do not block)

#### Scenario: Cancel idempotent
- **WHEN** the same sale is cancelled twice
- **THEN** the second call returns HTTP 200 with no further side effects; `cancelled_at` and `cancellation_reason` remain from the first call

#### Scenario: Cancel edited sale restores edited items
- **WHEN** a sale was previously edited (status `edited`) and is now cancelled
- **THEN** the system restores stock based on the items currently in `sale_items` (the post-edit version) and sets `status='cancelled'`

#### Scenario: Cancel sale with returns (inflation risk documented)
- **WHEN** a `completed` sale had 10 units of product P sold, a `completed` return was registered for 4 units (stock incremented by 4), and the sale is then cancelled
- **THEN** the sale cancellation increments stock by the full 10 sold units; net effect on inventory is `+14` from a pre-sale-pre-return baseline. The two `Return` rows are unaffected. The operator is expected to reconcile (typically by cancelling the return first; v1 does not enforce the order — see design.md Risks).

#### Scenario: Out-of-branch cancellation
- **WHEN** an `operator` in branch B1 tries to cancel a sale whose `branchId = B2` and the operator lacks `branches:access_all`
- **THEN** the system returns HTTP 403

#### Scenario: Sale not found
- **WHEN** the `:id` does not match any sale
- **THEN** the system returns HTTP 404

#### Scenario: Folio stays consumed
- **WHEN** a sale with `folio_number = 1024` is cancelled
- **THEN** the next emitted sale on the same folio takes `folio_number = 1025`, not `1024`

#### Scenario: Cancel sale with dosification line restores fractional stock
- **WHEN** a `completed` sale has one line with `numPartsSnapshot=4`, `quantity=3` (i.e. `0.75` base units decremented at emission), and the sale is cancelled
- **THEN** `branch_inventory.quantity` is incremented by `0.75` (not by `3`)

#### Scenario: Cancellation triggers admin notification after commit
- **WHEN** a `completed` sale with `folioCode="TK-000042"`, `total=1500` is cancelled with `reason="Cliente cambió de opinión"`
- **THEN** after the cancellation commits, the system attempts to email `ADMIN_NOTIFICATION_EMAIL` with the folio, total, reason, branch, and cashier; if this email send fails, the sale remains `cancelled` and the endpoint still returns HTTP 200

---

### Requirement: Edit completed sale (headquarters only)
The system SHALL expose `PATCH /api/v1/admin/sales/:id`. Requires `sales:edit_completed`. The body MUST include a complete `items: SaleItemInput[]` (the new version of the lines; min 1, same shape as "Create sale" — each item is either `productPriceId`-based or `dosificationId`-based). Optional: `customerId`, `paymentMethodId`, `notes`. The body MUST NOT change `folioId`, `folioNumber`, or `branchId`.

**Headquarters check (combined gate)**: before invoking the use case, the controller SHALL evaluate:

```
if (NOT user has 'branches:access_all') AND
   (x-user-branch-id is empty OR
    headquarters branch does not exist OR
    x-user-branch-id !== headquarters.id)
→ HTTP 403 {"error": "Sales can only be edited from the headquarters branch"}
```

That is: a caller with `branches:access_all` (admin) MAY edit from any branch; a caller without it MUST be assigned to the branch flagged `is_headquarters = TRUE`. Combined with the existing `sales:edit_completed` requirement, only an admin or a specially-granted user physically at HQ can edit.

Behavior (inside a Prisma transaction):

- If `sale.status === 'cancelled'` → HTTP 409 `{"error": "Cancelled sales cannot be edited"}`.
- **If the sale has one or more `CustomerPayment` rows with `status='completed'`** → HTTP 409 `{"error":"SaleHasActivePayments","paymentIds":[...]}`. The operator MUST cancel each listed payment first.
- Load the OLD `paymentMethod.isCredit` (from the current sale, before any change) AND the NEW `paymentMethod.isCredit` (if `paymentMethodId` changes in the body). Both flags govern the `currentBalance` delta below.
- Restore stock for each existing item using the base-unit amount (`quantity / numPartsSnapshot` when the persisted line has a dosification, `quantity` otherwise): `UPDATE branch_inventory SET quantity = quantity + ${oldAmount} WHERE branch_id = ? AND product_id = ?`.
- Delete all rows from `sale_items` for this `saleId`.
- Re-run the validation + snapshot + decrement + insert flow from "Create sale" using the new `items[]` (including the `productPriceId`/`dosificationId` resolution and the base-unit decrement for dosification lines).
- Recompute totals.
- Recompute `paidAmount` and `paymentStatus` according to the NEW `paymentMethod.isCredit`:
  - NEW `isCredit=false`: `paidAmount = newTotal`, `paymentStatus = 'paid'`.
  - NEW `isCredit=true`: `paidAmount = 0`, `paymentStatus = 'pending'`.
- Update `customer.currentBalance` by `(- oldOutstanding + newOutstanding)` where:
  - `oldOutstanding = (oldIsCredit ? oldTotal - oldPaidAmount : 0)`.
  - `newOutstanding = (newIsCredit ? newTotal : 0)`.
- If the NEW `paymentMethod.isCredit=true`, ALSO validate the credit limit (`customer.currentBalance + newOutstanding <= customer.creditLimit`) and the `sales:create_credit` permission of the caller; failure → HTTP 409/403 respectively.
- `UPDATE sales SET subtotal=?, tax_total=?, total=?, status='edited', edited_at=NOW(), customer_id=?, payment_method_id=?, notes=?, paid_amount=?, payment_status=?`. `folio_id`/`folio_number`/`folio_code`/`branch_id` are NOT changed.

#### Scenario: Admin edits ticket from any branch
- **WHEN** an `admin` (has `branches:access_all` and `sales:edit_completed`) PATCHes a completed cash sale (no payments) with a new items array
- **THEN** the system returns HTTP 200 with the recalculated `SaleDetailDto` and `status='edited'`

#### Scenario: Edit sale with active payments rejected
- **WHEN** the target sale has at least one `CustomerPayment` with `status='completed'`
- **THEN** the system returns HTTP 409 `{"error":"SaleHasActivePayments","paymentIds":[...]}` and nothing is persisted

#### Scenario: Edit credit sale recomputes balance
- **WHEN** a credit sale with `total=1000`, `paidAmount=0` (no active payments) is edited to a new `total=1200`, keeping the same credit `paymentMethodId`
- **THEN** `customer.currentBalance -= 1000` and `customer.currentBalance += 1200` net `+200`; the sale has `paidAmount=0`, `paymentStatus='pending'`

#### Scenario: Edit cash sale to credit
- **WHEN** a cash sale with `paymentMethod.isCredit=false`, `total=500` is edited to a new `paymentMethodId` whose `isCredit=true`, and the caller has `sales:create_credit`
- **THEN** the sale becomes credit: `paidAmount=0`, `paymentStatus='pending'`; `customer.currentBalance += newTotal` (since `oldOutstanding=0` because original was cash)

#### Scenario: Edit credit sale to cash
- **WHEN** a credit sale with `paymentMethod.isCredit=true`, `total=1000`, `paidAmount=0`, no active payments, is edited to a new `paymentMethodId` whose `isCredit=false`
- **THEN** the sale becomes cash: `paidAmount=newTotal`, `paymentStatus='paid'`; `customer.currentBalance -= 1000` (the original outstanding)

#### Scenario: Operator at HQ without sales:edit_completed
- **WHEN** an `operator` with `x-user-branch-id = HQ_id` (no `sales:edit_completed`) PATCHes a sale
- **THEN** the system returns HTTP 403 `{"error": "Forbidden", "required": "sales:edit_completed"}`

#### Scenario: User with sales:edit_completed but not at HQ
- **WHEN** a user with `sales:edit_completed` but `x-user-branch-id != HQ_id` and without `branches:access_all` PATCHes a sale
- **THEN** the system returns HTTP 403 `{"error": "Sales can only be edited from the headquarters branch"}`

#### Scenario: Edit cancelled sale
- **WHEN** the target sale has `status='cancelled'`
- **THEN** the system returns HTTP 409 `{"error": "Cancelled sales cannot be edited"}` and does not commit

#### Scenario: Edit zeroes out items
- **WHEN** the body has `items: []`
- **THEN** the system returns HTTP 400 `{"error": "Sale must include at least one item"}` and does not commit

#### Scenario: Folio invariants preserved
- **WHEN** the body includes `folioId` or `folioNumber`
- **THEN** the system silently ignores those fields and persists the original folio data

#### Scenario: Branch invariant preserved
- **WHEN** the body includes `branchId` different from the sale's current `branch_id`
- **THEN** the system silently ignores it and persists the original `branch_id`

#### Scenario: Stock fully recomputed
- **WHEN** the original items consumed 5 units of product A and 0 of B, and the new items consume 0 of A and 3 of B
- **THEN** after the edit, `branch_inventory.quantity` for A is restored by 5 and for B is decremented by 3 (allowed to go negative)

#### Scenario: Edit replaces a dosification line with a price line
- **WHEN** the original line had `numPartsSnapshot=4`, `quantity=3` (0.75 base units decremented), and the new items array replaces it with a normal price-based line of `quantity=2` for the same product
- **THEN** stock is restored by `0.75` (old dosification line) and then decremented by `2` (new price line) — net `-1.25` from the pre-edit baseline

#### Scenario: Edit's new-item decrement triggers admin notification
- **WHEN** the "decrement" half of the re-run "Create sale" flow (step re-run above) leaves `branch_inventory.quantity < reorder_point` for the new items, per the same debounce rule as "Create sale"
- **THEN** the low-stock notification per `admin-notifications-api` fires the same way it would for a direct sale creation — the edit flow does not special-case this

---

### Requirement: SaleTotalsCalculator (domain service)
The system SHALL provide a pure domain service `SaleTotalsCalculator` in `src/modules/pos/domain/services/SaleTotalsCalculator.ts` with a static method:

```
computeTotals(lines: SaleLineInput[]): SaleTotalsResult
```

`SaleLineInput`: `{ quantity, unitPrice, discountPct?, discountAmount?, ivaRate?, iepsRate? }` — all decimals; `discountPct` defaults to `0` when absent; `discountAmount` defaults to `0` when absent; `ivaRate`/`iepsRate` default to `0` when `null`/absent.

`SaleTotalsResult`: `{ lines: SaleLineTotals[], subtotal, taxTotal, total }`. Each `SaleLineTotals`: `{ lineSubtotal, lineIva, lineIeps, lineTax, lineTotal }`.

`unitPrice` represents the FINAL price the customer pays for that unit — taxes are already included in it. The system SHALL extract (not add) the tax from that price using the standard tax-inclusive-price formula:

```
lineGross    = max(0, round(quantity * unitPrice * (1 - discountPct / 100), 4) - discountAmount)
divisor      = 1 + ivaRate + iepsRate
lineSubtotal = round(lineGross / divisor, 4)
lineIva      = round(lineSubtotal * ivaRate, 4)
lineIeps     = round(lineSubtotal * iepsRate, 4)
lineTax      = lineIva + lineIeps
lineTotal    = lineGross
```

`lineTotal` (what the customer pays) is unaffected by this change in the absence of `discountAmount` — only the internal subtotal/IVA/IEPS breakdown changes with discounts. When `ivaRate = iepsRate = 0`, `divisor = 1` and the formula degenerates to the previous behavior (`lineSubtotal = lineGross = lineTotal`). When `discountAmount = 0`, `lineGross` degenerates to the pre-existing percentage-only formula.

Header totals are the sum across lines for `lineSubtotal`, `lineTax`, `lineTotal` respectively (mapped to `subtotal`, `taxTotal`, `total`). Rounding uses banker's rounding (half-to-even) at 4 decimal places. The service SHALL throw if `quantity <= 0`, `unitPrice < 0`, `discountPct < 0 || discountPct > 100`, `discountAmount < 0 || discountAmount > 100`, `(discountPct > 0 && discountAmount > 0)` (mutually exclusive), `ivaRate < 0 || ivaRate > 1`, or `iepsRate < 0 || iepsRate > 1`. No I/O dependencies (no Prisma, no fetch).

#### Scenario: Simple line
- **WHEN** `computeTotals([{ quantity: 2, unitPrice: 100, ivaRate: 0.16 }])` is invoked
- **THEN** the result has `lineSubtotal = 172.4138`, `lineIva = 27.5862`, `lineTax = 27.5862`, `lineTotal = 200`, `subtotal = 172.4138`, `taxTotal = 27.5862`, `total = 200`

#### Scenario: With discount
- **WHEN** `computeTotals([{ quantity: 1, unitPrice: 100, discountPct: 10 }])` is invoked
- **THEN** `lineSubtotal = 90`, `lineTotal = 90` (no tax rates, formula degenerates to gross = subtotal)

#### Scenario: With IVA and IEPS
- **WHEN** `computeTotals([{ quantity: 1, unitPrice: 100, ivaRate: 0.16, iepsRate: 0.08 }])` is invoked
- **THEN** `lineSubtotal = 80.6452`, `lineIva = 12.9032`, `lineIeps = 6.4516`, `lineTax = 19.3548`, `lineTotal = 100` — both taxes are extracted simultaneously from the same base (`divisor = 1.24`), not in cascade

#### Scenario: Null rates treated as zero
- **WHEN** `computeTotals([{ quantity: 1, unitPrice: 100, ivaRate: null, iepsRate: null }])` is invoked
- **THEN** `lineTax = 0`, `lineSubtotal = 100`, `lineTotal = 100`

#### Scenario: Multi-line aggregation
- **WHEN** `computeTotals([{quantity:1,unitPrice:100,ivaRate:0.16}, {quantity:2,unitPrice:50}])` is invoked
- **THEN** `subtotal = 186.2069`, `taxTotal = 13.7931`, `total = 200`

#### Scenario: Domain purity
- **WHEN** unit tests run against the calculator
- **THEN** no Prisma, no fetch, no environment access is required

#### Scenario: Invalid input rejected
- **WHEN** `computeTotals([{ quantity: 0, unitPrice: 100 }])` is invoked
- **THEN** the method throws a validation error

#### Scenario: With flat-amount discount
- **WHEN** `computeTotals([{ quantity: 1, unitPrice: 500, discountAmount: 100 }])` is invoked
- **THEN** `lineGross = 400`, `lineSubtotal = 400`, `lineTotal = 400` (no tax rates)

#### Scenario: Flat-amount discount combined with tax extraction
- **WHEN** `computeTotals([{ quantity: 1, unitPrice: 116, discountAmount: 16, ivaRate: 0.16 }])` is invoked
- **THEN** `lineGross = 100`, `lineSubtotal = round(100/1.16, 4) = 86.2069`, `lineIva = 13.7931`, `lineTotal = 100`

#### Scenario: Flat-amount discount exceeding the line clamps to zero
- **WHEN** `computeTotals([{ quantity: 1, unitPrice: 80, discountAmount: 100 }])` is invoked
- **THEN** `lineGross = 0`, `lineTotal = 0` (never negative)

#### Scenario: discountPct and discountAmount both present is rejected
- **WHEN** `computeTotals([{ quantity: 1, unitPrice: 100, discountPct: 10, discountAmount: 10 }])` is invoked
- **THEN** the method throws a validation error — the two discount kinds are mutually exclusive per line

#### Scenario: discountAmount out of range is rejected
- **WHEN** `computeTotals([{ quantity: 1, unitPrice: 100, discountAmount: 150 }])` is invoked
- **THEN** the method throws a validation error

### Requirement: Branch scoping pattern for sale endpoints
Every route handler in `pos-api` that operates on a sale or on a branch-specific listing SHALL enforce the following scoping pattern using `x-user-branch-id` (from middleware) and `branches:access_all` (via `AuthorizationService.userCan`):

```
const bypass = await authz.userCan(userId, "branches:access_all");
if (!bypass) {
  const userBranch = req.headers.get("x-user-branch-id") ?? "";
  if (userBranch === "" || resourceBranchId !== userBranch) {
    return 403 { error: "Forbidden", required: "branches:access_all" };
  }
}
```

`resourceBranchId` is either: (a) the `branchId` in the request body/query for creates and listings, or (b) the `branchId` joined from the persisted sale for reads/updates/cancels/edits. Reads MUST resolve the sale's `branchId` BEFORE applying the check (so a 403 is not used as an existence oracle; if the sale does not exist, return 404 first).

#### Scenario: Resource leak prevented
- **WHEN** an unauthorized user requests `GET /api/v1/admin/sales/<id-of-sale-in-other-branch>`
- **THEN** the system returns HTTP 403 (not 200, not 404) only if the sale exists; if it does not exist, returns HTTP 404 (existence is revealed only to anyone with permission to look)

#### Scenario: Listing default
- **WHEN** an `operator` with `branchId=B1` (no bypass) calls `GET /api/v1/admin/sales` without `?branchId=`
- **THEN** the listing is implicitly scoped to `B1`

#### Scenario: Listing without assigned branch
- **WHEN** a user without `branches:access_all` and without a `branchId` calls `GET /api/v1/admin/sales` without `?branchId=`
- **THEN** the system returns HTTP 403

---

### Requirement: POS product catalog does NOT expose product imageUrl
The POS lookup endpoint(s) used to populate the POS product catalog (e.g., `searchProducts` consumed by `PosLookupService`) SHALL NOT expose the `imageUrl` field of products. The DTO returned to the POS frontend MUST NOT include `imageUrl`. The `SaleItem` snapshot (`product_code_snapshot`, `product_name_snapshot`, `price_name_snapshot`, etc.) MUST NOT store any image reference. This preserves payload size and rendering latency on the POS catalog.

#### Scenario: searchProducts response excludes imageUrl
- **WHEN** the POS frontend invokes the product search endpoint
- **THEN** each item in the response MUST NOT contain an `imageUrl` field

#### Scenario: SaleItem snapshot excludes image
- **WHEN** a sale is created
- **THEN** the persisted `sale_items` rows MUST NOT contain any image-related column

#### Scenario: Quote and Return snapshots also exclude image
- **WHEN** a quote item or return item is created
- **THEN** the persisted snapshot MUST NOT contain any image-related column

---

### Requirement: Folio scope must be POS for sales

`CreateSaleUseCase` SHALL validar, después de cargar el `Folio` desde el `folioId` recibido, que `folio.scope === 'POS'`. Si el scope no coincide, el use case SHALL lanzar `FolioScopeMismatchError(expected='POS', actual=<folio.scope>)` que el controller mapea a HTTP 400 `{"error":"FolioScopeMismatch","expected":"POS","actual":"<scope>"}`. La validación SHALL ocurrir en el mismo paso que `folio.isActive`, antes de cualquier mutación de inventario o asignación de folio. `EditCompletedSaleUseCase` no admite cambios de `folioId` (folio inmutable en edit), por lo que NO requiere chequeo adicional: el folio original ya fue validado contra `scope='POS'` en la creación.

#### Scenario: Crear venta con folio POS válido

- **WHEN** un usuario con `sales:create` envía `POST /api/v1/admin/sales` con `folioId` apuntando a un folio cuyo `scope='POS'` (e.g. `TK`, `TC`)
- **THEN** el sistema procede con la emisión normal y retorna HTTP 201

#### Scenario: Crear venta con folio OPERATIONS rechazada

- **WHEN** la request usa `folioId` apuntando a un folio cuyo `scope='OPERATIONS'` (e.g. `RB`)
- **THEN** el sistema retorna HTTP 400 `{"error":"FolioScopeMismatch","expected":"POS","actual":"OPERATIONS"}` SIN tocar inventario ni `current_number` del folio

#### Scenario: Crear venta con folio INVENTORY rechazada

- **WHEN** la request usa `folioId` apuntando a un folio cuyo `scope='INVENTORY'` (e.g. `TS`)
- **THEN** el sistema retorna HTTP 400 `{"error":"FolioScopeMismatch","expected":"POS","actual":"INVENTORY"}`

#### Scenario: Scope check ocurre antes de allocate folio

- **WHEN** la request usa un folio con scope incorrecto pero `is_active=true` y `current_number=42`
- **THEN** tras el 400, `current_number` sigue en 42 (no se incrementa por el intento fallido)

---

### Requirement: SaleRepository.createCompletedFromQuote (conversion bridge)
The system SHALL extend `SaleRepository` with a method `createCompletedFromQuote(input, tx)` that:

- Accepts an open Prisma transaction handle `tx` (so the caller — typically `ConvertQuoteToSaleUseCase` — orchestrates the outer transaction that also updates the quote).
- Accepts an input including `branchId`, `customerId`, `paymentMethodId`, `folioId`, `cashierId`, `notes`, `quoteId`, and a pre-snapshotted `items: SaleItemSnapshotInput[]` (each item carries `productId`, `productPriceId`, `quantity`, `productCodeSnapshot`, `productNameSnapshot`, `priceNameSnapshot`, `unitPrice`, `discountPct`, `ivaRate`, `iepsRate` — values copied from the quote's `quote_items`, NOT re-resolved from the catalog).
- Reuses the same SQL plan as `createCompleted`: atomic folio increment via `UPDATE folios ... RETURNING`, per-item `UPDATE branch_inventory ... SET quantity = quantity - qty WHERE branch_id = ? AND product_id = ?` falling back to `INSERT branch_inventory (..., -qty)` when no row exists, `INSERT sales (..., quote_id=<quoteId>)`, `INSERT sale_items`.
- Computes totals from the snapshotted unit prices using `SaleTotalsCalculator` (since the snapshots are authoritative for cotization-derived sales).
- Returns the same `SaleDetailDto` shape as `createCompleted`.

The original `createCompleted` SHALL remain unchanged and continues to be used by `POST /api/v1/admin/sales` for direct sale emission.

#### Scenario: Conversion preserves snapshot prices
- **WHEN** `createCompletedFromQuote` is invoked with snapshot `unitPrice: 12.50`, and the current catalog price for that `productPriceId` is `13.00`
- **THEN** the resulting `sale_item.unit_price = 12.50` (the snapshot wins; the conversion does NOT re-resolve from the catalog)

#### Scenario: Conversion uses fiscal folio
- **WHEN** `createCompletedFromQuote` is invoked with `folioId = F_fiscal`
- **THEN** `F_fiscal.current_number` is incremented by 1 and the resulting `sale.folioId = F_fiscal`; the quote's folio (which is a different folio entirely) is NOT touched

#### Scenario: Conversion decrements inventory
- **WHEN** `createCompletedFromQuote` is invoked for an item `{ productId: P, quantity: 5 }` and the current `branch_inventory.quantity` for (branch, P) is `10`
- **THEN** after the call, `branch_inventory.quantity` is `5`

#### Scenario: Conversion allows negative stock
- **WHEN** `createCompletedFromQuote` is invoked for an item with `quantity = 30` and current inventory is `0`
- **THEN** the resulting inventory is `-30` (no rejection, same rule as direct POS sales)

### Requirement: Send sale ticket by email
The system SHALL expose `POST /api/v1/admin/sales/:id/send-ticket-email`. Requires `sales:read` (same permission as viewing the sale; no new permission introduced — sending a copy of an already-visible ticket is not a higher-privilege action). Enforces the same branch scope as `GET /sales/:id` (`enforceBranchScope`, loading the sale first). Optional body: `{ email?: string }` — when omitted, the recipient is `sale.customer.email` (via the sale's linked customer, which is nullable for walk-in/"público general" sales).

Behavior:

1. Load the sale via the same lookup used by `GET /sales/:id` (with items); enforce branch scope; not found → HTTP 404.
2. Resolve the recipient: `body.email` if present and non-empty (validated as a well-formed email via Zod `.email()`, else HTTP 400), otherwise `sale.customer?.email`. If both are absent/null → HTTP 400 `{"error": "Customer has no email and no override provided"}`.
3. Compose a single HTML email summarizing the ticket (folio, date, items, subtotal, IVA, IEPS, total, payment method) — no PDF/XML attachment (unlike `billing-api`'s invoice email, there is no generated file to attach; the ticket is a live-rendered summary).
4. Send the email to the resolved recipient via `MailerPort`. This send is SYNCHRONOUS — a failure (SMTP unreachable, auth failure, etc.) SHALL propagate to the caller as HTTP 502 `{"error": "Failed to send ticket email"}`. Nothing about the sale record is mutated by this endpoint either way.

Returns HTTP 200 `{"sentTo": "<resolved-email>"}` on success.

#### Scenario: Successful send to customer's email
- **WHEN** an authorized caller POSTs with no body for a sale whose linked `customer.email = "cliente@ejemplo.com"`
- **THEN** the system returns HTTP 200 `{"sentTo": "cliente@ejemplo.com"}` and a summary email was sent to that address

#### Scenario: Override recipient
- **WHEN** the body is `{ "email": "otra@direccion.com" }`
- **THEN** the email is sent to `otra@direccion.com` regardless of `customer.email`

#### Scenario: Walk-in sale with no customer requires an override
- **WHEN** the sale has `customerId: null` (público general) and the body omits `email`
- **THEN** the system returns HTTP 400 `{"error": "Customer has no email and no override provided"}` and no send is attempted

#### Scenario: Customer exists but has no email on file
- **WHEN** the sale's linked `customer.email` is `null` and the body omits `email`
- **THEN** the system returns HTTP 400 `{"error": "Customer has no email and no override provided"}`

#### Scenario: Malformed override email
- **WHEN** the body is `{ "email": "not-an-email" }`
- **THEN** the system returns HTTP 400 with a Zod validation error, no send is attempted

#### Scenario: SMTP failure propagates to caller
- **WHEN** the SMTP server is unreachable or rejects authentication
- **THEN** the system returns HTTP 502 `{"error": "Failed to send ticket email"}`

#### Scenario: Forbidden without sales:read
- **WHEN** a caller without `sales:read` calls the endpoint
- **THEN** the system returns HTTP 403 `{"error": "Forbidden", "required": "sales:read"}`

#### Scenario: Branch scoping violation
- **WHEN** a caller without `branches:access_all` requests a sale belonging to a different branch than `x-user-branch-id`
- **THEN** the system returns HTTP 403 `{"error": "Forbidden", "required": "branches:access_all"}`

#### Scenario: Sale not found
- **WHEN** `:id` does not reference an existing sale
- **THEN** the system returns HTTP 404

### Requirement: Product availability gate on sale creation and edit
When the inventory scope mode (`inventory-api` — Configurable inventory scope mode) is `branch`, creating a sale (`POST /api/v1/admin/sales`) or editing a completed sale (`PATCH /api/v1/admin/sales/:id`) SHALL reject any line item whose `productId` has no `branch_inventory` row for the sale's `branchId`, with HTTP 400 and a distinct error identifying the unavailable product (`ProductNotAvailableInBranch`), separate from the existing "product not found or inactive" error. The check runs in the application layer, after the existing active-product check and before price/dosification resolution, so it cannot be bypassed by calling the API directly without going through the UI. The error message SHALL NOT reveal whether or where else the product is available.

When the inventory scope mode is `general`, this gate does not apply — sale creation and edit behave exactly as before this capability.

Cancelling a sale, or restoring stock as part of an edit, is unaffected by this gate — restoration always succeeds regardless of scope mode (see `inventory-api` — Sale movements do not auto-create missing branch inventory rows in branch scope mode).

#### Scenario: Sale rejects unassigned product in branch mode
- **WHEN** the inventory scope mode is `branch` and `POST /api/v1/admin/sales` includes a line item for a product with no `branch_inventory` row in the sale's `branchId`
- **THEN** the system returns HTTP 400 with a `ProductNotAvailableInBranch` error identifying the product, and creates no sale

#### Scenario: Sale succeeds for assigned product with zero stock
- **WHEN** the inventory scope mode is `branch` and the line item's product has a `branch_inventory` row in the sale's branch with `quantity = 0`
- **THEN** the availability gate passes (the sale may still go negative per the existing negative-stock rules in `inventory-api`)

#### Scenario: Gate does not apply in general mode
- **WHEN** the inventory scope mode is `general` and a sale includes a product with no `branch_inventory` row anywhere
- **THEN** the sale is created normally (unchanged behavior — the row is auto-created as before)

#### Scenario: Edit completed sale enforces the same gate
- **WHEN** the inventory scope mode is `branch` and `PATCH /api/v1/admin/sales/:id` replaces the line items with one referencing a product not assigned to the sale's branch
- **THEN** the system returns HTTP 400 `ProductNotAvailableInBranch` and does not apply the edit

#### Scenario: Cancellation is never blocked by this gate
- **WHEN** the inventory scope mode is `branch` and a completed sale is cancelled
- **THEN** the cancellation succeeds and restores stock regardless of whether the product's `branch_inventory` row still exists

#### Scenario: Direct API call cannot bypass the gate
- **WHEN** the inventory scope mode is `branch` and a client calls `POST /api/v1/admin/sales` directly (not through the POS UI) with an unassigned product
- **THEN** the system still returns HTTP 400 `ProductNotAvailableInBranch` — the gate is enforced in the application layer, not only in the client

### Requirement: Customer branch membership gate on sale creation and edit

Creating a sale (`POST /api/v1/admin/sales`) or editing a completed sale (`PATCH /api/v1/admin/sales/:id`, which optionally changes `customerId`) SHALL reject the request when a non-null `customerId` does not have branch membership in the sale's `branchId` (`customers-api` — Customer branch membership), with HTTP 400 and a distinct error `CustomerNotAvailableInBranch`, separate from the existing "customer not found or inactive" check. Unlike the inventory availability gate (`Product availability gate on sale creation and edit`), this check is UNCONDITIONAL — it applies regardless of `INVENTORY_SCOPE_MODE`, since customer branch membership is a business rule independent of inventory scoping (`customers-api` — Customer branch membership). The check runs in the application layer, after the existing active-customer check, so it cannot be bypassed by calling the API directly without going through the UI. The error message SHALL NOT disclose which other branch the customer belongs to.

A `null` `customerId` (cash sale with no customer on file) is unaffected — this gate only applies when a customer is actually referenced.

#### Scenario: Sale rejects a customer not assigned to the sale's branch
- **WHEN** `POST /api/v1/admin/sales` has `branchId: <PRADERA>` and `customerId` referencing a customer whose `branchIds` is `["<ZARIOZ>"]` only
- **THEN** the system returns HTTP 400 `CustomerNotAvailableInBranch` and creates no sale

#### Scenario: Sale succeeds for a customer with multi-branch membership
- **WHEN** `POST /api/v1/admin/sales` has `branchId: <PRADERA>` and `customerId` referencing a customer whose `branchIds` includes both `<ZARIOZ>` and `<PRADERA>`
- **THEN** the sale is created normally

#### Scenario: Cash sale without a customer is unaffected
- **WHEN** `POST /api/v1/admin/sales` omits `customerId` (or sends `null`)
- **THEN** this gate does not apply — the sale proceeds per the existing rules for `customerId`-less sales

#### Scenario: Edit completed sale enforces the same gate when changing the customer
- **WHEN** `PATCH /api/v1/admin/sales/:id` includes a `customerId` not belonging to the sale's `branchId`
- **THEN** the system returns HTTP 400 `CustomerNotAvailableInBranch` and does not apply the edit

#### Scenario: Gate is unconditional regardless of inventory scope mode
- **WHEN** the inventory scope mode is `general` (the default) and a sale references a customer not assigned to the sale's branch
- **THEN** the system still returns HTTP 400 `CustomerNotAvailableInBranch` — this gate is NOT controlled by `INVENTORY_SCOPE_MODE`

#### Scenario: Direct API call cannot bypass the gate
- **WHEN** a client calls `POST /api/v1/admin/sales` directly (not through the POS UI) with a `customerId` outside the sale's branch
- **THEN** the system still returns HTTP 400 `CustomerNotAvailableInBranch` — the gate is enforced in the application layer, not only in the client

