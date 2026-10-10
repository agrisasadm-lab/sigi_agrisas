## Context

Ver `proposal.md` → `## Why` para la motivación completa. Resumen técnico necesario
para las decisiones de este documento:

- `CreateSaleUseCase.execute` y `CreateQuoteUseCase.execute` ya hacen *check-then-insert*:
  consultan `findByClientRequestId` antes de proceder. Esto cubre el replay secuencial
  (historia #1 y #2 de la tabla), pero no la carrera concurrente.
- `PrismaSaleRepository.createCompleted`/`createCompletedFromQuote` insertan vía ORM
  (`tx.sale.create(...)`) → un choque de `client_request_id` lanza Prisma `P2002` con
  `meta.target` incluyendo el nombre de columna/índice.
- `PrismaQuoteRepository.createWithItems` inserta vía `tx.$executeRaw` (necesario porque
  el Prisma Client generado aún valida `customerId` como no-nulo aunque la columna ya
  acepta `null` — comentario existente en el archivo, no se toca en este change) → un
  choque del mismo constraint lanza Prisma `P2010` ("Raw query failed") con
  `meta.code === "23505"` y `meta.message` conteniendo el nombre del índice, **no**
  `P2002`. Verificado leyendo el comportamiento documentado de Prisma para
  `$executeRaw`/`$queryRaw` sobre violaciones de constraint.
- Helper compartido `isPrismaUniqueError(err, target?)` en
  `src/shared/infrastructure/prisma/errors.ts` — hoy sólo reconoce `P2002`. Tiene ~15
  callers en el repo, todos vía `.create()`/`.update()` del ORM (nunca `$executeRaw`).
- `findByClientRequestId` ya existe en ambos repos (usado por los use cases para el
  replay secuencial) — se reutiliza para resolver la carrera, no se duplica lógica de
  consulta.

## Goals / Non-Goals

**Goals:**

- Que un conflicto de unicidad por `client_request_id` detectado DENTRO del repositorio
  (no sólo el check previo del use case) se resuelva devolviendo el registro ganador en
  vez de propagar un error 500. Responde a los Criterios de Aceptación de las historias
  #1 y #2 de `proposal.md`.
- Un único punto de detección reutilizable (`isPrismaUniqueError` extendido) que cubra
  tanto el camino ORM (`P2002`, sales) como el camino `$executeRaw` (`P2010`/`23505`,
  quotes) — Criterio de Seguridad de ambas historias: no absorber silenciosamente otros
  conflictos de unicidad (folio, etc.) como si fueran idempotencia.
- Cero regresión en los ~15 callers existentes de `isPrismaUniqueError` (todos `P2002`
  puro) — Criterio de Seguridad de la historia #2.

**Non-Goals:**

- No se modifica `app/_lib/offline/syncEngine.ts` ni el mecanismo de retry/backoff del
  outbox — su comportamiento es correcto y es justamente el que debe seguir existiendo
  para tolerar respuestas perdidas; el bug está sólo en que el backend respondía 500 en
  vez de 201 idempotente.
- No se migra `PrismaQuoteRepository.createWithItems` de `$executeRaw` a ORM — ese INSERT
  crudo existe por una razón documentada (`customerId` nullable vs. Prisma Client
  desactualizado) ajena a este bug; cambiarlo es un refactor independiente, no deuda de
  idempotencia.
- No se añade retry/backoff del lado del servidor ni locking explícito (`SELECT ... FOR
  UPDATE`) — el índice único de Postgres ya es la fuente de verdad transaccional; sólo
  falta capturar su violación.

## Decisions

### 1. Extender `isPrismaUniqueError` en vez de crear un helper paralelo

`isPrismaUniqueError(err, target?)` ya es el punto de verdad usado por ~15 repositorios
para "¿esto es un choque de unicidad en esta columna?". Se extiende su cuerpo para
reconocer una segunda forma de error:

- Rama existente: `err.code === "P2002"` → revisa `err.meta.target` (array o string).
- Rama nueva: `err.code === "P2010" && err.meta.code === "23505"` → revisa
  `err.meta.message` (string) buscando el substring `target`.

Alternativa descartada: crear `isRawUniqueViolation` como función separada. Se descarta
porque obligaría a cada caller del nuevo camino (sales, quotes) a llamar DOS funciones y
decidir cuál aplica según si el insert es ORM o crudo — acoplando el caller a un detalle
de implementación del repositorio que no le corresponde. Una sola función que reconoce
ambas formas mantiene el contrato "¿esto es un choque de `target`?" sin exponer la
distinción `P2002`/`P2010` hacia arriba.

Por qué es seguro para los callers actuales: todos pasan errores `P2002` reales (ORM);
la rama nueva sólo se activa con `P2010`, que ningún caller actual puede producir (ninguno
usa `$executeRaw`). Se agregan tests para la rama nueva en
`tests/unit/modules/shared/infrastructure/prisma/errors.test.ts` sin tocar los tests
existentes.

### 2. Dónde capturar el conflicto: dentro del repositorio, no en el use case

El use case (`CreateSaleUseCase`/`CreateQuoteUseCase`) ya hace su propio check-then-insert
antes de llamar al repositorio — ese check cubre el replay secuencial. La ventana de
carrera ocurre DESPUÉS de ese check, dentro de la transacción Prisma del repositorio. Por
eso el `try/catch` se agrega envolviendo `this.prisma.$transaction(...)` en
`createCompleted`, `createCompletedFromQuote` (sales) y `createWithItems` (quotes) — el
use case no necesita cambios, sigue recibiendo un `SaleSummary`/`QuoteSummary` válido ya
sea porque la transacción tuvo éxito o porque el repo absorbió el conflicto.

Alternativa descartada: mover el `try/catch` al use case, envolviendo la llamada a
`saleRepo.createCompleted(...)`. Se descarta porque el use case no sabe (ni debe saber)
qué forma de error produce el repositorio concreto (ORM vs. raw) — esa es precisamente la
razón por la que `PrismaQuoteRepository` usa `$executeRaw` en primer lugar, un detalle de
infraestructura. Mantener la captura en el repositorio respeta la frontera de capas ya
establecida en el proyecto (ports/use-cases no importan nada de Prisma).

### 3. Qué se hace tras capturar el conflicto

```
try {
  summary = await this.prisma.$transaction(async (tx) => { ... });
} catch (err) {
  if (data.clientRequestId && isPrismaUniqueError(err, "client_request_id")) {
    const existing = await this.findByClientRequestId(data.clientRequestId);
    if (existing) return existing;
  }
  throw err;
}
```

- El guard `data.clientRequestId` truthy evita siquiera intentar la recuperación cuando
  el campo es `null` (caso normal online) — un error en ese camino nunca es por este
  constraint (el índice único de Postgres permite múltiples `NULL`), así que se re-lanza
  directo.
- Si `findByClientRequestId` no encuentra nada (no debería pasar si el error fue
  realmente por ese constraint, pero Prisma no garantiza que el registro ganador ya sea
  visible en la misma conexión/snapshot bajo cualquier nivel de aislamiento) se re-lanza
  el error original — nunca se devuelve `undefined`/`null` como si fuera éxito.
- En `createCompleted`/`createCompletedFromQuote`, el `return existing` ocurre ANTES de
  `fireLowStockNotifications` (ese `await` está fuera del `try`, después de él) — se
  reestructura para que el catch retorne temprano desde la función, saltándose esa
  notificación. Ver Criterio de Aceptación de la historia #1 ("NO se dispara
  `fireLowStockNotifications` de nuevo").

### 4. Alcance de los specs: requirement existente "Create sale"/"Create quote", no uno nuevo

El requirement `### Requirement: Create sale (atomic emission)` (y su equivalente en
quotes-api) ya describe el campo `clientRequestId` y el replay secuencial. Este cambio es
una extensión de ESE comportamiento (sigue siendo la misma garantía de idempotencia, ahora
también bajo concurrencia), no una capability nueva — por eso el delta usa `MODIFIED
Requirements` reproduciendo el bloque completo con el párrafo de idempotencia y el paso
del flujo atómico ampliados, más un escenario nuevo, en vez de crear un requirement
separado "Idempotencia concurrente".

## Risks / Trade-offs

- **[Riesgo] Nivel de aislamiento de transacción no garantiza que el `SELECT` de
  recuperación vea la fila ganadora inmediatamente tras el `ROLLBACK` del perdedor** →
  Mitigación: Postgres garantiza que una vez que el `INSERT` ganador hace `COMMIT`, el
  `SELECT` posterior (fuera de esa transacción, en una conexión nueva del catch) sí la ve
  — el perdedor sólo llega al catch después de que su propio intento de `INSERT` fue
  rechazado por el motor, lo que implica que el ganador ya completó su `INSERT` en el
  índice (aunque no necesariamente su `COMMIT` completo en todos los niveles de
  aislamiento). Para el nivel por defecto de Prisma/Postgres (`Read Committed`), esto es
  seguro en la práctica; se documenta el caso borde (fila no encontrada → re-lanzar) como
  defensa adicional en la Decisión 3.
- **[Riesgo] `isPrismaUniqueError` extendido podría, en teoría, hacer match de falso
  positivo si `meta.message` de un `P2010` no relacionado contiene casualmente el
  substring `client_request_id`** → Mitigación: el único INSERT crudo tocado por este
  change es el de `quotes` sobre la tabla `quotes`; el mensaje de Postgres para una
  violación de unicidad siempre incluye el nombre exacto del índice
  (`quotes_client_request_id_key`), que contiene el substring de forma intencional — el
  mismo patrón que ya usa la rama `P2002` existente (`target` como substring, no
  igualdad exacta), así que el riesgo es idéntico al que el helper ya acepta hoy.
- **[Trade-off] El fix no elimina la ventana de carrera a nivel de aplicación (sigue
  existiendo un check-then-insert) — sólo garantiza que, cuando la carrera ocurre, el
  resultado observable es idempotente** → Aceptado: eliminar la ventana requeriría un
  lock explícito (`SELECT ... FOR UPDATE` sobre una fila centinela) que añade complejidad
  y contención para un caso ya protegido por el índice único de Postgres; el objetivo de
  este change es que la carrera sea inofensiva, no imposible.
