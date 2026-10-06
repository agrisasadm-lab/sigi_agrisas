## Context

Ver `proposal.md` — Why para la motivación y las mediciones de producción.

Estado actual relevante para el diseño:

- `product_prices.branch_id` es nullable. Migración `20260825000001_add_branch_scoped_product_prices` dejó tres índices vivos: `product_prices_product_id_branch_id_name_key` (unique plano, **inefectivo** cuando `branch_id IS NULL` porque Postgres considera los NULL distintos entre sí), más dos parciales por bucket: `product_price_global_name_idx` / `product_default_price_global_idx` (`WHERE branch_id IS NULL`) y `product_price_branch_name_idx` / `product_default_price_branch_idx` (`WHERE branch_id IS NOT NULL`).
- `resolveEffectivePrices` (`src/modules/products/domain/services/`) es el único punto donde vive la herencia. Tres consumidores: `PrismaProductPriceRepository.findEffectiveForBranch`, `InMemoryProductPriceRepository` y `PrismaDepartmentPriceListRepository` (reporte de lista de precios por departamento).
- La validación "el precio pertenece a la sucursal" está duplicada en cuatro use cases (`CreateSaleUseCase`, `EditCompletedSaleUseCase`, `CreateQuoteUseCase`, `UpdateQuoteUseCase`) con el patrón `price.branchId != null && price.branchId !== <branchId>`.
- `findDefaultByProductId(productId, branchId?)` cae a `branchId: null` cuando no recibe sucursal. Sus llamadores de dosificación (`ListProductDosificationsUseCase`, `CreateProductDosificationUseCase`, `UpdateProductDosificationUseCase`) no le pasan sucursal.
- Datos de producción verificados: 795 productos activos, 1861 filas en `branch_inventory`, 1220 precios base, 517 de sucursal, **4011** copias a materializar, sólo 3 productos activos sin ninguna fila de inventario y ninguno de esos 3 con precio base.
- `sale_items`, `quote_items` y `return_items` referencian `product_price_id` con `ON DELETE SET NULL`.

## Goals / Non-Goals

**Goals:**
- Que la separación por sucursal sea una invariante del esquema (`NOT NULL`), no una convención que cada consulta deba recordar.
- Migrar sin que ninguna sucursal pierda un precio vendible ni se altere ningún precio ya cargado.
- Dejar un único punto de resolución de precio: filtro por `branchId`, sin servicio de dominio intermedio.

**Non-Goals:**
- No se cambia el orden de prioridad de negocio (`sortProductPricesForDisplay`: default → subdis → distri → resto).
- No se agrega importación de Excel por UI ni por endpoint; el seeder `inventory-tiendas` sigue siendo la vía de carga masiva.
- No se toca la numeración de folios (change `add-folio-branch-scope`) ni la membresía de clientes (`add-customer-branch-membership`), aunque viajen en la misma rama.
- No se introducen permisos nuevos.

## Decisions

### Decisión 1 — `branch_id NOT NULL` en vez de conservar el bucket global y filtrar mejor

El change superseded (`fix-branch-price-override-exclusivity`) demostró el límite del enfoque contrario: se puede hacer que el override excluya al base, pero el bucket global sigue existiendo y cualquier lectura que omita `branchId` vuelve a exponer (o a ocultar) precios equivocados — que es exactamente lo que pasa hoy en `catalogCache`, en la pestaña Precios y en `findByProductId`. Con `NOT NULL`, olvidar el `branchId` deja de ser un fallo silencioso y pasa a ser un 400 explícito.

Alternativa descartada: mantener `NULL` como "plantilla de catálogo" no vendible. Conserva dos fuentes de verdad para el mismo concepto y reintroduce la ambigüedad en la UI ("edité el precio y no cambió nada").

### Decisión 2 — Materializar antes de reasignar, y no borrar nada

El orden es obligatorio: si primero se reasignaran los base a Matriz, el `JOIN` de materialización ya no encontraría filas con `branch_id IS NULL` y las demás sucursales quedarían sin precio.

No se borran los base remanentes: `sale_items`/`quote_items`/`return_items` los referencian con `ON DELETE SET NULL`, así que borrarlos dejaría ítems históricos sin trazabilidad al precio que se cobró (los snapshots de nombre y monto sobreviven, el vínculo no). Reasignarlos a Matriz preserva la FK y le da a Matriz el juego de precios que de hecho ya era suyo.

`branch_inventory` es el criterio de materialización porque es la definición operativa de "este producto se maneja en esta sucursal"; copiar a todas las sucursales inflaría la tabla con precios de productos que esa tienda no vende.

### Decisión 3 — Eliminar `resolveEffectivePrices` en lugar de simplificarlo

Con `branchId` obligatorio la función quedaría en `rows.filter(p => p.branchId === branchId)`, que es una línea dentro del `where` de Prisma. Mantener el servicio sólo conservaría el nombre "effective", que ya no describe nada: no hay resolución, hay pertenencia. Se elimina y sus tres consumidores pasan a filtrar en la consulta.

### Decisión 4 — El gate de venta/cotización se simplifica, y `hasBranchPriceOverrides` se retira

`hasBranchPriceOverrides` existía para detectar "esta sucursal ya tiene precio propio, así que el base no vale". Con precios por sucursal esa pregunta no tiene sentido: la comparación `price.branchId !== branchId` es completa por sí sola. Se retira el método del puerto `PosLookups` y de sus implementaciones; los tests de scoping que introdujo se conservan, reescritos contra la regla nueva.

### Decisión 5 — `branchId` obligatorio también en dosificaciones

`findDefaultByProductId` sin sucursal devolvería `null` para todo producto una vez que no existan filas con `branch_id IS NULL`, dejando toda la pestaña Dosificaciones en "Requiere precio default". Los tres use cases de dosificación pasan a recibir el `branchId` desde el controller, con las mismas reglas de validación y scoping que `GET /prices`. En POS, `getDosificationForSale` pierde el fallback a `branchId: null`.

### Decisión 6 — La pestaña Precios arranca en una sucursal concreta

Sin bucket global no hay nada que mostrar en "Precio base (todas)". Para un caller con `branches:access_all` el arranque es la matriz (`useHeadquarters()`), que es el juego de precios de referencia del negocio; sin bypass, la sucursal propia. Un usuario sin sucursal y sin bypass no puede administrar precios: se le muestra un estado vacío en vez de una lista que el backend rechazaría.

## Risks / Trade-offs

- **La migración crea ~4011 filas y reasigna 1220 en una transacción** → una sola migración transaccional; se ejecuta primero en dev y sólo después, con aprobación explícita y respaldo previo de `product_prices`, en producción.
- **Si no existe sucursal matriz, el paso de reasignación no tiene destino** → la migración aborta con un `RAISE EXCEPTION` explícito antes de tocar datos, en vez de dejar filas con `branch_id` nulo y fallar en el `SET NOT NULL`.
- **Un producto asignado a una sucursal después de la migración no hereda ningún precio** → es el comportamiento buscado, pero deja un hueco operativo: el change hermano `add-inventory-to-pricing-link` ya enlaza "asignar a sucursal" con "asignar precio de venta"; la pestaña Precios muestra estado vacío con CTA en vez de una tabla silenciosamente vacía.
- **Los tiers Subdis/Distri/Precio 4 pasan a existir replicados en cada sucursal** → cambiarlos deja de ser una edición central y pasa a ser una por sucursal. Es la consecuencia aceptada de la separación; se documenta en el spec y no se agrega un mecanismo de propagación, que reintroduciría la herencia por la puerta de atrás.
- **La caché offline de un usuario que cambia de sucursal podría servir precios de la anterior** → la caché se invalida al cambiar de sucursal y al cerrar sesión.

## Migration Plan

1. `npx prisma migrate dev --name separate_branch_pricing` contra dev (`qzzjpyepggwautckqeex`).
2. Verificar en dev: `SELECT count(*) FROM product_prices WHERE branch_id IS NULL` → 0; ningún par `(branch_inventory.branch_id, product_id)` sin al menos un precio; ninguna sucursal con dos defaults para un mismo producto.
3. `npm test` + `npm run build` + verificación manual en dev con Playwright.
4. Producción: respaldo de `product_prices` (`CREATE TABLE product_prices_backup_<fecha> AS SELECT * FROM product_prices`), aprobación explícita del usuario, `npx prisma migrate deploy`, y repetición de las verificaciones del paso 2 en modo lectura.

**Rollback**: la migración no borra filas, así que revertir consiste en restaurar `branch_id` a `NULL` para las filas cuyo `id` esté en el respaldo con `branch_id IS NULL`, borrar las filas materializadas (las que no existen en el respaldo) y volver a permitir `NULL` en la columna.
