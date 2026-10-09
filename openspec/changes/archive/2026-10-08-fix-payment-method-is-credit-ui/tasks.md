## 1. Tipos cliente

- [x] 1.1 `app/(private)/catalogs/payment-methods/_logic/types/api.ts`: agregar `isCredit: boolean` a `PaymentMethodDto` (el backend ya lo devuelve, ver spec `admin-payment-methods`) y `isCredit?: boolean` a `CreatePaymentMethodBody`. No tocar `UpdatePaymentMethodBody`.
- [x] 1.2 `app/(private)/catalogs/payment-methods/_logic/types/domain.ts`: agregar `isCredit: boolean` a `PaymentMethod`.
- [x] 1.3 `app/(private)/catalogs/payment-methods/_logic/services/listPaymentMethods.ts`: mapear `isCredit` en `toPaymentMethod` (dto → domain).

## 2. Schema de validación

- [x] 2.1 `app/(private)/catalogs/payment-methods/_logic/schemas/paymentMethod.schema.ts`: agregar `isCredit: z.boolean().optional()` a `createPaymentMethodSchema`. No tocar `updatePaymentMethodSchema`.

## 3. Modal

- [x] 3.1 `PaymentMethodEditModal.tsx`: agregar estado `isCredit` (default `false`), reseteado a `false` en `mode="create"` y a `entity.isCredit` en `mode="edit"` (mismo `useEffect` que ya resetea `code`/`name`/`description`/`isActive`).
- [x] 3.2 Renderizar `Switch` "Es crédito" junto al switch "Activo" existente: `checked={isCredit}`, `onChange={setIsCredit}` sólo activo cuando `isCreateMode`; en modo edición pasar `disabled` (mismo patrón visual que el input `code`).
- [x] 3.3 Incluir `isCredit` en el payload de `validate()`/`handleSave()` para `mode="create"` (`createPaymentMethodSchema.safeParse({ code, name, description, isActive, isCredit })` y `onSave({ code, name, description, isActive, isCredit })`).
- [x] 3.4 Confirmar que `getDiff()` (modo edit) NO incluye `isCredit` bajo ninguna condición — no agregar ninguna línea ahí; dejar explícito con comentario breve si ayuda a no romperlo a futuro.
- [x] 3.5 Confirmar que `isDirty` (modo create) considera `isCredit !== false` para habilitar "Guardar" cuando sólo se tocó el switch.

## 4. Tests

- [x] 4.1 Test de `paymentMethod.schema.ts`: `createPaymentMethodSchema` acepta `isCredit: true`/`false`/ausente.
- [x] 4.2 Test de `PaymentMethodEditModal` (RTL): en `mode="create"`, togglear "Es crédito" y guardar incluye `isCredit: true` en `onSave`.
- [x] 4.3 Test de `PaymentMethodEditModal` (RTL): en `mode="edit"` con `entity.isCredit=true`, el switch se renderiza marcado y `disabled`.
- [x] 4.4 Test de `PaymentMethodEditModal` (RTL): en `mode="edit"`, cambiar `name`/`isActive` y guardar — el diff enviado a `onSave` no contiene la clave `isCredit`.
- [x] 4.5 Correr `npm test -- payment-methods` (o el path específico) y confirmar verde.

## 5. Verificación manual

- [x] 5.1 En dev (`.env.local`), crear una forma de pago nueva con "Es crédito" activado, confirmar en `npx prisma studio` o vía `GET /api/v1/admin/payment-methods/:id` que `isCredit=true`.
- [x] 5.2 Registrar una venta en `/pos` con esa forma de pago y confirmar que la venta resultante tiene `paymentStatus='pending'` y `paidAmount=0` (no "efectivo").
