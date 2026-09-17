## Historia de Usuario

| # | Rol | Tarea | Motivo | Criterios de Aceptación | Criterios de Seguridad |
|---|---|---|---|---|---|
| 1 | Operador de sucursal sin `branches:access_all` (ej. rol `tienda_zarioz`/`zarioz_test`) | Como operador de sucursal, quiero que el producto que acabo de crear se asigne automáticamente al inventario de mi sucursal, para poder empezar a venderlo sin tener que pasar por el paso manual de "Asignar producto" en Inventario | Hoy crear un producto no lo pone a la venta en ninguna sucursal — el operador tenía que ir manualmente a Inventario y volver a buscarlo, un paso redundante cuando el sistema ya sabe a qué sucursal pertenece (su propia sucursal asignada) | - Given un operador sin `branches:access_all` con sucursal propia `B1` en modo de inventario `branch`, When crea un producto exitosamente, Then queda una fila en `branch_inventory` para `(B1, productId)` con `quantity=0`, y el producto es visible/asignable en `/inventory` de esa sucursal sin usar "Asignar producto"<br>- Given ese mismo caso, When la creación termina, Then el banner de éxito muestra un link "Gestionar producto" hacia `/catalogs/products/{id}` (no hacia `/inventory`)<br>- Given la fila de `branch_inventory` no se pudo crear por un error inesperado (best-effort), When la creación del producto de todos modos fue exitosa, Then la respuesta sigue siendo 201 con el producto creado, el error queda logueado, y no se le muestra ningún error al usuario (puede asignarlo manualmente después si hiciera falta)<br>- Given el modo de inventario es `general` (no `branch`), When ese mismo operador crea un producto, Then NO se crea ninguna fila de `branch_inventory` (no aplica el concepto de "no asignado" en ese modo) y el banner no ofrece ningún link de asignación (comportamiento actual, sin cambios) | - El `branchId` de la auto-asignación se resuelve exclusivamente server-side desde `x-user-id`/`x-user-branch-id` (headers derivados del JWT) — el body de `POST /products` no acepta ni admite un `branchId` de override, así que un cliente no puede forzar la asignación a una sucursal ajena<br>- La auto-asignación respeta el mismo criterio de scope que el resto del sistema: solo aplica cuando el caller NO tiene `branches:access_all` (verificado vía `AuthorizationService.userCan`) |
| 2 | Admin (`branches:access_all`) | Como admin, quiero que crear un producto siga sin asignarlo a ninguna sucursal automáticamente, para mantener control manual de a qué sucursal(es) asigno cada producto vía Inventario | Un admin no tiene una única sucursal propia — auto-asignar a una sucursal específica sería una decisión arbitraria que el sistema no debe tomar por él | - Given un usuario con `branches:access_all` en modo `branch`, When crea un producto, Then NO se crea ninguna fila en `branch_inventory` automáticamente<br>- Given ese mismo caso, When la creación termina, Then el banner de éxito sigue mostrando el link "Asignar a sucursal" hacia `/inventory`, igual que antes de este cambio (sin regresión) |

Nota: ambas historias comparten el mismo cambio de código (`ProductsController.create` decide el `branchId` de auto-asignación según `branches:access_all`, y `ProductsPage` banner lee ese resultado) — se separan porque el comportamiento observable (AC) es opuesto según el rol, no porque sean features independientes.

## Why

El change `add-inventory-to-pricing-link` (sesión anterior, PR #85) agregó un banner post-creación que invitaba al operador a ir a `/inventory` a asignar manualmente el producto recién creado a su sucursal. Ese paso es innecesario: el sistema ya sabe, por el JWT del propio operador, a qué sucursal pertenece (`x-user-branch-id`) — no hay ambigüedad que resolver manualmente como sí la hay para un admin (que gestiona múltiples sucursales y elige explícitamente dónde asignar cada producto).

Automatizar esa asignación cierra el último tramo de fricción del flujo Catálogo→Inventario→Precios trabajado en la sesión anterior: para el operador de sucursal, crear un producto ahora lo deja listo para configurarle precio directamente, sin ningún paso manual de inventario intermedio. El link del banner existente ("Asignar a sucursal") deja de tener sentido para este caso — de hecho, usarlo produciría un 409 "ya asignado" — por lo que se reemplaza por un link a la gestión del producto recién creado.

## What Changes

- `CreateProductUseCase.ts`: nuevo parámetro opcional de constructor (`branchInventoryRepo`) y nuevo argumento opcional en `execute` (`autoAssignBranchId`). Si se pasa, intenta crear la fila `branch_inventory` correspondiente (`quantity: 0`) en modo best-effort (no bloquea ni revierte la creación del producto si falla).
- `ProductsController.create`: resuelve `autoAssignBranchId` server-side (headers JWT + `isBranchScopedInventory()` + `branches:access_all`) y lo pasa al use case. La respuesta 201 incluye `autoAssignedBranchId: string | null`.
- `products/infrastructure/di/container.ts`: inyecta `PrismaBranchInventoryRepository` (importado directo desde `inventory/infrastructure/repositories`, no desde el DI container de `inventory`, para evitar ciclo).
- Frontend (`ProductsPage.tsx` y tipos/servicios de creación de producto): el banner post-crear usa `autoAssignedBranchId` de la respuesta para decidir el link — "Gestionar producto" (`/catalogs/products/{id}`) si hubo auto-asignación, o el link viejo "Asignar a sucursal" (`/inventory`) si no la hubo (admin, o modo `general`).
- Sin cambios en `InventoryAssignModal`/flujo manual de asignación — sigue existiendo tal cual para admin y para correcciones/asignaciones adicionales.

## Capabilities

### New Capabilities
_(ninguna)_

### Modified Capabilities
- `products-api`: el requirement de creación de producto (`Create product`) gana el comportamiento de auto-asignación best-effort a la sucursal propia del caller, y la respuesta gana el campo `autoAssignedBranchId`.
- `products-ui`: el requirement del banner post-creación (agregado por `add-inventory-to-pricing-link`, dentro de "Branch scope mode notice in products catalog") cambia el link ofrecido según si hubo auto-asignación.

## Impact

- **Archivos modificados (backend)**: `src/modules/products/application/use-cases/CreateProductUseCase.ts`, `src/modules/products/infrastructure/http/ProductsController.ts`, `src/modules/products/infrastructure/di/container.ts`.
- **Archivos modificados (frontend)**: `app/(private)/catalogs/products/_logic/types/api.ts` (o equivalente), `app/(private)/catalogs/products/_logic/services/products.ts`, `app/(private)/catalogs/products/_logic/hooks/useProductMutations.ts`, `app/(private)/catalogs/products/_blocks/ProductsPage.tsx`.
- **Sin cambios de schema** (reutiliza la tabla `branch_inventory` existente) **ni de permisos nuevos** (reutiliza `branches:access_all` ya existente).
- **Sin transacción Prisma cross-módulo**: la creación del producto y la asignación de inventario son dos operaciones separadas: best-effort, no atómicas — aceptado explícitamente.
- **Alcance de pruebas**: unit tests de `CreateProductUseCase` (con `InMemoryBranchInventoryRepository`), de `ProductsController.create` (nuevo `describe` de auto-asignación, extendiendo el patrón ya usado para `list — branch scope mode`), y de `ProductsPage` (banner condicional por `autoAssignedBranchId`).
