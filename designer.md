# designer.md — Sistema de diseño de agrisas-panel

Referencia obligatoria para toda implementación de UI/UX en este repo. Todo spec `openspec/specs/*-ui/spec.md` **referencia este documento y la capability `design-system`**; no redefine tokens.

Origen: Stitch — proyecto `5227157529282603342` ("Agrisas Admin & POS Dashboard"), design system **Agro-Systemic** (Material 3). Fuente autoritativa: `designTheme.designMd`, recuperable con `mcp__stitch__get_project(name="projects/5227157529282603342")` → `.designTheme.designMd`. Ante discrepancia entre este documento y ese `designMd`, gana Stitch — salvo las desviaciones registradas en la sección [Desviaciones](#desviaciones).

---

## Paleta

Material 3 "Agro-Systemic". Todo color en `app/(private)/` y `app/_components/` se expresa con estos tokens semánticos — nunca hex crudo, nunca `bg-gray-*`.

| Rol | Token | Hex |
|---|---|---|
| Primario (verde vibrante — crecimiento) | `primary` / `on-primary` | `#0d631b` / `#ffffff` |
| Primario contenedor | `primary-container` / `on-primary-container` | `#2e7d32` / `#cbffc2` |
| Primario fijo | `primary-fixed` / `primary-fixed-dim` | `#a3f69c` / `#88d982` |
| Secundario (marrón tierra) | `secondary` / `on-secondary` | `#77574d` / `#ffffff` |
| Secundario contenedor | `secondary-container` / `on-secondary-container` | `#fed3c7` / `#795950` |
| Secundario fijo | `secondary-fixed` / `secondary-fixed-dim` | `#ffdbd0` / `#e7bdb1` |
| Terciario (gris-azul técnico) | `tertiary` / `on-tertiary` | `#445963` / `#ffffff` |
| Terciario contenedor | `tertiary-container` / `on-tertiary-container` | `#5c717b` / `#e1f4ff` |
| Superficie | `surface` / `on-surface` | `#f9f9f7` / `#1a1c1b` |
| Superficie variante | `on-surface-variant` | `#40493d` |
| Superficie contenedor (bajo→alto) | `surface-container-lowest/low/(default)/high/highest` | `#ffffff` / `#f4f4f2` / `#eeeeec` / `#e8e8e6` / `#e2e3e1` |
| Outline | `outline` / `outline-variant` | `#707a6c` / `#bfcaba` |
| Error | `error` / `on-error` / `error-container` / `on-error-container` | `#ba1a1a` / `#ffffff` / `#ffdad6` / `#93000a` |
| Fondo | `background` / `on-background` | `#f9f9f7` / `#1a1c1b` |

**Legacy `/auth/*` únicamente** — `agrisas-dark #1a4d42`, `agrisas-medium #2a6b5f`, `agrisas-mint #d4f1e9`, `agrisas-light #e8f7f3`. No usar fuera de `app/(public)/auth/`.

**Variables CSS** — los mismos tokens están disponibles como tripletas RGB en `:root` (`app/globals.css`), forma `--md-sys-color-<token>`, para consumo fuera de Tailwind: `rgb(var(--md-sys-color-outline-variant))`.

---

## Tipografía

Inter, cargada vía `next/font/google` en `app/layout.tsx`. 16 tokens, todos en `tailwind.config.ts` → `theme.extend.fontSize`. **Ninguna clase tipográfica usada en `app/` puede quedar fuera de esta lista** — el guardarraíl (`tokens.test.ts`) lo verifica.

| Token | px / line-height | letter-spacing | weight | Uso |
|---|---|---|---|---|
| `display-lg` | 57/64 | -0.25px | 400 | Valores KPI grandes (dashboard) |
| `display-md` | 45/52 | — | 400 | Valores destacados secundarios |
| `display-sm` | 36/44 | — | 400 | Totales de cotización/venta |
| `headline-lg` | 32/40 | — | 600 | **Título de página** (vía `PageShell`) |
| `headline-lg-mobile` | 28/36 | — | 600 | `headline-lg` en viewport móvil |
| `headline-md` | 28/36 | — | 600 | Subtítulos de sección grandes |
| `headline-sm` | 24/32 | — | 600 | Título de página de reporte (hoy vía `PageShell`) |
| `title-lg` | 22/28 | — | 500 | Título de editor full-bleed (POS, crear/editar cotización) |
| `title-md` | 16/24 | 0.15px | 500 | Encabezado de sección dentro de panel |
| `title-sm` | 14/20 | 0.1px | 500 | Subtítulo de tabla agrupada |
| `body-lg` | 16/24 | 0.5px | 400 | Texto de párrafo largo |
| `body-md` | 14/20 | 0.25px | 400 | Texto de página estándar, descripciones |
| `body-sm` | 13/18 | 0.25px | 400 | **Celdas de tabla** — ver [Desviaciones](#desviaciones) |
| `label-lg` | 14/20 | 0.1px | 500 | Botones tamaño `md`, labels de formulario |
| `label-md` | 12/16 | 0.5px | 500 | Botones tamaño `sm`, mensajes de error de campo |
| `label-sm` | 11/16 | 0.5px | 500 | **Encabezado de tabla** (uppercase) |

Prohibido: `text-[Npx]` (tamaño arbitrario) y cualquier clase `text-<categoría>-<variante>` fuera de esta tabla.

---

## Spacing

Escala 8px, en `tailwind.config.ts` → `theme.extend.spacing`.

| Token | Valor |
|---|---|
| `xs` | 4px |
| `sm` / `base` | 8px |
| `md` | 16px |
| `lg` / `gutter` | 24px |
| `xl` | 32px |
| `margin-mobile` | 16px |
| `margin-desktop` | 32px |

`gutter` y `lg` son el mismo valor (24px) por diseño: `gutter` para padding de página, `lg` para gaps de layout genéricos.

---

## Radios

Escala exacta del `designMd` de Stitch, en `tailwind.config.ts` → `theme.extend.borderRadius`.

| Clase | Valor | Uso |
|---|---|---|
| `rounded-sm` | 0.25rem | Detalles menores, `Skeleton` |
| `rounded` (DEFAULT) | 0.5rem | Inputs, selects, botones no-pill |
| `rounded-md` | 0.75rem | Contenedores internos |
| `rounded-lg` | 1rem | **Tarjetas, paneles de página, diálogos** |
| `rounded-xl` | 1.5rem | Superficies grandes, hojas laterales |
| `rounded-full` | 9999px | Botones pill, avatares, badges, chips |

Prohibido: `rounded-2xl`, `rounded-3xl` — fuera de escala.

---

## Elevación

Material 3 usa elevación tonal, no sombras duras. `tailwind.config.ts` → `theme.extend.boxShadow`: `shadow-elevation-1` (cards), `shadow-elevation-2` (elementos flotantes: dropdowns, `Card tone="primary"`), `shadow-elevation-3` (modales/overlays de alta prioridad). Sombras ambientales, opacidad 5-10%.

Overlays de modal usan scrim `bg-black/40` (pendiente de migrar a `bg-tertiary/40` literal-Stitch — ver [Pendientes](#pendientes)).

---

## Nota técnica: `cn()` y `tailwind-merge`

`app/_lib/cn.ts` envuelve `tailwind-merge` con `extendTailwindMerge`, registrando los 16 tokens de `fontSize` como grupo `font-size` propio. **Sin esto, `tailwind-merge` clasifica mal cualquier clase `text-<token-m3>`** (por no calzar con su detector de tamaños "t-shirt": xs/sm/base/lg/xl/2xl) y la trata como color de texto — así que al combinar `cn("text-label-lg", "text-on-primary")` una de las dos se descartaba en silencio según el orden. Bug descubierto durante este pase (afectaba potencialmente a cualquier componente pre-existente que combinara tamaño+color vía `cn()`; el fix es general y vive en un solo archivo). Si se añade un token a `tailwind.config.ts` → `fontSize`, replicarlo en `M3_FONT_SIZE_TOKENS` en `cn.ts`.

---

## Catálogo de primitivas

Todas bajo `app/_components/`. Presentational — sin `fetch`, sin `sessionStorage`, sin `useRouter().push`.

### `organisms/PageShell` — `PageShell`, `PageHeader`

Único contenedor de página bajo `(private)`. Ver contrato completo en `openspec/specs/design-system/spec.md`.

```tsx
<PageShell title="Ventas" description="Historial de ventas emitidas" toolbar={<Toolbar />} width="default">
  <DataTable ... />
</PageShell>
```

- `width`: `default` (max-w-screen-2xl, listados) · `narrow` (max-w-4xl, detalles y settings) · `full` (sin límite, POS).
- El **panel** (fondo tonal + borde) aparece **sólo si se pasa `toolbar`**. Sin `toolbar`, `children` renderiza directo bajo el header — así funcionan los hubs de tarjetas (`/catalogs`, `/reports`) y los layouts master-detail (`/roles`).
- `PageHeader` se usa solo, sin `PageShell`, cuando ni el header simple ni el panel encajan (p.ej. un layout de dos columnas que necesita su propio contenedor raíz — ver `RolesPage`, que sí usa `PageShell` completo porque su master-detail cabe como `children` sin panel).
- Páginas de **detalle** con header bespoke (folio en mono + badges de estado inline) no caben en `PageHeader.title: string`; usan el mismo contrato de clases raíz (`flex flex-col gap-lg px-gutter py-lg mx-auto w-full max-w-4xl`) a mano y componen su propio header. Ver `SaleDetailPage.tsx` como referencia.

### `atoms/Button`

```tsx
<Button variant="filled" size="md" icon="add" loading={isSaving}>Guardar</Button>
```

| Variant | Uso |
|---|---|
| `filled` (default) | CTA primario único de la página |
| `tonal` | Acción secundaria con peso visual medio |
| `outlined` | Acción secundaria neutra |
| `text` | Acción terciaria, enlaces de acción ("Reintentar") |
| `destructive` | Cancelar, eliminar, revertir |

`size`: `sm` (label-md) · `md` (label-lg, default) · `lg` (title-md). Siempre `rounded-full`.

`Button` acepta `href?: string`: si está presente, renderiza `next/link` en vez de `<button>`, con las mismas clases de `variant`/`size`/ícono. Úsalo para CTAs que navegan a una ruta en vez de abrir un modal.

### `molecules/CreateButton`

```tsx
<CreateButton label="Nuevo proveedor" onClick={openCreateModal} />
<CreateButton label="Nueva cotización" href="/quotes/new" />
```

**Regla obligatoria**: todo botón de creación de recurso ("Nuevo/a X", "Crear X", "Agregar X") en cualquier página bajo `(private)` usa `CreateButton` — nunca `Button` instanciado directamente con `variant="filled"` + `icon="add"`. `CreateButton` envuelve `Button` con esas dos props fijas y expone sólo `label: string` (obligatoria, sin default genérico como el antiguo `"Nuevo"`) y `onClick`/`href` (uno de los dos, según abra modal o navegue). El gating por permisos (`canWrite`/`can(...)`) sigue siendo responsabilidad del caller — `CreateButton` no valida autorización.

### `molecules/PdfDownloadButton` — `ExportPdfButton`, `DownloadPdfButton`

```tsx
<ExportPdfButton onClick={handleExportPdf} loading={isExporting} />
<DownloadPdfButton onClick={handleDownloadPdf} loading={isDownloading} />
```

**Regla obligatoria**: todo botón de descarga/exportación de PDF usa uno de estos dos componentes — nunca `Button` instanciado directamente con `icon="picture_as_pdf"`, ni un `<button>` crudo. Ambos envuelven `Button` con `icon="picture_as_pdf"` fijo; sólo exponen `onClick`/`loading`/`size?`, sin `label`/`children` (el texto es fijo, no configurable). Ninguno de los dos usa `primary` (verde, CTA) ni `error` (rojo, destructivo) — ambos comparten la familia `tertiary` (gris-azul técnico), para que la acción "PDF" se reconozca por color sin confundirse con el CTA de la página ni con una acción destructiva. `ExportPdfButton` (`variant="tertiary"`, leyenda "Exportar a PDF") se usa exclusivamente en las 8 pantallas de `/reports/*`. `DownloadPdfButton` (`variant="outlined"` recoloreado a `tertiary` vía `className`, leyenda "Descargar PDF") se usa en cualquier otra pantalla que descargue un PDF (facturas, cartas porte, cotizaciones, historial de abonos, kardex).

### `molecules/DataTable` — `Table`, `THead`, `TBody`, `Tr`, `Th`, `Td`

```tsx
<Table>
  <THead><tr><Th>Folio</Th><Th align="right">Total</Th></tr></THead>
  <TBody>{rows.map(r => <Tr key={r.id}><Td>{r.folio}</Td><Td align="right">{r.total}</Td></Tr>)}</TBody>
</Table>
```

Único dialecto de tabla de la app. `align="right"` da `text-right tabular-nums` — usar en toda columna numérica. Cabecera `bg-surface-container` (ver [Desviaciones](#desviaciones)).

### `atoms/Input`, `atoms/Select`, `molecules/FormField`

Mismo contrato visual: `rounded border border-outline bg-surface-container-lowest`, foco `ring-2 ring-primary`, error `border-error` + mensaje `text-label-md text-error`. `FormField` añade label `text-label-lg text-on-surface-variant`.

### `molecules/PageLoading`

```tsx
if (isLoading === "loading") return <PageLoading />;
```
Sustituye los `<div className="flex h-[60vh] items-center justify-center"><Spinner /></div>` repetidos por módulo.

### `molecules/Card`

`tone="default"` (`bg-surface-container-lowest` + borde + `shadow-elevation-1`) · `tone="primary"` (`bg-primary` + `shadow-elevation-2`). Radio `rounded-lg`, igual que el panel de `PageShell`.

### Resto de átomos/moléculas existentes

`Icon` (siempre `material-symbols-outlined`, nunca `-rounded`), `IconButton`, `Avatar`, `Badge`, `Chip`, `Spinner`, `Skeleton`, `Switch`, `SegmentedButton`, `SearchInput`, `Combobox`, `ConfirmDialog`, `EmptyState`, `StatCard`, `TaxBreakdownRows` — todos ya tokenizados; su contrato no cambió en este pase salvo lo listado en [Cambios de esta iteración](#cambios-de-esta-iteración).

---

## Recetas cerradas

**Página de listado** — `PageShell` con `toolbar` (filtros + búsqueda) y `children` = `DataTable` + `CatalogPagination`. CTA de creación en `actions`.

**Página de detalle** — ancho `narrow` (max-w-4xl), header bespoke con back-link + folio en `font-mono` + badges de estado inline, subtítulo con fecha. Ver `SaleDetailPage.tsx`.

**Página de reporte** — `PageShell` con `backHref="/reports"` (o el listado padre correspondiente, ver `LedgerPage`/`PaymentsHistoryPage`), sin `toolbar` (los filtros van en `children`, no en un panel encajonado — los reportes componen sus propias tarjetas/tablas sueltas, no un único panel). Botones de exportar: `ExportPdfButton` (PDF, `tertiary`) y `<Button variant="outlined" icon="summarize">` (Excel).

**Página de grid/hub** — `PageShell` sin `toolbar`, `children` = grid de `CatalogHubCard`.

**Layout master-detail** — `PageShell` sin `toolbar`, `children` = fila `flex` con panes propios (cada uno con su propio borde/radio, no uno global).

**Editor full-bleed (split-pane)** — sin `PageShell`. Contenedor propio `h-[calc(100vh-64px)]`, barra superior compacta (`px-4 py-3`) con título `text-title-lg`. Ver `PosPage`, `QuoteCreatePage`, `QuoteEditPage`, `EditSalePage`.

**Formulario** — `FormField`/`Input`/`Select` tokenizados, mensaje de error `text-label-md text-error`.

**Estado vacío** — `EmptyState` (icon + title + description + action opcional).

**Estado de carga de página** — `PageLoading`. Estado de carga de sección/tabla — `Spinner` inline o `Skeleton`.

**Badge de estado** — `Badge` (variant `read`/`write`/`neutral`) para permisos/roles; badges de dominio (estado de venta, cotización, devolución, pago) son componentes propios por módulo (`SaleStatusBadge`, `QuoteStatusBadge`, etc.) que ya siguen la tabla de tokens de su spec — no la duplican aquí.

---

## Prohibiciones

- Hex crudo (`#...`) en TSX o CSS, fuera de `app/(public)/auth/*` y `tailwind.config.ts`/`globals.css` (fuente de los tokens).
- Valores arbitrarios de color: `bg-[#...]`, `text-[#...]`, `border-[#...]`.
- Paleta neutra genérica de Tailwind: `bg-gray-*`, `border-gray-*`, `text-gray-*`.
- Tamaño de fuente arbitrario: `text-[Npx]`.
- Clases tipográficas fuera de la tabla de 16 tokens.
- `rounded-2xl`, `rounded-3xl`.
- `<button>`, `<table>`, `<select>` crudos con clases de estilo en `app/(private)/**/_blocks/` (los que aún quedan están en la allowlist de `tokens.test.ts` como deuda declarada — ver [Pendientes](#pendientes)).
- Padding/ancho máximo propio a nivel de raíz de página (`px-*`, `max-w-*`, `mx-auto` fuera de `PageShell`).
- `material-symbols-rounded` — sólo `material-symbols-outlined` está cargado.

---

## Desviaciones

Registradas y con motivo. Si se revierten, es cambiar la constante correspondiente, no releer todo el sistema.

1. **`body-sm` = 13px/18px, no 12px/16px.** M3 estándar fija 12px. Se eligió 13px porque `body-sm` es el token de las celdas de las ~50 tablas de datos del panel (450 usos), y 12px resultaba apretado para lectura prolongada de cifras. Constante: `tailwind.config.ts` → `fontSize["body-sm"]`.

2. **Cabecera de `DataTable` en `bg-surface-container`, no `bg-tertiary-container`.** Stitch dice literalmente *"Header rows use a Tonal Tertiary background"*. `tertiary-container` (`#5c717b`) es pizarra oscura con texto claro — demasiado pesado para 50 tablas en un tema claro y compite con el CTA primario por atención. `bg-surface-container` es el gris tonal que ya usaban `users`/`customers` antes de este pase. Constante: `app/_components/molecules/DataTable/DataTable.tsx` → `THead`.

3. **`Button` en `/auth/*` conserva la paleta legacy vía `className` override**, no la M3. `LoginForm`/`RegisterForm` pasan `bg-agrisas-dark text-agrisas-mint hover:bg-agrisas-medium` que gana sobre las clases M3 del componente por resolución de conflicto de `tailwind-merge`. Es intencional: `/auth/*` está exento del sistema M3 por `frontend-scaffold`.

---

## Pendientes (deuda declarada, no bloquea este pase)

- **Formularios internos de modales, toolbars y tablas de detalle**: 51 archivos bajo `_blocks/` conservan `<button>`/`<table>`/`<select>` crudos (modales de crear/editar/cancelar, toolbars de filtros, tablas de líneas de detalle, action bars) — quedan en la allowlist explícita de `tokens.test.ts`. Migrar módulo por módulo cuando se toque cada archivo; la allowlist debe encoger, nunca crecer. Bajó de 107 a 51 con `shrink-design-debt-allowlist-sales-flow` (2026-10-11), que migró el flujo completo de Ventas (pos/quotes/sales/returns/payments/billing, 54 de 56 archivos — ver excepciones abajo). Restan dos partes: Compras/Logística/Inventario (`purchases`, `waybills`, `inventory`, 31 archivos) y Administración (`reports`, `roles`, `users`, `settings`, `dashboard`, 20 archivos).
- **Excepciones permanentes documentadas en la allowlist** (no se migran, no cuentan como deuda pendiente real): `sales/_blocks/PrintableTicket.tsx` (su `<table>` es el layout de impresión térmica del ticket, no una tabla de datos) y el `<table>` de `pos/_blocks/PosShortcutsOverlay.tsx` (lista estática de atajos de teclado, no un data grid de negocio) — mismo criterio que el `<button>` de "imprimir anticipo" en `LedgerTable`.
- **Scrim de modal**: `bg-black/40` en lugar de `bg-tertiary/40` (lectura literal de Stitch para overlays). Cambio de una clase en cada modal cuando se decida.
- **Tablas de reportes — migradas a `DataTable`** (`openspec/changes/migrate-report-tables-datatable`, 2026-10-10): `SummaryTable`, `PaymentMethodBreakdownTable`, `ByCustomerTable`, `ByTicketTable`, `BreakdownTable`, `SalesListTable` ya usan `Table/THead/TBody/Tr/Th/Td`. `LedgerTable` también migró su tabla, pero permanece en la allowlist sólo por un `<button>` nativo ("imprimir anticipo", fuera de alcance de esa migración). No queda ninguna otra tabla de reportes pendiente — las menciones previas a un segundo `BreakdownTable` y a `ProductBreakdownTable` no correspondían a archivos reales del repo.
- **`app/(private)/dashboard/page.tsx` no usa `PageShell`.** Conserva `<div className="max-w-7xl mx-auto p-gutter space-y-gutter">` a mano. Los valores en px coinciden hoy con los de `PageShell` (`gutter`=`lg`=24px), pero el ancho máximo difiere (`max-w-7xl`=1280px vs `max-w-screen-2xl`=1536px de `PageShell`) y no vive en el componente compartido — cualquier cambio futuro a `PageShell` no se propaga aquí. Nunca estuvo en el alcance de la migración original (bento grid propio, no listado). Migrar cuando se toque el dashboard.
- **`CreatePurchasePage.tsx:102` en `text-headline-lg`** mientras `NewInvoicePage`/`NewWaybillPage`/`CreateReturnPage` usan `text-headline-sm` — inconsistencia pre-existente entre páginas de creación, detectada en la auditoría original pero nunca incluida en el alcance de `tasks.md` (que cubrió sólo páginas de *detalle*, no de creación). Unificar a `headline-sm` cuando se toque el módulo de compras.
- **`SatCatalogCombobox.tsx`** no tiene clases base propias — depende de que cada consumidor pase `className` completo tokenizado. Sus 4 usos actuales ya lo hacen correctamente, pero el componente en sí no es autosuficiente si se agrega un consumidor nuevo sin className. Darle un contrato base propio (igual a `Input`) cuando se toque.

---

## Cómo re-extraer la fuente Stitch

```
mcp__stitch__get_project(name="projects/5227157529282603342")
  → .designTheme.designMd   # markdown con paleta, tipografía, radios, spacing y reglas de prosa
  → .designTheme.namedColors # mismos colores en snake_case, útil para diff rápido contra tailwind.config.ts
```

Si Stitch actualiza el design system, comparar contra `tailwind.config.ts` → `theme.extend` antes de aplicar cualquier cambio; las [Desviaciones](#desviaciones) documentadas aquí no deben revertirse sin decisión explícita.

---

## Cambios de esta iteración

Ver `openspec/changes/standardize-design-system/` para el detalle completo (proposal, design, tasks). Resumen: escala tipográfica completada (8→16 tokens), radios realineados a Stitch con barrido mecánico de 758 clases, `PageShell`/`Button`/`DataTable`/`Select`/`PageLoading` nuevos, `Input`/`FormField`/`Card`/`Chip` retokenizados, 26 módulos migrados, guardarraíl automatizado en `tests/unit/ui/design-system/tokens.test.ts`.
