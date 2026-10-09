## Historia de Usuario

| # | Rol | Tarea | Motivo | Criterios de Aceptación | Criterios de Seguridad |
|---|---|---|---|---|---|
| 1 | Administrador (`payment_methods:write`) | Como Administrador, quiero marcar una forma de pago como "Es crédito" al crearla, para que las ventas registradas con ese método se calculen y guarden correctamente como venta a crédito (`paidAmount=0`, `paymentStatus='pending'`) en vez de como efectivo | - Given el modal en modo `create`, When despliego el formulario, Then veo un switch "Es crédito" (default `false`, mismo patrón visual que el switch "Activo")<br>- Given marco el switch en `true` y guardo, When se envía `POST /api/v1/admin/payment-methods`, Then el body incluye `isCredit: true` y el registro creado en BD tiene `is_credit=true`<br>- Given no toco el switch, When guardo, Then se envía `isCredit: false` (o se omite y el backend defaultea `false`) — sin cambio de comportamiento para el caso ya existente<br>- Given el modal en modo `edit`, When lo abro, Then el switch "Es crédito" se muestra pero deshabilitado (mismo patrón que el campo `code` inmutable), reflejando el valor actual sin permitir cambiarlo<br>- Given estoy en modo `edit` y cambio otros campos (nombre, descripción, activo), When calculo el diff para el PATCH, Then `isCredit` nunca aparece en el diff | - El campo `isCredit` solo se acepta en el payload de `POST` (creación); el schema de `PATCH` (`updatePaymentMethodSchema`) no lo incluye<br>- Gate existente de permiso `payment_methods:write` sigue aplicando sin cambios — no se introduce ruta ni acción nueva<br>- No se permite editar `isCredit` desde ningún flujo de edición, preservando la inmutabilidad ya implementada en backend (`PaymentMethodsController` ignora el campo en PATCH) — el fix es solo de UI, no abre superficie de mutación nueva |

Historia única — cambio acotado a un campo, un modal, un schema; no amerita partirse.

## Why

El backend ya soporta correctamente `isCredit` desde su creación: `PaymentMethodsController` lo acepta en `POST`, lo ignora en `PATCH` (inmutable por diseño), y `CreateSaleUseCase` lo consume para decidir si una venta es a crédito (`paidAmount=0`, `paymentStatus='pending'`) o de contado. El spec `admin-payment-methods` documenta este contrato completo. Pero `PaymentMethodEditModal` — el único punto de entrada para crear formas de pago — nunca expuso ese campo: ni el formulario, ni `createPaymentMethodSchema`, ni `CreatePaymentMethodBody` lo incluyen. Resultado: toda forma de pago creada desde el panel queda `is_credit=false` para siempre (el backend defaultea a `false` si no llega, y es inmutable después), así que no existe forma de crear una forma de pago de crédito real desde la UI.

Esto causó que ventas marcadas por el cajero con un método pensado como "crédito" se calcularan y guardaran como venta de contado — bug reportado, arrastrado desde que existe el POS porque nunca producía un error visible. Se confirmó la causa raíz contra datos reales de PROD: la forma de pago activa `CRED` ("CREDITO") tenía `is_credit=false`, mientras la seed original `CREDITO` (con `is_credit=true`) quedó inactiva — evidencia de que en algún punto se creó manualmente un reemplazo vía el panel, que por este gap de UI nació con el flag equivocado e inmutable. El dato de PROD ya fue corregido directamente (fuera de este change, con aprobación explícita del usuario) para desbloquear operación inmediata; este change cierra el hueco de UI para que no vuelva a pasar.

## What Changes

- `PaymentMethodEditModal` (`app/(private)/catalogs/payment-methods/_blocks/PaymentMethodEditModal.tsx`): agrega un `Switch` "Es crédito" visible en ambos modos — habilitado y editable sólo en `mode="create"` (default `false`), deshabilitado/solo-lectura en `mode="edit"` (mismo patrón que el input `code`).
- `createPaymentMethodSchema` (`app/(private)/catalogs/payment-methods/_logic/schemas/paymentMethod.schema.ts`): agrega `isCredit: z.boolean().optional()`. `updatePaymentMethodSchema` no cambia (sigue sin el campo, consistente con la inmutabilidad).
- `CreatePaymentMethodBody` (tipo en `app/(private)/catalogs/payment-methods/_logic/types/api.ts` o equivalente): agrega `isCredit?: boolean`.
- Sin cambios en backend, en `createPaymentMethod` service (ya reenvía el body tal cual al `POST`), ni en ningún otro módulo.

## Capabilities

### New Capabilities

(ninguna)

### Modified Capabilities

- `catalogs-ui`: el requirement "Create modal per catalog" especifica actualmente los inputs editables por módulo y para `payment-methods` sólo lista `code`, `name`, `isActive`, `description`. Se añade `isCredit` (`Switch`, sólo editable en `mode="create"`, deshabilitado en `mode="edit"`) a esa lista.

## Impact

- **Archivos**: `PaymentMethodEditModal.tsx`, `paymentMethod.schema.ts`, tipo `CreatePaymentMethodBody` en `_logic/types/api.ts`.
- **API**: ninguna — `POST /api/v1/admin/payment-methods` ya acepta `isCredit`; sólo empieza a usarse desde la UI.
- **Datos**: ninguno en este change (la corrección de PROD ya se aplicó fuera de este proposal).
- **Tests**: agregar/actualizar test de `PaymentMethodEditModal` (render del switch, disabled en edit, inclusión en el payload de create) y del schema Zod.
