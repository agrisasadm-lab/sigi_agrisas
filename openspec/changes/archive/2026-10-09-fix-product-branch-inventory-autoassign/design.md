## Context

Ver `proposal.md` — Why / Historia de Usuario. Estado actual relevante:

- `CreateProductUseCase` (`src/modules/products/application/use-cases/CreateProductUseCase.ts:19-37`) recibe un único `autoAssignBranchId?: string` y, si viene, hace un solo `branchInventoryRepo.create({ branchId, productId })` envuelto en `try/catch` (best-effort, no revierte la creación del producto si falla).
- `ProductsController.create` (líneas 200-209) calcula ese único `autoAssignBranchId` consultando `rbacContainer.authorizationService.userCan(userId, "branches:access_all")` — sólo lo setea si el caller NO tiene el permiso.
- `BranchRepository.findAll(opts: { page, pageSize, includeInactive })` (`src/modules/branches/application/ports/BranchRepository.ts`) es paginado, sin método "todas sin límite". El propio DI container de `products` ya importa `branchRepo` (`src/modules/branches/infrastructure/di/container.ts`) para `ProductPricesController` — no hace falta nueva instancia, sólo pasarlo también a `CreateProductUseCase`.
- `isBranchScopedInventory()` (helper ya existente, usado en `ProductsController.create` y en el repo de listado) decide si el modo de alcance es `branch` o `general`.
- La tabla de Historia de Usuario en `proposal.md` fija los criterios de seguridad: no condicionar por `branches:access_all`, `quantity=0` siempre, no tocar `enforceBranchScope` de otros endpoints.

## Goals / Non-Goals

**Goals:**
- Garantizar que, en modo `branch`, todo producto creado quede con una fila `branch_inventory` en cada sucursal activa, sin importar el rol de quien lo crea.
- Mantener el contrato best-effort actual (fallo de una inserción no bloquea la creación del producto ni las demás inserciones).
- Mantener consistencia con el patrón ya usado en el módulo (`branchRepo` inyectado vía DI, reutilizando el mismo repo que ya consume `ProductPricesController`).

**Non-Goals:**
- No retroactivo: productos ya creados sin inventario (como los detectados en prod) se remediaron aparte, por fuera de este change (dato, no código).
- No cambia nada del modo `general` ni del filtrado de `GET /api/v1/admin/products` (eso ya está correcto, documentado en `products-api` — sección "Branch scope mode").
- No agrega lógica de "asignar automáticamente a sucursales nuevas creadas después" — eso sigue siendo manual vía `/inventory` (ya cubierto por `InventoryAssignModal`).
- No cambia `BranchInventoryRepository` ni sus endpoints (`/api/v1/admin/branches/:id/inventory`); sólo cambia quién y cuándo llama a `create()`.

## Decisions

**Loop secuencial sobre `branchRepo.findAll`, no un método batch nuevo.** Se obtienen las sucursales activas con `branchRepo.findAll({ page: 1, pageSize: 1000, includeInactive: false })` (mismo patrón de "asumir < N sucursales" ya usado en `app/_hooks/useHeadquarters.ts` con `pageSize=100` — aquí se usa 1000 por margen, dato real actual: 6 sucursales activas en prod) y se itera creando una fila `branch_inventory` por cada una, cada `create()` en su propio `try/catch` independiente (no `Promise.all` para no perder el aislamiento de fallos que ya pedía la spec: una falla no debe tumbar las demás). Alternativa descartada: agregar `findAllActive(): Promise<Branch[]>` sin paginar al puerto `BranchRepository` — más limpio a futuro pero expande el contrato del puerto para un solo caso de uso; se deja fuera de alcance de este fix puntual (anotado como posible mejora futura, no bloqueante).

**`autoAssignBranchIds: string[]` en vez de mantener el campo viejo.** Se renombra (no se agrega un campo nuevo en paralelo) porque el significado cambia de raíz: ya no existe "la sucursal auto-asignada", existen "las sucursales auto-asignadas". Mantener ambos campos sería confuso y el único consumidor interno (`ProductsPage.tsx`) se actualiza en el mismo change — no hay contrato externo (móvil, integraciones) que dependa de este campo (confirmado por `grep` — único consumidor es el propio frontend del panel).

**Se elimina el chequeo `branches:access_all` del controller, no se reutiliza para otra cosa.** El permiso ya no participa en la decisión de alcance; se quita la llamada a `rbacContainer.authorizationService.userCan(...)` completa de `ProductsController.create` (no sólo se ignora su resultado) para no dejar una verificación muerta que confunda a quien lea el código después.

**`CreateProductUseCase` gana un parámetro `BranchRepository` opcional, análogo a `branchInventoryRepo`.** Firma pasa de `execute(req, autoAssignBranchId?: string)` a `execute(req)` — ya no recibe nada relacionado a sucursales desde el controller, porque ahora resuelve las sucursales activas él mismo vía el repo inyectado en el constructor (mismo patrón que ya usa para `branchInventoryRepo`). Esto es más simple que el controller: el controller deja de necesitar lógica de sucursales en absoluto.

## Risks / Trade-offs

- [Riesgo] `branchRepo.findAll` con `pageSize: 1000` sigue siendo "paginado con límite alto", no una garantía dura de "todas". → Mitigación: el número real de sucursales activas (6) está muy por debajo del límite; si el negocio alguna vez supera 1000 sucursales activas, el síntoma sería visible de inmediato (productos nuevos sin inventario en las sucursales "de más") y el fix es trivial (subir el límite o agregar el método no paginado pospuesto arriba).
- [Riesgo] Más escrituras por creación de producto (1 por sucursal activa vs. 1 fija) — más carga en picos de alta masiva de catálogo. → Mitigación: cada insert es una fila mínima (`quantity=0`), operación barata; ya es el patrón de carga que usa el seeder de productos en dev/test.
- [Trade-off] `autoAssignedBranchIds` es un **breaking change** de contrato de respuesta. → Mitigación: único consumidor es interno (`ProductsPage.tsx`), actualizado en el mismo PR; no hay versión de API externa que romper.
