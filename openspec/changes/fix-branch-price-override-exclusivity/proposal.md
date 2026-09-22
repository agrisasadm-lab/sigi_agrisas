## Historia de Usuario

| # | Rol | Tarea | Motivo | Criterios de Aceptación | Criterios de Seguridad |
|---|---|---|---|---|---|
| 1 | Cajero de sucursal (POS/Cotizaciones) sin `branches:access_all` | Como cajero de sucursal, quiero que el selector de precios sólo muestre los precios propios de mi sucursal cuando el producto ya tiene al menos un override local, para no poder cobrar por error un precio de Matriz que ya no aplica en mi tienda | Reportado en campo como "no se respetan los precios que se mandaron en el Excel por sucursal": el Excel de precios por tienda definió un precio único por producto, pero el POS sigue ofreciendo también los tiers de Matriz (Subdis 10%, Distri 15%, Precio 4) para productos que ya tienen su propio precio de sucursal | - Given un producto con override "Precio Publico" en la sucursal del cajero (ej. ZARIOZ), When el cajero abre el selector de precios en POS/Cotizaciones, Then sólo ve los precios con `branchId` de su sucursal — no ve "Precio Subdis 10%"/"Precio Distri 15%"/"Precio 4" de Matriz aunque esos tiers existan sin override local<br>- Given un producto SIN ningún override en la sucursal del cajero, When abre el selector, Then ve todos los tiers base de Matriz (comportamiento actual, sin cambio — sigue heredando cuando no hay nada propio)<br>- Given un cliente HTTP manda directamente un `productPriceId` de un precio base de Matriz para un producto que sí tiene override en la sucursal de la venta/cotización, When se crea la venta o cotización, Then el backend rechaza con HTTP 400 (`ProductPriceNotAvailableForBranchError`) — el filtrado no es sólo cosmético en el frontend | - La regla se aplica en el backend (`resolveEffectivePrices` + validación en `CreateSaleUseCase`/`EditCompletedSaleUseCase`/`CreateQuoteUseCase`/`UpdateQuoteUseCase`), no sólo en el filtrado del frontend — un cliente HTTP directo no puede bypassear enviando el `productPriceId` base cuando existe un override.<br>- Sin cambio de permisos: se sigue requiriendo `products:read`/`sales:create`/`quotes:create` como hoy — la regla es de integridad del precio cobrado, no de autorización nueva. |

Nota: aunque el fix toca dos capas (regla de dominio en `resolveEffectivePrices` y una validación nueva en los use cases de venta/cotización), ambas sirven al mismo criterio de aceptación — el cajero nunca debe poder cobrar un precio de Matriz cuando existe un override local — por lo que se mantiene como una sola historia.

## Why

`resolveEffectivePrices` (`src/modules/products/domain/services/resolveEffectivePrices.ts`) hoy combina, para una sucursal dada, sus propios overrides **más** cualquier tier base de Matriz cuyo `name` no tenga un override local con el mismo nombre. En la práctica esto significa que una sucursal con override sólo en "Precio Publico" (el tier que trae el Excel de precios por tienda) sigue heredando "Precio Subdis 10%", "Precio Distri 15%" y "Precio 4" de Matriz — tiers que esa tienda nunca definió y que en varios productos son varias veces más caros o más baratos que el precio real de la tienda (verificado en prod: `KAB1`/"KER KAB 1L" en ZARIOZ tiene override $699.35, pero Matriz define Subdis $3,300 y Distri $3,116.65 para el mismo producto, ambos aún seleccionables en el POS de ZARIOZ).

El dato en base de datos ya es correcto — la importación del Excel sí creó los overrides esperados (verificado: 222/225 precios "Precio Publico" de ZARIOZ coinciden con el Excel fuente, y las ventas históricas de esa sucursal ya usaron el precio local). El bug es de exposición: el POS ofrece un conjunto de precios más amplio de lo que la sucursal debería ver, dejando la puerta abierta a que el cajero elija el tier incorrecto de Matriz.

## What Changes

- `resolveEffectivePrices`: cuando una sucursal tiene ≥1 override propio para un producto, el resultado son **únicamente** esos overrides (ya no se completa con los tiers base sin nombre coincidente). Cuando la sucursal no tiene ningún override, el comportamiento no cambia (se devuelven todos los tiers base).
- Nuevo método `PosLookups.hasBranchPriceOverrides(productId, branchId): Promise<boolean>` (Prisma + InMemory) para saber si un producto tiene overrides en una sucursal sin traer todas las filas.
- `CreateSaleUseCase`, `EditCompletedSaleUseCase`, `CreateQuoteUseCase`, `UpdateQuoteUseCase`: si el `productPriceId` recibido es un precio base (`branchId === null`) y el producto tiene overrides en la sucursal de la venta/cotización, se rechaza con el error ya existente `ProductPriceNotAvailableForBranchError` (400) — defensa en profundidad para que la regla no dependa sólo de lo que el frontend deje seleccionar.
- `app/_lib/offline/catalogCache.ts` (`pullPricesFor`): se agrega `branchId` a la URL de precarga, para que la caché offline no siga sirviendo únicamente los tiers base de Matriz sin distinguir sucursal (evita que una venta offline con producto de override falle al sincronizar).
- Sin cambios de frontend en `PriceTierPicker` ni en los selectores de POS/Cotizaciones/Facturación — ya reciben `branchId` y listan lo que el backend les entregue; heredan el comportamiento correcto automáticamente.

## Capabilities

### New Capabilities
_(ninguna)_

### Modified Capabilities
- `products-api`: el requirement "List product prices" cambia — el conjunto "efectivo" para una sucursal ya no mezcla overrides con tiers base sin nombre coincidente cuando existe al menos un override.
- `pos-api`: el paso de resolución de precio en `CreateSaleUseCase`/`EditCompletedSaleUseCase` gana una validación nueva (precio base rechazado si existe override de sucursal).
- `quotes-api`: mismo cambio en `CreateQuoteUseCase`/`UpdateQuoteUseCase`.

## Impact

- **Archivos modificados**: `src/modules/products/domain/services/resolveEffectivePrices.ts`, `src/modules/pos/application/ports/PosLookups.ts` (+ implementaciones Prisma/InMemory), `src/modules/pos/application/use-cases/{CreateSaleUseCase,EditCompletedSaleUseCase}.ts`, `src/modules/quotes/application/use-cases/{CreateQuoteUseCase,UpdateQuoteUseCase}.ts`, `app/_lib/offline/catalogCache.ts`.
- **Sin cambios de schema ni migraciones.**
- **Sin cambios de API pública** (mismos endpoints, mismo contrato de query params) — sólo cambia qué filas devuelve/acepta el backend.
- **Alcance de pruebas**: unit tests de dominio (`resolveEffectivePrices`), unit tests de los 4 use cases (InMemory repos), sin necesidad de tests E2E nuevos (POS/Cotizaciones ya mandan `branchId`).
