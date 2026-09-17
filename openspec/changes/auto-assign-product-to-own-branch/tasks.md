## 1. Backend — `CreateProductUseCase`

- [x] 1.1 En `src/modules/products/application/use-cases/CreateProductUseCase.ts`, agregar 4º parámetro opcional al constructor: `branchInventoryRepo?: BranchInventoryRepository` (importar el port desde `@/modules/inventory/application/ports/BranchInventoryRepository`).
- [x] 1.2 Cambiar la firma de `execute` a `execute(req: CreateProductRequest, autoAssignBranchId?: string): Promise<ProductDto>`.
- [x] 1.3 Tras `const created = await this.repo.create(req);`, si `autoAssignBranchId && this.branchInventoryRepo`, envolver en `try/catch`: `await this.branchInventoryRepo.create({ branchId: autoAssignBranchId, productId: created.id });` — en el `catch`, solo loguear (`console.error("[CreateProductUseCase] auto-assign failed", err)` o el patrón de logging que ya use el módulo), NO relanzar.
- [x] 1.4 Confirmar que `toProductDto(created)` sigue siendo el valor de retorno de `execute` — sin cambios en el DTO del use case (el campo `autoAssignedBranchId` se agrega en el controller, no aquí).

## 2. Backend — `ProductsController.create`

- [x] 2.1 En `src/modules/products/infrastructure/http/ProductsController.ts` método `create`, tras validar `parsed` (Zod) y antes de llamar al use case, resolver `autoAssignBranchId`:
  ```ts
  const userId = req.headers.get("x-user-id") ?? "";
  const userBranchId = req.headers.get("x-user-branch-id") ?? "";
  let autoAssignBranchId: string | undefined;
  if (isBranchScopedInventory() && userId && userBranchId) {
    const hasAccessAll = await rbacContainer.authorizationService.userCan(userId, "branches:access_all");
    if (!hasAccessAll) autoAssignBranchId = userBranchId;
  }
  ```
  (Importar `isBranchScopedInventory` desde `@/shared/infrastructure/config/inventoryScope` y `rbacContainer` desde `@/modules/rbac/infrastructure/di/container` — confirmar si ya están importados en el archivo, ya que `list` los usa.)
- [x] 2.2 Cambiar `const product = await this.createUseCase.execute(parsed.data);` a `const product = await this.createUseCase.execute(parsed.data, autoAssignBranchId);`.
- [x] 2.3 Cambiar `return NextResponse.json(product, { status: 201 });` a `return NextResponse.json({ ...product, autoAssignedBranchId: autoAssignBranchId ?? null }, { status: 201 });`.

## 3. Backend — DI container

- [x] 3.1 En `src/modules/products/infrastructure/di/container.ts`, importar `PrismaBranchInventoryRepository` **directo** desde `@/modules/inventory/infrastructure/repositories/PrismaBranchInventoryRepository` (NO desde `@/modules/inventory/infrastructure/di/container`, para evitar ciclo entre los dos DI containers).
- [x] 3.2 Instanciar `const branchInventoryRepo = new PrismaBranchInventoryRepository(prisma);` (usar el mismo singleton `prisma` que ya usa el resto del container) y pasarlo como 4º argumento a `new CreateProductUseCase(productRepo, departmentRepo, taxRateRepo, branchInventoryRepo)`.

## 4. Frontend — tipo de respuesta de creación

- [x] 4.1 En `app/(private)/catalogs/products/_logic/types/domain.ts`, agregar (cerca de `Product`) un tipo `CreatedProduct extends Product { autoAssignedBranchId: string | null }`.
- [x] 4.2 En `app/(private)/catalogs/products/_logic/services/products.ts`, cambiar el tipo de retorno de `createProduct` de `Promise<Product>` a `Promise<CreatedProduct>` (línea ~100) — el body de la respuesta ya trae el campo extra, solo hace falta el tipo.
- [x] 4.3 En `app/(private)/catalogs/products/_logic/hooks/useProductMutations.ts`, cambiar el tipo de retorno de `createOne` de `Promise<Product | null>` a `Promise<CreatedProduct | null>` — sin cambios de lógica, solo de tipo (el valor ya fluye tal cual desde `createProduct`).

## 5. Frontend — banner condicional en `ProductsPage`

- [x] 5.1 En `app/(private)/catalogs/products/_blocks/ProductsPage.tsx`, extender el tipo `CreateSuccess` (agregado en la sesión anterior) con `autoAssignedBranchId: string | null`.
- [x] 5.2 En `handleSave` (rama `create`), tras `const product = await createOne(data as CreateProductBody);`, cambiar la condición de `setCreateSuccess` de `if (product && inventoryScopeMode === "branch")` a solo `if (product)` — poblar `setCreateSuccess({ productId: product.id, productCode: product.code, productName: product.name, autoAssignedBranchId: product.autoAssignedBranchId })`. (El gate por modo `branch` ya no es necesario en el cliente: en modo `general` el backend siempre devuelve `autoAssignedBranchId: null`, así que el banner cae naturalmente al caso "sin auto-asignación"; pero revisar la tarea 5.3 — el banner en modo `general` NO debe mostrar el link viejo tampoco, ver más abajo.)
- [x] 5.3 Ajustar la condición de render del banner: debe seguir aaplicando el gate `inventoryScopeMode === "branch"` para decidir si se muestra el banner EN ABSOLUTO (en modo `general` no se muestra banner de creación, por especificación — ver escenario "No post-create banner in general mode"). Dentro del banner, la rama del link cambia:
  ```tsx
  {createSuccess.autoAssignedBranchId !== null ? (
    <Link href={`/catalogs/products/${createSuccess.productId}`} className="underline font-medium">
      Gestionar producto
    </Link>
  ) : (
    canWriteInventory === true && (
      <Link href="/inventory" className="underline font-medium">
        Asignar a sucursal
      </Link>
    )
  )}
  ```
- [x] 5.4 Confirmar que la limpieza de `createSuccess` al abrir el modal de crear/editar (`handleCreate`/`handleEdit`/`CatalogEmpty` inline `onCreate`, ya ajustados en la sesión anterior) no necesita cambios adicionales.

## 6. Tests — backend

- [x] 6.1 En `tests/unit/modules/products/application/use-cases/CreateProductUseCase.test.ts`, nuevo `describe("CreateProductUseCase — auto-assign a branch")` con `InMemoryBranchInventoryRepository` (mismo patrón `reset()` que los demás repos in-memory):
  - Caso: `execute(req, "B1")` crea el producto y una fila en `branchInventoryRepo` para `(B1, productId)` con `quantity: 0` (verificar vía `findByBranchAndProduct`).
  - Caso: `execute(req)` (sin 2º argumento) no crea ninguna fila de inventario.
  - Caso: `branchInventoryRepo.create` mockeado para lanzar (`jest.spyOn(...).mockRejectedValue(...)`) — `execute(req, "B1")` igual resuelve con el `ProductDto` creado, sin lanzar.
- [x] 6.2 En `tests/unit/modules/products/infrastructure/http/ProductsController.test.ts`:
  - Extender `makeCreateReq(body: unknown, headers: Record<string, string> = {})` para aceptar headers (hoy no los acepta).
  - Extender `buildController()` para aceptar un `InMemoryBranchInventoryRepository` opcional y pasarlo al 4º argumento de `new CreateProductUseCase(...)`.
  - Nuevo `describe("ProductsController.create — branch auto-assign")`, calcado del patrón de `"ProductsController.list — branch scope mode"` (mismo `userCanMock`, mismas constantes `BRANCH_A`/`USER_ID`, mismo manejo de `process.env.INVENTORY_SCOPE_MODE`):
    - Modo `branch`, operador sin `branches:access_all` con `x-user-branch-id: BRANCH_A` → `res.status === 201`, `body.autoAssignedBranchId === BRANCH_A`, y una fila en el `branchInventoryRepo` de la prueba para `(BRANCH_A, body.id)`.
    - Modo `branch`, `userCanMock` resuelve `true` (admin) → `body.autoAssignedBranchId === null`, sin fila de inventario creada.
    - Modo `branch`, operador sin `branches:access_all` y sin `x-user-branch-id` → `body.autoAssignedBranchId === null`, sin fila, y el producto igual se crea (201).
    - Modo `general` (borrar `process.env.INVENTORY_SCOPE_MODE`) con headers de operador con branch propia → `body.autoAssignedBranchId === null`, sin fila (comportamiento de modo `general` no cambia).

## 7. Tests — frontend

- [x] 7.1 En `tests/unit/ui/(private)/catalogs/products/ProductsPage.test.tsx`, dentro de `describe("ProductsPage — banner de éxito post-creación")`, ajustar el mock de `createOne` en los tests existentes para que la respuesta incluya `autoAssignedBranchId` (agregar `autoAssignedBranchId: null` al `createdProduct` mock existente para no romper los tests que ya pasan con el banner viejo).
- [x] 7.2 Agregar un test nuevo: `createOne` resuelve con `autoAssignedBranchId: "branch-1"` → el banner muestra el link "Gestionar producto" con `href="/catalogs/products/p1"` (sin `?tab=`), y NO muestra "Asignar a sucursal".
- [x] 7.3 Confirmar que el test existente "en modo branch con inventory:write, muestra el banner con link a Inventario" sigue pasando ajustando su mock a `autoAssignedBranchId: null` explícito (representa el caso admin).

## 8. Verificación

- [x] 8.1 `npx jest --testPathPattern="CreateProductUseCase|ProductsController.test|ProductsPage.test"` en verde.
- [x] 8.2 `npm run build` sin errores de tipos.
- [x] 8.3 `npx jest` (suite completa) sin regresiones. Única falla: `payment-methods-crud.test.ts` (integración) por timeout de connection pool contra Supabase real — preexistente, no relacionada a este change (no toca payment-methods).
- [x] 8.4 Manual en dev (Playwright): con `kevhernandez07@gmail.com` (`zarioz_test`, sucursal ZARIOZ) crear un producto nuevo → confirmar que aparece inmediatamente en `/inventory` (tabla, sin usar "Asignar producto") con `quantity: 0` → banner muestra "Gestionar producto" → click lleva a `/catalogs/products/{id}` (tab General). Confirmar en la tabla de `/inventory` que el `quantity` es `0` y no hay error visible. Verificado: producto `AUTOASSIGN_TEST` creado, banner mostró "Gestionar producto" → `/catalogs/products/d98b1470-f619-4787-9238-c7e83d4644c0`, y apareció en `/inventory` sucursal ZARIOZ con cantidad 0 sin usar "Asignar producto".
- [x] 8.5 Manual en dev con `admin` (`branches:access_all`): crear un producto → confirmar que NO aparece automáticamente en ninguna sucursal de `/inventory` → banner sigue mostrando "Asignar a sucursal" → `/inventory` (sin regresión). Verificado vía API directa (UI del modal de creación resultó no confiable en Playwright para este intento — el submit del formulario no disparaba, un `.next` corrupto por el build de producción intercaló módulos webpack viejos; se limpió y se reinició el dev server, pero el flujo del modal siguió sin dispararse en el navegador automatizado): `POST /products` como admin respondió 201 con `autoAssignedBranchId: null`, y el producto `ADMIN_NOAUTO3` no apareció en `/inventory` sucursal ZARIOZ tras buscarlo — confirma que el backend nunca auto-asigna para `branches:access_all`.
