## MODIFIED Requirements

### Requirement: List product prices
El sistema SHALL exponer `GET /api/v1/admin/products/:id/prices`. Requiere `products:read`. El querystring `branchId` (UUID de una sucursal existente) es **obligatorio**: ausente → HTTP 400 `{"error":"branchId is required"}`, formato inválido → HTTP 400, sucursal inexistente → HTTP 404 `{"error":"Branch not found"}`.

Cada `ProductPrice` pertenece a exactamente una sucursal: `branchId` es `string` no nulo. No existe el concepto de precio base compartido ni de herencia entre sucursales. Cada `ProductPriceDto` incluye `id`, `productId`, `branchId`, `name`, `price`, `minQuantity`, `discountPct` (o `null`), `isDefault`, `createdAt`, `updatedAt`.

La respuesta retorna únicamente los precios cuyo `branchId` coincide con el solicitado, ordenados por prioridad de negocio: primero el `isDefault=true`, luego `subdis` (case-insensitive), luego `distri`, luego el resto por `name ASC`.

#### Scenario: List prices de una sucursal
- **WHEN** un usuario autorizado pide los precios de un producto con `?branchId=<ZARIOZ>`
- **THEN** la respuesta incluye únicamente los precios de ZARIOZ, con el default primero

#### Scenario: branchId ausente
- **WHEN** se pide `GET /products/:id/prices` sin `branchId`
- **THEN** the system returns HTTP 400 `{"error":"branchId is required"}`

#### Scenario: Orden de prioridad para descuentos por volumen
- **WHEN** un producto tiene, en la sucursal consultada, precios "Precio Publico" (`isDefault=true`), "Precio Subdis 10%", "Precio Distri 15%" y "Precio 4"
- **THEN** el orden de la respuesta es exactamente: Precio Publico, Precio Subdis 10%, Precio Distri 15%, Precio 4

#### Scenario: Precios sin patrón conocido van al final por nombre
- **WHEN** un producto tiene un precio no-default cuyo `name` no matchea `subdis` ni `distri` (ej. "General")
- **THEN** ese precio aparece después de los precios "subdis"/"distri" de la misma sucursal, ordenado alfabéticamente junto a otros precios en la misma situación

#### Scenario: Sucursal sin precios para el producto
- **WHEN** el producto no tiene ningún precio cargado en la sucursal solicitada
- **THEN** la respuesta es HTTP 200 con `items: []` — no se devuelven precios de otra sucursal como sustituto

#### Scenario: Los precios de una sucursal no se ven desde otra
- **WHEN** un producto tiene "Precio Publico" $699.35 en ZARIOZ y $3,666.65 en Matriz, y se pide `?branchId=<ZARIOZ>`
- **THEN** la respuesta incluye únicamente $699.35 y ninguna fila de Matriz

#### Scenario: Product not found
- **WHEN** the URL `:id` does not match any product
- **THEN** the system returns HTTP 404

#### Scenario: branchId con formato inválido
- **WHEN** `?branchId=` recibe un valor que no es UUID
- **THEN** the system returns HTTP 400

#### Scenario: branchId de sucursal inexistente
- **WHEN** `?branchId=<uuid>` no corresponde a ninguna sucursal
- **THEN** the system returns HTTP 404 `{"error":"Branch not found"}`

### Requirement: Create product price
The system SHALL expose `POST /api/v1/admin/products/:id/prices`. Requires `products:write`. Required body: `name: string` (1–60 chars), `price: number` (>= 0, max 12 integer digits + 4 decimals), `branchId: string` (UUID de una sucursal activa — **obligatorio**; ausente o `null` → HTTP 400). Optional: `minQuantity: number` (integer >= 1, default 1), `discountPct: number | null` (0–100), `isDefault: boolean` (default `false`).

Las restricciones de unicidad y de default aplican por `(productId, branchId)`:
- Un producto SHALL tener a lo sumo UN precio con `isDefault: true` por sucursal. Un segundo default en la misma sucursal retorna HTTP 409 `{"error": "Product already has a default price"}`.
- Dos precios con el mismo `name` en la misma sucursal retornan HTTP 409. El mismo `name` PUEDE reutilizarse en sucursales distintas.

**Branch scoping**: un caller sin `branches:access_all` MUST enviar `branchId === x-user-branch-id`; cualquier otro valor retorna HTTP 403 `{"error": "Forbidden", "required": "branches:access_all"}`. Un `branchId` inexistente o inactivo retorna HTTP 400.

#### Scenario: Create non-default price
- **WHEN** the body is `{ "name": "Mayoreo", "price": 10.50, "minQuantity": 10, "branchId": "<B1>" }`
- **THEN** the system returns HTTP 201

#### Scenario: Create first default price
- **WHEN** the body is `{ "name": "Menudeo", "price": 12.00, "isDefault": true, "branchId": "<B1>" }` y esa sucursal no tiene default
- **THEN** the system returns HTTP 201

#### Scenario: branchId ausente en el body
- **WHEN** the body is `{ "name": "Menudeo", "price": 12.00 }` sin `branchId`
- **THEN** the system returns HTTP 400

#### Scenario: Reject second default price
- **WHEN** el producto ya tiene un default en esa sucursal y el body envía `isDefault: true`
- **THEN** the system returns HTTP 409

#### Scenario: Duplicate price name
- **WHEN** ya existe un precio "Menudeo" para el producto en esa sucursal
- **THEN** the system returns HTTP 409

#### Scenario: Mismo nombre en sucursales distintas coexiste
- **WHEN** existe "Precio Publico" en Matriz y se crea "Precio Publico" con `branchId: "<ZARIOZ>"`
- **THEN** the system returns HTTP 201 — la unicidad es por sucursal

#### Scenario: Cada sucursal tiene su propio default
- **WHEN** el producto ya tiene un default en Matriz y se crea un precio con `isDefault: true` y `branchId: "<ZARIOZ>"`
- **THEN** the system returns HTTP 201

#### Scenario: Invalid price
- **WHEN** the body contains `price: -5`
- **THEN** the system returns HTTP 400

#### Scenario: Operador crea precio fuera de su sucursal
- **WHEN** un `operator` con `x-user-branch-id: B1` (sin `branches:access_all`) envía `{ "name": "Precio Publico", "price": 500, "branchId": "B2" }`
- **THEN** the system returns HTTP 403 `{"error": "Forbidden", "required": "branches:access_all"}`

#### Scenario: Operador crea precio de su propia sucursal
- **WHEN** un `operator` con `x-user-branch-id: B1` envía `{ "name": "Precio Publico", "price": 500, "branchId": "B1" }`
- **THEN** the system returns HTTP 201

#### Scenario: branchId de sucursal inactiva o inexistente
- **WHEN** el body incluye `branchId` que no corresponde a una sucursal activa
- **THEN** the system returns HTTP 400

### Requirement: Update product price
The system SHALL expose `PATCH /api/v1/admin/products/:id/prices/:priceId`. Requires `products:write`. Body MAY include `name`, `price`, `minQuantity`, `discountPct`, `isDefault`. At least one field required. Toggling `isDefault: true` SHALL automatically unset `isDefault` on the prior default price of the SAME sucursal (atomic) — it SHALL NOT affect the default de ninguna otra sucursal.

`branchId` is **immutable** after creation, same as `code` in other catalogs: if the body includes `branchId`, it SHALL be silently ignored. Un caller sin `branches:access_all` SHALL recibir HTTP 403 si el precio pertenece a una sucursal distinta de `x-user-branch-id`.

#### Scenario: Update price value
- **WHEN** the body is `{ "price": 13.50 }`
- **THEN** the system returns HTTP 200 with the new value

#### Scenario: Promote to default
- **WHEN** the body is `{ "isDefault": true }` for a non-default price y otro precio de la MISMA sucursal es el default actual
- **THEN** the system atomically sets the new price as default and unsets the previous default; returns HTTP 200

#### Scenario: Promover el default de una sucursal no toca el de otra
- **WHEN** un precio de ZARIOZ con `isDefault: false` se PATCHea a `{ "isDefault": true }`, y Matriz tiene su propio default
- **THEN** el precio de ZARIOZ pasa a ser default en ZARIOZ; el default de Matriz queda intacto

#### Scenario: Price not found
- **WHEN** `:priceId` does not exist
- **THEN** the system returns HTTP 404

#### Scenario: branchId is ignored on update
- **WHEN** the body includes `{ "price": 15.00, "branchId": "<other-branch>" }` sobre un precio de la sucursal A
- **THEN** the system returns HTTP 200, updates `price`, y el `branchId` de la fila sigue siendo A

#### Scenario: Operador edita precio de otra sucursal
- **WHEN** un `operator` con `x-user-branch-id: B1` (sin `branches:access_all`) PATCHea un precio cuya sucursal es B2
- **THEN** the system returns HTTP 403 `{"error": "Forbidden", "required": "branches:access_all"}`

### Requirement: List product dosifications with computed unit price
The system SHALL expose `GET /api/v1/admin/products/:id/dosifications`. Requires `products:read`. El querystring `branchId` (UUID) es obligatorio, con las mismas reglas de validación y branch scoping que `GET /prices`. Returns `{ items: ProductDosificationDto[] }`. Each `ProductDosificationDto` includes `id`, `productId`, `name`, `numParts`, `isActive`, `computedUnitPrice: number | null`, `requiresDefaultPrice: boolean`, `createdAt`, `updatedAt`.

The `computedUnitPrice` is computed by the domain service `DosificationPriceCalculator` using the product's default price **de la sucursal solicitada** (`is_default = true AND branch_id = <branchId>`) as `basePrice`, and the surcharge percentage currently configured in `settings-api` (`GET /settings/pricing` → `dosificationSurchargePct`, default `5.0` when unconfigured). Formula: `basePrice / numParts * (1 + dosificationSurchargePct / 100)`. Si la sucursal no tiene precio default para ese producto, `computedUnitPrice` es `null` y `requiresDefaultPrice` es `true` — no se usa el precio de otra sucursal como sustituto.

#### Scenario: With default price
- **WHEN** el producto tiene un precio default de `100.00` en la sucursal solicitada, una dosificación con `numParts=10`, y no existe fila de `pricing_settings`
- **THEN** la respuesta incluye esa dosificación con `computedUnitPrice ≈ 10.50` (100 / 10 * 1.05) y `requiresDefaultPrice: false`

#### Scenario: With a configured surcharge
- **WHEN** un admin configuró `dosificationSurchargePct = 8` vía `PATCH /settings/pricing`, y el producto tiene precio default `100.00` en la sucursal solicitada con una dosificación de `numParts=10`
- **THEN** la respuesta incluye `computedUnitPrice ≈ 10.80` (100 / 10 * 1.08)

#### Scenario: Without default price
- **WHEN** el producto no tiene precio `is_default = true` en la sucursal solicitada
- **THEN** la respuesta incluye cada dosificación con `computedUnitPrice: null` y `requiresDefaultPrice: true`

#### Scenario: El precio default de otra sucursal no se usa
- **WHEN** el producto tiene default `100.00` en Matriz y ninguno en ZARIOZ, y se pide `?branchId=<ZARIOZ>`
- **THEN** `computedUnitPrice` es `null` y `requiresDefaultPrice` es `true`

#### Scenario: Inactive dosifications included by default
- **WHEN** el producto tiene dosificaciones con `is_active = false`
- **THEN** la respuesta las incluye (sin filtrado en el endpoint de lista; la UI filtra según necesite)
