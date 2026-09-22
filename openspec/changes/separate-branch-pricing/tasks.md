## 1. Esquema y migración

- [x] 1.1 `prisma/schema.prisma`: `ProductPrice.branchId String @map("branch_id")` (deja de ser opcional); relación `branch Branch @relation(...)` no opcional; reemplazar el `@@unique([productId, branchId, name])` plano por el mismo unique ya efectivo (queda uno solo, sin buckets) y quitar los índices parciales del bucket global.
- [x] 1.2 Migración `separate_branch_pricing` con este orden estricto dentro de una sola transacción:
  1. `RAISE EXCEPTION` si `NOT EXISTS (SELECT 1 FROM branches WHERE is_headquarters = TRUE)`.
  2. `INSERT INTO product_prices (...) SELECT gen_random_uuid()::text, bi.product_id, bi.branch_id, pp.name, pp.price, pp.min_quantity, pp.discount_pct, pp.is_default, NOW(), NOW() FROM branch_inventory bi JOIN product_prices pp ON pp.product_id = bi.product_id AND pp.branch_id IS NULL WHERE NOT EXISTS (SELECT 1 FROM product_prices o WHERE o.product_id = bi.product_id AND o.branch_id = bi.branch_id AND o.name = pp.name);`
  3. `UPDATE product_prices SET branch_id = (SELECT id FROM branches WHERE is_headquarters = TRUE) WHERE branch_id IS NULL;`
  4. `DROP INDEX` de `product_price_global_name_idx`, `product_default_price_global_idx` y del unique plano `product_prices_product_id_branch_id_name_key`; `ALTER COLUMN branch_id SET NOT NULL`; crear el unique definitivo `(product_id, branch_id, name)` y el parcial de default `(product_id, branch_id) WHERE is_default`.
- [x] 1.3 `npx prisma migrate dev --name separate_branch_pricing` contra dev + `npx prisma generate`.
- [x] 1.4 Verificación en dev (SQL): `SELECT count(*) FROM product_prices WHERE branch_id IS NULL` → 0; ningún par `(branch_id, product_id)` de `branch_inventory` sin al menos un precio; ninguna combinación `(product_id, branch_id)` con más de un `is_default = true`.

## 2. Dominio y puertos

- [x] 2.1 Eliminar `src/modules/products/domain/services/resolveEffectivePrices.ts` y su test `tests/unit/modules/products/domain/services/resolveEffectivePrices.test.ts`.
- [x] 2.2 `src/modules/products/domain/entities/ProductPrice.ts`: `branchId: string` (no nullable).
- [x] 2.3 `src/modules/products/application/ports/ProductPriceRepository.ts`: eliminar `findByProductId(productId)`; renombrar `findEffectiveForBranch` a `findByProductAndBranch(productId, branchId)`; `findDefaultByProductId(productId, branchId: string)` con `branchId` obligatorio; `CreateProductPriceData.branchId: string`.
- [x] 2.4 `src/modules/pos/application/ports/PosLookups.ts`: retirar `hasBranchPriceOverrides`; `ProductPriceLookup.branchId: string`.

## 3. Repositorios

- [x] 3.1 `PrismaProductPriceRepository`: `findByProductAndBranch` = `findMany({ where: { productId, branchId } })` + `sortProductPricesForDisplay`; sin `resolveEffectivePrices`. `findDefaultByProductId` deja de caer a `branchId: null`.
- [x] 3.2 `InMemoryProductPriceRepository`: mismo contrato, espejo en memoria.
- [x] 3.3 `PrismaDepartmentPriceListRepository` (reporte de lista de precios por departamento): filtrar por `branchId` en la consulta en vez de usar `resolveEffectivePrices`.
- [x] 3.4 `PrismaPosLookupService`: retirar `hasBranchPriceOverrides`; `getDosificationForSale` resuelve el default sólo con `branch_id = <branchId de la operación>`, sin fallback a `null`.

## 4. Use cases y controllers

- [x] 4.1 `ListProductPricesUseCase`: `branchId` obligatorio en el request; se elimina la rama sin sucursal.
- [x] 4.2 `ProductPricesController.list`: `branchId` obligatorio (ausente → 400 `{"error":"branchId is required"}`); mantener 400 por UUID inválido y 404 por sucursal inexistente.
- [x] 4.3 `ProductPricesController.create`: `branchId` obligatorio en el body (ausente/`null` → 400); `enforceBranchScope` se mantiene.
- [x] 4.4 `ProductPricesController.update`: aplicar `enforceBranchScope` contra el `branchId` del precio cargado antes de modificar (hoy la edición no lo valida).
- [x] 4.5 `CreateProductPriceUseCase`: `findDefaultByProductId(productId, branchId)` con sucursal explícita.
- [x] 4.6 Dosificaciones — `ListProductDosificationsUseCase`, `CreateProductDosificationUseCase`, `UpdateProductDosificationUseCase`: reciben `branchId` y lo pasan a `findDefaultByProductId`. `ProductDosificationsController`: `branchId` obligatorio con las mismas reglas de validación y scoping que `GET /prices`.
- [x] 4.7 `CreateSaleUseCase`, `EditCompletedSaleUseCase`, `CreateQuoteUseCase`, `UpdateQuoteUseCase`: la validación pasa a `price.branchId !== <branchId de la operación>` → `ProductPriceNotAvailableForBranchError`; se retiran las llamadas a `hasBranchPriceOverrides`.

## 5. Frontend

- [x] 5.1 `app/(private)/pos/_logic/types/api.ts` y `services/getProductPrices.ts`: el DTO conserva `branchId`; se elimina `isOverride` (ya no existe la distinción).
- [x] 5.2 `app/_lib/offline/catalogCache.ts`: `pullPricesFor(productId, branchId)` manda `branchId` (ya viene del change superseded — conservar); invalidar la caché de precios al cambiar de sucursal y al cerrar sesión.
- [x] 5.3 `app/(private)/catalogs/products/_blocks/ProductPricesTab.tsx`: quitar la opción "Precio base (todas)" y la columna `Origen`; arranque en matriz (bypass) o en la sucursal propia; estado vacío cuando el usuario no tiene sucursal ni bypass; quitar la acción "Crear override aquí". Conservar el filtrado del selector por permiso y la traducción del 403.
- [x] 5.4 Pestaña Dosificaciones: propagar el `branchId` seleccionado a `GET /dosifications` y ajustar el texto del aviso a "Requiere precio default en esta sucursal".
- [x] 5.5 Revisar los demás consumidores de `GET /products/:id/prices` (`app/(private)/quotes`, `app/(private)/billing`, reportes) para que todos manden `branchId`.

## 6. Tests

- [ ] 6.1 Reescribir los tests de scoping heredados del change superseded (`CreateSaleUseCase.branchScoping`, `EditCompletedSaleUseCase`, `CreateQuoteUseCase.branchScoping`, `ListProductPricesUseCase.branchScoping`) contra la regla nueva: precio de otra sucursal → 400; precio de la sucursal propia → acepta; ya no existe el caso "precio base".
- [ ] 6.2 Tests de `ProductPricesController`: `branchId` ausente en list → 400; ausente en create → 400; update de un precio de otra sucursal sin bypass → 403.
- [ ] 6.3 Tests de dosificaciones: `computedUnitPrice` se resuelve con el default de la sucursal pedida; sin default en esa sucursal → `null` + `requiresDefaultPrice: true` aunque otra sucursal sí tenga default.
- [ ] 6.4 Test de integración de la migración: partiendo de un producto con precio base y asignación en dos sucursales, tras migrar cada sucursal tiene su copia con el mismo valor y no queda ningún `branch_id` nulo.
- [ ] 6.5 Tests de UI: `ProductPricesTab` sin opción "todas", arranque por sucursal, estado vacío sin sucursal; `catalogCache` manda `branchId`.

## 7. Verificación

- [ ] 7.1 `npm test` — suite completa en verde.
- [ ] 7.2 `npm run build` — sin errores de tipos.
- [ ] 7.3 Verificación manual en dev (Playwright): usuario de sucursal en POS — el selector de precio muestra sólo los precios de su sucursal; un producto asignado siempre tiene al menos un precio; la pestaña Precios abre directamente en su sucursal y lista filas.
- [ ] 7.4 Verificación manual: `POST /api/v1/admin/sales` con un `productPriceId` de otra sucursal → 400.
- [ ] 7.5 Verificación offline: con la caché poblada, el POS sin conexión muestra los precios de la sucursal.
- [ ] 7.6 Confirmar con el usuario antes de `npx prisma migrate deploy` en prod (`cggfhiyxufjdzxzcxugo`), con respaldo previo de `product_prices`; tras aplicar, repetir las verificaciones de 1.4 en modo lectura.
