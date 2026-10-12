## Context

Ver `proposal.md` § Why para la motivación. Este documento cubre el *cómo*.

**Inventario cuantificado** (31 archivos de Compras/Logística/Inventario, conteo de elementos crudos por submódulo vía regex multilínea `/<(?:button|table|select)[\s/>]/` sobre el contenido completo del archivo — grep por línea falla porque JSX suele partir el tag en varias líneas):

| Submódulo | Archivos | `<button>` | `<table>` | `<select>` |
|---|---|---|---|---|
| `purchases/_blocks/` | 13 | 21 | 3 | 3 |
| `waybills/_blocks/` | 10 | 14 | 3 | 3 |
| `inventory/_blocks/` (+ `kardex/_blocks/`) | 8 | 13 | 2 | 1 |
| **Total** | **31** | **48** | **8** | **7** |

**Primitivas ya existentes y estables** (no se modifican en este change — mismo inventario confirmado en `shrink-design-debt-allowlist-sales-flow`):
- `Button`/`IconButton` — `app/_components/atoms/{Button,IconButton}/`. `variant`, `size`, `loading`, `icon`/`iconPosition`, `href`; acepta `className` (merge vía `tailwind-merge` extendido en `cn.ts`), por lo que un override de layout (p.ej. `flex-col` en vez de la fila default) es viable sin tocar el componente.
- `Select` — `app/_components/atoms/Select/Select.tsx`. `forwardRef`, extiende `SelectHTMLAttributes`, prop `error?: string` (sólo estiliza `border-error`/`aria-invalid`, no renderiza texto — el `<p>` externo se mantiene).
- `DataTable` — `app/_components/molecules/DataTable/DataTable.tsx`. Exporta `Table`/`THead`/`TBody`/`Tr`(`hoverable?`)/`Th`(`align?`)/`Td`(`align?`) como funciones independientes; `Tr`/`Td` aceptan cualquier prop HTML vía spread (inputs controlados dentro de `Td` funcionan igual que en un `<td>` nativo).
- `ConfirmDialog` — `app/_components/molecules/ConfirmDialog/`. Ya en uso en `RebuildArticleButton.tsx`, `CancelPurchaseModal.tsx`, `CancelWaybillModal.tsx`, `CancelProviderPaymentModal.tsx` — no se toca, sólo cambia el trigger de presentación.

**Casos particulares relevados en este bloque** (no presentes en el inventario de `sales-flow`):
- `SatInvoiceUploader.tsx`: el `<button>` es un dropzone de ancho completo con layout en columna (ícono + título + descripción), no un CTA de fila. Dispara un `<input type="file">` oculto — ese input no es detectado por el regex del guardarraíl y no requiere cambio.
- `RebuildArticleButton.tsx`: botón con `ConfirmDialog` ya integrado; sólo migra el trigger.
- `BranchPairSelector.tsx`: dos `<select>` (sucursal origen/destino) con exclusión mutua — la opción seleccionada en uno se filtra del otro.
- `WaybillItemsForm.tsx`: `<table>` con inputs de cantidad editables por fila dentro de `<td>`.
- `KardexTable.tsx`: `<table>` con saldo acumulado con signo/color condicional (entrada vs. salida).
- `ProviderPicker.tsx`/`ProviderQuickAddModal.tsx`: uso exclusivo de `purchases/_blocks/CreatePurchasePage.tsx` (confirmado por búsqueda de referencias) — sin acoplamiento cruzado a otros módulos, a diferencia de `CustomerPicker` en el flujo de Ventas.

**Patrón de migración ya validado dos veces** (`shrink-design-debt-allowlist-catalogs`, `shrink-design-debt-allowlist-sales-flow`): migración mecánica 1:1, sin crear abstracciones nuevas, shrink de allowlist atómico por archivo, verificación visual manual con Playwright antes de cerrar.

## Goals / Non-Goals

**Goals:**
- Migrar los 48 `<button>`, 8 `<table>` y 7 `<select>` crudos de los 31 archivos de Compras/Logística/Inventario a las primitivas existentes, preservando exactamente comportamiento, datos renderizados y estados de accesibilidad actuales (Historia #1, #2, #3 de `proposal.md`).
- Resolver sin regresión los casos particulares de este bloque: dropzone de `SatInvoiceUploader`, `ConfirmDialog` de `RebuildArticleButton`, exclusión mutua de `BranchPairSelector`, inputs editables de `WaybillItemsForm`, saldo con signo de `KardexTable`.
- Shrink atómico de `RAW_ELEMENT_ALLOWLIST` (Historia #4): remover cada ruta sólo tras confirmar 0 matches en ese archivo específico.

**Non-Goals:**
- No se tocan los 20 archivos de Administración (reports/roles/users/settings/dashboard) — change separado, fuera de alcance.
- No se modifican las primitivas `Button`/`IconButton`/`Select`/`DataTable`/`ConfirmDialog` — ya tienen toda la superficie de API necesaria; si algún caso exigiera una prop nueva, es una decisión a elevar antes de aplicar, no a resolver ad-hoc durante la migración.
- No se crea un átomo nuevo de "dropzone" para `SatInvoiceUploader` aunque su layout difiera del `Button` default — se resuelve con `className` override puntual (ver Decisión 2).
- No se toca lógica de negocio: cálculo de totales de compra, saldos de kardex (`InventoryMovement`/kardex backend), validación de cantidades de guía, parseo de CFDI (`satXmlParser`), RBAC/branch scoping, ni los `fetch`/services de `_logic/`.

## Decisions

1. **Mapeo de `variant` de `Button` por intención semántica, no por clase CSS copiada.** Misma regla que `sales-flow`: primario (Guardar/Crear/Confirmar/Registrar pago) → `filled`; secundario (Cancelar/Cerrar) → `text` u `outlined` según si hoy tiene borde visible; destructivo (Cancelar compra/pago a proveedor/guía, Reconstruir kardex) → `destructive`; icon-only → `IconButton`. **Corrección sobre una suposición incorrecta de esta misma sección (auditoría QA, 2026-10-12)**: `ExportButtons.tsx` no es icon-only — su `<button>` original (`git show HEAD`) ya tenía ícono+texto visible ("Exportar Excel"). La implementación migró correctamente a `Button` (no `IconButton`); la premisa de esta decisión estaba mal calificada, no la migración.

2. **`SatInvoiceUploader` migra a `Button` con `className` override para su layout en columna (ancho completo, ícono+título+descripción apilados), no se crea una primitiva "Dropzone" nueva.** Alternativa descartada: dejarlo fuera de la migración por ser "distinto" — se descarta porque sigue siendo un `<button>` semánticamente simple (dispara un click en un input oculto), y `Button` ya soporta override de layout vía `className` gracias al `cn()` extendido con `tailwind-merge` (mismo mecanismo que ya resolvió casos de layout no estándar en `sales-flow`, p.ej. `CartLine`).

3. **`RebuildArticleButton` conserva su `ConfirmDialog` intacto; sólo el trigger (`<button>`→`Button` `variant="outlined"`) cambia.** Sin alternativas evaluadas — es la misma regla de "migración de presentación únicamente" aplicada en `CancelPurchaseModal`/`CancelWaybillModal`/`CancelProviderPaymentModal`, que ya usan `ConfirmDialog` de forma análoga.

4. **`BranchPairSelector` migra sus 2 `<select>` a `Select` preservando la lógica de exclusión mutua en el componente padre (filtrado de `<option>` por el valor del otro select), sin mover esa lógica a `Select` ni crear una prop `excludeValue`.** Alternativa descartada: añadir soporte nativo de exclusión a `Select` — rechazada por ser expansión de API no solicitada y específica de un único consumidor (igual criterio que la Decisión 4 de `sales-flow`, que rechazó extender `DataTable` por el mismo motivo).

5. **`WaybillItemsForm` conserva sus inputs de cantidad controlados dentro de `Td`, sin cambiar su `onChange`/validación.** `Td` acepta cualquier prop HTML vía spread; el input hijo no se ve afectado por el contenedor. Mismo patrón que `RegisterPaymentModal`/`SalePaymentsSection` en `sales-flow`.

6. **`KardexTable` preserva el `<tr>`/`<td>` 1:1, sin color condicional por signo.** Verificado contra el archivo original (`git show HEAD`): la celda de saldo no tenía clases condicionales por signo/color — es un número plano. La migración sólo cambia el markup (`tr`/`td` → `Tr`/`Td`), preservando padding (`px-3 py-2`) y la ausencia de hover en filas de datos. Corrección sobre una suposición incorrecta de esta misma sección (auditoría QA, 2026-10-12): también se detectó y corrigió un `border-b border-outline-variant` perdido en la fila de datos durante la migración inicial.

7. **Orden de ejecución: `purchases` → `waybills` → `inventory`, y dentro de cada uno, componentes compartidos del submódulo antes que las páginas que los consumen.** `ProviderPicker`/`ProviderQuickAddModal` se migran antes de `CreatePurchasePage.tsx` (que los consume); `WaybillLineRow` antes de `WaybillItemsForm.tsx`. El orden completo vive en `tasks.md`. Se elige este orden (y no, por ejemplo, agrupar primero todos los `<select>` de los 3 submódulos) porque minimiza el número de archivos con estado mixto (parcialmente migrados) en cualquier punto intermedio de verificación.

8. **El `<p>` de mensaje de error externo de cada `<select>` migrado se mantiene** (regla ya fijada en `sales-flow` Decisión 7, se reitera aquí por aplicar igual a `CreatePurchasePage`/`PurchasesToolbar`/`WaybillsToolbar`/`KardexFilters`).

## Risks / Trade-offs

- **[Riesgo] Romper la exclusión mutua de `BranchPairSelector`** al migrar sus 2 `<select>`. → **Mitigación**: migrar ambos selects en el mismo commit/paso (no por separado), verificar manualmente que seleccionar sucursal origen sigue removiendo esa opción del select de destino antes de marcar el archivo como migrado.
- **[Riesgo] Perder el foco/valor de los inputs de cantidad dentro de `WaybillItemsForm`** al envolver las filas en `Tr`/`Td`. → **Mitigación**: `Td` es transparente a props HTML vía spread; verificación manual de edición de cantidades (teclado, blur, validación de mínimo) en Playwright antes de cerrar `waybills`.
- **[Riesgo] Confundir el `<input type="file">` oculto de `SatInvoiceUploader` con un elemento a migrar.** → **Mitigación**: el regex del guardarraíl no lo detecta; se documenta explícitamente en `tasks.md` para no agregarle trabajo fuera de alcance.
- **[Riesgo] Romper el formato de saldo con signo de `KardexTable`** al migrar el `<table>`. → **Mitigación**: migrar sólo el markup externo, preservar las clases condicionales de color/signo exactamente donde están hoy (en el `<td>`/`Td` de la celda de saldo), verificar visualmente contra datos de kardex reales con movimientos positivos y negativos.
- **[Riesgo] Doble-contar o perder alguna exclusión al hacer el shrink final de la allowlist** (a diferencia de `sales-flow`, este bloque no tiene exclusiones permanentes — los 31 archivos migran en su totalidad). → **Mitigación**: shrink atómico archivo por archivo con verificación de 0 matches inmediatamente antes de cada remoción.
- **[Trade-off] No hay snapshot tests ni e2e automatizado en el repo** (mismo trade-off aceptado en los 2 changes precedentes) — la red de seguridad es: tests RTL existentes en verde + `tsc --noEmit` + verificación visual manual con Playwright.

## Migration Plan

1. Aplicar en el orden fijado en `tasks.md` (purchases → waybills → inventory, compartidos antes que consumidores dentro de cada submódulo).
2. Por archivo: migrar, correr el regex del guardarraíl localmente (debe dar 0 matches), remover esa ruta puntual de `RAW_ELEMENT_ALLOWLIST`.
3. Al completar cada submódulo: correr `npm test` filtrado a esa área + `tsc --noEmit`.
4. Al completar los 31: `npm test` completo, `tsc --noEmit` global, verificación visual manual con Playwright (nunca Claude-in-Chrome) sobre Compras/Guías de traslado/Inventario/Kardex en datos de dev, con foco en los 5 casos particulares listados en Goals.
5. Actualizar `designer.md` § Pendientes (51 → 20 archivos restantes, quitando la mención de este bloque).
6. **Rollback**: no hay estado persistente ni migración de datos — revertir es un `git revert` del commit o de los commits de esta parte; cada archivo es independiente entre sí (excepto pares acoplados: `ProviderPicker`+`ProviderQuickAddModal`+`CreatePurchasePage`, `WaybillLineRow`+`WaybillItemsForm`, que se revierten juntos).
