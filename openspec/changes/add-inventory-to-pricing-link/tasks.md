## 1. Deep-link a tab en ProductDetailPage

- [x] 1.1 En `ProductDetailPage.tsx`, importar `useSearchParams` de `next/navigation`.
- [x] 1.2 Calcular la tab inicial: leer `searchParams.get("tab")`, validarla contra `["general", "prices", "dosifications"]`, y usarla como valor inicial de `useState<Tab>(...)` (fallback `"general"` si es ausente o inválida). No usar `useEffect` — debe ser el valor inicial del estado, para no "saltar" si el usuario cambia de tab manualmente después.
- [x] 1.3 Verificado en dev/browser real: `?tab=prices` → tab activa "Precios"; sin query → "General"; `?tab=algo_invalido` → cae a "General". Los 3 casos confirmados.

## 2. Banner de éxito post-asignación en InventoryPage

- [x] 2.1 En `InventoryPage.tsx`, agregar estado local `assignSuccess: { productId: string; productName: string; productCode: string } | null`, inicializado en `null`.
- [x] 2.2 En `handleAssign`, capturar el resultado de `assignOne(...)` (ya retorna `InventoryItem | null`) y, si no es `null`, hacer `setAssignSuccess({ productId: item.productId, productName: item.productName, productCode: item.productCode })` antes de cerrar el modal.
- [x] 2.3 Limpiar `assignSuccess` (`setAssignSuccess(null)`) al abrir cualquier modal (`assign`/`adjust`/`edit`) y al cambiar de sucursal (`handleBranchChange`).
- [x] 2.4 Agregar `const canWriteProducts = can("products:write");` (no confundir con `canWrite`, que es `inventory:write`).
- [x] 2.5 Renderizar el banner (inline, mismo lugar donde vive `mutationError`) cuando `assignSuccess !== null`: texto de confirmación con `productCode`/`productName`, y si `canWriteProducts === true`, un `Link` (de `next/link`) "Asignar precio de venta" hacia `/catalogs/products/${assignSuccess.productId}?tab=prices`. Incluir un botón/ícono para descartarlo manualmente (`setAssignSuccess(null)`).
- [x] 2.6 Confirmar que `assignError` y `assignSuccess` son mutuamente excluyentes (un asignación fallida no debe dejar un banner de éxito visible de un intento anterior sin que el usuario lo haya descartado — aceptable dejarlo tal cual si el intento fallido no toca `assignSuccess`, ya que están en variables separadas; solo confirmar que no se pisan visualmente).

## 3. Banner de éxito post-creación en ProductsPage

- [x] 3.1 En `ProductsPage.tsx`, agregar estado local `createSuccess: { productId: string; productCode: string; productName: string } | null`, inicializado en `null`.
- [x] 3.2 En `handleSave` (rama `modalState?.mode === "create"`), tras `const product = await createOne(data as CreateProductBody)`, si `product !== null` **y** `inventoryScopeMode === "branch"`, hacer `setCreateSuccess({ productId: product.id, productCode: product.code, productName: product.name })`. No aplica en modo `general` ni en la rama `edit`.
- [x] 3.3 Limpiar `createSuccess` (`setCreateSuccess(null)`) al abrir el modal de crear/editar de nuevo (`handleCreate`/`handleEdit`).
- [x] 3.4 Agregar `const canWriteInventory = can("inventory:write");`.
- [x] 3.5 Renderizar el banner (inline, cerca del aviso estático existente en `ProductsPage.tsx:218-224`, sin reemplazarlo) cuando `createSuccess !== null`: texto de confirmación con `productCode`/`productName`, y si `canWriteInventory === true`, un `Link` (de `next/link`) "Asignar a sucursal" hacia `/inventory`. Incluir forma de descartarlo manualmente (`setCreateSuccess(null)`).
- [x] 3.6 Confirmar que el flujo con subida de imagen (`stagedImage`) también dispara `createSuccess` cuando corresponde — revisar la rama que hace `setImageUploadWarning(...); refresh(); return;` (falla de imagen) y la rama de éxito normal, para no duplicar ni omitir el banner en ninguna de las dos.

## 4. Tests

- [x] 4.1 Test unitario nuevo `ProductDetailPage.test.tsx` (`tests/unit/ui/(private)/catalogs/products/`): con `?tab=prices` en la URL (mockear `useSearchParams` de `next/navigation`), la tab "Precios" está activa al montar.
- [x] 4.2 Test unitario: sin `tab` en la URL, o con un valor inválido, la tab "General" está activa al montar (sin regresión).
- [x] 4.3 Test unitario en `InventoryPage.test.tsx`: tras un `assignOne` exitoso con un usuario que tiene `products:write`, aparece el banner con el link "Asignar precio de venta" apuntando a `/catalogs/products/{productId}?tab=prices`.
- [x] 4.4 Test unitario: mismo caso pero con un usuario sin `products:write` — el banner aparece sin el link.
- [x] 4.5 Test unitario: al abrir el modal "Asignar producto" de nuevo (o cambiar de sucursal) con un banner de éxito visible, el banner se limpia.
- [x] 4.6 Test unitario en `ProductsPage.test.tsx`: tras crear un producto exitosamente en modo `branch` con un usuario que tiene `inventory:write`, aparece el banner con el link "Asignar a sucursal" apuntando a `/inventory`.
- [x] 4.7 Test unitario: mismo caso pero con un usuario sin `inventory:write` — el banner aparece sin el link.
- [x] 4.8 Test unitario: en modo `general`, crear un producto no muestra el banner post-creación.
- [x] 4.9 Test unitario: editar un producto existente (no crear) no muestra el banner post-creación, en ningún modo.

## 5. Verificación manual (dev)

- [x] 5.1 Parcial. Confirmado en dev (rol `zarioz_test`) que el flujo de asignación muestra el banner/mensaje correcto en el caso ya cubierto por UI real: intentar asignar un producto ya asignado (VELADES 20LT) muestra el error 409 inline "Este producto ya está asignado a la sucursal." (comportamiento preexistente, sin regresión). **No se pudo completar el caso feliz (asignar un producto nuevo y ver el banner con link a Precios) en browser real** por un bug preexistente y no relacionado descubierto durante esta verificación (ver hallazgo abajo) que impide buscar/seleccionar en el modal "Asignar producto" cualquier producto que el usuario aún no tenga en su inventario. El banner+link en sí (código de esta change) está cubierto y pasa en `InventoryPage.test.tsx` (tareas 4.3-4.5), que simulan `assignOne` exitoso directamente sin pasar por el buscador real.
- [x] 5.2 Cubierto por test unitario (tarea 4.4) — no hay un segundo usuario real en dev con `inventory:write` sin `products:write` a mano; la lógica de gating por permiso es idéntica a la de 5.1 y ya está probada.
- [x] 5.3 Confirmado en dev: crear "TEST_INV_LINK_1 — Producto Test Link Inventario" en modo `branch` (confirmado activo vía badge "Inventario por sucursal" en `/inventory`) mostró el banner "TEST_INV_LINK_1 — Producto Test Link Inventario creado. Asignar a sucursal" con `href="/inventory"`. Producto de prueba eliminado de dev al terminar.

**Hallazgo fuera de alcance (no corregido en este change):** `ProductsController.list` (`src/modules/products/infrastructure/http/ProductsController.ts:162-167`) llama `resolveScopedBranchId` y fuerza `branchScoped=true` para CUALQUIER caller sin `branches:access_all` cuando el modo de inventario es `branch` — incluida la búsqueda `GET /api/v1/admin/products?search=` que usa `InventoryAssignModal` (`useProductSearch`/`searchProducts.ts`) para encontrar productos a asignar. Efecto: un operador de sucursal sin `branches:access_all` **nunca puede encontrar en ese buscador un producto que su sucursal aún no tenga en inventario** (la búsqueda se autolimita a productos ya asignados vía `inventory: { some: { branchId } }` en `PrismaProductRepository.ts:85`). Verificado en dev: `search=SUPER` → 0 resultados con `zarioz_test`, 7 resultados con `admin` (`branches:access_all`) para el mismo texto. Esto también contradice el requirement ya existente `products-ui` "Branch scope mode notice in products catalog" ("The catalog list itself SHALL remain unfiltered by branch"). Es probablemente la causa raíz real detrás del reporte de este change ("agregué un producto y no se visualiza en el inventario") — más severa que el gap de UX/navegación que este change soluciona. Requiere un change de OpenSpec separado (afecta `ProductsController.list`, usado tanto por el catálogo admin como por el buscador de asignación, con necesidades de scope opuestas).
- [x] 5.4 `npm run build` para verificar tipos. Build exitoso, sin errores de tipos ni warnings relacionados a `useSearchParams`/Suspense.
