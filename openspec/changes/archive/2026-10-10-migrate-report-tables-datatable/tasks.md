## 1. Tablas simples sin fila de totales (validan Decisión 3 de design.md)

- [x] 1.1 Migrar `app/(private)/reports/collections/_blocks/by-customer/ByCustomerTable.tsx` a `Table/THead/TBody/Tr/Th/Td`, incluyendo la fila "Sin cobranza" (`Td colSpan={4}`).
- [x] 1.2 Migrar `app/(private)/reports/collections/_blocks/by-customer/ByTicketTable.tsx` siguiendo el mismo patrón que 1.1.
- [x] 1.3 Migrar `app/(private)/reports/collections/_blocks/global/PaymentMethodBreakdownTable.tsx` siguiendo el mismo patrón que 1.1.
- [x] 1.4 Migrar `app/(private)/reports/sales-cut/_blocks/BreakdownTable.tsx` siguiendo el mismo patrón que 1.1.
- [x] 1.5 Migrar `app/(private)/reports/sales-cut/_blocks/SalesListTable.tsx` siguiendo el mismo patrón que 1.1.
- [x] 1.6 Migrar `app/(private)/reports/_blocks/SummaryTable.tsx` siguiendo el mismo patrón que 1.1 (revisar si tiene fila de totales antes de asumir que es "simple"; si la tiene, tratarla como 2.1). — No tiene fila de totales; sí tiene `onRowClick` por fila, resuelto con `hoverable={false}` + className custom en `Tr`.

## 2. Tabla con fila de totales (valida Decisión 2 de design.md)

- [x] 2.1 Migrar `app/(private)/reports/_blocks/LedgerTable.tsx`: `table/thead/tbody/tr/th/td` → `Table/THead/TBody/Tr/Th/Td`; conservar `<tfoot>` nativo envolviendo `Tr`/`Td` con `className` override para `border-t-2 border-outline-variant bg-surface-container font-medium`; preservar el botón nativo de imprimir anticipo, el chip de estado cancelado, la indentación de abonos (`border-l-2 border-l-primary/30`) y la fila "Abonos sin venta visible en el rango" (`Td colSpan={12}`).

## 3. Verificación visual manual (sin runner e2e automatizado en el repo)

- [x] 3.1 Con Playwright (`mcp__playwright__*`, nunca Claude-in-Chrome), comparar visualmente las páginas afectadas con datos reales del entorno dev:
  - `/reports/account-statements` → `SummaryTable` con 6 clientes: header tokenizado, hover por fila, click navega al detalle (`router.push`), columnas numéricas alineadas. ✓
  - `/reports/account-statements/[id]` → `LedgerTable` con 1 movimiento: tabla + fila de totales (`tfoot`, "1 movimientos") con el estilo `border-t-2 bg-surface-container`. ✓
  - `/reports/sales-cut` (rango 2026-01-01 a 2026-10-10) → 5 instancias de `BreakdownTable` (método de pago, día, cajero, departamento, producto con columna "Piezas") y `SalesListTable` con 16 tickets, verificado vía accessibility snapshot (16 filas, headers correctos). ✓
  - `/reports/collections` → entorno dev sin abonos previos. Se generó un abono de prueba real ($500 efectivo sobre la venta TC-000001, AGRISAS AGRISAS, vía `/sales/[id]` → "+ Registrar abono") para poblar las 3 tablas, y se revirtió inmediatamente con "Cancelar abono" (motivo: "Abono de prueba para verificación visual de migrate-report-tables-datatable, revertido") dejando la venta de vuelta en estado "Pendiente" — sin residuo en los datos dev. Con el abono activo se confirmó: pestaña "Global" → `PaymentMethodBreakdownTable` (fila "Efectivo", 1, $500.00); pestaña "Por Cliente" → `ByCustomerTable` (AGRISAS AGRISAS, CLIQA01, 1, $500.00) y sub-tab "Por Ticket" → `ByTicketTable` (TC-000001, AGRISAS AGRISAS, 1, $500.00). Header tokenizado y columnas numéricas alineadas a la derecha en las 3. ✓
- [x] 3.2 Confirmar que las columnas numéricas siguen alineadas a la derecha con `tabular-nums`: verificado visualmente en las 7 tablas (`SummaryTable`, `LedgerTable`, `BreakdownTable`, `SalesListTable`, `ByCustomerTable`, `ByTicketTable`, `PaymentMethodBreakdownTable`), todas con datos reales.

## 4. Guardarraíl y documentación

- [x] 4.1 Remover de `RAW_ELEMENT_ALLOWLIST` en `tests/unit/ui/design-system/tokens.test.ts` las 6 rutas: `app/(private)/reports/_blocks/SummaryTable.tsx`, `app/(private)/reports/collections/_blocks/global/PaymentMethodBreakdownTable.tsx`, `app/(private)/reports/collections/_blocks/by-customer/ByCustomerTable.tsx`, `app/(private)/reports/collections/_blocks/by-customer/ByTicketTable.tsx`, `app/(private)/reports/sales-cut/_blocks/BreakdownTable.tsx`, `app/(private)/reports/sales-cut/_blocks/SalesListTable.tsx`. `app/(private)/reports/_blocks/LedgerTable.tsx` se MANTIENE en la allowlist (con comentario inline): su `<table>` ya está migrado, pero conserva un `<button>` nativo de "imprimir anticipo" (Decisión 4 de design.md, fuera de alcance de este change) que el regex del guardarraíl también detecta.
- [x] 4.2 Correr `npm test -- tests/unit/ui/design-system/tokens.test.ts` y confirmar que pasa (incluyendo el test "la allowlist no contiene archivos que ya no existen"). ✓ 8/8 passed.
- [x] 4.3 Actualizar `designer.md` § Pendientes: quitar estas 6 tablas de la lista de deuda, dejar `LedgerTable` anotado como "tabla migrada, pendiente sólo el botón nativo" y corregir las menciones obsoletas (`BreakdownTable` ×2, `ProductBreakdownTable`) que no corresponden a archivos existentes.
- [x] 4.4 Correr `npm run build` para confirmar que el cambio no rompe el type-check de TypeScript. ✓ build exitoso.
