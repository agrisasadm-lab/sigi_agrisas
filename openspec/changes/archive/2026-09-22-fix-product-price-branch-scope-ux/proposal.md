## Historia de Usuario

| # | Rol | Tarea | Motivo | Criterios de Aceptación | Criterios de Seguridad |
|---|---|---|---|---|---|
| 1 | Operador de sucursal sin `branches:access_all` (ej. rol `tienda_zarioz`/`zarioz_test`) | Como operador de sucursal, quiero que el selector de sucursal en la pestaña Precios de un producto solo me muestre mi propia sucursal para crear overrides sin toparme con un error al elegir una sucursal ajena | Evita intentos inválidos y confusión: hoy el dropdown lista todas las sucursales aunque el backend solo permita crear en la mía | - Given usuario sin `branches:access_all`, When abre el selector de sucursal en la tab Precios, Then solo aparece su propia sucursal (además de "Precio base (todas)")<br>- Given usuario CON `branches:access_all` (ej. admin), When abre el mismo selector, Then sigue viendo todas las sucursales activas, sin cambio de comportamiento<br>- Given el usuario no tiene sucursal asignada (`branchId=null`) y no tiene `branches:access_all`, When abre el selector, Then solo ve la opción "Precio base (todas)" (sin sucursales específicas) | - El filtrado es solo UX/presentación — no reemplaza `enforceBranchScope` en el backend, que sigue siendo la única fuente de verdad de autorización<br>- El `branchId` del usuario se obtiene de `useCurrentUser()` (derivado del JWT), nunca de un input editable por el cliente |
| 2 | Operador de sucursal sin `branches:access_all` | Como operador de sucursal, quiero ver un mensaje claro en español si intento crear un precio para una sucursal que no es la mía, para entender por qué falló en vez de ver el texto crudo "Forbidden" | Mejora la percepción de error: hoy el 403 de branch-scope se muestra tal cual, sin contexto, lo que se interpreta como "no puedo agregar precios" en general | - Given un intento de crear precio con `branchId` distinto al propio (ej. estado stale del selector), When el backend responde 403 con `required: "branches:access_all"`, Then el banner de error en `ProductPricesTab` muestra "No puedes crear precios para otra sucursal." en vez del texto crudo del backend<br>- Given cualquier otro error (400 validación, 404 producto, 409 nombre/default duplicado), When ocurre, Then el mensaje específico existente (`nameError`/`defaultError`/mensaje genérico) no se ve afectado por este cambio | - El mensaje traducido no debe filtrar detalles internos (IDs de sucursal, headers) — solo el texto genérico de la acción bloqueada<br>- No se debilita ni se oculta el código HTTP 403 real para fines de debugging (consola/network sigue mostrando el 403 original) |

## Why

El selector de sucursal de la pestaña "Precios" (`ProductPricesTab.tsx`) usa `useBranchesOptions()` para listar **todas** las sucursales activas del catálogo, sin considerar el `branchId` propio del usuario ni si tiene `branches:access_all`. El backend sí aplica ese scope: `ProductPricesController.create` llama `enforceBranchScope(req, branchId)` (`src/modules/rbac/infrastructure/http/enforceBranchScope.ts`), que devuelve 403 cuando el `branchId` del precio no coincide con `x-user-branch-id` del usuario y este no tiene `branches:access_all`. El resultado: cualquier operador de sucursal (roles custom como `tienda_zarioz` en prod / `zarioz_test` en dev, sin `branches:access_all`) puede elegir una sucursal ajena en el dropdown, intentar crear el override, y recibir un 403 que la UI muestra tal cual ("Forbidden"), sin explicar que el problema es la sucursal elegida.

Esto se reprodujo end-to-end en dev (usuario real, rol `zarioz_test`, sucursal ZARIOZ): crear precio base → 201; crear override en ZARIOZ (propia) → 201; crear override en "Matriz" (ajena) → 403 con banner "Forbidden". El bug reportado como "no se pueden agregar precios" es este: no es un problema de permisos faltantes (el rol sí tiene `products:write`), sino de un selector que no refleja el scope real de sucursal del usuario, sumado a un mensaje de error que no comunica la causa.

## What Changes

- `ProductPricesTab.tsx`: cuando el usuario no tiene `branches:access_all`, el `<select>` de sucursal solo muestra "Precio base (todas)" + la sucursal propia del usuario (via `useCurrentUser().branchId`), en vez de las opciones de `useBranchesOptions()` sin filtrar. Usuarios con `branches:access_all` mantienen el comportamiento actual (todas las sucursales activas).
- `ProductPricesTab.tsx` / `useProductPrices`: el error 403 de `enforceBranchScope` (respuesta `{"error":"Forbidden","required":"branches:access_all"}`) se traduce a un mensaje fijo en español ("No puedes crear precios para otra sucursal.") en el banner `saveError`, en vez de mostrar el texto crudo del backend.
- Sin cambios de backend: `enforceBranchScope` y `ProductPricesController` ya son correctos y siguen siendo la fuente de verdad de autorización.

## Capabilities

### New Capabilities
_(ninguna)_

### Modified Capabilities
- `products-ui`: el requirement "Product prices management in the Precios tab" cambia — el selector de sucursal deja de listar incondicionalmente todas las sucursales activas y ahora se filtra según `branches:access_all` del usuario; se agrega el mapeo del error 403 de branch-scope a un mensaje traducido.

## Impact

- **Archivo modificado**: `app/(private)/catalogs/products/_blocks/ProductPricesTab.tsx` (filtrado del selector + traducción del error).
- **Sin cambios de API, schema, ni permisos**: no se toca `ProductPricesController.ts`, `enforceBranchScope.ts`, ni `CreateProductPriceUseCase.ts`.
- **Sin cambios de datos**: no requiere migración ni seed.
- **Alcance de pruebas**: unit test de UI (`tests/unit/ui/...`) para el filtrado condicional del selector y la traducción del mensaje de error; no requiere test de integración backend (sin cambios ahí).
