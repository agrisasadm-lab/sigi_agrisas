## 1. Documentación de entorno

- [x] 1.1 Agregar `RBAC_DEFAULT_ROLE=viewer` con comentario a `.env.example`
- [x] 1.2 Agregar `VERCEL_ENV` comentado a `.env.example`

## 2. Eliminación de código muerto (backend)

- [x] 2.1 Eliminar método `UserMapper.toPersistence()` de `src/modules/auth/application/mappers/UserMapper.ts`
- [x] 2.2 Eliminar función async `checkAndNotifyLowStock` e interfaz `CheckAndNotifyLowStockInput` de `src/shared/domain/services/checkAndNotifyLowStock.ts`
- [x] 2.3 Eliminar export `rfcSchema` de `src/shared/infrastructure/http/validators.ts`
- [x] 2.4 Eliminar archivo `src/modules/rbac/application/ports/UserRoleReader.ts`
- [x] 2.5 Eliminar archivo `src/modules/rbac/infrastructure/services/PrismaUserRoleReader.ts`
- [x] 2.6 Limpiar `src/modules/rbac/infrastructure/di/container.ts`: eliminar import `PrismaUserRoleReader` y key `userRoleReader` de `rbacContainer`
- [x] 2.7 Actualizar `tests/unit/modules/shared/domain/services/checkAndNotifyLowStock.test.ts`: eliminar describe block de `checkAndNotifyLowStock` e import
- [x] 2.8 Actualizar `tests/unit/modules/auth/application/mappers/UserMapper.test.ts`: eliminar test de `toPersistence` e import de `User`

## 3. Consolidación de clases de error en shared

- [x] 3.1 Crear `src/shared/domain/errors/BranchScopeViolationError.ts` (mensaje: `"Branch scope violation"`)
- [x] 3.2 Reemplazar clase en `src/shared/domain/errors/facturama.ts` por re-export desde `BranchScopeViolationError.ts`
- [x] 3.3 Reemplazar `src/modules/payments/domain/errors/BranchScopeViolationError.ts` por re-export desde shared
- [x] 3.4 Crear `src/shared/domain/errors/ProviderNotFoundOrInactiveError.ts`
- [x] 3.5 Reemplazar `src/modules/departments/domain/errors/ProviderNotFoundOrInactiveError.ts` por re-export
- [x] 3.6 Reemplazar `src/modules/purchases/domain/errors/ProviderNotFoundOrInactiveError.ts` por re-export
- [x] 3.7 Crear `src/shared/domain/errors/EmailAlreadyInUseError.ts`
- [x] 3.8 Crear `src/shared/domain/errors/UserNotFoundError.ts`
- [x] 3.9 Reemplazar los 4 archivos de módulo (`auth` + `users`) por re-exports hacia shared
- [x] 3.10 Simplificar imports en `src/modules/auth/infrastructure/http/AuthController.ts`: eliminar aliases duplicados (`AuthUserNotFoundError`, `UsersEmailAlreadyInUseError`)

## 4. Formatter de moneda — app/_lib/

- [x] 4.1 Crear `app/_lib/formatMxCurrency.ts` con `Intl.NumberFormat("es-MX", MXN, 2 decimales)`
- [x] 4.2 Convertir `app/(private)/pos/_logic/lib/formatMxCurrency.ts` en re-export de `_lib/`
- [x] 4.3 Reemplazar 58 instancias inline de `Intl.NumberFormat("es-MX", MXN)` en los 38 archivos `_blocks` (billing, payments, purchases, returns, expenses, reports)
- [x] 4.4 Verificar: `grep -rn 'Intl.NumberFormat.*es-MX' app/` retorna 0 líneas fuera de `_lib/`

## 5. Formatter de fechas — app/_lib/ con America/Mexico_City

- [x] 5.1 Crear `app/_lib/formatDate.ts` con helpers: `fmtDateShort`, `fmtDateLong`, `fmtDateTimeShort`, `fmtDateTimeLong`, `fmtDateTimeMedium`, `fmtDateOnly`
- [x] 5.2 `fmtDateOnly` extrae componentes UTC del ISO string (sin conversión de timezone) para campos `@db.Date`
- [x] 5.3 Reemplazar ~21 instancias inline de `Intl.DateTimeFormat("es-MX")` en archivos `_blocks` (waybills, payments, purchases, sales, quotes, expenses, reports)
- [x] 5.4 Migrar `InventoryTable.tsx` de `DATE_FMT` inline a `fmtDateOnly`
- [x] 5.5 Actualizar `app/(private)/billing/_logic/lib/formatInvoiceDate.ts` para usar helpers de `_lib/`
- [x] 5.6 Verificar: `grep -rn 'Intl.DateTimeFormat.*es-MX' app/` retorna 0 líneas fuera de `_lib/`

## 6. Verificación final

- [x] 6.1 `npm run build` pasa sin errores nuevos
- [x] 6.2 `npm test` pasa — 575/577 suites, 4262/4276 tests (2 suites + 14 tests skipped son pre-existentes)
- [x] 6.3 Errores de `tsc` restantes confirmados pre-existentes: stale Prisma client (`folioBranchCounter`, `branches` en CustomerInclude), test fixture mismatches — ninguno en archivos modificados por este change
