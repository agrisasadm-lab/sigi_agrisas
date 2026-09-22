## MODIFIED Requirements

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
   - If `productPriceId` is present: load the `Product` and `ProductPrice`; verify `productPrice.productId === item.productId` (else `ProductPriceMismatchError` → HTTP 400), that the price belongs to a product whose `isActive = true` (else HTTP 400), and that `productPrice.branchId === null OR productPrice.branchId === branchId` — the price is either a global base price or an override belonging to the sale's own branch (else `ProductPriceNotAvailableForBranchError` → HTTP 400 `{"error": "Product price does not belong to this branch"}`; the error message SHALL NOT disclose the price or the other branch it belongs to). If `item.quantity` is NOT an integer (`quantity % 1 !== 0`), resolve the currently configured `dosificationSurchargePct` from `settings-api` (default `5.0` when unconfigured) and compute `unitPrice = price.price * (1 + surchargePct / 100)`; if `item.quantity` IS an integer, `unitPrice = price.price` unchanged (no surcharge). This surcharge applies uniformly to every product — there is no per-product or per-department opt-out.
   - If `dosificationId` is present instead: load the `Product` and `ProductDosification`; verify `dosification.productId === item.productId` (else HTTP 400) and `dosification.isActive = true` (else HTTP 400); load the product's default `ProductPrice` for the sale's `branchId` — the branch's own override marked `isDefault=true` if one exists, otherwise the global default (`branchId: null`, `isDefault=true`) — if neither exists → HTTP 400 `{"error": "Dosification requires a default price"}`; resolve the currently configured `dosificationSurchargePct` from `settings-api` (default `5.0` when unconfigured); compute `unitPrice = DosificationPriceCalculator.computeUnitPrice(defaultPrice.price, dosification.numParts, surchargePct)`. This is the ONLY surcharge applied to dosification lines — the fractional-quantity surcharge above SHALL NOT additionally apply here, regardless of whether `quantity` is itself fractional, to avoid double-charging the configured percentage on the same line.
   - `quantity > 0` (else HTTP 400) for either case. The system MAY skip enforcement of `minQuantity` in v1 (documented, applies only to price-based lines).
5. Snapshot `productCodeSnapshot = product.code`, `productNameSnapshot = product.name`; for price-based lines: `priceNameSnapshot = price.name`, `unitPrice` per step 4 above (recharged when `quantity` is fractional, else `price.price` unchanged), `discountPct = price.discountPct`; for dosification lines: `priceNameSnapshot = dosification.name`, `unitPrice` per above, `discountPct = null`, `dosificationId = dosification.id`, `numPartsSnapshot = dosification.numParts`. Both kinds set `ivaRate = product.ivaRate`, `iepsRate = product.iepsRate`. This server-computed snapshot is authoritative even for offline-originated sales — a `clientRequestId`-bearing request carries only IDs/quantities, never client-computed snapshot values, so catalog drift between offline creation and sync time is always resolved in favor of the server's live catalog. The snapshot does NOT record which branch's price (base or override) was used — only the resolved `unitPrice` value.
6. Compute totals using `SaleTotalsCalculator` (domain service) — unchanged by dosification lines or by the fractional-quantity surcharge (operates on `quantity * unitPrice`, agnostic to what `quantity` represents or how `unitPrice` was resolved).
7. If `paymentMethod.isCredit === true`: compute the informational `creditLimitExceeded` flag per "Credit flow auto-activation" above. This step never aborts the transaction.
8. Allocate the next folio number **for the sale's own branch** atomically via `allocateBranchFolio(tx, folioId, branchId)`: `INSERT INTO folio_branch_counters (folio_id, branch_id, current_number) VALUES (?, ?, 1) ON CONFLICT (folio_id, branch_id) DO UPDATE SET current_number = folio_branch_counters.current_number + 1 RETURNING current_number` (plus the folio's `code`/`prefix` and the branch's `code`). If the folio is inactive → HTTP 400. The resulting `folioCode` SHALL be `<prefix><BRANCH_CODE>-<currentNumber padded to 6 digits>` (e.g. `TK-ZARIOZ-000001`), distinct from the legacy global format (`TK-000001`) used before this per-branch counter existed — legacy documents keep their original `folioCode` unchanged. Folio numbers are allocated strictly in the order requests reach this step, PER BRANCH — two sales from different branches never share or block each other's sequence, and for a sale queued offline and synced later, this MAY differ from the chronological order in which the sale was actually created at the register (this is expected and accepted behavior for `offline-sync`, not a bug).
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
- **THEN** the system returns HTTP 201 with the `SaleDetailDto` (`quoteId: null`, `isCredit: false`, `paidAmount: total`, `paymentStatus: 'paid'`, `creditLimitExceeded: false`), `branch_inventory.quantity` decremented by each item's quantity, and `folios.current_number` incremented by 1
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
- **WHEN** the body has one item with `dosificationId` referencing a dosification with `numParts=4` and `quantity=3`, for a product whose default price is `100` and whose `branch_inventory.quantity = 10`, and no `pricing_settings` row exists yet (default 5% surcharge applies)
- **THEN** the system returns HTTP 201 with `unitPrice = (100/4)*1.05 = 26.25` on that line; `branch_inventory.quantity` becomes `10 - (3/4) = 9.25`

#### Scenario: Dosification without default price rejected
- **WHEN** the body has an item with `dosificationId` referencing a dosification whose product has no default `ProductPrice`
- **THEN** the system returns HTTP 400 `{"error": "Dosification requires a default price"}` and the transaction does not commit

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

#### Scenario: Folio numbering is independent per branch
- **WHEN** branch ZARIOZ has already issued `TK-ZARIOZ-000001` through `TK-ZARIOZ-000005` and branch PRADERA issues its first `TK` sale ever
- **THEN** PRADERA's sale receives `TK-PRADERA-000001` — not `TK-ZARIOZ-000006` or any number derived from another branch's sequence

#### Scenario: Legacy folioCode is preserved, not renumbered
- **WHEN** a sale issued before this capability exists with `folioCode = "TK-000038"` (the old global-counter format)
- **THEN** that sale's `folioCode` is never altered by this change, and no new sale is ever assigned that same `folioCode` again (the new per-branch format `TK-<BRANCH>-NNNNNN` cannot collide with it)

#### Scenario: Sale uses the branch's own override price
- **WHEN** the body's `branchId` is ZARIOZ and an item's `productPriceId` references a `ProductPrice` whose `branchId = ZARIOZ`
- **THEN** the system returns HTTP 201 and `unitPrice` on that line is resolved from the ZARIOZ override, not from the product's global base price

#### Scenario: Sale uses the global base price when the branch has no override
- **WHEN** the body's `branchId` is HUAJUAPAN and an item's `productPriceId` references a `ProductPrice` whose `branchId = null` (base)
- **THEN** the system returns HTTP 201 and `unitPrice` on that line is resolved from the base price, exactly as before this change

#### Scenario: Sale rejects a price override belonging to another branch
- **WHEN** the body's `branchId` is HUAJUAPAN but an item's `productPriceId` references a `ProductPrice` whose `branchId = ZARIOZ`
- **THEN** the system returns HTTP 400 `{"error": "Product price does not belong to this branch"}` and the transaction does not commit; the response body does not include the ZARIOZ price value

#### Scenario: Dosification default price resolves the branch's own override first
- **WHEN** the body's `branchId` is ZARIOZ, the item has `dosificationId` referencing a dosification whose product has BOTH a global default `ProductPrice` (base, `price=100`) AND a ZARIOZ-scoped override marked `isDefault=true` (`price=80`)
- **THEN** the dosification's `basePrice` used for `computeUnitPrice` is `80` (the ZARIOZ default), not the global `100`

#### Scenario: Dosification default price falls back to the global default
- **WHEN** the body's `branchId` is HUAJUAPAN, the item has `dosificationId` referencing a dosification whose product has a global default `ProductPrice` and no HUAJUAPAN-scoped override
- **THEN** the dosification's `basePrice` is resolved from the global default, exactly as before this change

