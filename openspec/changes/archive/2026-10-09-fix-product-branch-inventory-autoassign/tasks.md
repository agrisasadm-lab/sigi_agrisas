## 1. Backend — CreateProductUseCase

- [x] 1.1 Cambiar firma de `CreateProductUseCase` (`src/modules/products/application/use-cases/CreateProductUseCase.ts`): agregar `BranchRepository` opcional al constructor (análogo a `branchInventoryRepo`), quitar el parámetro `autoAssignBranchId` de `execute(req, ...)`.
- [x] 1.2 Implementar el auto-assign: cuando `isBranchScopedInventory()` sea `true` y `branchRepo`/`branchInventoryRepo` estén inyectados, obtener sucursales activas (`branchRepo.findAll({ page: 1, pageSize: 1000, includeInactive: false })`) y, para cada una, intentar `branchInventoryRepo.create({ branchId, productId })` en su propio `try/catch` (no abortar el loop ni la creación del producto si una falla; loggear cada fallo individual).
- [x] 1.3 Devolver `autoAssignedBranchIds: string[]` (los IDs de las sucursales activas intentadas, no sólo las exitosas) desde el use case, reemplazando el antiguo `autoAssignedBranchId: string | null`.
- [x] 1.4 Actualizar `ProductDto` / tipo de retorno del use case para incluir `autoAssignedBranchIds: string[]`.

## 2. Backend — Controller y DI

- [x] 2.1 En `ProductsController.create` (`src/modules/products/infrastructure/http/ProductsController.ts:200-209`), eliminar el bloque que calcula `autoAssignBranchId` vía `rbacContainer.authorizationService.userCan(userId, "branches:access_all")` — ya no se usa para esta decisión.
- [x] 2.2 Ajustar la llamada a `createUseCase.execute(parsed.data)` (sin segundo argumento) y el `NextResponse.json({ ...product, ... })` para reflejar `autoAssignedBranchIds` (el DTO ya lo trae desde 1.3/1.4, no reconstruir el campo en el controller).
- [x] 2.3 En el DI container de products (`src/modules/products/infrastructure/di/container.ts`), pasar `branchRepo` (ya importado para `ProductPricesController`) como nuevo argumento al constructor de `CreateProductUseCase`.

## 3. Backend — Tests

- [x] 3.1 Actualizar `tests/unit/modules/products/application/use-cases/CreateProductUseCase.test.ts` (o ruta equivalente): reemplazar el caso "admin no dispara auto-asignación" por "admin SÍ auto-asigna a todas las sucursales activas"; agregar casos de sucursales inactivas excluidas, cero sucursales activas, y fallo aislado de una inserción sin afectar las demás ni la creación del producto.
- [x] 3.2 Actualizar `tests/unit/modules/products/infrastructure/http/ProductsController.test.ts`: quitar expectativas sobre el chequeo `branches:access_all` en `create`; validar que la respuesta expone `autoAssignedBranchIds` como array.

## 4. Frontend

- [x] 4.1 Actualizar `app/(private)/catalogs/products/_logic/types/domain.ts`: renombrar/tipar `autoAssignedBranchId: string | null` → `autoAssignedBranchIds: string[]`.
- [x] 4.2 Actualizar `app/(private)/catalogs/products/_logic/services/products.ts` para el nuevo campo de respuesta.
- [x] 4.3 Actualizar `app/(private)/catalogs/products/_blocks/ProductsPage.tsx`: usar `autoAssignedBranchIds.length > 0` en vez de `autoAssignedBranchId !== null` para decidir el CTA del mensaje post-creación; quitar la rama "Asignar a sucursal" cuando el modo es `branch` (ya no debería dispararse, pero dejar el fallback defensivo si `autoAssignedBranchIds` viene vacío por sucursales inactivas/ninguna activa).
- [x] 4.4 Actualizar `tests/unit/ui/(private)/catalogs/products/ProductsPage.test.tsx` acorde al nuevo campo y comportamiento del CTA.

## 5. Verificación

- [x] 5.1 Correr suite de tests del módulo products (`npm test -- products`) en verde. (167/167: 160 backend + 7 UI)
- [x] 5.2 Correr `npm run build` (verifica tipos — la firma de `CreateProductUseCase.execute` cambió). Build exitoso.
- [x] 5.3 Probar manualmente en dev (`admin@example.com` / `admin1234`): crear producto nuevo, confirmar en Prisma Studio que `branch_inventory` tiene una fila por cada sucursal activa de `.env.local` con `quantity=0`. Verificado vía Playwright + query Prisma directa: 8/8 sucursales activas, quantity=0. Datos de prueba limpiados después.
- [x] 5.4 Confirmar en `/catalogs/products` que el mensaje post-creación ya no ofrece "Asignar a sucursal" cuando el modo de alcance es `branch` y hay al menos una sucursal activa. Verificado vía Playwright: banner muestra sólo "Gestionar producto".
