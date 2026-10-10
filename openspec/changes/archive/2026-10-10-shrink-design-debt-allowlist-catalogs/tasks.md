## 1. Shells genéricos de catalogs

- [x] 1.1 Migrar `_blocks/CatalogEmpty.tsx`: reemplazar `<button>` crudos por `Button` (variant según acción: reintentar/crear)
- [x] 1.2 Migrar `_blocks/CatalogError.tsx`: reemplazar `<button>` crudo (reintentar) por `Button variant="outlined"` o `"text"`
- [x] 1.3 Migrar `_blocks/CatalogPagination.tsx`: reemplazar `<button>` crudos (anterior/siguiente/número de página) por `Button`; si hay un `<select>` de tamaño de página, migrar a `Select`
- [x] 1.4 Verificar con el regex `/<(?:button|table|select)[\s/>]/g` sobre el contenido completo de cada archivo (no grep por línea) que da 0 matches
- [x] 1.5 Correr tests RTL existentes que cubran estos 3 shells y confirmar que siguen en verde

## 2. Catálogo branches

- [x] 2.1 Migrar `branches/_blocks/BranchEditModal.tsx`: `<button>` (Cancelar/Guardar/Marcar HQ) → `Button`
- [x] 2.2 Migrar `branches/_blocks/BranchesTable.tsx`: `<table>`/`<thead>`/`<tbody>`/`<tr>`/`<th>`/`<td>` → `Table`/`THead`/`TBody`/`Tr`/`Th`/`Td`; `<button>` de fila (editar/activar) → `Button`
- [x] 2.3 Verificar 0 matches de elementos crudos en ambos archivos
- [x] 2.4 Correr tests RTL de branches y confirmar verde

## 3. Catálogo customers

- [x] 3.1 Migrar `customers/_blocks/CustomerEditModal.tsx`: `<button>` (3 secciones: datos básicos/fiscales/contacto y crédito) → `Button`
- [x] 3.2 Migrar `customers/_blocks/CustomersTable.tsx`: tabla → `DataTable`; botones de fila → `Button`
- [x] 3.3 Verificar 0 matches de elementos crudos en ambos archivos
- [x] 3.4 Correr tests RTL de customers y confirmar verde

## 4. Catálogo departments

- [x] 4.1 Migrar `departments/_blocks/DepartmentEditModal.tsx`: `<button>` → `Button`; `<select>` → `Select`
- [x] 4.2 Migrar `departments/_blocks/DepartmentsTable.tsx`: tabla → `DataTable`; botones de fila → `Button`
- [x] 4.3 Verificar 0 matches de elementos crudos en ambos archivos
- [x] 4.4 Correr tests RTL de departments y confirmar verde

## 5. Catálogo folios

- [x] 5.1 Migrar `folios/_blocks/FolioAuditModal.tsx`: `<button>` → `Button`; `<table>` (histórico de auditoría) → `DataTable`; `<select>` (si filtra por tipo de evento) → `Select`
- [x] 5.2 Migrar `folios/_blocks/FolioEditModal.tsx`: `<button>` → `Button`; `<select>` (scope POS/INVENTORY/OPERATIONS) → `Select`
- [x] 5.3 Migrar `folios/_blocks/FoliosTable.tsx`: tabla → `DataTable`; botón de fila (ver auditoría) → `Button`
- [x] 5.4 Verificar 0 matches de elementos crudos en los 3 archivos
- [x] 5.5 Correr tests RTL de folios y confirmar verde

## 6. Catálogo payment-methods

- [x] 6.1 Migrar `payment-methods/_blocks/PaymentMethodEditModal.tsx`: `<button>` (incluye switch `isCredit`) → `Button`
- [x] 6.2 Migrar `payment-methods/_blocks/PaymentMethodsTable.tsx`: tabla → `DataTable`; botones de fila → `Button`
- [x] 6.3 Verificar 0 matches de elementos crudos en ambos archivos
- [x] 6.4 Correr tests RTL de payment-methods y confirmar verde

## 7. Catálogo products

- [x] 7.1 Migrar `products/_blocks/ProductDetailPage.tsx`: `<button>` (navegación entre tabs) → `Button`
- [x] 7.2 Migrar `products/_blocks/ProductGeneralTab.tsx`: `<select>` (department_id) → `Select`
- [x] 7.3 Migrar `products/_blocks/ProductEditModal.tsx`: `<button>` → `Button`; `<select>` → `Select`
- [x] 7.4 Migrar `products/_blocks/ProductPricesTab.tsx`: `<table>` (lista de precios) → `DataTable`; `<button>` (agregar/eliminar precio, marcar default) → `Button`; `<select>` → `Select`
- [x] 7.5 Migrar `products/_blocks/ProductDosificationsTab.tsx`: `<table>` (lista de dosificaciones) → `DataTable`; `<button>` (agregar/eliminar) → `Button`; `<select>` → `Select`
- [x] 7.6 Migrar `products/_blocks/ProductsPage.tsx`: `<button>` → `Button`; `<select>` (si filtra por departamento) → `Select`
- [x] 7.7 Migrar `products/_blocks/ProductsTable.tsx`: tabla → `DataTable`; botones de fila → `Button`
- [x] 7.8 Migrar `products/_blocks/SatCodeCombobox.tsx`: `<button>` (abrir/cerrar combobox) → `Button` (revisar que no rompa el comportamiento de `Combobox` molecule si lo envuelve)
- [x] 7.9 Migrar `products/_blocks/TaxRateSelect.tsx`: `<select>` → `Select`
- [x] 7.10 Verificar 0 matches de elementos crudos en los 9 archivos de products
- [x] 7.11 Correr tests RTL de products (General/Precios/Dosificaciones) y confirmar verde

## 8. Catálogo providers

- [x] 8.1 Migrar `providers/_blocks/ProviderEditModal.tsx`: `<button>` (3 secciones: datos básicos/fiscales/contacto) → `Button`
- [x] 8.2 Migrar `providers/_blocks/ProvidersTable.tsx`: tabla → `DataTable`; botones de fila → `Button`
- [x] 8.3 Verificar 0 matches de elementos crudos en ambos archivos
- [x] 8.4 Correr tests RTL de providers y confirmar verde

## 9. Catálogo tax-rates

- [x] 9.1 Migrar `tax-rates/_blocks/TaxRateEditModal.tsx`: `<button>` → `Button`; `<select>` → `Select`
- [x] 9.2 Migrar `tax-rates/_blocks/TaxRatesTable.tsx`: tabla → `DataTable`; botones de fila → `Button`
- [x] 9.3 Verificar 0 matches de elementos crudos en ambos archivos
- [x] 9.4 Correr tests RTL de tax-rates y confirmar verde

## 10. Shrink de la allowlist y verificación final

- [x] 10.1 Remover las 27 rutas de `app/(private)/catalogs/**` de `RAW_ELEMENT_ALLOWLIST` en `tests/unit/ui/design-system/tokens.test.ts`
- [x] 10.2 Correr `tests/unit/ui/design-system/tokens.test.ts` completo y confirmar verde (incluye el test "la allowlist no contiene archivos que ya no existen")
- [x] 10.3 Correr `tsc --noEmit` y confirmar sin errores nuevos
- [x] 10.4 Correr la suite completa de tests RTL (`npm test`) y confirmar sin regresiones fuera de catalogs
- [x] 10.5 Verificación visual manual en `npm run dev` (Playwright, nunca Claude-in-Chrome) de al menos un modal y una tabla por catálogo migrado, comparando contra el estilo previo
