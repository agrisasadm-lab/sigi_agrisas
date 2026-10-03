## 1. Prisma y base de datos

- [x] 1.1 Agregar modelo `Expense` a `prisma/schema.prisma` (campos `concept`, `amount` `@db.Decimal(14,4)`, `notes?`, `photoUrl?`, `expenseDate` `@db.Date`, `branchId` (TEXT, FK a `Branch`), `creatorId` (`@db.Uuid`, FK a `User`), `isActive`, `createdAt`, `updatedAt`, índices `branchId`/`expenseDate`)
- [x] 1.2 Correr `npx prisma migrate dev --name add_expenses_table` y revisar el SQL generado
- [x] 1.3 `npx prisma generate`
- [ ] 1.4 Crear bucket Supabase Storage `expense-photos` (política equivalente a `product-images`) — **bloqueado**: faltan `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` en `.env.local` (tampoco están seteadas para `product-images`, gap preexistente). Requiere que el usuario las agregue o cree el bucket manualmente desde el dashboard de Supabase (proyecto dev `qzzjpyepggwautckqeex`).

## 2. Dominio (`src/modules/expenses/domain/`)

- [x] 2.1 Entidad `Expense` (`domain/entities/Expense.ts`) con factory `.create(id, props)`, todo readonly
- [x] 2.2 Errores de dominio: `ExpenseNotFoundError`, `ExpenseInvalidAmountError`

## 3. Aplicación (`src/modules/expenses/application/`)

- [x] 3.1 Puerto `ExpenseRepository` (`application/ports/ExpenseRepository.ts`) — `create`, `findById`, `findAll` (con filtros fecha/concepto/sucursal + paginación), `update`, `updatePhotoUrl`, `softDelete`, `findHistory` (para reporte, paginación opcional)
- [x] 3.2 Puerto `ExpensePhotoStoragePort` (`application/ports/ExpensePhotoStoragePort.ts`) — `upload(id, buffer, mime, ext)`, `delete(url)`
- [x] 3.3 DTO `ExpenseDto` + mapper `toExpenseDto`
- [x] 3.4 `CreateExpenseUseCase` — valida `amount > 0`, resuelve `branchId`/`creatorId`, persiste
- [x] 3.5 `GetExpenseUseCase` / `ListExpensesUseCase`
- [x] 3.6 `UpdateExpenseUseCase` — rechaza body vacío (vía Zod `.refine` en el controller), aplica diff
- [x] 3.7 `SoftDeleteExpenseUseCase` — idempotencia: 404 si ya inactivo
- [x] 3.8 `UploadExpensePhotoUseCase` — valida MIME (`jpeg`/`png`/`webp`), `MAX_BYTES=2MB`, borra foto previa (best-effort), persiste `photoUrl`
- [x] 3.9 `DeleteExpensePhotoUseCase` — idempotente si ya no hay foto
- [x] 3.10 `GetExpensesReportUseCase` — pagina en modo JSON; `forPdf=true` trae dataset completo sin paginar; marca `tooLarge` si `total > 10_000`

## 4. Infraestructura — persistencia y storage

- [x] 4.1 `PrismaExpenseRepository` — implementa el puerto, traduce errores Prisma (`isPrismaNotFoundError`→404)
- [x] 4.2 `InMemoryExpenseRepository` (para tests de use cases)
- [x] 4.3 `SupabaseExpensePhotoStorage` — bucket `"expense-photos"`, key `expenses/${id}/${randomUUID()}.${ext}`, usa `getPublicUrl` (código listo; requiere el bucket de 1.4 para funcionar en runtime)
- [x] 4.4 `InMemoryExpensePhotoStorage` (para tests)

## 5. Infraestructura — reporte (PDF/XLSX)

- [x] 5.1 `ExpensesReportPdf.tsx` (`infrastructure/pdf/`) con `@react-pdf/renderer`, reusa `PdfLogo`/`PdfIssuer` de `src/shared/infrastructure/pdf/` (lista flat, patrón `KardexReportPdf` — no hay agrupación por entidad padre)
- [x] 5.2 `buildExpensesReportWorkbook.ts` (`infrastructure/xlsx/`)

## 6. Infraestructura — HTTP

- [x] 6.1 `ExpensesController` (`infrastructure/http/ExpensesController.ts`) — Zod schemas `createBodySchema`/`updateBodySchema` (`.refine` ≥1 campo)/`listQueryFiltersSchema`/`historyQuerySchema` (`format: json|pdf|xlsx`), métodos `list/getById/create/update/softDelete/uploadPhoto/deletePhoto/report`, usa `mapDomainError`
- [x] 6.2 DI: `infrastructure/di/container.ts` → instancia repos/storage → use cases → exporta `expensesController`

## 7. Rutas Next.js (`app/api/v1/admin/expenses/`)

- [x] 7.1 `route.ts` — `GET` (`expenses:read`) / `POST` (`expenses:write`, orden Zod→enforceBranchScope→use case)
- [x] 7.2 `[id]/route.ts` — `GET` (`expenses:read`) / `PATCH` (`expenses:write`) / `DELETE` (`expenses:write`), `enforceBranchScope` cargando el recurso primero (vía `getUseCase`)
- [x] 7.3 `[id]/photo/route.ts` — `POST`/`DELETE` (`expenses:write`), `req.formData()` + `Buffer.from(await file.arrayBuffer())`
- [x] 7.4 `report/route.ts` — `GET` (`expenses:report_read`), delega a `expensesController.report(req)`

## 8. RBAC

- [x] 8.1 Agregar `expenses:read`, `expenses:write`, `expenses:report_read` a `PERMISSIONS` en `prisma/seed.ts`
- [x] 8.2 Asignar `admin`+`operator` a los tres permisos; `viewer` sólo a `expenses:read`+`expenses:report_read`
- [x] 8.3 Correr `npm run seed` localmente y verificar idempotencia (corrido dos veces, sin duplicados)

## 9. Tests

- [x] 9.1 `tests/unit/modules/expenses/` — tests de cada use case con `InMemoryExpenseRepository`/`InMemoryExpensePhotoStorage`, cubriendo cada escenario de `specs/expenses-api/spec.md`
- [x] 9.2 Test de `UploadExpensePhotoUseCase` para MIME inválido y tamaño excedido
- [x] 9.3 Test de `GetExpensesReportUseCase` para el caso `tooLarge`
- [ ] 9.4 `npm test` completo en verde — **parcial**: todos los tests unitarios pasan 100% (3946/3946, incluidos 36 tests nuevos de `ExpensesController.test.ts` agregados en `/opsx:verify`). 75 tests fallan en `tests/integration/` (real DB) por un `Null constraint violation` preexistente en `productPrice.branch_id` (módulo `products`/`pos`, no tocado por este change) — no relacionado a `expenses`. Requiere investigación aparte del estado de la DB dev.
- [x] 9.5 `npm run build` sin errores de tipos
- [x] 9.6 (`/opsx:verify` fixes) Validación de `from`/`to` en `listQueryFiltersSchema`/`historyQuerySchema` (`ExpensesController.ts`) — antes aceptaban cualquier string y una fecha malformada producía un `RangeError` no capturado (500) en vez del 400 documentado en la spec. Se agregó `isoDateQuerySchema` con `.refine(!isNaN(Date.parse(v)))`.
- [x] 9.7 (`/opsx:verify` fixes) `tests/unit/modules/expenses/infrastructure/http/ExpensesController.test.ts` — 36 tests nuevos cubriendo validación Zod, `enforceBranchScope` (403), `resolveScopedBranchId`, subida/borrado de foto vía `FormData` (400/413/404), reporte JSON/PDF/XLSX y `ReportTooLarge`, siguiendo el patrón de `ReturnsController.test.ts`/`PaymentsController.test.ts`.
- [x] 9.8 (`/opsx:verify` fix) `specs/expenses-api/spec.md` — corregido el status code del escenario "Desactivación exitosa" de 200 a 204 (el código ya devolvía 204, correcto y consistente con `DepartmentsController`/`ProvidersController`; el error estaba en el texto de la spec).
