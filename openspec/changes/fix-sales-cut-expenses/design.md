## Context

`SalesCutAssembler` (dominio puro) calcula `netCash = grossSales + paymentsReceived − returnsRefunded` a partir de `SalesCutAggregates`, que llena `PrismaSalesCutRepository` con un `aggregate` por fuente (`sale`, `customerPayment`, `return`). Los gastos (`expenses`: `branchId`, `amount Decimal(14,4)`, `expenseDate @db.Date`, `isActive`) no participan, así que el neto sobreestima el efectivo. Responde a la fila 1 de la Historia de Usuario del proposal.

Restricciones: arquitectura hexagonal (dominio sin Prisma), el repo de reports ya consulta tablas de otros módulos directo para evitar ciclos de DI, montos en `Decimal` (banker's rounding, escala 4), branch scoping transversal.

## Goals / Non-Goals

**Goals:**
- Restar gastos activos de la sucursal y el rango al `netCash`, y exponer `cash.expensesTotal` (API, UI, PDF, XLSX).
- Mantener sin cambios la query, permisos y branch scoping del endpoint.

**Non-Goals:**
- Reporte `cash-cut` (cobranza).
- Filtrar gastos por cajero o método de pago (no existen en `expenses`).
- Zona horaria (todo sigue en UTC).
- Desglose de gastos por concepto en el corte.

## Decisions

1. **Agregado en `PrismaSalesCutRepository` con `prisma.expense.aggregate`** (`_sum.amount`, `_count`), en el mismo `Promise.all` que los demás agregados. Alternativa descartada: reutilizar `ExpenseRepository.findHistory` — hace `findMany` + `count` + joins innecesarios para una suma y acopla reports a otro módulo (riesgo de ciclo de DI, ver comentario en `reports/infrastructure/di/container.ts`). El patrón ya existe para `customerPayment` y `return`.
2. **Filtro de gastos**: `isActive: true`, `branchId` vía el mismo `branchWhere` de los otros agregados (cubre branch scoping, criterio de seguridad 2), `expenseDate: { gte: from, lte: to }`. `expenseDate` es `DATE`, por lo que `from`/`to` a medianoche UTC bastan; no se usa `endOfDay`. Los filtros `cashierId`/`paymentMethodId` no se aplican (decisión del usuario, igual que abonos y devoluciones).
3. **Dominio**: `SalesCutAggregates` agrega `expenses: { count: number; total: number }` (igual que `PaymentsAgg`/`ReturnsAgg`; el DTO lo formatea a string con `money`). `SalesCutAssembler` hace `netCash = grossSales + paymentsReceived − returnsRefunded − expensesTotal` con `Decimal` (criterio de seguridad 3, sin float) y devuelve `cash.expensesTotal`. Campo aditivo en el DTO: clientes existentes no se rompen.
4. **Seguridad**: sin permisos nuevos; el endpoint sigue exigiendo `reports:sales_cut_read` y `resolveScopedBranchId` (un operador sólo suma gastos de su sucursal). Operación de sólo lectura (criterio 4).
5. **Presentación**: `NetCashCard` agrega la línea "− Gastos" entre Devoluciones y Neto, con primitivas/tokens del design system (`designer.md`). PDF (`SalesCutReportPdf`) y XLSX (`buildSalesCutWorkbook`) agregan la fila "Gastos" en el bloque de neto. Se revisa la condición de "hay datos" en `SalesCutPage` para que un periodo con sólo gastos no se muestre vacío.
6. **Fixtures**: `InMemorySalesCutRepository` recibe un cuarto parámetro `expenses: InMemCutExpense[] = []` para no romper llamadores existentes.

## Risks / Trade-offs

- [Consultas históricas cambian de valor (neto baja)] → Esperado por el fix; documentado como **BREAKING (valores)** en el proposal y se comunica al usuario.
- [Con filtro de cajero/método, se restan gastos de toda la sucursal a un neto parcial] → Decisión explícita del usuario; queda en el spec como escenario.
- [Gasto de fecha local puede caer en día UTC adyacente] → Fuera de alcance, consistente con el resto del reporte (todo UTC).
- [Sobrecosto de una query extra] → Un `aggregate` indexado por `branchId` y `expenseDate` (índices existentes), en paralelo con los demás.

## Migration Plan

Sin migraciones de BD ni flags. Deploy normal; rollback = revert del commit (el campo extra del DTO es aditivo). Verificación contra dev/test (`qzzjpyepggwautckqeex`), no prod.

## Open Questions

Ninguna pendiente.
