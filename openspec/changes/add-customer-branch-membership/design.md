## Context

`Customer` (`prisma/schema.prisma:491-531`) no tiene ninguna columna ni relación de sucursal. `CustomersController` (`src/modules/customers/infrastructure/http/CustomersController.ts`) sólo valida `search` en `list`; `PrismaCustomerRepository.findAll` no aplica ningún `where` de sucursal. `CustomerRepository` (puerto, `src/modules/customers/application/ports/CustomerRepository.ts`) expone `FindAllOptions { page, pageSize, includeInactive, search? }`, `CreateCustomerData`/`UpdateCustomerData` sin `branchIds`, y `CustomerDto` sin ese campo.

`enforceBranchScope`/`resolveScopedBranchId` (`src/modules/rbac/infrastructure/http/enforceBranchScope.ts`) ya son el patrón estándar reusado por `products`, `inventory`, `sales`, etc. — `resolveScopedBranchId` en particular YA implementa exactamente la semántica que necesito para `list`: "un caller sin `branches:access_all` queda SIEMPRE scoped a su propia sucursal, la pida o no explícitamente"; se reutiliza tal cual, sin crear un helper nuevo.

`PosLookups.CustomerLookup` (`src/modules/pos/application/ports/PosLookups.ts:31-36`) es el tipo que `CreateSaleUseCase`/`CreateQuoteUseCase` reciben tras `getCustomer(id)`; `PrismaPosLookupService.getCustomer` (línea 85) hace un `findUnique` seleccionando sólo `id, isActive, creditLimit, currentBalance, email`.

Ver proposal.md — Historia de Usuario para las tres historias que este diseño resuelve.

## Goals / Non-Goals

**Goals:**
- (Historia 1) Un operador sin `branches:access_all` ve/crea/edita únicamente clientes de su propia sucursal — reutilizando el patrón `resolveScopedBranchId`/`enforceBranchScope` ya validado en el resto del sistema.
- (Historia 2) Un admin bypass gestiona el conjunto de sucursales de cualquier cliente vía `branchIds`, con al menos 1 sucursal siempre.
- (Historia 3) POS y Cotizaciones rechazan un `customerId` fuera de la sucursal de la operación, en backend, no sólo en el filtro de UI.
- Migración de datos reproducible y auditable (bootstrap por historial + fallback a Matriz), ejecutada una sola vez.

**Non-Goals:**
- No se pagina ni virtualiza el checklist de sucursales del modal — el número de sucursales activas es pequeño (10 en dev, orden de decenas esperado en prod), un checklist plano es suficiente.
- No se agrega un endpoint dedicado para "sucursales de un cliente" — `branchIds` viaja embebido en `CustomerDto`/create/update, igual que `products.branchIds` no existe como endpoint propio (patrón: siempre embebido en el DTO del agregado).
- No se resuelve aquí ninguna migración de `RegisterPaymentUseCase`/billing hacia una validación de cliente-sucursal — un abono/factura ya opera sobre una venta ya scoped; el bootstrap por historial ya cubre la visibilidad retroactiva necesaria (ver Riesgos).
- No se cambia el permiso `customers:read`/`customers:write` — el branch scoping es una restricción adicional sobre esos mismos permisos, no un permiso nuevo.

## Decisions

**1. `customer_branches` como tabla puente N:M pura, sin campos adicionales (a diferencia de `product_prices` que sí necesitaba `name`/`price` por fila).**

```prisma
model CustomerBranch {
  customerId String   @map("customer_id")
  branchId   String   @map("branch_id")
  createdAt  DateTime @default(now()) @map("created_at")

  customer Customer @relation(fields: [customerId], references: [id], onDelete: Cascade)
  branch   Branch   @relation(fields: [branchId], references: [id], onDelete: Cascade)

  @@id([customerId, branchId])
  @@index([branchId])
  @@map("customer_branches")
}
```
`onDelete: Cascade` en ambos lados — a diferencia de `folio_branch_counters` (donde borrar una sucursal con historial de folios no debía ser trivial), aquí borrar una sucursal SÍ debería limpiar sus membresías de cliente sin dejar huérfanos (las sucursales no se borran en la práctica — son soft-deleted vía `isActive`, así que este `Cascade` casi nunca dispara, pero es la semántica correcta si algún día se hace hard-delete).

**2. Gating siempre activo, NO condicionado a `INVENTORY_SCOPE_MODE` (Criterio de Seguridad de la Historia 1 y 3).**

A diferencia de `products` (`isBranchScopedInventory()` gatea el filtro), aquí el scoping de clientes se aplica incondicionalmente. Razón: es una regla de integridad de negocio (un cliente pertenece a X tiendas), no una configuración de despliegue sobre cómo se modela el inventario — mezclar ambos flags haría que apagar el modo de inventario alterara silenciosamente la visibilidad de clientes, una superficie de riesgo que la Historia 1 no acepta ("hoy se ven mezclados" debe dejar de ocurrir siempre, no sólo en un modo de despliegue).

**3. Reutilizar `resolveScopedBranchId`/`enforceBranchScope` tal cual — no crear una variante para "membresía en un array" en el helper compartido.**

`resolveScopedBranchId` ya resuelve "¿qué branchId aplica a este caller?" (fuerza al propio si no hay bypass). Eso cubre `list` y `create` (el "branchId a usar" para no-bypass). Para `getById`/`update`/`softDelete`, la pregunta es distinta — "¿el customer.branchIds YA CARGADO incluye la sucursal del caller?" — no encaja en la firma de `enforceBranchScope` (que compara `resourceBranchId` contra `x-user-branch-id`, un solo valor, no un array). Se agrega un helper local al controller de customers: `assertCustomerVisible(req, customer, authzService)` — no se toca `enforceBranchScope.ts` compartido para no acoplar ese archivo a la forma "recurso con múltiples sucursales", que hoy sólo aplica a `customers`.

```ts
// dentro de CustomersController, no exportado
async function assertCustomerVisible(
  req: NextRequest, customer: Customer, authz: AuthorizationService
): Promise<NextResponse | null> {
  const userId = req.headers.get("x-user-id") ?? "";
  const bypass = await authz.userCan(userId, "branches:access_all");
  if (bypass) return null;
  const userBranchId = req.headers.get("x-user-branch-id") ?? "";
  if (userBranchId === "" || !customer.branchIds.includes(userBranchId)) {
    return NextResponse.json({ error: "Forbidden", required: "branches:access_all" }, { status: 403 });
  }
  return null;
}
```

**4. `branchIds` en `create`/`update` se resuelve en el CONTROLLER, no en el use case — mismo principio que "el use case no conoce HTTP/headers".**

`CreateCustomerUseCase`/`UpdateCustomerUseCase` reciben `branchIds: string[]` YA resuelto (forzado a `[ownBranch]` para no-bypass, o el array validado del bypass) — no reciben `req`/headers. El controller calcula el array final antes de invocar el use case, igual que ya hace con otros campos normalizados (`code` uppercase, `rfc` uppercase). Alternativa descartada: pasar un flag `isBypass` al use case y que él decida — mezclaría lógica de autorización HTTP dentro de application, violando la regla de capas del proyecto ("el use case no contiene lógica de negocio de HTTP").

**5. Reemplazo completo del array en `update` (`branchIds` reemplaza, no fusiona) — igual semántica que otros campos "set" del proyecto.**

`PrismaCustomerRepository.update` con `branchIds` presente hace `branches: { deleteMany: {}, create: branchIds.map(id => ({ branchId: id })) }` dentro de la misma operación — atómico vía el nested write de Prisma (una sola llamada, no dos pasos). Alternativa descartada: aceptar `addBranchIds`/`removeBranchIds` separados — más flexible pero no lo pide ninguna historia, y el modal de UI ya construye el array completo (checklist), no un diff incremental.

**6. Nuevo error de dominio compartido por `pos` y `quotes`: `CustomerNotAvailableInBranchError`, un archivo por módulo (mismo patrón que `ProductNotAvailableInBranchError`, que YA existe duplicado en `pos/domain/errors/` y `quotes/domain/errors/` en vez de un módulo compartido).**

Se sigue el patrón existente en vez de introducir un módulo `shared/domain/errors` nuevo sólo para este caso — mantiene consistencia con cómo el proyecto ya maneja el mismo tipo de gate para productos.

**7. `CustomerLookup.branchIds: string[]` se agrega al lookup existente — no se crea un lookup separado.**

`PrismaPosLookupService.getCustomer` amplía su `select` para incluir `branches: { select: { branchId: true } }` y mapea a `branchIds`. Mismo objeto que ya usan `CreateSaleUseCase`/`CreateQuoteUseCase`, sin round-trip adicional a la DB.

## Riesgos / Trade-offs

- **[Riesgo] Ventas/facturas/abonos legacy cuyo cliente, tras el bootstrap, no incluya la sucursal de ese documento histórico** (no debería ocurrir — el bootstrap asigna exactamente las sucursales de sus documentos — pero si un cliente tiene una venta en una sucursal que luego se desactiva/borra, la membresía sigue intacta vía `Cascade` sólo si la sucursal se borra realmente). → Mitigación: el bootstrap cubre el caso normal; branches no se hard-delete en la práctica (soft-delete vía `isActive`), así que el escenario de pérdida de membresía por cascade es hipotético.
- **[Riesgo] Un cliente que compra en una sucursal nueva por primera vez, sin que un bypass lo haya asignado antes, queda invisible para el operador de esa sucursal en el catálogo** — pero SÍ puede completarse su primera venta ahí si un bypass lo autoriza puntualmente (crea la venta) o si el propio operador usa el quick-add (que asigna automáticamente su sucursal, ver proposal.md — What Changes). → Aceptado: es el comportamiento correcto según la Historia 1 — un cliente "aparece" en una sucursal sólo cuando alguien con permiso lo asigna ahí, ya sea explícitamente (bypass) o implícitamente (el propio operador lo da de alta).
- **[Riesgo] `RegisterPaymentUseCase`/facturación no validan cliente-sucursal** (fuera de alcance, ver Non-Goals) — un abono sobre una venta antigua cuyo cliente ya no esté en la sucursal actual del operador seguiría funcionando porque opera sobre la venta (ya scoped), no sobre el catálogo de clientes directamente. Aceptado explícitamente.
- **[Trade-off] El checklist de sucursales en el modal no pagina** — aceptable mientras el catálogo de sucursales sea pequeño; si crece a cientos, requeriría revisarse (fuera de alcance de este cambio).

## Migration Plan

1. `npx prisma migrate dev --name add_customer_branches` contra dev (`qzzjpyepggwautckqeex`) — crea `customer_branches` + ejecuta el bootstrap SQL (ver tasks.md) dentro de la misma migración.
2. Implementar backend + frontend (ver `tasks.md`).
3. Verificación completa en dev: `npm test`, `npm run build`, verificación manual (Playwright) — operador ve sólo sus clientes, bypass asigna múltiples sucursales, POS/Cotizaciones rechazan cliente ajeno.
4. **Aplicar a prod (`cggfhiyxufjdzxzcxugo`) requiere confirmación explícita separada** antes de `npx prisma migrate deploy` — el bootstrap reescribe datos reales (asigna sucursales a cada cliente existente), es la migración de mayor impacto de los tres workstreams.
5. Verificación post-deploy en prod (SQL de sólo lectura): `SELECT customer_id, count(*) FROM customer_branches GROUP BY 1` — confirmar que ningún cliente quedó con 0 membresías.
6. Rollback: revertir el código es seguro (el filtrado deja de aplicarse, catálogo vuelve a comportarse como antes). Revertir el schema (`DROP TABLE customer_branches`) es seguro en cualquier momento — no hay otra tabla que dependa de ella.
