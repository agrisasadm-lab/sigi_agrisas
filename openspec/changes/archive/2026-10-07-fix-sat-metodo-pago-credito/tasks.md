## 1. Lógica de mapeo (`satInvoiceMapping.ts`)

- [x] 1.1 Reemplazar `mapFormaPagoToPaymentMethod(formaPago, paymentMethods)` por una función que reciba también `metodoPago: string | null` (ej. `resolvePaymentMethodFromSat(metodoPago, formaPago, paymentMethods)`), devolviendo `{ paymentMethodId: string | null; warning: string | null }` en vez de sólo el id.
- [x] 1.2 Rama `metodoPago === "PPD"`: buscar en `paymentMethods` (ya filtrados a activos por `usePaymentMethodsOptions`) exactamente un `pm.isCredit === true`. Si hay exactamente 1, devolverlo. Si hay 0 o ≥2, devolver `paymentMethodId: null` con warning explícito ("Factura a crédito (PPD) sin una única forma de pago de crédito activa en catálogo, selecciona manualmente").
- [x] 1.3 Rama `metodoPago === "PUE"` o `null`/ausente: mantener `FORMA_PAGO_KEYWORDS` y el keyword-match actual tal cual. Si no hay match, devolver `paymentMethodId: null` con warning ("No se pudo determinar la forma de pago desde la factura, selecciona manualmente").
- [x] 1.4 Actualizar `buildSatApplyResult` (línea ~159) para usar la nueva función y, si el `warning` devuelto no es `null`, empujarlo al array `warnings` existente (el mismo que ya usan los avisos de IVA/IEPS).
- [x] 1.5 Verificar que `CreatePurchasePage.handleSatParsed` no necesita cambios — confirmar que `satApplied` sigue calculándose como `warnings.length === 0 && unmatched.length === 0` y que el nuevo warning lo hace `false` automáticamente.

## 2. Tests

- [x] 2.1 Buscar si existe un archivo de test para `satInvoiceMapping.ts` (`tests/unit/ui/...`); si no existe, crear uno nuevo siguiendo la convención `tests/unit/ui/...` del proyecto (`jsdom`). (ya existía, se extendió)
- [x] 2.2 Caso: `metodoPago="PPD"` + 1 `paymentMethod` activo con `isCredit=true` en catálogo → se preselecciona ese id, sin warning de forma de pago.
- [x] 2.3 Caso: `metodoPago="PPD"` + 0 `paymentMethod` con `isCredit=true` → `paymentMethodId=null`, warning presente.
- [x] 2.4 Caso: `metodoPago="PPD"` + 2 `paymentMethod` con `isCredit=true` (ambiguo) → `paymentMethodId=null`, warning presente (no se adivina).
- [x] 2.5 Caso: `metodoPago="PUE"` con `formaPago` matcheable → comportamiento preexistente sin cambios (test de regresión).
- [x] 2.6 Caso: `metodoPago="PUE"` sin match de `formaPago` → `paymentMethodId=null`, warning presente (hoy no existe este warning, es el fix).
- [x] 2.7 Caso: `metodoPago=null` (XML sin el nodo) → se trata igual que PUE, sin crash.
- [x] 2.8 Caso integración mínima: `buildSatApplyResult` con un `parsed` que combine lo anterior, confirmar que `result.warnings` incluye el mensaje esperado y que no se perdió ningún warning de IVA/IEPS existente.

## 3. Documentación / Spec

- [x] 3.1 Confirmar que `openspec/changes/fix-sat-metodo-pago-credito/specs/purchases-ui/spec.md` (ya creado en fase de propuesta) refleja fielmente el comportamiento final implementado — ajustar si la implementación difiere en algún detalle del delta spec. (coincide: match por `isCredit`, ambigüedad no se adivina, PUE sin cambios, warning en ambas ramas sin match)

## 4. Verificación manual

- [x] 4.1 Probar en `/purchases/new` con un XML CFDI real `MetodoPago="PPD"` (crédito) — confirmar preselección correcta o warning según catálogo del entorno de prueba. (Playwright contra dev local: `Forma de pago` auto-selecciona "Crédito", muestra nota "Compra a crédito: quedará pendiente de pago...", sin warning de forma de pago)
- [x] 4.2 Probar con un XML CFDI real `MetodoPago="PUE"` con `FormaPago` conocido (ej. `"03"` transferencia) — confirmar que sigue matcheando igual que antes. (Playwright contra dev local: auto-selecciona "Transferencia", sin nota de crédito, comportamiento preexistente intacto)
- [x] 4.3 Ejecutar `npm run build` y la suite de tests (`npm test`) antes de dar por cerrada la implementación. (tsc: 34 errores preexistentes sin relación al cambio, confirmado con `git stash`; jest: 4274/4274 tests pasan, 576/578 suites, 2 skips preexistentes)
