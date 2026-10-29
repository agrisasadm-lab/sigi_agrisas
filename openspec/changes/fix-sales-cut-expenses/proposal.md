## Historia de Usuario

| # | Rol | Tarea | Motivo | Criterios de Aceptación | Criterios de Seguridad |
|---|---|---|---|---|---|
| 1 | Administrador / Operador con `reports:sales_cut_read` | Como administrador u operador, quiero que el corte de ventas reste los gastos activos de la sucursal al neto de caja para ver el efectivo realmente disponible | Evitar que el neto de caja quede sobreestimado y se descuadre contra el efectivo físico | - Given ventas, abonos, devoluciones y gastos activos en sucursal y rango, When consulto el corte, Then `netCash = ventas + abonos − devoluciones − gastos`<br>- Gastos con `isActive=false`, de otra sucursal o fuera de rango no restan<br>- Sin gastos, el neto es igual al actual (`expensesTotal = 0`)<br>- Con filtro cajero/método de pago los gastos de la sucursal se restan igual<br>- UI, PDF y XLSX muestran la línea "− Gastos" antes del Neto | - Reutiliza `reports:sales_cut_read`; sin permisos nuevos<br>- Branch scoping vía `resolveScopedBranchId`: un operador sólo suma gastos de su sucursal<br>- Sumas en `Decimal`, sin float<br>- Sólo lectura, sin mutación de datos |

## Why

El corte de ventas (`/reports/sales-cut`) calcula el "Neto de caja" como `grossSales + paymentsReceived − returnsRefunded` (`SalesCutAssembler`). El módulo `expenses` (gastos pagados en efectivo desde caja) nunca entra en la fórmula, por lo que el neto reportado es mayor al efectivo real y no cuadra al cierre. Se corrige ahora porque los gastos ya están en producción (`add-expenses-api`/`add-expenses-ui` archivados) y el corte es la referencia de cierre diario.

## What Changes

- `netCash = grossSales + paymentsReceived − returnsRefunded − expensesTotal`.
- Nuevo agregado `expenses { count, total }` en `SalesCutAggregates`: suma de `expenses.amount` con `isActive = true`, mismo `branchId` del corte y `expenseDate` dentro de `[from, to]`.
- Los gastos ignoran los filtros `cashierId` y `paymentMethodId` (no tienen cajero ni método); se filtran sólo por sucursal y fechas, igual que abonos y devoluciones.
- La respuesta del endpoint expone `cash.expensesTotal`.
- UI (`NetCashCard`), PDF (`SalesCutReportPdf`) y XLSX (`buildSalesCutWorkbook`) muestran la línea "− Gastos" antes de "Neto".
- **BREAKING (valores)**: el `netCash` de consultas históricas baja si existen gastos en el rango. Sin cambio de contrato en query params; el campo nuevo es aditivo.

## Capabilities

### New Capabilities
<!-- Ninguna -->

### Modified Capabilities
- `sales-cut-api`: el requirement "Cash net composition" pasa a incluir gastos activos en la fórmula del neto y expone `cash.expensesTotal`.

## Impact

- Backend `src/modules/reports/`: `SalesCutFilters.ts` (VO), `SalesCutAssembler.ts`, `PrismaSalesCutRepository.ts`, `InMemorySalesCutRepository.ts`, `SalesCutReportResponseDto.ts`, `GetSalesCutReportUseCase.ts`, `SalesCutReportPdf.tsx`, `buildSalesCutWorkbook.ts`.
- UI `app/(private)/reports/sales-cut/`: `_logic/types/api.ts`, `domain.ts`, `_blocks/NetCashCard.tsx`.
- Datos: lectura de la tabla `expenses` desde el repositorio de reports (acceso directo vía Prisma, igual que `customer_payments` y `returns`); sin migraciones.
- Tests: assembler, use case, controller, `SalesCutPage`/`NetCashCard`.
- Fuera de alcance: reporte `cash-cut` (cobranza), zona horaria (todo UTC).
