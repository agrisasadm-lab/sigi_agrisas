## ADDED Requirements

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
