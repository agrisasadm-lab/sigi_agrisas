## Historia de Usuario

| # | Rol | Tarea | Motivo | Criterios de Aceptación | Criterios de Seguridad |
|---|---|---|---|---|---|
| 1 | Cajero/operador de POS con conectividad intermitente | Como cajero/operador de POS con conectividad intermitente, quiero que un reintento duplicado de venta (mismo `clientRequestId`) nunca falle con error de servidor para que mi venta offline se sincronice sin quedar atascada en la cola | Hoy, si dos intentos con el mismo `clientRequestId` llegan casi simultáneos, el segundo choca con el índice único `sales_client_request_id_key` y el backend responde 500 en vez de devolver la venta ya creada, dejando el item del outbox en reintento indefinido con backoff creciente | - Given dos requests concurrentes a `createCompleted`/`createCompletedFromQuote` con el mismo `clientRequestId` no nulo, When la segunda transacción choca con el constraint único (Prisma `P2002`), Then el repositorio captura el conflicto y devuelve la venta ya persistida (mismo `id`/folio) en vez de lanzar<br>- Given el conflicto fue absorbido, When se resuelve, Then NO se dispara `fireLowStockNotifications` de nuevo (no es una venta nueva)<br>- Given `clientRequestId` es `null`/`undefined`, When ocurre cualquier otro error de Prisma, Then el error se re-lanza sin cambios (no se absorbe nada fuera del caso de conflicto por `client_request_id`)<br>- Given el conflicto se absorbe, When se verifica inventario, Then solo existe **un** movimiento de inventario para esa venta (no doble decremento) | - El helper compartido `isPrismaUniqueError` sigue exigiendo que el `target`/constraint coincida exactamente con `client_request_id` — no absorber silenciosamente otros conflictos de unicidad (ej. folio duplicado) que sí deben seguir siendo errores visibles<br>- La respuesta idempotente no debe filtrar datos de una venta de otra sucursal/cliente distinto al solicitante — el registro devuelto es exactamente el que el mismo `clientRequestId` ya creó, nunca un resultado de otro usuario<br>- No se introduce ninguna ventana donde la transacción quede a medio aplicar: el catch ocurre después de que la transacción de Prisma ya hizo rollback automático del intento fallido |
| 2 | Cajero/operador de Cotizaciones con conectividad intermitente | Como cajero/operador que crea cotizaciones offline, quiero que un reintento duplicado de cotización (mismo `clientRequestId`) nunca falle con error de servidor para que mi cotización se sincronice sin quedar "pendiente" para siempre | Hoy `PrismaQuoteRepository.createWithItems` usa INSERT crudo (`$executeRaw`) y el conflicto de unicidad se manifiesta como Prisma `P2010` (no `P2002`), código que el helper compartido no reconocía — el error se propaga como 500 y la cotización queda indefinidamente "1 pendiente de sincronizar" | - Given dos requests concurrentes a `createWithItems` con el mismo `clientRequestId` no nulo, When la segunda choca con `quotes_client_request_id_key` vía INSERT crudo (Prisma `P2010` + `meta.code==="23505"`), Then el repositorio lo reconoce como conflicto de unicidad (helper extendido) y devuelve la cotización ya persistida en vez de lanzar<br>- Given el helper `isPrismaUniqueError` extendido, When se le pasa un error `P2002` normal (callers ORM existentes, ej. `UserPrismaRepository`), Then el comportamiento previo no cambia (regresión cero sobre los ~15 callers actuales)<br>- Given el conflicto se absorbe, When se verifica la tabla `quote_items`, Then no hay líneas duplicadas (solo las de la primera inserción exitosa) | - Igual que la fila 1: el `target`/constraint debe coincidir exactamente con `client_request_id`, nunca absorber otros `23505` (ej. folio) como si fueran idempotencia<br>- La detección de `P2010` debe inspeccionar `meta.code`/`meta.message`, no solo el `code` externo `P2010` (que también cubre otros fallos de query cruda no relacionados a unicidad) — un `P2010` sin `meta.code==="23505"` se re-lanza igual que cualquier otro error |

Nota: se dividió en 2 historias (ventas vs. cotizaciones) porque, aunque comparten el mismo bug de fondo y el mismo helper compartido, cada una tiene mecanismo de detección de error distinto (`P2002` vs `P2010`) y criterios de aceptación/test independientes.

## Why

`CreateSaleUseCase` y `CreateQuoteUseCase` ya resuelven el replay **secuencial** de un
`clientRequestId` repetido (consultan `findByClientRequestId` antes de insertar), pero
dejan una ventana de carrera: dos requests concurrentes con el mismo `clientRequestId`
(reintento del outbox offline disparado antes de confirmar el intento anterior, o doble
pestaña) pueden ambos superar ese check y uno de los dos choca con el índice único
(`sales_client_request_id_key` / `quotes_client_request_id_key`, migración
`20260824000001_add_client_request_id_to_sales_and_quotes`). Ese choque no se captura en
ningún repositorio — se propaga como error 500. El sync engine offline
(`app/_lib/offline/syncEngine.ts`) trata todo `>=500` como fallo transitorio y reintenta
con backoff creciente: si el servidor siempre responde 500 ante el duplicado (el registro
ya existe para siempre), el item queda **indefinidamente** "pendiente de sincronizar".
Esto contradice la garantía de idempotencia por `clientRequestId` que CLAUDE.md documenta
para `pos-api`/`quotes-api`. Detectado y documentado como deuda técnica ALTA pendiente
durante la verificación manual del fix de `exhaustive-deps` (ver
`openspec/changes/fix-hooks-exhaustive-deps/`, fuera de su alcance).

## What Changes

- Extender `isPrismaUniqueError` (`src/shared/infrastructure/prisma/errors.ts`) para
  reconocer, además del caso ORM existente (`P2002` + `meta.target`), el caso de INSERT
  crudo vía `$executeRaw` (`P2010` + `meta.code === "23505"` + `meta.message` conteniendo
  el nombre del constraint). Sin cambios de comportamiento para los callers ORM actuales.
- `PrismaSaleRepository.createCompleted` y `createCompletedFromQuote`: capturar el
  conflicto de unicidad por `client_request_id` dentro de la transacción y devolver el
  registro ya existente (`findByClientRequestId`) en vez de propagar el error. Se omite
  `fireLowStockNotifications` en ese camino (no es una venta nueva).
- `PrismaQuoteRepository.createWithItems`: mismo patrón, usando el helper extendido para
  detectar el conflicto del INSERT crudo.
- Actualizar el requirement de idempotencia en `openspec/specs/pos-api/spec.md` y
  `openspec/specs/quotes-api/spec.md` para cubrir explícitamente el conflicto concurrente
  a nivel de constraint único (hoy solo describen el replay secuencial).

## Capabilities

### New Capabilities

(ninguna)

### Modified Capabilities

- `pos-api`: el requirement de idempotencia por `clientRequestId` pasa a garantizar
  también el caso de conflicto concurrente a nivel de base de datos (no solo el replay
  secuencial ya cubierto).
- `quotes-api`: mismo cambio de requirement, aplicado a la creación de cotizaciones.

## Impact

- **Código**: `src/shared/infrastructure/prisma/errors.ts`,
  `src/modules/pos/infrastructure/repositories/PrismaSaleRepository.ts`,
  `src/modules/quotes/infrastructure/repositories/PrismaQuoteRepository.ts`.
- **Specs**: `openspec/specs/pos-api/spec.md`, `openspec/specs/quotes-api/spec.md`
  (delta de requirement de idempotencia).
- **Tests**: nuevos casos en `tests/unit/modules/shared/infrastructure/prisma/errors.test.ts`
  y nuevos tests de integración `tests/integration/modules/pos/sales-idempotent-conflict.test.ts`
  / `tests/integration/modules/quotes/quotes-idempotent-conflict.test.ts`.
- **Sin impacto en cliente**: no se modifica `app/_lib/offline/syncEngine.ts` — su
  comportamiento de retry es correcto una vez el backend deje de responder 500 ante el
  duplicado.
- **Sin migraciones de BD**: los índices únicos ya existen.
