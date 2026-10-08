## Context

El carrito (`CartPanel`/`useCart`/`computeTotalsClient`) es compartido entre POS y Cotizaciones; cualquier cambio de modelo/UI ahí se refleja en ambos módulos sin código extra. El cálculo de totales por línea vive en un núcleo compartido (`src/shared/domain/services/LineTotalsCalculator.ts`) consumido por `SaleTotalsCalculator`, `QuoteTotalsCalculator`, `ReturnTotalsCalculator` y `PurchaseTotalsCalculator` — los primeros tres son idénticos salvo el nombre del campo de precio; deben mantenerse en equivalencia (test obligatorio por `CLAUDE.md`).

Durante la exploración se confirmaron dos hechos del código actual que condicionan el diseño:

1. **`discountPct` editado en el carrito nunca llega al backend.** El frontend ya envía `discountPctOverride` en el body (`useSaleSubmission`, `useQuoteSubmission`, `EditSalePage`, `QuoteEditPage`), pero ni `saleItemSchema`/`quoteItemSchema` (zod, en `SalesController`/`QuotesController`) ni los DTOs (`CreateSaleRequest.SaleItemInput`, etc.) lo declaran. Zod lo descarta silenciosamente; el use case siempre usa `price.discountPct` del catálogo. Ver proposal.md — "Fix prerequisito".
2. **`ReturnItem` snapshotea `discountPct` del `sale_item`** y lo reenvía a `ReturnTotalsCalculator` para calcular `refundTotal`. Sin el mismo snapshot para `discountAmount`, una devolución de una línea con descuento $ reembolsaría de más.

## Goals / Non-Goals

**Goals:**
- Descuento por monto fijo ($, tope 100 MXN) por línea, mutuamente excluyente con el % existente, en POS y Cotizaciones (Historia #1).
- El % y el $ llegan realmente al backend y se persisten (corrige el bug del punto 1, prerequisito para validar la exclusión mutua en servidor).
- Una devolución de una línea con descuento $ reembolsa el monto correcto (corrige el gap del punto 2).

**Non-Goals:**
- No se agrega un descuento a nivel de ticket/total (decidido: sólo por línea).
- No se toca `PurchaseTotalsCalculator` ni `InvoiceTotalsCalculator` — ninguno de los dos recibe `discountAmount`.
- No se habilita el control $ (ni se cambia el existente %) en líneas de dosificación — se mantiene exactamente el comportamiento actual para esas líneas.
- No se introduce un nuevo permiso RBAC — sigue gateado por `sales:create`/`sales:edit_completed`/`quotes:create`/`quotes:write` ya existentes.

## Decisions

### 1. Un solo campo numérico + toggle, no dos inputs simultáneos
`CartLine` gana `discountType: "pct" | "amount"` (default `"pct"`, no rompe carritos en memoria existentes) y `discountAmount: number` (default `0`). La UI (`CartLine.tsx`) muestra un segmented toggle `%` / `$` junto a un único input numérico cuyo significado depende del toggle — no dos campos visibles a la vez. Esto hace la exclusión mutua estructuralmente imposible de violar desde la UI (Historia #1, AC "mutuamente excluyentes"), en vez de depender de lógica de reseteo entre dos inputs independientes.

Alternativa descartada: dos inputs (% y $) siempre visibles, deshabilitando uno cuando el otro es > 0. Más código, más estados inconsistentes posibles (ambos en 0 — ¿cuál manda?), sin beneficio sobre el toggle.

### 2. Dosificación: se oculta el toggle/control $, el % existente se mantiene sin cambios
Para `line.dosificationId != null`, `CartLine.tsx` sigue renderizando exactamente el input `Desc. %` que ya existe hoy (sin toggle, sin opción $) — ese control ya era inerte antes de este cambio porque el backend fuerza `discountPct = null` en líneas de dosificación, pero no se altera su presencia ni comportamiento. El toggle %/$ (con la opción $ nueva) sólo aparece en líneas no-dosificación. Decisión explícita del usuario sobre el $; el % de dosificación queda intacto por no-regresión.

### 3. Validación en el borde (zod), invariante en el dominio (defense-in-depth)
Alineado con `CLAUDE.md` ("Validación Zod ocurre en el controller, antes de los use cases"): el rango `[0,100]` de `discountAmount`/`discountPctOverride` y la exclusión mutua por ítem se validan en `saleItemSchema`/`editSaleSchema`/`quoteItemSchema` (zod `.refine()`) → HTTP 400 limpio. `computeLineTotals` (dominio compartido) gana el mismo invariante (`discountPct > 0 && discountAmount > 0` → throw; `discountAmount` fuera de `[0,100]` → throw) como invariante de pureza del dominio, igual que ya hace con `discountPct`/`ivaRate` — en la práctica inalcanzable desde HTTP porque zod ya filtró, pero mantiene el servicio seguro para cualquier otro caller presente o futuro.

### 4. `lineGross` resta el monto después del %, clamp a 0
```
lineGross = max(0, quantity * price * (1 - discountPct/100) - discountAmount)
```
Como son mutuamente excluyentes por línea, en la práctica sólo uno de los dos términos es distinto de cero — la fórmula combinada es sólo para no bifurcar el cálculo en dos caminos. El `max(0, ...)` cubre el caso borde "amount > quantity*price" (Historia #1, AC "lineGross se clampa a 0").

### 5. El núcleo compartido (`computeLineTotals`) gana el campo; Purchase/Invoice no lo adoptan
`LineTotalsInput.discountAmount?: number | null` se agrega una sola vez en `src/shared/domain/services/LineTotalsCalculator.ts`. `SaleTotalsCalculator`, `QuoteTotalsCalculator` y `ReturnTotalsCalculator` (los tres ya delegan ahí) pasan el campo explícitamente en su mapeo. `PurchaseTotalsCalculator` e `InvoiceTotalsCalculator` **no** pasan el campo — su comportamiento es idéntico a hoy sin tocar una línea de su código. Mantiene el test de equivalencia (`tests/fixtures/totals-vectors.ts`) correcto: los vectores compartidos siguen siendo válidos para los tres calculadores porque `discountAmount` ausente ⇒ `0` ⇒ fórmula degenera a la actual.

### 6. Fix del `discountPctOverride` muerto: wiring mínimo, sin cambiar semántica
`saleItemSchema`/`quoteItemSchema` declaran `discountPctOverride: z.number().min(0).max(100).optional()` y `discountAmount: z.number().min(0).max(100).optional()`, con `.refine()` de exclusión mutua. `CreateSaleRequest.SaleItemInput`/`EditCompletedSaleRequest`/el DTO de quotes ganan ambos campos opcionales. En los use cases, para ítems basados en `productPriceId`: `discountPct = item.discountPctOverride ?? price.discountPct` (antes: siempre `price.discountPct`, el override se ignoraba); `discountAmount = item.discountAmount ?? 0`. Para ítems basados en `dosificationId`: ambos se ignoran incondicionalmente (`discountPct = null`, `discountAmount = 0`) — mismo patrón que ya existe para `discountPct` en dosificación, ahora también aplicado a `discountAmount` (defensa en profundidad: aunque la UI oculta el control, un caller de API directo no puede forzarlo).

### 7. Devoluciones: snapshot adicional, sin nueva validación de input
`ReturnItem` gana `discountAmount: number | null`. `CreateReturnUseCase`, en el paso 6 ("snapshot per line from the corresponding sale_item"), copia `saleItem.discountAmount` igual que ya copia `saleItem.discountPct` — no hay campo nuevo en `ReturnItemInput` (el body de `POST /returns` no cambia), es un valor derivado del `sale_item`, no un input del usuario. `ReturnTotalsCalculator.computeTotals` pasa `discountAmount` al núcleo compartido igual que `discountPct`.

### 8. Migración: una sola columna por tabla, sin `CHECK` constraint
`discount_amount DECIMAL(5,2) NOT NULL DEFAULT 0` en `sale_items`, `quote_items`, `return_items` — misma escala que `discount_pct` en esas mismas tablas (no `DECIMAL(14,4)` como los campos monetarios de línea: el valor está acotado a `[0,100]`, igual que el %, así que reusar esa escala es más consistente que la de montos sin tope). No se agrega `CHECK (discount_amount BETWEEN 0 AND 100)` a nivel DB: el proyecto no usa ese patrón para rangos de negocio en ninguna columna existente (`discount_pct` tampoco lo tiene) — la validación vive en zod + dominio, consistente con el resto del código base.

## Risks / Trade-offs

- **[Riesgo] El fix del `discountPctOverride` cambia comportamiento observable de ventas/cotizaciones ya en producción** (el % que el cajero edita ahora SÍ se persiste, cuando antes se ignoraba silenciosamente). → Mitigación: es estrictamente una corrección de un bug (el dato ya se enviaba y se esperaba que aplicara); no hay caller que dependa de que el override se ignore. Se documenta explícitamente en proposal.md y se cubre con tests que fijan el nuevo comportamiento.
- **[Riesgo] `discountType` nuevo en `CartLine` rompe estado persistido** (si el carrito se guarda en algún storage entre sesiones). → Mitigación: `useCart` es estado en memoria (`useReducer`), no persiste entre reloads; no hay migración de estado cliente que hacer.
- **[Riesgo] Edición de venta completada (`EditCompletedSaleUseCase`) reconstruye totales re-ejecutando el flujo de "Create sale"** — al heredar el fix del override y el nuevo `discountAmount`, una venta editada con items nuevos sin estos campos debe seguir comportándose igual (ambos opcionales, default a los valores actuales). → Mitigación: ambos campos son opcionales en el DTO/zod; omitir ambos reproduce exactamente el comportamiento pre-cambio (`discountPct = price.discountPct`, `discountAmount = 0`).
- **[Trade-off] Validar rango/exclusión en zod Y en el dominio es validación duplicada.** → Aceptado: es el mismo patrón que ya existe para `discountPct`/`ivaRate`/`iepsRate` en `computeLineTotals`; mantiene el dominio puro y seguro independientemente del caller HTTP.

## Migration Plan

1. Migración Prisma: `discount_amount DECIMAL(5,2)` en `sale_items`, `quote_items`, `return_items` (default `0`, no requiere backfill).
2. Dominio: `LineTotalsCalculator` → `SaleTotalsCalculator`/`QuoteTotalsCalculator`/`ReturnTotalsCalculator` (en ese orden, por la cadena de dependencia).
3. Backend: DTOs + zod schemas (fix `discountPctOverride` + nuevo `discountAmount`) → use cases (`CreateSaleUseCase`, `EditCompletedSaleUseCase`, `CreateQuoteUseCase`, `UpdateQuoteUseCase`, `CreateReturnUseCase`) → mappers/DTOs de respuesta.
4. Frontend: tipos de dominio (`CartLine`) → `computeTotalsClient` → `useCart` → UI (`CartLine`, `SaleItemsTable`, `QuoteItemsTable`).
5. Rollback: la columna nueva con default `0` es aditiva y retrocompatible — revertir el deploy de aplicación sin revertir la migración es seguro (columnas no usadas no rompen nada). Revertir la migración (si fuera necesario) es un simple `DROP COLUMN` sin pérdida de datos de negocio preexistentes.
