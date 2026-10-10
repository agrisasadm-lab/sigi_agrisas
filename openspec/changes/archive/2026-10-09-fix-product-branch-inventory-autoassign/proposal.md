## Historia de Usuario

| # | Rol | Tarea | Motivo | Criterios de Aceptación | Criterios de Seguridad |
|---|---|---|---|---|---|
| 1 | Administrador (o cualquier usuario con `products:write`) | Como Administrador, quiero que al crear un producto se le asigne automáticamente una fila de inventario (cantidad 0) en todas las sucursales activas, sin importar si tengo `branches:access_all` o estoy amarrado a una sola sucursal, para que el producto sea visible de inmediato en POS, cotizaciones y compras de cualquier sucursal activa y no quede como "fantasma" hasta que alguien lo asigne manualmente. | - Given un usuario con `branches:access_all` crea un producto, When el producto se persiste correctamente, Then se crea una fila `branch_inventory` (quantity=0, reservedQuantity=0, reorderPoint=0) por cada sucursal con `isActive=true`.<br>- Given un usuario sin `branches:access_all` (operador de una sucursal) crea un producto, When el producto se persiste, Then también se crean filas en TODAS las sucursales activas (ya no sólo en la suya) — comportamiento unificado, sin ramas por permiso.<br>- Given existen sucursales con `isActive=false`, When se crea el producto, Then NO se crea fila `branch_inventory` para esas sucursales inactivas.<br>- Given la creación del producto falla (ej. `departmentId` inválido/inactivo, `code` duplicado), When el error ocurre, Then no se crea ninguna fila `branch_inventory` huérfana (el producto tampoco se creó).<br>- Given la inserción de inventario en alguna sucursal falla individualmente (ej. error transitorio de DB), When esto ocurre, Then el producto igual queda creado (no bloquea la respuesta 201) y el error se loggea — mismo comportamiento de tolerancia a fallos que el código actual (try/catch por inserción), no se revierte la creación del producto. | - La asignación automática no debe exponer ni requerir el permiso `branches:access_all` del creador — ya no se usa ese check para decidir alcance, así que debe eliminarse del controller sin dejar atrás una verificación muerta o inconsistente con el use case.<br>- `quantity=0` siempre — nunca inventar stock al auto-asignar.<br>- No debe romper el guard de branch scoping existente en el resto de endpoints de `branch_inventory` (el auto-assign es interno al use case, no pasa por `enforceBranchScope`, así que no debe convertirse en una vía para que un operador escriba inventario fuera de su alcance vía otro endpoint — sólo aplica a la creación de producto). |

Nota: el comportamiento previo distinguía por rol (operador → 1 sucursal, admin → ninguna); esta historia unifica a "todas las sucursales activas, siempre" (sólo cuando el modo de alcance de inventario es `branch` — ver Impact), decisión ya validada en el diagnóstico del bug original.

## Why

En modo de alcance de inventario `branch`, `GET /api/v1/admin/products?branchId=...` sólo devuelve productos con una fila `branch_inventory` para esa sucursal (`products-api` spec, sección "Branch scope mode"). Hoy la auto-asignación al crear producto (`products-api` spec, sección "Auto-assignment to the caller's own branch") sólo cubre al operador de una sucursal — un Administrador (`branches:access_all`) crea el producto sin que se cree ninguna fila de inventario, en ninguna sucursal. El producto queda invisible en POS, cotizaciones y compras hasta que alguien lo asigna manualmente desde `/inventory`. Esto no es un caso raro: se confirmó en prod (2026-10-09) que varios productos recientes creados por un admin tenían 0 filas `branch_inventory` en cualquier sucursal.

## What Changes

- **BREAKING**: `CreateProductUseCase.execute` deja de recibir un `autoAssignBranchId: string | undefined` único; en su lugar, cuando el modo de alcance de inventario es `branch`, crea una fila `branch_inventory` (quantity=0) por cada sucursal con `isActive=true`, sin condicionar por el permiso del creador.
- `ProductsController.create` (`src/modules/products/infrastructure/http/ProductsController.ts:200-209`) elimina el cálculo condicional de `autoAssignBranchId` basado en `branches:access_all` — ya no aplica distinción por rol.
- **BREAKING**: el campo de respuesta `autoAssignedBranchId: string | null` se reemplaza por `autoAssignedBranchIds: string[]` (lista de IDs de sucursal donde se creó la fila; `[]` si el modo es `general` o no hay sucursales activas). Se actualizan los consumidores: `app/(private)/catalogs/products/_blocks/ProductsPage.tsx`, `_logic/types/domain.ts`, `_logic/services/products.ts`.
- El mensaje post-creación en `ProductsPage.tsx` deja de mostrar el CTA "Asignar a sucursal" cuando el modo es `branch` (ya no aplica: la asignación es automática a todas las sucursales activas); se simplifica a sólo mostrar "Gestionar producto" cuando `autoAssignedBranchIds.length > 0`.
- En modo de alcance `general` el comportamiento NO cambia: no se auto-asigna inventario (igual que hoy), porque en ese modo `branch_inventory` no filtra visibilidad.
- Se actualizan tests unitarios de `CreateProductUseCase` y `ProductsController` que cubrían el escenario "Admin no dispara auto-asignación" (ahora debe cubrir lo opuesto) y los tests de UI de `ProductsPage`.

## Capabilities

### New Capabilities

(ninguna)

### Modified Capabilities

- `products-api`: cambia el requisito de auto-asignación de inventario al crear producto (de "sólo la sucursal propia del operador, nunca si tiene `branches:access_all`" a "todas las sucursales activas, siempre, en modo `branch`") y el contrato de respuesta (`autoAssignedBranchId` → `autoAssignedBranchIds`).

## Impact

- Backend: `src/modules/products/application/use-cases/CreateProductUseCase.ts`, `src/modules/products/infrastructure/http/ProductsController.ts`, inyección de `BranchRepository` en el DI container del módulo products (`src/modules/products/infrastructure/di/container.ts` o equivalente).
- Frontend: `app/(private)/catalogs/products/_blocks/ProductsPage.tsx`, `app/(private)/catalogs/products/_logic/types/domain.ts`, `app/(private)/catalogs/products/_logic/services/products.ts`.
- Tests: `tests/unit/modules/products/application/use-cases/CreateProductUseCase.test.ts` (o ruta equivalente), `tests/unit/modules/products/infrastructure/http/ProductsController.test.ts`, `tests/unit/ui/(private)/catalogs/products/ProductsPage.test.tsx`.
- Spec: `openspec/specs/products-api/spec.md` (delta spec en este change).
- No afecta `inventory-api` (sus endpoints de inventario no cambian; sólo cambia quién llama a `branchInventoryRepo.create` y cuándo, desde `products`).
- Dato en prod ya remediado por fuera de este change (fix puntual vía SQL, no vía código) — fuera de alcance de este proposal.
