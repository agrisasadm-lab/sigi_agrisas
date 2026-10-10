## 1. Helper compartido de detección de errores Prisma

- [x] 1.1 Extender `isPrismaUniqueError(err, target?)` en `src/shared/infrastructure/prisma/errors.ts` para reconocer, además de `P2002` (rama existente), el caso `P2010` + `meta.code === "23505"` + `meta.message` conteniendo `target` (INSERT crudo vía `$executeRaw`). No cambiar la firma ni el comportamiento de la rama `P2002` existente.
- [x] 1.2 Agregar tests nuevos en `tests/unit/modules/shared/infrastructure/prisma/errors.test.ts` para la rama `P2010`/`23505` (match con `target`, no-match sin `target` presente en el mensaje, `P2010` sin `meta.code==="23505"` no hace match). Confirmar que los tests existentes de la rama `P2002` siguen pasando sin modificarlos.

## 2. PrismaSaleRepository — idempotencia bajo concurrencia

- [x] 2.1 En `src/modules/pos/infrastructure/repositories/PrismaSaleRepository.ts`, envolver el `this.prisma.$transaction(...)` de `createCompleted` en `try/catch`: si `data.clientRequestId` es truthy y `isPrismaUniqueError(err, "client_request_id")`, llamar `this.findByClientRequestId(data.clientRequestId)` y, si existe, retornarlo (saltando `fireLowStockNotifications`); en cualquier otro caso, re-lanzar el error original.
- [x] 2.2 Aplicar el mismo patrón a `createCompletedFromQuote` en el mismo archivo.
- [x] 2.3 Verificar manualmente que `lowStockSignals`/`fireLowStockNotifications` no se ejecutan en el camino de recuperación por conflicto (lectura de código, no solo test — confirmar que el `return` temprano ocurre antes de esa llamada).

## 3. PrismaQuoteRepository — idempotencia bajo concurrencia

- [x] 3.1 En `src/modules/quotes/infrastructure/repositories/PrismaQuoteRepository.ts`, envolver el `this.prisma.$transaction(...)` de `createWithItems` en `try/catch` con el mismo patrón: si `data.clientRequestId` es truthy y `isPrismaUniqueError(err, "client_request_id")` (ahora cubre `P2010`/`23505` del INSERT crudo), llamar `this.findByClientRequestId(data.clientRequestId)` y retornarlo si existe; de lo contrario, re-lanzar.

## 4. Tests de integración — carrera real contra DB de test

- [x] 4.1 Crear `tests/integration/modules/pos/sales-idempotent-conflict.test.ts`: invocar `PrismaSaleRepository.createCompleted` dos veces con el mismo `clientRequestId` y payload completo y válido (branch/customer/paymentMethod/folio/items reales en DB de test) — primero secuencialmente (confirmar que la segunda llamada devuelve la misma venta sin lanzar) y luego en paralelo real (`Promise.all` de dos llamadas con el mismo `clientRequestId` sobre payloads idénticos) para forzar la ventana de carrera contra el constraint único. Verificar: ambas resoluciones devuelven el mismo `id`/`folioNumber`; sólo existe 1 fila en `sales` con ese `client_request_id`; sólo hay un movimiento de inventario (no doble decremento en `branch_inventory`).
- [x] 4.2 Crear `tests/integration/modules/quotes/quotes-idempotent-conflict.test.ts`: mismo patrón contra `PrismaQuoteRepository.createWithItems` — secuencial y paralelo real. Verificar: mismo `id`/`folioNumber`; sólo 1 fila en `quotes` con ese `client_request_id`; sin filas duplicadas en `quote_items`.

## 5. Verificación final

- [x] 5.1 Correr `npx tsc --noEmit` — confirmar que no se introducen errores nuevos (los 24 preexistentes de `tests/` documentados en `TECH_DEBT_CHECKLIST.md` §2 quedan fuera de este change).
- [x] 5.2 Correr la suite completa (`npm test`) y confirmar verde, incluyendo los tests nuevos de las secciones 1 y 4.
- [x] 5.3 Correr `vendor/bin/phpcs`-equivalente del proyecto (lint/eslint) sobre los archivos tocados si el flujo del repo lo exige antes de PR.
- [x] 5.4 Releer los escenarios nuevos en `openspec/changes/fix-idempotent-sale-quote-retry/specs/pos-api/spec.md` y `specs/quotes-api/spec.md` ("Concurrent duplicate clientRequestId resolved idempotently") y confirmar que cada uno quedó efectivamente cubierto por los tests de la sección 4 (trazabilidad escenario → test).
