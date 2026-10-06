## MODIFIED Requirements

### Requirement: List product prices
El sistema SHALL exponer `GET /api/v1/admin/products/:id/prices`. Requiere `products:read`. Acepta querystring opcional `branchId` (UUID de una sucursal existente; formato inválido → HTTP 400, sucursal inexistente → HTTP 404 `{"error":"Branch not found"}`).

Cada `ProductPrice` tiene un `branchId` (`string | null`): `null` = **precio base** (aplica a toda sucursal sin override propio); no-null = **override** exclusivo de esa sucursal. Cada `ProductPriceDto` incluye `id`, `productId`, `branchId`, `isOverride` (= `branchId !== null`), `name`, `price`, `minQuantity`, `discountPct` (o `null`), `isDefault`, `createdAt`, `updatedAt`.

- **Sin `branchId`**: retorna únicamente los precios base (`branchId: null`) del producto, ordenados por prioridad de negocio (igual que hoy): primero el `isDefault=true`, luego `subdis` (case-insensitive), luego `distri`, luego el resto por `name ASC`.
- **Con `branchId=<uuid>`**: si la sucursal tiene **al menos un** override propio para ese producto, la respuesta retorna **únicamente** los overrides de esa sucursal (`isOverride: true` en todos) — los tiers base sin override propio ya NO se incluyen, aunque existan con otro `name`. Si la sucursal **no tiene ningún** override para ese producto, la respuesta retorna todos los precios base sin cambios (`isOverride: false` en todos, comportamiento idéntico a "sin `branchId`"). El orden de prioridad de negocio se aplica sobre el conjunto resultante en ambos casos.

#### Scenario: List prices
- **WHEN** an authorized user gets prices for an existing product
- **THEN** the response includes all prices, default first

#### Scenario: Orden de prioridad para descuentos por volumen
- **WHEN** un producto tiene precios "Precio Publico" (`isDefault=true`), "Precio Subdis 10%", "Precio Distri 15%" y "Precio 4"
- **THEN** el orden de la respuesta es exactamente: Precio Publico, Precio Subdis 10%, Precio Distri 15%, Precio 4

#### Scenario: Precios sin patrón conocido van al final por nombre
- **WHEN** un producto tiene un precio no-default cuyo `name` no matchea `subdis` ni `distri` (ej. "General")
- **THEN** ese precio aparece después de los precios "subdis"/"distri" del mismo producto, ordenado alfabéticamente junto a otros precios en la misma situación

#### Scenario: Product not found
- **WHEN** the URL `:id` does not match any product
- **THEN** the system returns HTTP 404

#### Scenario: Precio efectivo por sucursal — override presente excluye los demás tiers base
- **WHEN** un producto tiene precios base "Precio Publico" ($3,666.65), "Precio Subdis 10%" ($3,300) y "Precio Distri 15%" ($3,116.65), y sólo existe un override de "Precio Publico" para la sucursal ZARIOZ ($699.35), y se pide `?branchId=<ZARIOZ>`
- **THEN** la respuesta incluye ÚNICAMENTE "Precio Publico" con `price: 699.35`, `branchId: <ZARIOZ>`, `isOverride: true` — "Precio Subdis 10%" y "Precio Distri 15%" de Matriz NO aparecen en la respuesta

#### Scenario: Precio efectivo por sucursal — sin ningún override hereda todos los tiers base
- **WHEN** un producto tiene precios base "Precio Publico" y "Precio Subdis 10%", y la sucursal HUAJUAPAN no tiene ningún override para ese producto, y se pide `?branchId=<HUAJUAPAN>`
- **THEN** la respuesta incluye ambos precios base sin cambios (`isOverride: false` en ambos), igual que si no se hubiera pasado `branchId`

#### Scenario: Eliminar el único override revierte la sucursal a heredar todos los tiers base
- **WHEN** existe un único override "Precio Publico" para la sucursal ZARIOZ y se elimina vía `DELETE /prices/:priceId`, y luego se pide `GET .../prices?branchId=<ZARIOZ>`
- **THEN** la respuesta muestra todos los precios base del producto (`isOverride: false` en todos) — la sucursal vuelve a heredar el catálogo completo de Matriz, no sólo el tier que tenía override

#### Scenario: branchId con formato inválido
- **WHEN** `?branchId=` recibe un valor que no es UUID
- **THEN** the system returns HTTP 400

#### Scenario: branchId de sucursal inexistente
- **WHEN** `?branchId=<uuid>` no corresponde a ninguna sucursal
- **THEN** the system returns HTTP 404 `{"error":"Branch not found"}`
