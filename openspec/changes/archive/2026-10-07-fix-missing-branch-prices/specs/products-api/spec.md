## MODIFIED Requirements

### Requirement: List product prices
El sistema SHALL exponer `GET /api/v1/admin/products/:id/prices`. Requiere `products:read`. Acepta querystring **obligatorio** `branchId` (UUID de una sucursal existente): ausente → HTTP 400 `{"error":"branchId is required"}`; formato inválido → HTTP 400; sucursal inexistente → HTTP 404 `{"error":"Branch not found"}`.

Cada `ProductPrice` pertenece a exactamente una sucursal: `branchId` es `string` obligatorio (nunca `null`). No existe un "precio base global" ni un bucket sin sucursal — cada fila es propia de la sucursal que la creó, sin herencia entre sucursales. Cada `ProductPriceDto` incluye `id`, `productId`, `branchId`, `name`, `price`, `minQuantity`, `discountPct` (o `null`), `isDefault`, `createdAt`, `updatedAt`. **No incluye** el campo `isOverride` (removido junto con el concepto de bucket global).

La respuesta retorna únicamente los precios cuya `branchId` coincide exactamente con el `branchId` solicitado, ordenados por prioridad de negocio: primero el `isDefault=true`, luego los que matchean `subdis` (case-insensitive) en el nombre, luego `distri`, luego el resto por `name ASC`.

#### Scenario: List prices
- **WHEN** an authorized user gets prices for an existing product and branch
- **THEN** the response includes all prices belonging to that exact branch, default first

#### Scenario: Orden de prioridad para descuentos por volumen
- **WHEN** un producto tiene, para la sucursal solicitada, precios "Precio Publico" (`isDefault=true`), "Precio Subdis 10%", "Precio Distri 15%" y "Precio 4"
- **THEN** el orden de la respuesta es exactamente: Precio Publico, Precio Subdis 10%, Precio Distri 15%, Precio 4

#### Scenario: Precios sin patrón conocido van al final por nombre
- **WHEN** un producto tiene un precio no-default, de la sucursal solicitada, cuyo `name` no matchea `subdis` ni `distri` (ej. "General")
- **THEN** ese precio aparece después de los precios "subdis"/"distri" de la misma sucursal, ordenado alfabéticamente junto a otros precios en la misma situación

#### Scenario: Product not found
- **WHEN** the URL `:id` does not match any product
- **THEN** the system returns HTTP 404

#### Scenario: branchId ausente
- **WHEN** el querystring no incluye `branchId`
- **THEN** the system returns HTTP 400 `{"error":"branchId is required"}`

#### Scenario: branchId con formato inválido
- **WHEN** `?branchId=` recibe un valor que no es UUID
- **THEN** the system returns HTTP 400

#### Scenario: branchId de sucursal inexistente
- **WHEN** `?branchId=<uuid>` no corresponde a ninguna sucursal
- **THEN** the system returns HTTP 404 `{"error":"Branch not found"}`

#### Scenario: Sucursal sin ningún precio para el producto
- **WHEN** el producto no tiene ninguna fila `ProductPrice` con `branchId` igual al solicitado (independientemente de que exista precio en otras sucursales)
- **THEN** la respuesta retorna `{ items: [] }` — no hay fallback a un precio de otra sucursal

### Requirement: Create product price
The system SHALL expose `POST /api/v1/admin/products/:id/prices`. Requires `products:write`. Required body: `branchId: string` (UUID of an active branch — **mandatory**, no longer optional/nullable), `name: string` (1–60 chars), `price: number` (>= 0, max 12 integer digits + 4 decimals). Optional: `minQuantity: number` (integer >= 1, default 1), `discountPct: number | null` (0–100), `isDefault: boolean` (default `false`). Missing `branchId` → HTTP 400 `{"error":"branchId is required"}`.

Uniqueness and default constraints are scoped per `(productId, branchId)` — there is no global bucket:
- A product may have at most ONE price with `isDefault: true` PER branch. A second default for the same `(productId, branchId)` returns HTTP 409 `{"error": "Product already has a default price"}`.
- Two prices with the same `name` for the same `(productId, branchId)` return HTTP 409. The same `name` MAY be reused across different branches (e.g. "Precio Publico" exists independently for branch A and branch B).

**Branch scoping**: a caller without `branches:access_all` MUST pass `branchId === x-user-branch-id`; mismatch returns HTTP 403 `{"error": "Forbidden", "required": "branches:access_all"}`. A non-existent or inactive `branchId` returns HTTP 400.

#### Scenario: Create non-default price
- **WHEN** the body is `{ "branchId": "<B>", "name": "Mayoreo", "price": 10.50, "minQuantity": 10 }`
- **THEN** the system returns HTTP 201

#### Scenario: Create first default price
- **WHEN** the body is `{ "branchId": "<B>", "name": "Menudeo", "price": 12.00, "isDefault": true }` and no default exists for that branch
- **THEN** the system returns HTTP 201

#### Scenario: Reject second default price
- **WHEN** the product already has a default price for branch `B` and the body sets `{ "branchId": "<B>", "isDefault": true, ... }`
- **THEN** the system returns HTTP 409

#### Scenario: Duplicate price name within the same branch
- **WHEN** a price named "Menudeo" already exists for the product in branch `B`, and the body creates another "Menudeo" for the same branch `B`
- **THEN** the system returns HTTP 409

#### Scenario: Same price name reused across different branches is allowed
- **WHEN** branch `A` already has a "Precio Publico" price for the product, and the body creates "Precio Publico" for branch `B`
- **THEN** the system returns HTTP 201 — uniqueness is scoped per branch, not global

#### Scenario: Invalid price
- **WHEN** the body contains `price: -5`
- **THEN** the system returns HTTP 400

#### Scenario: branchId ausente
- **WHEN** el body no incluye `branchId`
- **THEN** the system returns HTTP 400 `{"error":"branchId is required"}`

#### Scenario: Operador crea precio fuera de su sucursal
- **WHEN** un `operator` con `x-user-branch-id: B1` (sin `branches:access_all`) envía `{ "branchId": "B2", "name": "Precio Publico", "price": 500 }`
- **THEN** the system returns HTTP 403 `{"error": "Forbidden", "required": "branches:access_all"}`

#### Scenario: Operador crea precio de su propia sucursal
- **WHEN** un `operator` con `x-user-branch-id: B1` envía `{ "branchId": "B1", "name": "Precio Publico", "price": 500 }`
- **THEN** the system returns HTTP 201

#### Scenario: branchId de sucursal inactiva o inexistente
- **WHEN** el body incluye `branchId` que no corresponde a una sucursal activa
- **THEN** the system returns HTTP 400

### Requirement: Update product price
The system SHALL expose `PATCH /api/v1/admin/products/:id/prices/:priceId`. Requires `products:write`. Body MAY include `name`, `price`, `minQuantity`, `discountPct`, `isDefault`. At least one field required. Toggling `isDefault: true` SHALL automatically unset `isDefault` on the prior default price of the SAME `(productId, branchId)` (atomic, scoped to that price's own branch) — it SHALL NOT affect the default of any other branch.

`branchId` is **immutable** after creation and is NOT accepted in the request body at all — if included, it is silently ignored by the schema (unknown field).

#### Scenario: Update price value
- **WHEN** the body is `{ "price": 13.50 }`
- **THEN** the system returns HTTP 200 with the new value

#### Scenario: Promote to default
- **WHEN** the body is `{ "isDefault": true }` for a non-default price and another price is currently default for the SAME branch
- **THEN** the system atomically sets the new price as default and unsets the previous default; returns HTTP 200

#### Scenario: Promoting a price to default only affects its own branch
- **WHEN** a branch A price with `isDefault: false` is PATCHed to `{ "isDefault": true }`, and branch B currently has its own default price for the same product
- **THEN** branch A's price becomes default; branch B's default is unchanged

#### Scenario: Price not found
- **WHEN** `:priceId` does not exist
- **THEN** the system returns HTTP 404

#### Scenario: branchId in body is ignored
- **WHEN** the body includes `{ "price": 15.00, "branchId": "<other-branch>" }` on an existing price for branch A
- **THEN** the system returns HTTP 200, updates `price`, and the row's `branchId` remains A
