## 1. Schema y migración (dev)

- [x] 1.1 Agregar `model CustomerBranch` a `prisma/schema.prisma` (ver design.md — Decisión 1): `customerId`, `branchId`, `createdAt`, relaciones `customer`/`branch` con `onDelete: Cascade` en ambos, `@@id([customerId, branchId])`, `@@index([branchId])`, `@@map("customer_branches")`. Agregar `branches CustomerBranch[]` en `Customer` y `customers CustomerBranch[]` en `Branch`.
- [x] 1.2 En la migración generada, agregar el bootstrap SQL después del `CREATE TABLE`:
  ```sql
  INSERT INTO customer_branches (customer_id, branch_id)
  SELECT DISTINCT customer_id, branch_id FROM sales    WHERE customer_id IS NOT NULL
  UNION SELECT DISTINCT customer_id, branch_id FROM quotes   WHERE customer_id IS NOT NULL
  UNION SELECT DISTINCT customer_id, branch_id FROM invoices WHERE customer_id IS NOT NULL
  ON CONFLICT DO NOTHING;

  INSERT INTO customer_branches (customer_id, branch_id)
  SELECT c.id, b.id FROM customers c CROSS JOIN (
    SELECT id FROM branches WHERE is_headquarters = TRUE
    UNION ALL SELECT id FROM branches WHERE is_active = TRUE AND NOT EXISTS (SELECT 1 FROM branches WHERE is_headquarters = TRUE)
  ) b WHERE NOT EXISTS (SELECT 1 FROM customer_branches cb WHERE cb.customer_id = c.id)
  ON CONFLICT DO NOTHING;
  ```
  Verificar que `invoices.customer_id` existe (confirmar en `prisma/schema.prisma` antes de asumirlo — si el modelo de facturación usa otro nombre de columna, ajustar el SQL).
- [x] 1.3 `npx prisma migrate dev --name add_customer_branches` contra la DB de dev (`qzzjpyepggwautckqeex`).
- [x] 1.4 `npx prisma generate`.
- [x] 1.5 Verificación de la migración en dev: `SELECT customer_id, count(*) FROM customer_branches GROUP BY 1 HAVING count(*) = 0` debe devolver 0 filas (ningún cliente sin membresías).

## 2. Dominio y errores

- [x] 2.1 `src/modules/pos/domain/errors/CustomerNotAvailableInBranchError.ts` (nuevo) — mismo patrón que `ProductNotAvailableInBranchError` del mismo módulo.
- [x] 2.2 `src/modules/quotes/domain/errors/CustomerNotAvailableInBranchError.ts` (nuevo) — mismo patrón, módulo `quotes`.
- [x] 2.3 `src/modules/customers/domain/entities/Customer.ts`: agregar `branchIds: string[]` a las props de la entidad.

## 3. Módulo `customers` — port, DTO, use cases

- [x] 3.1 `src/modules/customers/application/ports/CustomerRepository.ts`: `FindAllOptions.branchId?: string`; `CreateCustomerData.branchIds: string[]`; `UpdateCustomerData.branchIds?: string[]`.
- [x] 3.2 `src/modules/customers/application/dto/CustomerDto.ts`: agregar `branchIds: string[]`; `toCustomerDto` lo mapea desde la entidad.
- [x] 3.3 `src/modules/customers/application/use-cases/{CreateCustomerUseCase,UpdateCustomerUseCase,ListCustomersUseCase}.ts`: pasar `branchIds`/`branchId` tal cual al repositorio (sin lógica de autorización — ya resuelta en el controller, ver design.md — Decisión 4).
- [x] 3.4 `src/modules/customers/infrastructure/repositories/PrismaCustomerRepository.ts`:
  - `findAll`: agregar `...(branchId ? { branches: { some: { branchId } } } : {})` al `where`; incluir `branches: { select: { branchId: true } }` en el `select`/`include` (aquí y en `findById`) para poblar `branchIds`.
  - `create`: `branches: { create: data.branchIds.map((branchId) => ({ branchId })) }`.
  - `update`: si `data.branchIds !== undefined`, `branches: { deleteMany: {}, create: data.branchIds.map((branchId) => ({ branchId })) }` (ver design.md — Decisión 5).
- [x] 3.5 `src/modules/customers/infrastructure/repositories/InMemoryCustomerRepository.ts`: espejo en memoria (`Map<customerId, Set<branchId>>` o campo `branchIds` en el objeto en memoria), mismas reglas de `findAll`/`create`/`update`.
- [x] 3.6 Tests: actualizar `tests/unit/modules/customers/application/use-cases/*.test.ts` (o el archivo consolidado existente) — `create` persiste `branchIds`, `update` reemplaza el set completo, `findAll` filtra por `branchId`.

## 4. Módulo `customers` — controller y branch scoping

- [x] 4.1 `src/modules/customers/infrastructure/http/CustomersController.ts`: constructor recibe `authzService: AuthorizationService` (inyectar `rbacContainer.authorizationService` en `src/modules/customers/infrastructure/di/container.ts`, mismo patrón que `SalesController`/`FoliosController`).
- [x] 4.2 `list`: parsear `?branchId=` (uuid opcional) → `resolveScopedBranchId(req, branchId, authzService)`; si es `NextResponse` (403), retornarla; si no, pasar el `branchId` resuelto al use case.
- [x] 4.3 `create`: parsear `branchIds?: string[]` del body (Zod `z.array(uuidSchema)`). Resolver el `branchId` propio del caller (`resolveScopedBranchId(req, undefined, authzService)` da el propio si no hay bypass, o `undefined` si hay bypass). Si NO bypass → forzar `branchIds = [ownBranchId]` (ignorando lo que venga en el body); si `ownBranchId` es `""` → 403. Si SÍ bypass → usar `body.branchIds`; si viene vacío/ausente → 400 `{"error": "branchIds must contain at least one branch"}`. Validar que cada id en `branchIds` corresponda a una sucursal activa existente (400 si no) antes de invocar el use case.
- [x] 4.4 `getById`/`update`/`softDelete`: cargar el customer primero (`GetCustomerUseCase`/`findById`); aplicar el helper local `assertCustomerVisible(req, customer, authzService)` (design.md — Decisión 3) — si retorna una respuesta, devolverla (403) antes de continuar.
- [x] 4.5 `update`: si el body incluye `branchIds` y el caller NO tiene bypass, ignorarlo silenciosamente (no forzar ni rechazar — mismo tratamiento que `code`). Si SÍ tiene bypass y `branchIds` está presente pero es un array vacío → 400 (mismo mensaje que en create); si tiene ≥1 elemento, pasar tal cual al use case (reemplaza el set completo).
- [x] 4.6 Tests: `tests/unit/modules/customers/infrastructure/http/CustomersController.test.ts` — casos: no-bypass forzado a su sucursal en `create`/`list`; 403 en `getById`/`update`/`softDelete` de un cliente ajeno; bypass sin `branchIds` en create → 400; bypass reemplaza el set en update; operador que envía `branchIds` en update no cambia nada.

## 5. POS y Cotizaciones — validación de cliente por sucursal

- [x] 5.1 `src/modules/pos/application/ports/PosLookups.ts`: `CustomerLookup.branchIds: string[]` (nuevo campo).
- [x] 5.2 `src/modules/pos/infrastructure/repositories/PrismaPosLookupService.ts`: `getCustomer` — ampliar el `select` con `branches: { select: { branchId: true } }`, mapear a `branchIds: row.branches.map(b => b.branchId)`.
- [x] 5.3 `src/modules/pos/application/use-cases/CreateSaleUseCase.ts`: tras la validación existente `if (customer && !customer.isActive) throw ...` (~línea 65), agregar: `if (customer && !customer.branchIds.includes(req.branchId)) throw new CustomerNotAvailableInBranchError();`.
- [x] 5.4 `src/modules/pos/application/use-cases/EditCompletedSaleUseCase.ts`: si el DTO de edición permite `customerId` opcional, mismo chequeo usando `existing.sale.branchId` cuando se resuelve un nuevo customer.
- [x] 5.5 `src/modules/quotes/application/use-cases/CreateQuoteUseCase.ts`: mismo patrón que 5.3 usando `req.branchId` (import del `CustomerNotAvailableInBranchError` de `quotes/domain/errors`).
- [x] 5.6 `src/modules/pos/infrastructure/http/SalesController.ts` / `src/modules/quotes/infrastructure/http/QuotesController.ts`: capturar `CustomerNotAvailableInBranchError` → 400 `{"error": err.message}` (mismo mapeo que `ProductNotAvailableInBranchError`).
- [x] 5.7 Tests: `tests/unit/modules/pos/application/use-cases/CreateSaleUseCase.customerBranch.test.ts` (nuevo) y equivalente en `quotes` — casos: cliente fuera de sucursal → rechaza; cliente multi-sucursal incluyendo la de la operación → acepta; `customerId` nulo → sin gate; gate incondicional aunque `INVENTORY_SCOPE_MODE=general`.

## 6. Frontend — catálogo de clientes

- [x] 6.1 `app/(private)/catalogs/customers/_logic/types/{api,domain}.ts`: `CustomerDto`/`Customer` ganan `branchIds: string[]`; tipos de create/update ganan `branchIds?: string[]`.
- [x] 6.2 `app/(private)/catalogs/customers/_logic/services/listCustomers.ts`: acepta `branchId?: string`, lo agrega al query string.
- [x] 6.3 `app/(private)/catalogs/customers/_logic/services/{createCustomer,updateCustomer}.ts`: incluyen `branchIds` en el body cuando esté presente.
- [x] 6.4 `app/(private)/catalogs/customers/_logic/schemas/customer.schema.ts` (si existe con ese nombre; si no, ubicar el schema Zod de cliente): agregar `branchIds: z.array(z.string().uuid())`.
- [x] 6.5 `app/(private)/catalogs/customers/_blocks/CustomerEditModal.tsx`: 4ª sección "Sucursales" (ver diseño de UI en el delta de `customers-ui`). Props nuevas: `branches: {id,name,code}[]` (vía `useBranchesOptions()`), `isBypass: boolean`, `ownBranchId: string | null`, `headquartersId: string | null` (vía `useHeadquarters()`). Bypass: checklist con al menos 1 marcado, preselecciona Matriz en `create`. Operador: chip read-only con su sucursal.
- [x] 6.6 `app/(private)/catalogs/customers/_blocks/CustomersPage.tsx`: si `isBypass`, agregar `Select` de sucursal en el toolbar (mismo patrón que `/sales`), pasar `branchId` a `listCustomers`/hook de lista.
- [x] 6.7 `app/(private)/catalogs/customers/_blocks/CustomersTable.tsx`: columna "Sucursales" (códigos separados por coma) sólo cuando `isBypass`.
- [x] 6.8 `app/(private)/catalogs/customers/_logic/hooks/{useCustomers,useCustomerMutations}.ts` (nombres exactos a confirmar al implementar): propagar `branchId`/`branchIds`; el diff de mutations incluye `branchIds` como comparación de sets ordenados (no de referencia de array).
- [x] 6.9 Tests: `tests/unit/ui/(private)/catalogs/customers/CustomerEditModal.test.tsx` (bypass vs operador, validación de mínimo 1 sucursal), `CustomersPage.test.tsx` (filtro visible sólo para bypass), tests de los servicios (`branchId`/`branchIds` en query/body).

## 7. Frontend — POS, Cotizaciones, Abonos

- [x] 7.1 `app/(private)/pos/_logic/services/searchCustomers.ts`: acepta `branchId?: string`, lo agrega al query string.
- [x] 7.2 `app/(private)/payments/_logic/services/searchCustomers.ts`: mismo cambio.
- [x] 7.3 Hooks que envuelven esos servicios (`useCustomerSearch` en `payments`, el hook equivalente en `pos` si existe): propagar `branchId`.
- [x] 7.4 `app/(private)/pos/_blocks/CustomerPicker.tsx`: prop `branchId`, pasado al buscador.
- [x] 7.5 Callers de `CustomerPicker`: `app/(private)/pos/_blocks/CartPanel.tsx` (o `PosPage.tsx`, confirmar dónde se renderiza) pasa `selectedBranchId`; equivalente en `QuoteEmitPanel.tsx`/`QuoteCreatePage.tsx` pasa `quote.branchId` o `selectedBranchId`.
- [x] 7.6 `app/(private)/pos/_logic/services/createCustomer.ts` (quick-add): body incluye `branchIds: [branchId]` — el `branchId` viene del contexto de la venta/cotización en curso (`selectedBranchId` o `quote.branchId`).
- [x] 7.7 `app/(private)/pos/_blocks/CustomerQuickAddModal.tsx`: prop `branchId`, pasada al servicio de creación.
- [x] 7.8 **Al cambiar `selectedBranchId` (bypass) en `PosPage.tsx`/`QuoteCreatePage.tsx`, limpiar cualquier cliente ya seleccionado** — evita que una venta se intente confirmar con un cliente que ya no pertenece a la sucursal recién elegida (edge case explícito de la Historia 3).
- [x] 7.9 Tests: `tests/unit/ui/(private)/pos/_blocks/CustomerPicker.test.tsx` (pasa `branchId`), `CustomerQuickAddModal.test.tsx` (envía `branchIds`), test de `PosPage`/`QuoteCreatePage` cubriendo la limpieza de cliente al cambiar sucursal (7.8).

## 8. Caché offline

- [x] 8.1 `app/_lib/offline/catalogCache.ts`: `pullCustomers` agrega `&branchId=${ownerBranchId}` a la URL.
- [x] 8.2 Test: actualizar `tests/unit/ui/_lib/offline/catalogCache.test.ts` verificando el `branchId` en la URL de clientes (mismo patrón que la aserción ya agregada para precios en el workstream C).

## 9. Verificación

- [x] 9.1 `npm test` — suite completa en verde.
- [x] 9.2 `npm run build` — sin errores de tipos.
- [x] 9.3 Verificación manual en dev (Playwright): usuario `zarioz_test`/ZARIOZ en `/catalogs/customers` → sólo ve clientes con membresía en ZARIOZ; `admin@example.com` ve todos + filtro de sucursal funcional; POS de ZARIOZ no encuentra en el buscador un cliente exclusivo de otra sucursal; quick-add en ZARIOZ deja el cliente nuevo asignado y disponible de inmediato en esa misma venta; `POST /api/v1/admin/sales` directo con `customerId` de otra sucursal → 400 confirmado.
- [ ] 9.4 Confirmar con el usuario antes de `npx prisma migrate deploy` en prod (`cggfhiyxufjdzxzcxugo`) — no ejecutar sin aprobación explícita separada; tras aplicar, correr la verificación de 1.5 contra prod (sólo lectura).
