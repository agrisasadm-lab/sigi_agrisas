## Historia de Usuario

| # | Rol | Tarea | Motivo | Criterios de Aceptación | Criterios de Seguridad |
|---|---|---|---|---|---|
| 1 | Ingeniero de software | Como ingeniero, quiero eliminar símbolos y archivos sin consumidores (`UserMapper.toPersistence`, `checkAndNotifyLowStock` async, `rfcSchema`, `UserRoleReader` port+impl+DI) para reducir superficie de mantenimiento | Código muerto introduce ruido cognitivo y puede ser invocado accidentalmente creyendo que tiene efecto real | - `tsc --noEmit` pasa sin errores nuevos<br>- `grep` sobre `src/` no encuentra referencia a los símbolos eliminados<br>- Tests que cubrían los símbolos eliminados también actualizados | - Sin impacto de permisos — ningún símbolo eliminado participaba en flujos de auth activos |
| 2 | Ingeniero de software | Como ingeniero, quiero consolidar `BranchScopeViolationError`, `ProviderNotFoundOrInactiveError`, `EmailAlreadyInUseError` y `UserNotFoundError` en `src/shared/domain/errors/` con re-exports en cada módulo para garantizar que `instanceof` funcione correctamente entre límites de módulo | Clases duplicadas por nombre hacen que `instanceof` falle cuando el error se lanza desde un módulo y se captura en otro | - Módulos afectados re-exportan desde shared sin romper imports existentes<br>- `AuthController` usa una sola importación de cada clase sin alias duplicados<br>- `grep` no encuentra más de una definición de clase por nombre de error<br>- `tsc --noEmit` limpio | - `BranchScopeViolationError` protege branch scoping multi-sucursal — no alterar message ni name de clase |
| 3 | Ingeniero de software | Como ingeniero, quiero mover `formatMxCurrency` a `app/_lib/` y reemplazar las 58 instancias inline de `Intl.NumberFormat("es-MX", MXN)` para tener un único punto de configuración del formatter de moneda | Instancias inline dispersas impiden cambiar la presentación sin búsqueda-reemplazo global propenso a omisiones | - `app/_lib/formatMxCurrency.ts` existe y exporta `formatMxCurrency`<br>- POS re-exporta desde `_lib` (compatibilidad)<br>- `grep -rn 'Intl.NumberFormat.*es-MX' app/` retorna 0 líneas fuera de `_lib` | - Sin impacto de permisos; formatter presentacional puro |
| 4 | Ingeniero de software | Como ingeniero, quiero crear `app/_lib/formatDate.ts` con `timeZone: "America/Mexico_City"` y reemplazar todas las instancias inline de `Intl.DateTimeFormat("es-MX")` para estandarizar la presentación de fechas a UTC-6 | Instancias inline usaban timezones inconsistentes — usuarios en México ven fechas incorrectas entre módulos | - `app/_lib/formatDate.ts` exporta 6 helpers incluyendo `fmtDateOnly` para campos `@db.Date`<br>- `grep -rn 'Intl.DateTimeFormat.*es-MX' app/` retorna 0 líneas fuera de `_lib`<br>- `InventoryTable` usa `fmtDateOnly` para no mostrar día anterior en UTC-6 | - Fechas en documentos fiscales (billing, waybills) usan ISO strings hacia Facturama — no afectadas |
| 5 | Ingeniero de software | Como ingeniero, quiero documentar `RBAC_DEFAULT_ROLE` y `VERCEL_ENV` en `.env.example` para evitar crashes en nuevos deploys | `RBAC_DEFAULT_ROLE` es requerida en startup — su ausencia lanza excepción en el primer registro de usuario | - `.env.example` contiene `RBAC_DEFAULT_ROLE=viewer` con comentario<br>- `.env.example` contiene `VERCEL_ENV` comentado<br>- Developer que clone el repo puede registrar usuario sin crash | - Documentar con valor seguro `viewer`, no `admin` |

## Why

Durante una auditoría QA de la versión en producción se identificaron cinco categorías de deuda técnica acumulada: (1) símbolos exportados que ningún consumidor importa, creando ruido y riesgo de invocación accidental; (2) clases de error definidas por nombre idéntico en múltiples módulos, lo que rompe `instanceof` silenciosamente cuando el error cruza límites de módulo — bug latente real en el flujo `payments ↔ billing`; (3) 58 instancias inline de `Intl.NumberFormat("es-MX", MXN)` dispersas en 38 archivos sin punto único de configuración; (4) ~21 instancias inline de `Intl.DateTimeFormat("es-MX")` con timezones inconsistentes (algunas sin timezone, algunas `"UTC"`) que producen presentaciones incorrectas para usuarios en México; (5) variables de entorno requeridas ausentes de `.env.example` que provocan crash en startup.

## What Changes

- **Código muerto eliminado**: `UserMapper.toPersistence()`, función async `checkAndNotifyLowStock`, export `rfcSchema`, archivos `UserRoleReader` port + `PrismaUserRoleReader` impl, key `userRoleReader` del DI container de rbac
- **Errores consolidados en shared**: `BranchScopeViolationError`, `ProviderNotFoundOrInactiveError`, `EmailAlreadyInUseError`, `UserNotFoundError` — cada módulo mantiene su archivo como re-export hacia `src/shared/domain/errors/`
- **Formatter de moneda unificado**: `app/_lib/formatMxCurrency.ts` como fuente canónica; POS re-exporta; 58 instancias inline reemplazadas
- **Formatters de fecha unificados**: `app/_lib/formatDate.ts` con `timeZone: "America/Mexico_City"` (5 variantes + `fmtDateOnly` para campos `@db.Date`); ~21 instancias inline reemplazadas; `InventoryTable` migrado a `fmtDateOnly`
- **`.env.example` actualizado**: `RBAC_DEFAULT_ROLE=viewer` y `VERCEL_ENV` documentados

## Capabilities

### New Capabilities

_(ninguna — refactor puro sin endpoints ni comportamiento nuevo)_

### Modified Capabilities

_(ninguna — ninguna spec existente cambia requisitos de comportamiento observable)_

> **`skip_specs: true`** aplica: este cambio es refactor puro de implementación. No modifica contratos de API, validaciones, reglas de negocio, ni comportamiento observable por el usuario final.

## Impact

- **Backend**: `src/shared/domain/errors/` (4 archivos nuevos), `src/modules/rbac/`, `src/modules/auth/`, `src/modules/users/`, `src/modules/departments/`, `src/modules/purchases/`, `src/modules/payments/`, `src/modules/billing/`, `src/modules/waybills/`, `src/shared/infrastructure/http/validators.ts`, `src/shared/domain/services/checkAndNotifyLowStock.ts`, `src/modules/auth/application/mappers/UserMapper.ts`
- **Frontend**: `app/_lib/formatMxCurrency.ts` (nuevo), `app/_lib/formatDate.ts` (nuevo), `app/(private)/pos/_logic/lib/formatMxCurrency.ts` (re-export), 60+ archivos `_blocks` de billing, payments, purchases, returns, expenses, reports, sales, quotes, waybills, inventory
- **Tests**: eliminados bloques `toPersistence` y `checkAndNotifyLowStock` en sus respectivos test files
- **Config**: `.env.example`
- **Sin impacto**: endpoints de API, schema Prisma, comportamiento de negocio, permisos RBAC
