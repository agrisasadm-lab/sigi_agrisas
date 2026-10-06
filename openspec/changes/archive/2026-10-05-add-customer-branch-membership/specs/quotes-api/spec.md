## ADDED Requirements

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
