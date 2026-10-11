## 1. Compartidos/transversales (migrar primero — los consume `billing` más adelante)

- [x] 1.1 Migrar `pos/_blocks/CustomerPicker.tsx` (1 `<button>` → `IconButton`/`Button`).
- [x] 1.2 Migrar `pos/_blocks/CustomerQuickAddModal.tsx` (4 `<button>` → `Button`/`IconButton`).
- [x] 1.3 Migrar `pos/_blocks/PriceTierPicker.tsx` (5 `<button>`, incl. tarjetas seleccionables con 3 estados visuales combinados — preservar `selected`/`disabled`/`requiresDefaultPrice`).

## 2. pos/ (resto)

- [x] 2.1 Migrar `pos/_blocks/CartLine.tsx` (4 `<button>` — incluye control segmentado %/$ con `aria-pressed`+`role="group"`; preservar esos atributos vía props nativas de `Button`, sin crear primitiva nueva — ver design.md Decisión 2).
- [x] 2.2 Migrar `pos/_blocks/CartPanel.tsx` (1 `<button>`, 2 `<select>` → `Select`).
- [x] 2.3 Migrar `pos/_blocks/PosHeader.tsx` (3 `<button>`).
- [x] 2.4 Migrar solo el `<button>` de `pos/_blocks/PosShortcutsOverlay.tsx` (1 botón cerrar) — **el `<table>` de atajos de teclado queda excluido**, agregar comentario inline en la allowlist explicando por qué (ver design.md Decisión 5).
- [x] 2.5 Migrar `pos/_blocks/ProductCatalogTable.tsx` (2 `<button>` de paginación, 1 `<table>` → `Table/THead/TBody/Tr/Th/Td` preservando `useTableKeyboard`/`getRowProps`/refs de foco por fila).
- [x] 2.6 Migrar `pos/_blocks/SaleConfirmedModal.tsx` (2 `<button>`) — nota: `Button` no es `forwardRef`, se reemplazó el `ref` de auto-foco por atributo `data-autofocus` + `querySelector` dentro del `dialog`.

## 3. quotes/ (completo)

- [x] 3.1 Migrar `quotes/_blocks/AuthorizeQuoteModal.tsx` (2 `<button>`).
- [x] 3.2 Migrar `quotes/_blocks/CancelQuoteModal.tsx` (3 `<button>`).
- [x] 3.3 Migrar `quotes/_blocks/ConvertQuoteModal.tsx` (2 `<button>`, 2 `<select>` — preservar spinner condicional que reemplaza al select en estado de carga).
- [x] 3.4 Migrar `quotes/_blocks/QuoteActionsBar.tsx` (3 `<button>`, lógica condicional de permisos).
- [x] 3.5 Migrar `quotes/_blocks/QuoteEmitPanel.tsx` (1 `<button>`, 2 `<select>` — preservar `disabled` en modo edit y spinner condicional).
- [x] 3.6 Migrar `quotes/_blocks/QuoteItemsTable.tsx` (1 `<table>`).
- [x] 3.7 Migrar `quotes/_blocks/QuotesTable.tsx` (1 `<table>`).
- [x] 3.8 Migrar `quotes/_blocks/QuotesToolbar.tsx` (1 `<button>`, 2 `<select>` de filtro).

## 4. returns/ (completo)

- [x] 4.1 Migrar `returns/_blocks/CancelReturnModal.tsx` (2 `<button>`).
- [x] 4.2 Migrar `returns/_blocks/ReturnActionsBar.tsx` (1 `<button>`).
- [x] 4.3 Migrar `returns/_blocks/ReturnItemsTable.tsx` (1 `<table>`).
- [x] 4.4 Migrar `returns/_blocks/ReturnsTable.tsx` (1 `<button>` embebido en fila, 1 `<table>`).
- [x] 4.5 Migrar `returns/_blocks/ReturnsToolbar.tsx` (2 `<button>`, 1 `<select>`).

## 5. sales/ (completo excepto `PrintableTicket.tsx`)

- [x] 5.1 Migrar `sales/_blocks/CancelSaleModal.tsx` (3 `<button>`).
- [x] 5.2 Migrar `sales/_blocks/FullReturnModal.tsx` (2 `<button>`).
- [x] 5.3 **No migrar** `sales/_blocks/PrintableTicket.tsx` — su `<table>` es layout de impresión térmica (estilos inline, `colSpan`). Agregar comentario inline en la allowlist explicando por qué (ver design.md Decisión 5).
- [x] 5.4 Migrar `sales/_blocks/SaleDetailPage.tsx` (3 `<button>`, lógica condicional de permisos).
- [x] 5.5 Migrar `sales/_blocks/SaleItemsTable.tsx` (1 `<table>`).
- [x] 5.6 Migrar `sales/_blocks/SalePaymentsSection.tsx` (3 `<button>` embebidos en celdas, 2 `<table>` — una con filas expandibles vía `Fragment`+`colSpan`+toggle, otra de saldo por producto; preservar expand/collapse).
- [x] 5.7 Migrar `sales/_blocks/SaleReturnsSection.tsx` (1 `<button>`).
- [x] 5.8 Migrar `sales/_blocks/SalesTable.tsx` (1 `<table>`).
- [x] 5.9 Migrar `sales/_blocks/SalesToolbar.tsx` (2 `<button>`, 1 `<select>`).
- [x] 5.10 Migrar `sales/[id]/returns/new/_blocks/CreateReturnFooter.tsx` (1 `<button>`).
- [x] 5.11 Migrar `sales/[id]/ticket/_blocks/SendTicketEmailModal.tsx` (2 `<button>`).
- [x] 5.12 Migrar `sales/[id]/ticket/_blocks/TicketPreviewPage.tsx` (4 `<button>` con estados de impresión dual browser/ESC-POS — migrar solo presentación, no la lógica de `isPrinting`/`printFailed`).

## 6. payments/ (completo — cuidado especial en 3 archivos)

- [x] 6.1 Migrar `payments/_blocks/CancelPaymentModal.tsx` (2 `<button>`).
- [x] 6.2 Migrar `payments/_blocks/GroupedPaymentsTable.tsx` (1 `<table>` — **preservar genericidad `<T extends GroupablePayment>` y render-props `headerRow`/`renderPaymentRow`**, ver design.md Decisión 3).
- [x] 6.3 Migrar `payments/_blocks/PaymentActionsBar.tsx` (1 `<button>`).
- [x] 6.4 Migrar `payments/_blocks/PaymentsHistoryPage.tsx` (1 `<table>` — **preservar columna condicional por permiso `isBypass`** en header y filas, ver design.md Decisión 4).
- [x] 6.5 Migrar `payments/_blocks/PaymentsHistoryToolbar.tsx` (2 `<button>`, 4 `<select>` — cobrador/método/estado/sucursal condicional por permiso; no tocar los `Combobox` ya migrados).
- [x] 6.6 Migrar `payments/_blocks/PaymentsListPage.tsx` (1 `<button>`).
- [x] 6.7 Migrar `payments/_blocks/PaymentsTable.tsx` (1 `<table>`).
- [x] 6.8 Migrar `payments/_blocks/PaymentsToolbar.tsx` (1 `<button>`, 2 `<select>`).
- [x] 6.9 Migrar `payments/_blocks/RegisterPaymentModal.tsx` (2 `<button>`, 2 `<select>` — **preservar inputs dinámicos por línea (`lineBalances.map`) y `lineErrors` por saleItemId**, no simplificar esa lógica).

## 7. billing/ (completo, al final — consume componentes de la sección 1)

- [x] 7.1 Migrar `billing/_blocks/BillingToolbar.tsx` (2 `<button>`, 1 `<select>`).
- [x] 7.2 Migrar `billing/_blocks/CancelInvoiceModal.tsx` (2 `<button>`, 1 `<select>`).
- [x] 7.3 Migrar `billing/_blocks/CsdManagerPage.tsx` (2 `<button>` — **no tocar** los 2 `<input type="file">` nativos, el regex del guardarraíl no los detecta).
- [x] 7.4 Migrar `billing/_blocks/InvoiceActionsBar.tsx` (3 `<button>`, lógica de permisos).
- [x] 7.5 Migrar `billing/_blocks/InvoiceDetailPage.tsx` (1 `<button>`).
- [x] 7.6 Migrar `billing/_blocks/InvoiceItemsTable.tsx` (1 `<table>`).
- [x] 7.7 Migrar `billing/_blocks/InvoicesTable.tsx` (1 `<table>`).
- [x] 7.8 Migrar juntos `billing/_blocks/PartialInvoiceForm.tsx` + `billing/_blocks/PartialInvoiceLineRow.tsx` (5+2 `<button>`, 1 `<table>` de 8 columnas `tableLayout:fixed`, 2 `<select>` — `PartialInvoiceLineRow` es `<tr>` hijo de la tabla del padre, migrar en el mismo commit/sesión).
- [x] 7.9 Migrar `billing/_blocks/SaleInvoicesSection.tsx` (1 `<button>`).
- [x] 7.10 Migrar `billing/_blocks/SalePickerField.tsx` (1 `<button>`).
- [x] 7.11 Migrar `billing/_blocks/SendInvoiceEmailModal.tsx` (2 `<button>`).
- [x] 7.12 Migrar `billing/_blocks/StampSaleForm.tsx` (6 `<button>` — incl. 4 variantes de botón "×" dentro de bloques de error tipados `instanceof`, migrar cada uno individualmente sin tocar la cadena de errores; 3 `<select>` de catálogos SAT).

## 8. Verificación y cierre

- [x] 8.1 Correr el regex `/<(?:button|table|select)[\s/>]/` sobre cada uno de los 56 archivos y confirmar 0 matches, salvo las 2 exclusiones documentadas (`PrintableTicket.tsx` completo, `PosShortcutsOverlay.tsx` solo por su `<table>`).
- [x] 8.2 Remover de `RAW_ELEMENT_ALLOWLIST` (`tests/unit/ui/design-system/tokens.test.ts`) las 54 rutas migradas por completo; dejar `PrintableTicket.tsx` y `PosShortcutsOverlay.tsx` con comentario inline explicando la excepción.
- [x] 8.3 Correr `npx tsc --noEmit` limpio (34 errores preexistentes ajenos a esta migración, ninguno en los módulos tocados).
- [x] 8.4 Correr `npm test` completo en verde (579/581 suites, 4346/4360 tests, sin tocar assertions existentes).
- [x] 8.5 Verificación visual manual con Playwright sobre `/pos`, `/quotes`, `/sales` (+ detalle con abonos), `/returns`, `/payments` (+ historial), `/billing` (+ detalle + modal cancelar CFDI) en datos de dev — sin regresiones visuales; toggle de `CartLine` (`aria-pressed` confirmado en accessibility tree), teclado de `ProductCatalogTable`, tarjetas de `PriceTierPicker`, tabla+tfoot de `InvoiceItemsTable`, y ambas tablas de `SalePaymentsSection` verificadas con capturas.
- [x] 8.6 Actualizar `designer.md` § Pendientes: reducir el conteo de 107 a 51 archivos restantes y documentar las 2 exclusiones si no están ya anotadas ahí.
- [x] 8.7 (post-verify) Mockear `usePaymentMethodsOptions`/`useCashiersOptions`/`useCustomerSearch`/`useProductSearch` en `PaymentsHistoryPage.test.tsx` — limpia el warning de `act()` detectado en `/opsx:verify` (preexistente, no introducido por esta migración; mismo patrón ya usado para `useBranchesOptions`).
