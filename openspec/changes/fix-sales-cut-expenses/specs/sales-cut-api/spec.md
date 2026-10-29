## MODIFIED Requirements

### Requirement: Cash net composition
El corte SHALL calcular `cash.netCash = grossSales + paymentsReceived − returnsRefunded − expensesTotal`, exponiendo los cuatro componentes en `cash`. `paymentsReceived` SHALL ser `Σ customer_payments.amount` con `status='completed'` y `createdAt` en el periodo; `returnsRefunded` SHALL ser `Σ returns.refundTotal` con `status='completed'` y `returnedAt` en el periodo; `expensesTotal` SHALL ser `Σ expenses.amount` con `isActive=true`, `branchId` igual a la sucursal del corte (branch scoping) y `expenseDate` dentro de `[from, to]`. Abonos y devoluciones `cancelled` SHALL NO contar; gastos inactivos (soft-deleted), de otra sucursal o fuera del rango SHALL NO contar. Los gastos SHALL NO verse afectados por los filtros `cashierId` ni `paymentMethodId` (se filtran sólo por sucursal y fechas, igual que abonos y devoluciones). Las sumas SHALL realizarse con `Decimal`, sin aritmética de punto flotante. Sin gastos en el periodo, `expensesTotal` SHALL ser `"0.0000"` y `netCash` SHALL coincidir con el cálculo previo. La UI, el PDF y el XLSX SHALL mostrar la línea "− Gastos" entre las devoluciones y el neto de caja. El endpoint SHALL seguir exigiendo `reports:sales_cut_read`, sin permisos adicionales. (Traza: S2.)

#### Scenario: Neto de caja con abonos, devoluciones y gastos
- **GIVEN** ventas activas, abonos `completed`, devoluciones `completed` y gastos activos en la sucursal y el periodo
- **WHEN** se consulta el corte
- **THEN** `cash.netCash` = `grossSales + paymentsReceived − returnsRefunded − expensesTotal` y los cuatro componentes aparecen en `cash`

#### Scenario: Abonos y devoluciones cancelados
- **WHEN** existen abonos o devoluciones `cancelled` en el periodo
- **THEN** no se suman a `paymentsReceived` ni a `returnsRefunded`

#### Scenario: Gastos que no cuentan
- **GIVEN** gastos con `isActive=false`, de otra sucursal o con `expenseDate` fuera del periodo
- **WHEN** se consulta el corte
- **THEN** ninguno se suma a `expensesTotal` ni se resta de `netCash`

#### Scenario: Periodo sin gastos
- **WHEN** el periodo no tiene gastos activos en la sucursal
- **THEN** `cash.expensesTotal` es `"0.0000"` y `cash.netCash` es igual a `grossSales + paymentsReceived − returnsRefunded`

#### Scenario: Gastos con filtro de cajero o método de pago
- **GIVEN** el corte filtrado por `cashierId` o `paymentMethodId`
- **WHEN** hay gastos activos de la sucursal en el periodo
- **THEN** `expensesTotal` incluye todos los gastos de la sucursal, sin aplicar esos filtros

#### Scenario: Branch scoping de gastos
- **GIVEN** un usuario sin `branches:access_all`
- **WHEN** consulta el corte
- **THEN** sólo se suman los gastos de su propia sucursal

#### Scenario: Línea de gastos en UI, PDF y XLSX
- **WHEN** se visualiza o exporta el corte (UI, `?format=pdf`, `?format=xlsx`)
- **THEN** el bloque de neto de caja muestra la línea "− Gastos" con `expensesTotal` antes del neto
