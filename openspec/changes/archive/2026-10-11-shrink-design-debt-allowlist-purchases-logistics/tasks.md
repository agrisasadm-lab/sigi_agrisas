## 1. Purchases — compartidos

- [x] 1.1 Migrar `app/(private)/purchases/_blocks/ProviderPicker.tsx` (`<button>` → `Button`/`IconButton`)
- [x] 1.2 Migrar `app/(private)/purchases/_blocks/ProviderQuickAddModal.tsx` (`<button>` → `Button`)
- [x] 1.3 Migrar `app/(private)/purchases/_blocks/PurchaseLineRow.tsx` (`<button>` → `Button`/`IconButton`)
- [x] 1.4 Migrar `app/(private)/purchases/_blocks/SatInvoiceUploader.tsx` (`<button>` dropzone → `Button` con `className` override, preservar layout en columna + trigger de input oculto)

## 2. Purchases — tablas y toolbar

- [x] 2.1 Migrar `app/(private)/purchases/_blocks/PurchaseItemsTable.tsx` (`<table>` → `Table`/`THead`/`TBody`/`Tr`/`Th`/`Td`, columnas numéricas `align="right"`)
- [x] 2.2 Migrar `app/(private)/purchases/_blocks/ProviderPaymentsSection.tsx` (`<button>` + `<table>`)
- [x] 2.3 Migrar `app/(private)/purchases/_blocks/PurchasesTable.tsx` (`<button>` + `<table>`)
- [x] 2.4 Migrar `app/(private)/purchases/_blocks/PurchasesToolbar.tsx` (`<button>` + `<select>` → `Select`, preservar `<p>` de error)
- [x] 2.5 Migrar `app/(private)/purchases/_blocks/PurchaseActionsBar.tsx` (`<button>`)

## 3. Purchases — modales y páginas

- [x] 3.1 Migrar `app/(private)/purchases/_blocks/CancelPurchaseModal.tsx` (`<button>`, preservar `ConfirmDialog` si existe)
- [x] 3.2 Migrar `app/(private)/purchases/_blocks/CancelProviderPaymentModal.tsx` (`<button>`)
- [x] 3.3 Migrar `app/(private)/purchases/_blocks/RegisterProviderPaymentModal.tsx` (`<button>`)
- [x] 3.4 Migrar `app/(private)/purchases/_blocks/CreatePurchasePage.tsx` (`<button>` + `<select>`, última del submódulo — ya migrados sus consumidos `ProviderPicker`/`ProviderQuickAddModal`/`SatInvoiceUploader`)
- [x] 3.5 Correr guardarraíl + `npm test` filtrado a `purchases` + `tsc --noEmit`; remover las 13 rutas de `purchases` de `RAW_ELEMENT_ALLOWLIST` (shrink atómico, una por una, sólo tras 0 matches)

## 4. Waybills — compartidos

- [x] 4.1 Migrar `app/(private)/waybills/_blocks/BranchPairSelector.tsx` (2 `<select>` → `Select`, preservar exclusión mutua origen/destino en el mismo paso)
- [x] 4.2 Migrar `app/(private)/waybills/_blocks/WaybillLineRow.tsx` (`<button>`)
- [x] 4.3 Migrar `app/(private)/waybills/_blocks/WaybillActionsBar.tsx` (`<button>`)

## 5. Waybills — tablas y toolbar

- [x] 5.1 Migrar `app/(private)/waybills/_blocks/WaybillItemsTable.tsx` (`<table>`)
- [x] 5.2 Migrar `app/(private)/waybills/_blocks/WaybillItemsForm.tsx` (`<button>` + `<table>`, preservar inputs de cantidad controlados dentro de `Td`)
- [x] 5.3 Migrar `app/(private)/waybills/_blocks/WaybillsTable.tsx` (`<button>` + `<table>`)
- [x] 5.4 Migrar `app/(private)/waybills/_blocks/WaybillsToolbar.tsx` (`<button>` + `<select>`)

## 6. Waybills — modales y páginas

- [x] 6.1 Migrar `app/(private)/waybills/_blocks/CancelWaybillModal.tsx` (`<button>`)
- [x] 6.2 Migrar `app/(private)/waybills/_blocks/WaybillDetailPage.tsx` (`<button>`)
- [x] 6.3 Migrar `app/(private)/waybills/_blocks/NewWaybillPage.tsx` (`<button>`, última del submódulo — ya migrados sus consumidos `BranchPairSelector`/`WaybillItemsForm`)
- [x] 6.4 Correr guardarraíl + `npm test` filtrado a `waybills` + `tsc --noEmit`; remover las 10 rutas de `waybills` de `RAW_ELEMENT_ALLOWLIST`

## 7. Inventory

- [x] 7.1 Migrar `app/(private)/inventory/_blocks/StockAdjustModal.tsx` (`<button>`)
- [x] 7.2 Migrar `app/(private)/inventory/_blocks/InventoryAssignModal.tsx` (`<button>`)
- [x] 7.3 Migrar `app/(private)/inventory/_blocks/InventoryEditModal.tsx` (`<button>`)
- [x] 7.4 Migrar `app/(private)/inventory/_blocks/InventoryTable.tsx` (`<button>` + `<table>`)
- [x] 7.5 Correr guardarraíl + `npm test` filtrado a `inventory/_blocks` + `tsc --noEmit`; remover las 4 rutas de `inventory/_blocks` de `RAW_ELEMENT_ALLOWLIST`

## 8. Inventory — kardex

- [x] 8.1 Migrar `app/(private)/inventory/kardex/_blocks/ExportButtons.tsx` (`<button>` → `IconButton` si icon-only, o `Button`)
- [x] 8.2 Migrar `app/(private)/inventory/kardex/_blocks/RebuildArticleButton.tsx` (`<button>`, preservar `ConfirmDialog` intacto)
- [x] 8.3 Migrar `app/(private)/inventory/kardex/_blocks/KardexFilters.tsx` (`<button>` + `<select>`)
- [x] 8.4 Migrar `app/(private)/inventory/kardex/_blocks/KardexTable.tsx` (`<table>`, preservar formato de signo/color del saldo)
- [x] 8.5 Correr guardarraíl + `npm test` filtrado a `inventory/kardex` + `tsc --noEmit`; remover las 4 rutas de `kardex/_blocks` de `RAW_ELEMENT_ALLOWLIST`

## 9. Verificación final y documentación

- [x] 9.1 Confirmar test "la allowlist no contiene archivos que ya no existen" en verde
- [x] 9.2 Confirmar 0 rutas de `purchases`/`waybills`/`inventory` restantes en `RAW_ELEMENT_ALLOWLIST`
- [x] 9.3 `npm test` completo + `tsc --noEmit` global en verde
- [x] 9.4 Verificación visual manual con Playwright (nunca Claude-in-Chrome) sobre Compras (lista/detalle/abonos/acciones), Guías de traslado (lista/crear/líneas), Inventario (lista/asignar/buscar) y Kardex (filtros) — sin errores de consola, sin regresiones visuales
- [x] 9.5 Actualizar `designer.md` § Pendientes: conteo de 51 → 20 archivos restantes (queda sólo el bloque de Administración)
