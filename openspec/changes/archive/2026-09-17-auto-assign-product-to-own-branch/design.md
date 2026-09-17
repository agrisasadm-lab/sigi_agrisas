## Context

`CreateProductUseCase.ts:10-29` (`src/modules/products/application/use-cases/`) recibe `ProductRepository`, `DepartmentRepository`, `TaxRateRepository?` — ninguna noción de sucursal ni de usuario. `CreateProductRequest` tampoco tiene `branchId`. `ProductsController.create` (`ProductsController.ts:193-211`) no lee headers de usuario/sucursal, a diferencia de `list` (líneas 143-176), que ya resuelve branch scope vía `resolveScopedBranchId`/`enforceBranchScope.ts`.

El módulo `inventory` ya expone todo lo necesario para crear una fila de inventario: `BranchInventoryRepository` (port, `src/modules/inventory/application/ports/BranchInventoryRepository.ts:31-37`) con `create(data: CreateBranchInventoryData): Promise<BranchInventoryView>`, donde `CreateBranchInventoryData = { branchId, productId, quantity?, reservedQuantity?, reorderPoint? }`. `PrismaBranchInventoryRepository.create` (`src/modules/inventory/infrastructure/repositories/PrismaBranchInventoryRepository.ts:134-166`) inserta con `quantity: 0` si no se pasa `quantity` (nuestro caso), y lanza `BranchInventoryAlreadyExistsError` en conflicto (no aplica aquí porque el producto es recién creado, pero se maneja best-effort de todos modos). `InMemoryBranchInventoryRepository` implementa el mismo port para tests.

`inventory/infrastructure/di/container.ts:3` ya importa `PrismaProductRepository` **directo** desde `@/modules/products/infrastructure/repositories/PrismaProductRepository` (no desde `products/infrastructure/di/container`) — el patrón exacto (documentado en CLAUDE.md para POS→Quotes) que hay que replicar en sentido inverso (`products` → `inventory`) para no crear un ciclo entre los dos `di/container.ts`.

`ProductsController.test.ts` ya tiene el patrón de test a replicar: `describe("ProductsController.list — branch scope mode", ...)` (línea 357) con `userCanMock = rbacContainer.authorizationService.userCan as jest.Mock`, constantes `BRANCH_A`/`USER_ID`, `beforeEach`/`afterEach` para `INVENTORY_SCOPE_MODE`. `makeCreateReq(body)` (línea 47) hoy **no acepta headers** (a diferencia de `makeListReq`, línea 55) — hay que extenderla.

## Goals / Non-Goals

**Goals:**
- (Historia 1) Operador sin `branches:access_all` con sucursal propia: crear un producto en modo `branch` crea también su fila `branch_inventory` (`quantity=0`), best-effort.
- (Historia 1) Banner post-crear ofrece "Gestionar producto" en vez de "Asignar a sucursal" cuando hubo auto-asignación.
- (Historia 2) Admin (`branches:access_all`): cero cambios de comportamiento — sin auto-asignación, banner igual que hoy.
- Modo `general`: cero cambios (sin auto-asignación, sin cambio de banner) — mismo gate que ya usa el banner actual (`inventoryScopeMode === "branch"`).

**Non-Goals:**
- No se envuelve la creación del producto y la asignación de inventario en una única transacción Prisma cross-módulo — son dos escrituras separadas, best-effort, decisión ya aprobada por el usuario.
- No se toca `resolveScopedBranchId`/`enforceBranchScope` — su contrato es "resolver/validar un `branchId` *solicitado*"; aquí no hay `branchId` solicitado en el body, se resuelve un concepto distinto ("¿a qué sucursal pertenece el creador?").
- No se modifica `InventoryAssignModal` ni el flujo manual de "Asignar producto" — sigue existiendo intacto (admin lo sigue usando siempre; el operador de sucursal lo puede seguir usando para correcciones o para productos creados antes de este cambio).
- No se agrega un `branchId` al body de `POST /products` — la auto-asignación nunca es elegible por el cliente.

## Decisions

**1. `CreateProductUseCase` gana una dependencia opcional (`branchInventoryRepo?: BranchInventoryRepository`) y un argumento opcional en `execute`, no un nuevo use case separado.**
Mantiene un solo punto de entrada para "crear producto", evita duplicar la validación de `department`/`taxRate` en dos use cases paralelos. El parámetro es opcional para no romper ningún caller existente (tests actuales que instancian `new CreateProductUseCase(repo, deptRepo)` sin más argumentos siguen compilando). Alternativa descartada: reutilizar `CreateBranchInventoryItemUseCase` completo (`src/modules/inventory/application/use-cases/CreateBranchInventoryItemUseCase.ts:10-35`) — hace dos validaciones redundantes en este contexto (`branchRepo.findById` y `productRepo.findById`, cuando la sucursal viene del JWT ya autenticado y el producto se acaba de crear activo) — se prefiere llamar directo al port `BranchInventoryRepository.create(...)`, más barato y igual de correcto para este caso.

**2. `autoAssignBranchId` se resuelve en el controller, nunca en el use case ni en el body.**
El use case solo recibe un `string | undefined` ya resuelto — no sabe nada de JWT, headers, ni permisos. `ProductsController.create` hace exactamente lo que ya hace `resolveScopedBranchId` internamente (leer `x-user-id`/`x-user-branch-id`, chequear `branches:access_all` vía `rbacContainer.authorizationService.userCan`), pero con semántica distinta: no "validar un branchId pedido", sino "¿tiene este caller una única sucursal propia a la que auto-asignar?". Por eso no se reutiliza `resolveScopedBranchId` tal cual (su contrato no encaja), se replica el patrón de lectura de headers + `userCan` directamente en `create`, gateado además por `isBranchScopedInventory()` (en modo `general` el concepto no aplica, igual que en `list`).

**3. Best-effort: `try/catch` alrededor del insert, sin relanzar, dentro de `CreateProductUseCase.execute`.**
Decisión ya confirmada por el usuario. Si `branchInventoryRepo.create(...)` falla, se loguea (`console.error` o el logger que use el proyecto en ese módulo) y el flujo continúa — el producto ya fue creado exitosamente por `this.repo.create(req)` antes de este paso, así que no hay nada que revertir. La respuesta HTTP sigue siendo 201.

**4. La respuesta de `create` reporta `autoAssignedBranchId` como la *intención* resuelta por el controller, no el resultado interno del best-effort.**
El controller conoce `autoAssignBranchId` (lo calculó él mismo) independientemente de si el use case tuvo éxito internamente insertando la fila. Se reporta `autoAssignedBranchId: autoAssignBranchId ?? null` sin esperar confirmación del insert. Esto simplifica el contrato (no hay que propagar un booleano de éxito desde el use case) y es coherente con "best-effort silencioso": el frontend no necesita saber si falló, solo necesita decidir qué banner mostrar según si el usuario *es del tipo* que se auto-asigna.

**5. Frontend: el banner decide su variante leyendo `autoAssignedBranchId` de la respuesta, no recalculando permisos en cliente.**
`ProductsPage.tsx` ya tiene `canWriteInventory = can("inventory:write")` (de la sesión anterior) para gatear el link del banner viejo — se mantiene para ESE caso (`autoAssignedBranchId === null`). Para el caso nuevo (`autoAssignedBranchId !== null`) el link "Gestionar producto" no depende de ningún permiso adicional — si el usuario pudo crear el producto (`products:write`), puede gestionarlo (`/catalogs/products/{id}` ya está gateado por `products:read` en su propia página, y las ediciones ahí por `products:write` de forma independiente). Evita duplicar en el cliente la misma lógica de `branches:access_all` que ya resolvió el backend — una sola fuente de verdad.

## Risks / Trade-offs

- **[Riesgo] Auto-asignación no atómica con la creación del producto** → en el peor caso (fallo de infraestructura justo entre ambos inserts) el producto existe sin fila de inventario — indistinguible del estado actual (pre-cambio) para ese producto puntual; el operador puede asignarlo manualmente vía `/inventory` en cualquier momento, sin bloqueo. Aceptado explícitamente.
- **[Riesgo] Operador sin sucursal asignada (`x-user-branch-id` vacío) y sin `branches:access_all`** → no cumple la condición de auto-asignación (no hay `userBranchId` que usar) — cae al mismo camino que "sin auto-asignación", banner muestra el link viejo gateado por `canWriteInventory` (si no tiene ese permiso tampoco, banner sin link — comportamiento ya existente, sin caso nuevo que romper).
- **[Trade-off] `autoAssignedBranchId` es un campo ad-hoc en la respuesta de `create`, no parte del `ProductDto` general** → evita ensuciar el contrato de `list`/`get`/`update` con un campo que solo tiene sentido justo después de crear; el costo es un tipo de respuesta ligeramente distinto solo para ese endpoint, ya un patrón aceptado en el proyecto (ej. `imageUploadWarning` en el flujo de creación de producto con imagen, manejado también solo en el cliente de ese flujo).
