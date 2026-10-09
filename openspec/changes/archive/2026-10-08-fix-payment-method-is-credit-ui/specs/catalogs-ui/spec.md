## MODIFIED Requirements

### Requirement: Create modal per catalog
The system SHALL provide, per catalog module, a single modal component `<Módulo>EditModal` that operates in two modes: `mode="create"` (POST) and `mode="edit"` (PATCH). When the user clicks "Nuevo" in the toolbar, the modal opens in `create` mode with empty defaults. The modal SHALL render the following editable inputs (depending on module):

- **Common (todos los módulos)**: `code` (text input, required, regex `^[A-Z0-9_]{1,32}$`), `name` (text input, required, 1–100 chars), `isActive` (`Switch`, default `true`).
- **`payment-methods`**: + `description` (textarea, 0–500 chars, empty maps to `null`); + `isCredit` (`Switch`, default `false`) — editable only in `mode="create"`; in `mode="edit"` the switch SHALL render disabled, reflecting the entity's current value without allowing changes, matching the immutability already enforced by the backend for this field.
- **`departments`**: + `description` (textarea, 0–500 chars, empty maps to `null`).
- **`folios`**: + `prefix` (text input, regex `^[A-Z0-9-]{1,8}$`, empty maps to `null`), + `currentNumber` (number input, integer ≥ 0, default `0`).
- **`branches`**: + `address` (textarea, 0–300 chars, empty maps to `null`), + `phone` (text input, 0–30 chars, empty maps to `null`), + `email` (email input, valid when not empty, 0–120 chars, empty maps to `null`).

On submit:
1. Validate with the module's create Zod schema.
2. If valid, call `create<Módulo>({ body })`. On HTTP 201, close modal and refresh the table.
3. On HTTP 409 (`code` duplicado), display inline error "Ese código ya está en uso" en el campo `code` y mantener el modal abierto.
4. On HTTP 400 (validation), display the first error message in a generic banner.

#### Scenario: Create payment method with isCredit enabled
- **WHEN** the user opens `PaymentMethodEditModal` in `mode="create"`, toggles "Es crédito" to `true`, fills `code`/`name`, and clicks "Guardar"
- **THEN** the modal calls `createPaymentMethod` with a body including `isCredit: true`, and on HTTP 201 closes the modal and refreshes the table

#### Scenario: Create payment method without touching isCredit defaults to false
- **WHEN** the user opens `PaymentMethodEditModal` in `mode="create"`, leaves "Es crédito" untouched, fills `code`/`name`, and clicks "Guardar"
- **THEN** the modal calls `createPaymentMethod` with a body where `isCredit` is `false` (or omitted), preserving current behavior for non-credit methods

#### Scenario: isCredit switch is disabled in edit mode
- **WHEN** the user opens `PaymentMethodEditModal` in `mode="edit"` for a payment method with `isCredit=true`
- **THEN** the "Es crédito" switch renders checked and disabled, and no user interaction can change its value

#### Scenario: isCredit never appears in the edit diff
- **WHEN** the user edits a payment method's `name`, `description`, or `isActive` in `mode="edit"` and clicks "Guardar"
- **THEN** the computed diff sent via `PATCH` never includes an `isCredit` key, regardless of the entity's current `isCredit` value
