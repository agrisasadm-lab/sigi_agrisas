# Spec: returns-api

## Purpose

Define the Returns API: registration and cancellation of product returns linked to completed sales, with per-line returnable quantity enforcement, inventory restoration, and branch scoping.

---
## Requirements
### Requirement: Return aggregate model
The system SHALL persist a product return as the aggregate `Return` (header) + `ReturnItem` (lines) with the following invariants:

- `Return.status` is one of `completed`, `cancelled`. There is no `draft` state — the return cart lives in the client. Transitions are:
  - `(created) → completed` (at `POST /returns`, atomically; never persisted as `draft`).
  - `completed → cancelled` (via `POST /returns/:id/cancel`). Terminal: no further transitions allowed.
- `Return` references `saleId` (the originating ticket; FK `ON DELETE RESTRICT`), `branchId` (snapshot of `sale.branchId`, immutable), `customerId` (snapshot of `sale.customerId`, nullable; FK `ON DELETE SET NULL`), `creatorId` (the authenticated user who registered the return; FK `ON DELETE RESTRICT`), `cancelledBy` (nullable; FK `ON DELETE SET NULL`).
- `Return.reason` is a required `TEXT` field with `length BETWEEN 3 AND 500` chars. Free text (no enum) in v1.
- `Return.returnedAt` is a required `TIMESTAMP(3)`. SHALL be `<= NOW()` at creation time. There is NO lower bound against `sale.completedAt` in v1 (operators may backdate captures).
- `Return.notes` is nullable, max 1000 chars.
- `Return.cancelledAt` and `Return.cancellationReason` are populated only when the cancellation occurs.
- `Return.refundSubtotal`, `Return.refundTax`, `Return.refundTotal` are persisted as `DECIMAL(14, 4)` and computed at creation from the snapshotted line totals.
- Each `ReturnItem` references `returnId` (FK `ON DELETE CASCADE`), `saleItemId` (FK `ON DELETE RESTRICT`; the link is required so the system can validate "this line belongs to the linked sale"), `productId` (FK `ON DELETE RESTRICT`), `productPriceId` (nullable; FK `ON DELETE SET NULL`).
- Each `ReturnItem` snapshots `productCodeSnapshot`, `productNameSnapshot`, `priceNameSnapshot`, `unitPrice`, `discountPct`, `discountAmount`, `ivaRate`, `iepsRate` so the return is intact even if the sale, product, or price are later edited or deleted. `discountAmount` is copied from the originating `sale_item` unchanged — it is never an input of `POST /returns` (the body carries no discount fields; see "Create return (atomic registration)").
- Each `ReturnItem` persists `quantity` (`DECIMAL(14, 4)`, the quantity returned for that sale line — strictly `> 0`), `lineSubtotal`, `lineTax`, `lineTotal` (refund amounts; same formula as the sale's `SaleTotalsCalculator`, including the `discountAmount` deduction when the originating line had one).
- The combination `(saleItemId)` MAY appear multiple times across different `Return` rows for the same `saleId` (partial returns done in multiple visits are allowed). The system enforces "sum of `quantity` across active (`status='completed'`) returns ≤ `sale_item.quantity`" via the `ReturnableQuantityCalculator` at write time.
- **Dosification lines**: when the originating `SaleItem` has a non-null `dosificationId`/`numPartsSnapshot` (see `pos-api` "Sale aggregate model"), the corresponding `ReturnItem` SHALL copy both `dosificationId` (nullable FK to `product_dosifications`, `ON DELETE SET NULL`) and `numPartsSnapshot` (nullable `INT`) from the sale item at return-creation time — same snapshot pattern already used for `priceNameSnapshot`/`productCodeSnapshot`. `ReturnItem.quantity` for such a line represents parts returned, consistent with the sale line's unit (parts, not base units). `ReturnableQuantityCalculator` compares `quantity` (parts) against `sale_item.quantity` (parts) unchanged — no conversion needed there, since both sides are already expressed in the same unit (parts).
- **Inventory quantity for dosification lines**: any operation that moves `branch_inventory.quantity` from a `ReturnItem` (creation, cancellation) SHALL use `quantity / numPartsSnapshot` as the base-unit amount when `numPartsSnapshot` is non-null, instead of `quantity` directly — mirrors the same rule on the sale side.

#### Scenario: Snapshot survives product rename
- **WHEN** a return is registered for product `SAC_50KG ("Saco 50kg")`, and later the product is renamed to `"Saco 50kg Mix Premium"`
- **THEN** `GET /api/v1/admin/returns/:id` for the prior return still returns `productNameSnapshot: "Saco 50kg"` on that line

#### Scenario: Snapshot survives sale item deletion path (theoretical)
- **WHEN** the FK from `return_items.sale_item_id` is `ON DELETE RESTRICT` and a request attempts to delete the underlying `sale_item` row (via SQL or a future module)
- **THEN** the delete fails because at least one return references that line

#### Scenario: Dosification return copies numPartsSnapshot
- **WHEN** a return is registered for a sale line whose `numPartsSnapshot=4`
- **THEN** the resulting `return_items` row has `numPartsSnapshot=4` and the same `dosificationId` as the sale line

#### Scenario: Return of a flat-amount-discounted line snapshots the discount
- **WHEN** a return is registered for a sale line whose `sale_item.discountAmount = 80` (and `discountPct = 0`)
- **THEN** the resulting `return_items` row has `discountAmount = 80`, `discountPct = 0`

---

### Requirement: ReturnableQuantityCalculator (domain service)
The system SHALL provide a pure domain service `ReturnableQuantityCalculator` in `src/modules/returns/domain/services/ReturnableQuantityCalculator.ts` with a static method:

```
computeRemaining(soldQuantity: Decimal, priorReturnItems: { quantity: Decimal; returnStatus: 'completed' | 'cancelled' }[]): Decimal
```

The result equals `soldQuantity - sum(quantity for items whose returnStatus === 'completed')`. Items whose `returnStatus === 'cancelled'` SHALL NOT be subtracted (a cancelled return releases its claim on the sale line).

The service SHALL throw if `soldQuantity <= 0` or if any item's `quantity <= 0`. No I/O dependencies.

#### Scenario: No prior returns
- **WHEN** `computeRemaining(10, [])` is invoked
- **THEN** the result is `10`

#### Scenario: One completed return
- **WHEN** `computeRemaining(10, [{ quantity: 3, returnStatus: 'completed' }])` is invoked
- **THEN** the result is `7`

#### Scenario: Multiple completed returns
- **WHEN** `computeRemaining(10, [{ quantity: 3, returnStatus: 'completed' }, { quantity: 2, returnStatus: 'completed' }])` is invoked
- **THEN** the result is `5`

#### Scenario: Cancelled return does not count
- **WHEN** `computeRemaining(10, [{ quantity: 3, returnStatus: 'completed' }, { quantity: 4, returnStatus: 'cancelled' }])` is invoked
- **THEN** the result is `7` (the cancelled 4 do NOT reduce the remaining)

#### Scenario: Fully returned
- **WHEN** `computeRemaining(10, [{ quantity: 10, returnStatus: 'completed' }])` is invoked
- **THEN** the result is `0`

#### Scenario: Fractional quantities
- **WHEN** `computeRemaining(10.5, [{ quantity: 2.75, returnStatus: 'completed' }])` is invoked
- **THEN** the result is `7.75`

---

### Requirement: ReturnTotalsCalculator (domain service)
The system SHALL provide a pure domain service `ReturnTotalsCalculator` in `src/modules/returns/domain/services/ReturnTotalsCalculator.ts` with the same signature, formula, and rounding as `SaleTotalsCalculator` (half-to-even at 4 decimals) — including the tax-extraction formula (`lineGross = max(0, round(quantity * unitPrice * (1 - discountPct/100), 4) - discountAmount)`, `lineSubtotal = round(lineGross / (1 + ivaRate + iepsRate), 4)`, `lineIva`/`lineIeps` computed from that extracted base, `lineTotal = lineGross`) and the same `discountPct`/`discountAmount` mutual-exclusion and range validation. The returned values represent refund amounts. A test of equivalence with `SaleTotalsCalculator` over a shared fixture (`tests/fixtures/totals-vectors.ts`), including vectors exercising `discountAmount`, is required.

#### Scenario: Equivalence with SaleTotalsCalculator
- **WHEN** the same input is passed to both calculators
- **THEN** they return identical results for every line and the aggregated totals, including the extracted subtotal/IVA/IEPS breakdown and any `discountAmount` deduction

#### Scenario: Pure domain
- **WHEN** unit tests run against the calculator
- **THEN** no Prisma, no fetch, no environment access is required

#### Scenario: Refund of a flat-amount-discounted line deducts the discount
- **WHEN** `computeTotals([{ quantity: 1, unitPrice: 500, discountAmount: 100 }])` is invoked (mirroring a return of a sale line that had a $100 flat discount)
- **THEN** `lineGross = 400`, `lineTotal = 400` — the refund reflects what the customer actually paid, not the undiscounted price

### Requirement: List returns
The system SHALL expose `GET /api/v1/admin/returns` that returns a paginated list of returns. Requires the `returns:read` permission. Query parameters: `page` (default 1), `pageSize` (default 20, max 100), `branchId` (optional UUID), `customerId` (optional UUID), `saleId` (optional UUID), `status` (optional, comma-separated; one or more of `completed`,`cancelled`), `from` (optional ISO date — inclusive lower bound on `returned_at`), `to` (optional ISO date — inclusive upper bound on `returned_at`), `search` (optional, min 2 chars; matches joined `sale.folio_code`, `sale.folio_number::text`, joined `customer.name`/`customer.rfc`).

Each `ReturnDto` includes `id`, `saleId`, `saleFolioCode` (joined), `saleFolioNumber` (joined), `branchId`, `branchName` (joined), `customerId`, `customerName` (joined or `null`), `customerRfc` (joined or `null`), `creatorId`, `creatorName` (joined), `status`, `reason`, `returnedAt`, `refundSubtotal`, `refundTax`, `refundTotal`, `notes`, `cancelledAt`, `cancelledBy`, `cancellationReason`, `createdAt`, `updatedAt`. `items` is NOT included in the list response.

Sorted by `returned_at DESC, created_at DESC`.

**Branch scoping**: identical to `pos-api`'s sales listing. Callers without `branches:access_all`:
- If `?branchId=` absent → implicit filter by `x-user-branch-id`; if `x-user-branch-id` is empty → HTTP 403.
- If `?branchId=<X>` present and `X !== x-user-branch-id` → HTTP 403.

Callers with `branches:access_all`:
- If `?branchId=` absent → returns across all branches.
- If `?branchId=<X>` present → filters to that branch.

#### Scenario: Operator lists own branch
- **WHEN** an `operator` with `x-user-branch-id: B1` and `returns:read` calls `GET /api/v1/admin/returns`
- **THEN** the system implicitly filters to `branchId = B1` and returns HTTP 200

#### Scenario: Operator tries another branch
- **WHEN** an `operator` with `x-user-branch-id: B1` calls `GET /api/v1/admin/returns?branchId=B2`
- **THEN** the system returns HTTP 403 `{"error": "Forbidden", "required": "branches:access_all"}`

#### Scenario: Admin lists all branches
- **WHEN** an `admin` (has `branches:access_all`) calls `GET /api/v1/admin/returns`
- **THEN** the system returns returns from all branches

#### Scenario: Filter by sale
- **WHEN** the request includes `?saleId=<uuid>`
- **THEN** only returns linked to that sale are returned

#### Scenario: Filter by status
- **WHEN** the request includes `?status=completed`
- **THEN** the response excludes returns whose status is `cancelled`

#### Scenario: Search by folio
- **WHEN** the request includes `?search=A-1024`
- **THEN** returns whose joined `sale.folio_code` or `sale.folio_number::text` contain "A-1024" are included

#### Scenario: Filter by date range
- **WHEN** the request includes `?from=2026-06-01&to=2026-06-30`
- **THEN** only returns whose `returned_at` falls within the range are returned

#### Scenario: Forbidden without returns:read
- **WHEN** a caller without `returns:read` calls the endpoint
- **THEN** the system returns HTTP 403 `{"error": "Forbidden", "required": "returns:read"}`

---

### Requirement: List returns for a sale
The system SHALL expose `GET /api/v1/admin/sales/:id/returns`. Requires `returns:read`. Returns ALL returns linked to the sale (both `completed` and `cancelled`), sorted by `returned_at DESC, created_at DESC`. Pagination is NOT applied (a single sale's return count is bounded in practice).

Returns HTTP 404 if `:id` does not match any sale. Branch scoping applies on the sale's `branchId`.

#### Scenario: Returns for sale
- **WHEN** an authorized caller fetches `GET /api/v1/admin/sales/<id>/returns` for a sale with 2 returns (one completed, one cancelled)
- **THEN** the system returns HTTP 200 with `{ returns: [<completed>, <cancelled>] }`

#### Scenario: No returns
- **WHEN** the sale exists but has no returns
- **THEN** the system returns HTTP 200 with `{ returns: [] }`

#### Scenario: Sale not found
- **WHEN** `:id` does not match any sale
- **THEN** the system returns HTTP 404

#### Scenario: Out-of-branch sale
- **WHEN** the caller's branch differs from the sale's branch and they lack `branches:access_all`
- **THEN** the system returns HTTP 403

---

### Requirement: Get return detail
The system SHALL expose `GET /api/v1/admin/returns/:id` that returns a single return with its items. Requires `returns:read`. Returns HTTP 404 if not found. Branch scoping applies (a caller without `branches:access_all` can only fetch returns whose `branchId === x-user-branch-id`; otherwise HTTP 403).

`ReturnDetailDto` extends `ReturnDto` with `items: ReturnItemDto[]`, each including `id`, `saleItemId`, `productId`, `productPriceId` (or `null`), `productCodeSnapshot`, `productNameSnapshot`, `priceNameSnapshot`, `quantity`, `unitPrice`, `discountPct`, `ivaRate`, `iepsRate`, `lineSubtotal`, `lineIva`, `lineIeps`, `lineTax`, `lineTotal`.

`lineIva` and `lineIeps` are derived fields — `ReturnItem` only persists `lineSubtotal`, `lineTax`, and `lineTotal`. The mapper SHALL compute `lineIva = roundHalfToEven(lineSubtotal * (ivaRate ?? 0), 4)` and `lineIeps = roundHalfToEven(lineSubtotal * (iepsRate ?? 0), 4)`, using the same banker's-rounding function (`roundHalfToEven`, half-to-even at 4 decimals) that `ReturnTotalsCalculator` uses when the line was first computed — never `Math.round` or any other rounding mode — so that `lineIva + lineIeps` always equals the persisted `lineTax` for that line.

#### Scenario: Authorized fetch
- **WHEN** a caller with `returns:read` and access to the return's branch fetches a valid `:id`
- **THEN** the system returns HTTP 200 with the `ReturnDetailDto`

#### Scenario: Out-of-branch fetch
- **WHEN** a caller without `branches:access_all` fetches a return whose `branchId !== x-user-branch-id`
- **THEN** the system returns HTTP 403

#### Scenario: Return not found
- **WHEN** the `:id` does not match any return
- **THEN** the system returns HTTP 404 `{"error": "Return not found"}`

#### Scenario: lineIva and lineIeps use the same rounding as lineTax
- **WHEN** a return item has `lineSubtotal = 100.0002` and `iepsRate = 0.25` (a value where half-up and half-to-even rounding disagree at the 4th decimal)
- **THEN** the returned `lineIeps` SHALL equal `roundHalfToEven(100.0002 * 0.25, 4) = 25.0000`, and `lineIva + lineIeps` SHALL equal the persisted `lineTax` for that item — never the half-up result `25.0001`

---

### Requirement: Create return (atomic registration)
The system SHALL expose `POST /api/v1/admin/returns` that registers a completed return in a single transaction. Requires `returns:create`.

Required body:

- `saleId: string` (UUID of an existing `Sale` with `status='completed'`)
- `reason: string` (min 3, max 500 chars; trimmed)
- `returnedAt: string` (ISO 8601 timestamp; SHALL be `<= NOW()`)
- `items: ReturnItemInput[]` (at least 1 item)

Each `ReturnItemInput`:

- `saleItemId: string` (UUID; SHALL belong to the linked `saleId`)
- `quantity: number` (decimal `> 0`; max 14 integer + 4 decimal digits). For a sale line originating from a dosification, this is parts returned (same unit as the sale line's `quantity`), not base units.

The body does NOT accept any discount field — `discountPct`/`discountAmount` are never inputs of this endpoint; they are always derived from the originating `sale_item` (see "Return aggregate model").

Optional body:

- `notes: string | null` (max 1000 chars)

The body SHALL NOT accept `branchId` or `customerId`: both are inherited from the linked sale.

**Branch scoping**: the controller resolves `sale.branchId` and applies the standard guard:
```
const bypass = await authz.userCan(userId, "branches:access_all");
if (!bypass && sale.branchId !== x-user-branch-id) return 403;
```

**Atomic flow (inside a Prisma transaction)**:

1. Load the sale via `saleRepo.findByIdWithItems(saleId)`; if it does not exist → HTTP 400 `{"error": "Sale not found"}` (not 404, since the body validation is failing).
2. Verify `sale.status === 'completed'`; if `cancelled` or `edited` → HTTP 409 `SaleNotReturnableError(status)` `{"error": "Sale is not returnable", "status": "<actual>"}`. (See pos-api Modified Requirement "Get sale detail" — `edited` is rejected in v1.)
3. Apply branch scoping (above); fail with 403 if violated.
4. Verify `items.length >= 1`; empty → HTTP 400 `EmptyReturnError`.
5. For each item:
   a. Verify `saleItemId` belongs to `sale.items` (else HTTP 400 `SaleItemNotPartOfSaleError`).
   b. Load all prior return_items for this `saleItemId` (any status) via the repo.
   c. `remaining = ReturnableQuantityCalculator.computeRemaining(saleItem.quantity, priorReturnItems)` — both `saleItem.quantity` and prior `return_items.quantity` are already in the same unit (parts for dosification lines, base units otherwise); no conversion needed at this step.
   d. If `item.quantity > remaining` → HTTP 409 `ReturnQuantityExceedsRemainingError(saleItemId, requested, remaining)` with body `{"error": "Return quantity exceeds remaining", "saleItemId": "<id>", "requested": <n>, "remaining": <n>}`.
6. Snapshot per line from the corresponding `sale_item`: `productCodeSnapshot`, `productNameSnapshot`, `priceNameSnapshot`, `unitPrice`, `discountPct`, `discountAmount`, `ivaRate`, `iepsRate`, and — when the sale item has them — `dosificationId`, `numPartsSnapshot`.
7. Compute totals using `ReturnTotalsCalculator` — unchanged by dosification lines; deducts `discountAmount` exactly as the originating sale line did.
8. For each item, INCREMENT inventory atomically using the base-unit amount (`quantity / numPartsSnapshot` when the sale item has a dosification, `quantity` otherwise):
   ```
   UPDATE branch_inventory
   SET quantity = quantity + ${amount}, updated_at = NOW()
   WHERE branch_id = ? AND product_id = ?
   ```
   If `UPDATE` affects 0 rows (no inventory record exists for this pair), the system SHALL `INSERT INTO branch_inventory (branch_id, product_id, quantity) VALUES (?, ?, ${amount})` (creates the record with the returned amount as initial).
9. `INSERT` the `returns` row with `status='completed'`, snapshotted `branchId`/`customerId` from the sale, `creatorId = userId`, `returnedAt = body.returnedAt`, `reason`, `notes`, refund totals.
10. `INSERT` the `return_items` rows (including `dosificationId`/`numPartsSnapshot` when applicable).

Returns HTTP 201 with the `ReturnDetailDto` (including items).

#### Scenario: Successful partial return
- **WHEN** an `operator` with `x-user-branch-id: B1` and `returns:create` posts `{ saleId, reason: "Producto defectuoso", returnedAt: "2026-06-02T10:00:00Z", items: [{ saleItemId, quantity: 2 }] }` for a sale whose item has `quantity: 10` and no prior returns
- **THEN** the system returns HTTP 201, `branch_inventory.quantity` for that product is incremented by 2, and the return row is `status='completed'` with `refundTotal` matching the line's prorated total

#### Scenario: Successful full return
- **WHEN** the body returns all of every line's remaining quantity
- **THEN** the system returns HTTP 201; the sale row is NOT modified (status stays `completed`); subsequent `POST /returns` with any item from this sale rejects with `ReturnQuantityExceedsRemainingError`

#### Scenario: Multiple partial returns over time
- **WHEN** a sale line had `quantity=10`, a first return for 3 was completed yesterday, and today a second return for 5 is posted
- **THEN** the second return succeeds (`3 + 5 = 8 <= 10`) and inventory is incremented by 5

#### Scenario: Exceeds remaining
- **WHEN** the requested `quantity` for a line is greater than `remaining`
- **THEN** the system returns HTTP 409 `{"error": "Return quantity exceeds remaining", "saleItemId": "<id>", "requested": 7, "remaining": 4}` and the transaction does not commit

#### Scenario: Cancelled return does not count toward remaining
- **WHEN** a prior return for a line was cancelled, and a new return requests up to the original sold quantity
- **THEN** the new return succeeds — cancelled return quantities do NOT reduce remaining

#### Scenario: Sale is cancelled
- **WHEN** the linked sale has `status='cancelled'`
- **THEN** the system returns HTTP 409 `{"error": "Sale is not returnable", "status": "cancelled"}` and the transaction does not commit

#### Scenario: Sale is edited (v1)
- **WHEN** the linked sale has `status='edited'`
- **THEN** the system returns HTTP 409 `{"error": "Sale is not returnable", "status": "edited"}` — v1 only accepts `completed` (see design.md Decision 6 trade-offs)

#### Scenario: Branch scoping violation
- **WHEN** an `operator` with `x-user-branch-id: B1` posts a return for a sale whose `branchId: B2` and lacks `branches:access_all`
- **THEN** the system returns HTTP 403 `{"error": "Forbidden", "required": "branches:access_all"}`

#### Scenario: SaleItem from another sale
- **WHEN** the body's `saleItemId` belongs to a sale OTHER than `saleId`
- **THEN** the system returns HTTP 400 `{"error": "Sale item does not belong to the linked sale", "saleItemId": "<id>"}` and the transaction does not commit

#### Scenario: Empty items
- **WHEN** the body has `items: []`
- **THEN** the system returns HTTP 400 `{"error": "Return must include at least one item"}`

#### Scenario: Missing reason
- **WHEN** the body omits `reason`
- **THEN** the system returns HTTP 400 with a Zod error pointing to `reason`

#### Scenario: returnedAt in the future
- **WHEN** the body has `returnedAt` strictly greater than the server's current time
- **THEN** the system returns HTTP 400 with a Zod error pointing to `returnedAt`

#### Scenario: Inventory record absent at return time
- **WHEN** the (branch, product) pair has no `branch_inventory` row
- **THEN** the system creates the row with `quantity = item.quantity` (positive initial) and returns HTTP 201

#### Scenario: Inventory was negative before the return
- **WHEN** `branch_inventory.quantity = -5` and a return for 3 of that product is registered
- **THEN** the row is updated to `quantity = -2` and the system returns HTTP 201

#### Scenario: Concurrent returns on the same line
- **WHEN** two concurrent requests both attempt to return `quantity=6` of a line whose `remaining=10`
- **THEN** both transactions read `remaining=10` and serialize at the inventory UPDATE; the FIRST to commit succeeds and the SECOND, when it attempts to re-read `remaining`, sees `4` (or fails with the constraint) and rejects with `ReturnQuantityExceedsRemainingError`. The use case SHALL use repository methods that observe prior returns inside the same transaction so that conflicts surface as 409 rather than silent over-returns.

#### Scenario: customerBalance does not mutate
- **WHEN** the customer's `current_balance = 1500` before the return
- **THEN** after a successful return the customer's `current_balance` is still `1500` (currentBalance is read-only in v1)

#### Scenario: Forbidden without returns:create
- **WHEN** a caller without `returns:create` calls the endpoint
- **THEN** the system returns HTTP 403 `{"error": "Forbidden", "required": "returns:create"}`

#### Scenario: Return of a dosification line increments a fraction of base stock
- **WHEN** a return is registered for `quantity=2` parts of a sale line whose `numPartsSnapshot=4`
- **THEN** `branch_inventory.quantity` is incremented by `2/4 = 0.5` (not by `2`)

#### Scenario: Refund of a flat-amount-discounted line deducts the discount
- **WHEN** a return is registered for a sale line whose `sale_item` had `unitPrice=500`, `quantity=1`, `discountAmount=100` (so the customer paid `400` for it)
- **THEN** the system returns HTTP 201 with `refundTotal = 400` on that line, not `500` — the refund never exceeds what was actually paid

---

### Requirement: Cancel return
The system SHALL expose `POST /api/v1/admin/returns/:id/cancel`. Requires `returns:cancel`. Optional body: `reason: string | null` (max 500 chars). Branch scoping applies (callers without `branches:access_all` can only cancel returns in their assigned branch).

Behavior (inside a Prisma transaction):

- If `return.status === 'cancelled'` → HTTP 409 `ReturnAlreadyCancelledError` `{"error": "Return is already cancelled"}` (NOT idempotent — re-cancellation is treated as a probable double-click).
- If `return.status === 'completed'`: for each item, DECREMENT inventory atomically using the base-unit amount (`quantity / numPartsSnapshot` when the return item has a dosification, `quantity` otherwise):
  ```
  UPDATE branch_inventory
  SET quantity = quantity - ${amount}, updated_at = NOW()
  WHERE branch_id = ? AND product_id = ?
  ```
  If `UPDATE` affects 0 rows, the system SHALL `INSERT INTO branch_inventory (branch_id, product_id, quantity) VALUES (?, ?, -${amount})` (creates the row with negative initial quantity). The resulting `quantity` MAY be negative — same rule as the POS sale path (see `inventory-api` Modified Requirement). **After each such decrement**, the system SHALL evaluate the low-stock notification trigger per `admin-notifications-api` "Notify admin on low stock" (best-effort, never blocks or fails this endpoint).
- Then `UPDATE returns SET status='cancelled', cancelled_at=NOW(), cancelled_by=<userId>, cancellation_reason=?` (one row).

Returns HTTP 200 with the updated `ReturnDetailDto`.

The cancellation does NOT modify the originating `Sale` or any `SaleItem` row. The sale ticket remains identical to its pre-return state on the sales side; only `returns.status` and `branch_inventory.quantity` change.

#### Scenario: Cancel completed return
- **WHEN** an authorized caller cancels a `completed` return with items totalling X units of product P
- **THEN** the system returns HTTP 200, the return `status` becomes `cancelled`, and `branch_inventory.quantity` for product P at the return's branch is decremented by X

#### Scenario: Re-cancellation rejected
- **WHEN** the same return is cancelled twice
- **THEN** the second call returns HTTP 409 `{"error": "Return is already cancelled"}` and no side effects occur

#### Scenario: Cancellation may drive stock negative
- **WHEN** at the moment of cancellation `branch_inventory.quantity = 2` and the return restored `5` units (i.e., between the return and the cancellation, 3 were sold)
- **THEN** the system updates the row to `quantity = -3` and returns HTTP 200 — the negative balance represents a real inventory debt to be settled by transfer or admin adjust

#### Scenario: Cancellation when inventory row was deleted
- **WHEN** between the return and the cancellation, the (branch, product) inventory row was removed (e.g., via `DELETE /inventory`)
- **THEN** the system re-creates the row with `quantity = -qty` and returns HTTP 200

#### Scenario: Out-of-branch cancellation
- **WHEN** an `operator` in branch B1 tries to cancel a return whose `branchId = B2` and lacks `branches:access_all`
- **THEN** the system returns HTTP 403

#### Scenario: Return not found
- **WHEN** the `:id` does not match any return
- **THEN** the system returns HTTP 404

#### Scenario: Free space restored for new returns
- **WHEN** a return for 3 units of a sale line is cancelled
- **THEN** `ReturnableQuantityCalculator.computeRemaining(...)` for that line increases by 3 — a new return up to the original sold quantity becomes possible

#### Scenario: Forbidden without returns:cancel
- **WHEN** a caller without `returns:cancel` calls the endpoint
- **THEN** the system returns HTTP 403 `{"error": "Forbidden", "required": "returns:cancel"}`

#### Scenario: Cancel a dosification return decrements a fraction of base stock
- **WHEN** a `completed` return with `numPartsSnapshot=4`, `quantity=2` parts (i.e. `0.5` base units incremented at creation) is cancelled
- **THEN** `branch_inventory.quantity` is decremented by `0.5` (not by `2`)

#### Scenario: Return cancellation crossing reorder point triggers admin notification
- **WHEN** cancelling a return decrements `branch_inventory.quantity` below `reorder_point` for that (branch, product), and no notification for that pair was sent in the last 24h
- **THEN** the system still returns HTTP 200 as normal, AND — per `admin-notifications-api` — an email is sent to the configured admin address and `lastLowStockNotifiedAt` is updated; a failure to send this email does NOT affect the HTTP 200 response

---

### Requirement: `returned_total` sale status
The system SHALL extend `Sale.status` domain type to include `returned_total`. A sale acquires `returned_total` status when a full-return operation results in `remaining = 0` for ALL sale lines. This status is terminal: no further transitions (cancel, edit) are allowed from `returned_total`.

#### Scenario: Sale becomes returned_total after full return
- **WHEN** `POST /api/v1/admin/sales/:id/full-return` completes and all lines have `remaining = 0`
- **THEN** `sale.status` transitions to `returned_total` within the same request

#### Scenario: returned_total blocks cancellation
- **WHEN** `POST /api/v1/admin/sales/:id/cancel` is called on a sale with `status = 'returned_total'`
- **THEN** the system returns HTTP 409 `{"error": "SaleNotCancellable"}`

#### Scenario: returned_total blocks edit
- **WHEN** `PUT /api/v1/admin/sales/:id/edit` is called on a sale with `status = 'returned_total'`
- **THEN** the system returns HTTP 409 `{"error": "SaleNotEditable"}`

---

### Requirement: Full-return endpoint
The system SHALL expose `POST /api/v1/admin/sales/:id/full-return`. Requires `returns:create` permission. Request body: `{ reason: string (3–500 chars), returnedAt?: string (ISO datetime, defaults to NOW), notes?: string (max 1000 chars) }`. The endpoint SHALL:

1. Load the sale with its items and all prior return items
2. Compute `remaining` for each sale line via `ReturnableQuantityCalculator`
3. Build a return payload including only lines with `remaining > 0`
4. If no lines have `remaining > 0`, return HTTP 409 `{"error": "SaleAlreadyFullyReturned"}`
5. Delegate to `CreateReturnUseCase` (same transaction as existing return creation)
6. After the return is persisted, evaluate if all lines are now fully returned; if so, update `sale.status = 'returned_total'` atomically
7. Return HTTP 201 with the new `ReturnDto`

Branch scoping: identical to `POST /returns` — `branchId` is derived from the sale.

#### Scenario: Full return on a completed sale
- **WHEN** an operator with `returns:create` calls `POST /api/v1/admin/sales/:id/full-return` with valid reason on a `completed` sale with no prior returns
- **THEN** the system creates a return covering all lines, sets `sale.status = 'returned_total'`, and returns HTTP 201

#### Scenario: Full return on a partially returned sale
- **WHEN** some lines have prior `completed` returns and `POST /sales/:id/full-return` is called
- **THEN** the system devuelve only the remaining quantities, marks the sale `returned_total` if everything is covered, returns HTTP 201

#### Scenario: Already fully returned
- **WHEN** all sale lines have `remaining = 0` before the call
- **THEN** the system returns HTTP 409 `{"error": "SaleAlreadyFullyReturned"}`

#### Scenario: Reason too short
- **WHEN** the body includes `reason: "x"` (less than 3 chars)
- **THEN** the system returns HTTP 400

#### Scenario: Forbidden without permission
- **WHEN** a user without `returns:create` calls the endpoint
- **THEN** the system returns HTTP 403

#### Scenario: Sale not found
- **WHEN** the `:id` does not match any sale
- **THEN** the system returns HTTP 404

#### Scenario: Sale not returnable (cancelled)
- **WHEN** the sale has `status = 'cancelled'`
- **THEN** the system returns HTTP 409 `{"error": "SaleNotReturnableError"}`

---

### Requirement: `returned_total` in sale list and detail responses
The system SHALL include `returned_total` as a valid value in `SaleDto.status` in all endpoints that return `SaleDto` (list, detail). Clients filtering by `?status=returned_total` SHALL receive only fully returned sales.

#### Scenario: Filter by returned_total
- **WHEN** `GET /api/v1/admin/sales?status=returned_total` is called
- **THEN** the response includes only sales with `status = 'returned_total'`

---

### Requirement: Sale invariant preserved by returns
A return SHALL NOT modify any row in `sales` or `sale_items`. The originating ticket is immutable from the returns module. Operations that mutate inventory (`UPDATE branch_inventory ...`), encode the return-related state ONLY in the `returns` and `return_items` tables.

#### Scenario: Sale row untouched by return creation
- **WHEN** a return is registered against a sale
- **THEN** the sale row's `status`, `subtotal`, `taxTotal`, `total`, `folioNumber`, `cancelledAt`, `cancellationReason`, `editedAt`, and `notes` are byte-for-byte identical to their pre-return values

#### Scenario: Sale items untouched by return creation
- **WHEN** a return is registered against a sale
- **THEN** every `sale_item` row for that sale has identical `quantity`, `unitPrice`, `discountPct`, `lineTotal`, etc. as before the return

#### Scenario: Sale row untouched by return cancellation
- **WHEN** a return is cancelled
- **THEN** the underlying `sale` and `sale_items` rows remain unchanged from their pre-return state — only `returns` and `branch_inventory` are mutated

---

### Requirement: Branch scoping pattern for return endpoints
Every route handler in `returns-api` that operates on a return or on a branch-specific listing SHALL enforce the standard scoping pattern using `x-user-branch-id` (from middleware) and `branches:access_all` (via `AuthorizationService.userCan`). See `rbac` Requirement: branches:access_all bypass semantics for the canonical implementation.

For `POST /returns`, the scoped `branchId` is resolved from `sale.branchId` (the sale referenced by the body). For `GET /returns/:id`, `POST /returns/:id/cancel`, and `GET /sales/:id/returns`, the scoped `branchId` is resolved from the persisted resource. For `GET /returns` without `?branchId=`, the scoped value is determined via `resolveScopedBranchId(req, queryBranchId)`. Reads MUST resolve the resource's existence BEFORE applying the scoping check (so 403 is never used as an existence oracle; if the resource does not exist, return 404 first).

#### Scenario: Existence not leaked
- **WHEN** an unauthorized user requests `GET /api/v1/admin/returns/<id-of-return-in-other-branch>`
- **THEN** the system returns HTTP 403 only if the return exists in another branch; if the id is unknown entirely, the system returns HTTP 404

#### Scenario: Operator restricted to own branch
- **WHEN** an `operator` posts a return for a sale of another branch
- **THEN** the system returns HTTP 403

#### Scenario: Admin bypass
- **WHEN** an `admin` (has `branches:access_all`) posts a return for a sale of any branch
- **THEN** the system returns HTTP 201 (no scoping check applied)

---

### Requirement: Idempotency of return creation is the client's responsibility
The system SHALL NOT deduplicate `POST /returns` requests server-side in v1. Two identical bodies submitted twice produce two independent returns. The client (UI or integration) is responsible for double-submission protection. If the second request would over-return a line, the standard `ReturnQuantityExceedsRemainingError` triggers — but if the original return had enough remaining, both succeed.

#### Scenario: Duplicate submissions
- **WHEN** the same body is posted twice within a few seconds and the line has enough remaining for both
- **THEN** TWO `Return` rows are created, inventory is incremented by `2 * quantity`, and both requests return HTTP 201 with distinct ids

#### Scenario: Second submission triggers exceed
- **WHEN** the first submission consumed all remaining and the second posts the same body
- **THEN** the second returns HTTP 409 `ReturnQuantityExceedsRemainingError`

(Future change: introduce HTTP `Idempotency-Key` support if production traffic warrants it.)

---

### Requirement: Return reason immutability (V1)
The system SHALL NOT expose any endpoint that allows modifying `Return.reason` after creation. There is no `PATCH /returns/:id` endpoint. Any future endpoint to edit the reason (for Admin role) is explicitly out of scope for V1 and requires a separate change with a new `returns:admin_edit` permission.

#### Scenario: No PATCH endpoint exists
- **WHEN** a client sends `PATCH /api/v1/admin/returns/:id`
- **THEN** the system returns HTTP 405 Method Not Allowed (or 404 if unrouted)

#### Scenario: reason persisted verbatim
- **WHEN** `POST /returns` is called with `reason: "Cliente cambió de opinión tras revisar el producto"`
- **THEN** `GET /returns/:id` returns `reason: "Cliente cambió de opinión tras revisar el producto"` unchanged

---

### Requirement: Quantity validation (formalized)
The system SHALL reject `POST /api/v1/admin/returns` requests where any item has `quantity <= 0` with HTTP 400. The system SHALL reject requests where any item's `quantity` exceeds `ReturnableQuantityCalculator.computeRemaining(soldQty, priorItems)` with HTTP 422 `{"error": "ReturnQuantityExceedsRemaining", "saleItemId": "<id>", "remaining": <n>}`. Requests with an empty `items` array SHALL return HTTP 400 `{"error": "ReturnItemsEmpty"}`.

#### Scenario: Zero quantity rejected
- **WHEN** the body includes `{ items: [{ saleItemId: "x", quantity: 0 }] }`
- **THEN** the system returns HTTP 400

#### Scenario: Negative quantity rejected
- **WHEN** the body includes `{ items: [{ saleItemId: "x", quantity: -1 }] }`
- **THEN** the system returns HTTP 400

#### Scenario: Quantity exceeds remaining
- **WHEN** the body requests returning 5 units of a line where only 3 remain
- **THEN** the system returns HTTP 422 `{"error": "ReturnQuantityExceedsRemaining", "saleItemId": "<id>", "remaining": 3}`

#### Scenario: Empty items array rejected
- **WHEN** the body includes `{ items: [] }`
- **THEN** the system returns HTTP 400 `{"error": "ReturnItemsEmpty"}`

---

### Requirement: Return reason validation formalized
The system SHALL enforce `reason` as required on `POST /returns` and `POST /sales/:id/full-return`: empty string, whitespace-only, or missing field → HTTP 400 `{"error": "ReturnReasonRequired"}`. Length SHALL be between 3 and 500 chars; violations → HTTP 400.

#### Scenario: Missing reason
- **WHEN** the body omits `reason`
- **THEN** the system returns HTTP 400 `{"error": "ReturnReasonRequired"}`

#### Scenario: Whitespace-only reason
- **WHEN** the body includes `reason: "   "`
- **THEN** the system returns HTTP 400 `{"error": "ReturnReasonRequired"}`

#### Scenario: Reason at max length
- **WHEN** the body includes `reason` of exactly 500 characters
- **THEN** the system accepts the request (HTTP 201)

#### Scenario: Reason exceeds max length
- **WHEN** the body includes `reason` of 501 characters
- **THEN** the system returns HTTP 400

