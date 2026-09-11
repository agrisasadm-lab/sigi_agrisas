## 1. Clase de error tipada para mensajes 400 no mapeados (Historia 2)

- [x] 1.1 Agregar `PurchaseValidationError` en `app/(private)/purchases/_logic/errors.ts` (extiende `Error`, constructor recibe el `message` real del backend y lo asigna vía `super(message)`, `name = "PurchaseValidationError"`).

## 2. Servicio `createPurchase.ts` (Historia 2)

- [x] 2.1 En el bloque `if (res.status === 400)` de `createPurchase.ts`, reemplazar el `throw new NetworkError()` final por `throw new PurchaseValidationError(errorBody.error)` cuando el mensaje no matchea ninguno de los 3 casos ya mapeados.
- [x] 2.2 Verificar que los 3 casos ya mapeados (`Provider not found or inactive`, `Product not found or inactive`, `Purchase must include at least one item`) siguen intactos sin regresión.

## 3. Guardia de lote/caducidad en `canSubmit` (Historia 1)

- [x] 3.1 En `useCreatePurchaseForm.ts`, agregar `linesValid = lines.every((l) => Boolean(l.lotNumber) === Boolean(l.expirationDate))` y sumarlo a `canSubmit`.
- [x] 3.2 `PurchaseLineRow.tsx` ya recibe `line` completo por props (`lotNumber`/`expirationDate`); calcula el mismo booleano localmente (1 línea) en vez de agregar un campo nuevo al hook — evita una abstracción innecesaria para un check trivial.

## 4. Aviso visual por línea (Historia 1)

- [x] 4.1 En `PurchaseLineRow.tsx`, mostrar un aviso (texto + estilo de error en los inputs de Lote/Caducidad) cuando `Boolean(line.lotNumber) !== Boolean(line.expirationDate)`.
- [x] 4.2 Ajustar el `placeholder="Opcional"` del input de Lote para aclarar que es opcional en pareja con Caducidad (ej. "Opcional (junto con caducidad)").

## 5. Guardia de `branchId` vacío (Historia 3)

- [x] 5.1 En `useCreatePurchaseForm.ts`, sumar `Boolean(branchId)` a `canSubmit`.
- [x] 5.2 Confirmado: `branchId` para no-bypass ya viene poblado del JWT (`CreatePurchasePage.tsx:40`, `userBranchId ?? ""`), sólo es `""` en el caso bypass sin selección — el check cubre ambos sin ramificar por `isBypass` ni tocar el `<select>`.

## 6. Orden del schema Zod del RFC (Historia 4)

- [x] 6.1 En `src/modules/purchases/infrastructure/http/PurchasesController.ts`, reordenar `newProviderSchema.rfc` de `.trim().regex(...).toUpperCase()` a `.trim().toUpperCase().regex(...)`.

## 7. Verificación manual (dev, Playwright)

- [x] 7.1/7.2 Verificado en dev con Playwright (`admin@example.com`, sucursal TLAXIACO): línea con Caducidad=2026-09-10 y Lote vacío → aviso "Captura lote y caducidad juntos, o deja ambos vacíos." visible en la línea y botón deshabilitado (reproduce el bug real reportado). Al completar Lote → aviso desaparece, botón se habilita, compra se crea (201) y redirige a `/purchases/<id>`.
- [x] 7.3 Verificado: con sucursal sin elegir (admin bypass) el botón queda deshabilitado aun con proveedor+forma de pago+producto completos; al elegir sucursal se habilita.
- [x] 7.4 Verificado: se desactivó temporalmente `payment_methods` "Transferencia" en BD dev (`qzzjpyepggwautckqeex`, reactivada de inmediato tras la prueba), se seleccionó desde un tab con caché stale y se envió → la UI mostró el mensaje real "PaymentMethod is inactive" en vez del genérico.
- [x] 7.5 Verificado con un XML CFDI de prueba (`.playwright-mcp/test-cfdi-lowercase-rfc.xml`, RFC emisor `zzz010101zz1` en minúsculas) vía el uploader "Factura SAT": la compra se creó y el proveedor quedó persistido con `rfc = "ZZZ010101ZZ1"` (confirmado en BD).

## 8. Pruebas automatizadas y suite

- [x] 8.1 Agregado a `tests/unit/ui/(private)/purchases/_logic/hooks/useCreatePurchaseForm.test.tsx`: tests para branchId vacío, caducidad sin lote, lote sin caducidad, y ambos capturados (canSubmit=true). Agregado además a `tests/unit/ui/(private)/purchases/_logic/services/purchasesServices.test.ts` (gap detectado en `opsx:verify`): test de `createPurchase` cubriendo `PurchaseValidationError` con el mensaje real del servidor en un 400 no mapeado.
- [x] 8.2 Omitido — no existe suite de tests para `PurchasesController.ts` ni precedente en el repo de exportar/testear un schema Zod inline de un controller (`newProviderSchema` no está exportado). Crear ese test implicaría exportar el schema sólo para testing, fuera del alcance mínimo de este fix. Cobertura de este caso queda en la verificación manual (tarea 7.5).
- [x] 8.3 `npx jest purchases` → 20 suites / 152 tests, todo verde (incluye los 4 tests nuevos de canSubmit).
