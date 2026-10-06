## Context

Ver `proposal.md` — Why / Historia de Usuario. Este change consume los endpoints de `add-expenses-api` (dependencia dura, debe estar mergeado y desplegado antes de poder validar end-to-end). La UI sigue al pie de la letra los patrones ya establecidos: Atomic Design + `_logic/` por feature (CLAUDE.md → "Arquitectura Frontend"), receta de catálogo (`app/(private)/catalogs/departments/`) para el CRUD, y receta de reporte (`app/(private)/payments/history/`) para `/expenses/report`. No se introduce ningún patrón nuevo de UI.

## Goals / Non-Goals

**Goals:**
- Listado, alta, edición y soft delete de gastos con gating de permisos consistente con el resto del panel (filas 1-4, 6).
- Reporte exportable PDF/XLSX calcado de `payments/history` (fila 5).
- Reutilizar `ImageUploadField` generalizándolo, en vez de clonar un componente casi idéntico.

**Non-Goals:**
- No se construye un flujo de aprobación/autorización de gastos — fuera de alcance del pedido original.
- No se agrega filtro de "categoría de gasto" en la UI — el backend no lo modela (ver `add-expenses-api`).
- No se resuelve aquí ningún cambio de comportamiento del backend — cualquier ajuste a `expenses-api` va en ese change.

## Decisions

**1. Ruta top-level `/expenses`, no bajo `/catalogs`.**
Un gasto es un registro operativo con fecha propia (como `sales`/`payments`/`returns`/`purchases`), no un catálogo maestro de códigos inmutables (como `providers`/`departments`). Seguir la convención ya usada evita que el usuario busque "Gastos" en el hub de catálogos por error.

**2. Generalizar `ImageUploadField.productId` → `entityId` en vez de clonar el componente.**
El componente ya recibe `uploadFn`/`deleteFn` inyectados (genérico por diseño); sólo el nombre del prop delata acoplamiento a "producto". Renombrar es un cambio mecánico de bajo riesgo (un solo consumidor actual: catálogo de productos) y evita mantener dos componentes casi idénticos, violando la regla de reutilización del proyecto.

**3. Alta con foto en dos llamadas encadenadas (`createExpense` → `uploadExpensePhoto`), no un único POST multipart.**
El backend (`add-expenses-api`) expone `photo` como endpoint separado porque el `id` del gasto debe existir antes de subir el archivo — mismo patrón ya usado por `products`. La UI no introduce una convención nueva de "creación con multipart combinado"; encadena las dos llamadas de forma transparente para el usuario dentro del mismo submit del modal.

**4. Manejo de fallo parcial (gasto creado, foto falla): no hacer rollback del gasto.**
Revertir (borrar) un gasto ya persistido sólo porque la foto falló añadiría una operación de compensación no trivial (y el backend no ofrece una transacción conjunta gasto+foto). Se opta por dejar el gasto creado y notificar al usuario que puede reintentar la subida desde edición — consistente con que la foto es explícitamente opcional en el dominio.

**5. Reporte reutiliza el layout exacto de `payments/history` (`PageShell` sin prop `toolbar`, filtro en `children`).**
Ya es la receta de "Página de reporte" documentada en `designer.md`; no se diseña un layout alternativo.

## Riesgos / Trade-offs

- **[Riesgo]** Renombrar `productId`→`entityId` en `ImageUploadField` es un cambio compartido: si algún otro lugar del código referencia ese prop por nombre fuera del único consumidor detectado (`catalogs/products`), se rompe en build. → **Mitigación**: `npm run build` (verifica tipos) detecta cualquier uso no actualizado antes de mergear; grep del prop como paso explícito en tasks.
- **[Riesgo]** Doble llamada (create + upload foto) deja una ventana donde el gasto existe sin foto si el usuario cierra la pestaña entre ambas. → **Mitigación**: aceptado, mismo comportamiento ya presente en el flujo de creación de producto + imagen; el usuario puede completar la foto después desde edición.
- **[Trade-off]** Este change no se puede probar end-to-end (crear/editar/subir foto) hasta que `add-expenses-api` esté desplegado en el ambiente de prueba. → Aceptado: mismo orden ya usado en pares `product-kardex-api`/`product-kardex-ui`; el desarrollo de componentes presentacionales y schemas Zod puede avanzar en paralelo con mocks de servicio.
