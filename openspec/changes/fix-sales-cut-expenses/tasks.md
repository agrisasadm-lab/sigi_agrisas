## 1. Dominio

- [x] 1.1 Agregar `expenses: { count: number; total: number }` a `SalesCutAggregates` en `src/modules/reports/domain/value-objects/SalesCutFilters.ts`
- [x] 1.2 Test rojo en `tests/unit/modules/reports/domain/SalesCutAssembler.test.ts`: neto con gastos (1000 + 300 − 120 − 50 = 1130), gastos 0, sin drift decimal
- [x] 1.3 `SalesCutAssembler`: restar `expenses.total` con `Decimal` y devolver `cash.expensesTotal`

## 2. Repositorios y use case

- [x] 2.1 `InMemorySalesCutRepository`: tipo `InMemCutExpense` y cuarto parámetro `expenses = []`; filtra por `isActive`, `branchId` y rango de `expenseDate`
- [x] 2.2 Tests rojos en `GetSalesCutReportUseCase.test.ts`: gastos activos restan; inactivos, otra sucursal y fuera de rango no; filtro cajero/método no excluye gastos
- [x] 2.3 `PrismaSalesCutRepository`: `prisma.expense.aggregate` (`_sum.amount`, `_count`) con `isActive: true`, `branchWhere` y `expenseDate: { gte: from, lte: to }` dentro del `Promise.all` existente
- [x] 2.4 `SalesCutReportResponseDto` (bloque `cash`) y `GetSalesCutReportUseCase`: exponer `expensesTotal`

## 3. HTTP y exportaciones

- [x] 3.1 Actualizar `ReportsController.test.ts` (fixture `emptySalesCutUseCase`, assert `body.cash.expensesTotal` y `netCash`) y confirmar que el controller propaga el DTO sin cambios de query
- [x] 3.2 `SalesCutReportPdf.tsx`: fila "− Gastos" antes de "Neto de caja"
- [x] 3.3 `buildSalesCutWorkbook.ts`: fila "Gastos" en la hoja "Totales" antes del neto, con test en `tests/unit/modules/reports/infrastructure/xlsx/buildSalesCutWorkbook.test.ts`

## 4. UI

- [x] 4.1 `app/(private)/reports/sales-cut/_logic/types/api.ts` y `domain.ts`: campo `expensesTotal` en `cash`
- [x] 4.2 Actualizar fixtures de `SalesCutPage.test.tsx` y test de `NetCashCard` para la línea "− Gastos"
- [x] 4.3 `NetCashCard.tsx`: línea "− Gastos" entre Devoluciones y Neto (primitivas y tokens de `designer.md`); revisar la condición de "hay datos" en `SalesCutPage.tsx`

## 5. Verificación

- [x] 5.0 Test de `PrismaSalesCutRepository` (where de gastos: `isActive`, sucursal, rango, sin cajero/método) en `tests/unit/modules/reports/infrastructure/repositories/PrismaSalesCutRepository.test.ts`

- [x] 5.1 `npx jest tests/unit/modules/reports tests/unit/ui` y `tests/unit/ui/design-system/tokens.test.ts` en verde
- [x] 5.2 `npm run build` en verde (Node 20.20.2; Node 18.0.0 del entorno es menor al mínimo de Next)
- [x] 5.2b `npm test` completo con DB dev accesible: 4354/4368 verdes (14 skipped); único fallo fue `Input.test.tsx` por SIGSEGV de worker jest, confirmado flaky al reintentar aislado (2/2 verde)
- [x] 5.3 Manual con Playwright en dev/test: venta $110.00 + gasto $30.00 mismo día (2026-10-28) y sucursal (Matriz) en `qzzjpyepggwautckqeex`; `/reports/sales-cut` muestra "− Gastos $30.00" y "Neto $80.00"; PDF y XLSX exportados muestran la fila Gastos/−Gastos antes del Neto; soft-delete del gasto recupera el neto a $110.00
- [x] 5.3b Branch scoping de gastos (escenario adicional, spec "Branch scoping de gastos"): venta $75.00 + gasto activo $15.00 en PRADERA, gasto de Matriz ya inactivo. Filtro Matriz → Ventas $110.00, Gastos $0.00, Neto $110.00 (gasto de PRADERA no se filtra); filtro PRADERA → Ventas $75.00, Gastos $15.00, Neto $60.00; filtro "Todas" → Ventas $185.00, Gastos $15.00 (sólo el activo de PRADERA), Neto $170.00
- [x] 5.4 `opsx:verify`; no archivar sin indicación explícita del usuario
