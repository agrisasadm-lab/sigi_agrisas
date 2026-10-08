## Historia de Usuario

| # | Rol | Tarea | Motivo | Criterios de Aceptación | Criterios de Seguridad |
|---|---|---|---|---|---|
| 1 | Operador/Administrador de Compras (`purchases:create`) | Como Operador de Compras, quiero que el sistema detecte automáticamente cuando una factura CFDI es a crédito (`MetodoPago=PPD`) y preseleccione una forma de pago de crédito del catálogo, para no registrar por error una compra a crédito como si fuera de contado | Evitar descuadre en cuentas por pagar a proveedores por mala clasificación del tipo de pago | - Given XML con `MetodoPago="PPD"`, When se importa, Then el sistema busca en catálogo un `paymentMethod` activo con `isCredit=true` y lo preselecciona (ignora keyword-match de `FormaPago` para esta rama)<br>- Given `MetodoPago="PPD"` y NO hay ningún `paymentMethod` activo con `isCredit=true` en catálogo, When se importa, Then no se autoselecciona nada y se agrega warning explícito "Factura a crédito (PPD) sin forma de pago de crédito activa en catálogo, selecciona manualmente"<br>- Given `MetodoPago="PUE"`, When se importa, Then se mantiene el comportamiento actual (match por `FormaPago`/keywords)<br>- Given XML sin nodo `MetodoPago` (null), When se importa, Then se trata igual que PUE, sin crash | - Preselección sólo puede recaer en `paymentMethod` con `isActive=true`, nunca inactivo<br>- Parseo sigue siendo 100% client-side (no se sube el XML al servidor) — sin regresión<br>- Backend mantiene su propia validación de `paymentMethod` activo e `isCredit` al confirmar la compra (defensa en profundidad ya existente en `PrismaPurchaseRepository`, no se toca) |
| 2 | Operador/Administrador de Compras (`purchases:create`) | Como Operador de Compras, quiero recibir una alerta visible cuando el sistema no logra determinar la forma de pago desde el XML (crédito o contado), para no confiar en una bandera de "aplicado correctamente" que hoy es falsa | Eliminar el falso positivo de `satApplied=true` que hoy oculta que el campo forma de pago quedó sin resolver — causa raíz de que se someta la compra con el método equivocado sin darse cuenta | - Given `paymentMethodId` resuelve `null` (rama PPD sin match o rama PUE sin match), When se aplica el resultado del parseo, Then se agrega un warning al arreglo de warnings (hoy solo cubre diffs de IVA/IEPS)<br>- Given existe al menos un warning de forma de pago, When se evalúa si marcar `satApplied=true`, Then debe quedar `false`<br>- El selector de forma de pago sigue siendo obligatorio para submit (ya existente — se mantiene como red adicional, no sustituto) | - Warning es sólo informativo en UI, no bloquea edición manual del campo<br>- No se valida en backend "por qué" se eligió tal forma de pago — fuera de alcance |

## Why

El importador de XML CFDI en `/purchases/new` sólo deriva la forma de pago de `FormaPago` (01=efectivo, 02=cheque, 03=transferencia, 04=tarjeta), vía keyword-match de texto contra nombre/código del catálogo de métodos de pago. El CFDI mexicano trae un campo separado, `MetodoPago` (`PPD` = Pago en Parcialidades o Diferido, `PUE` = Pago en una sola Exhibición), que es la señal fiscal real de si la factura es a crédito. El parser (`satXmlParser.ts`) ya extrae `metodoPago` del XML, pero `satInvoiceMapping.ts` nunca lo consume: facturas `PPD` traen típicamente `FormaPago="99"` (Por definir), que no matchea ningún keyword y resuelve a `paymentMethodId=null` — sin generar ningún warning. El usuario ve el formulario "aplicado" (`satApplied=true`) y puede terminar enviando una compra a crédito marcada como contado, sin ninguna señal de que algo quedó sin resolver.

Esto ya corrompió datos en prod: compras a crédito registradas como contado, con el descuadre correspondiente en el estado de cuenta de proveedores. El fix corrige la detección hacia adelante usando `MetodoPago` como señal primaria y agrega un warning explícito cuando la forma de pago no puede determinarse con confianza, en vez de fallar en silencio.

## What Changes

- `mapFormaPagoToPaymentMethod` se reemplaza por una función que recibe tanto `metodoPago` como `formaPago`:
  - `metodoPago === "PPD"` → busca en catálogo un `paymentMethod` activo con `isCredit=true` (match por flag, no por texto). Si no hay ninguno, retorna `null` y se emite warning.
  - `metodoPago === "PUE"` o `null` → comportamiento actual (keyword-match contra `FormaPago`), pero ahora también emite warning si no hay match.
- `buildSatApplyResult` agrega un warning al arreglo `warnings` cuando `paymentMethodId` resuelve `null`, en ambas ramas. `CreatePurchasePage` ya calcula `satApplied=true` sólo si `warnings.length === 0 && unmatched.length === 0` (`handleSatParsed`), así que empujar el warning ahí es suficiente — no se requiere tocar el cálculo de `satApplied` por separado.
- `openspec/specs/purchases-ui/spec.md`, sección "Requirement: Carga de factura SAT (CFDI) para prellenar la compra", se actualiza para documentar `MetodoPago` PPD/PUE como señal primaria de forma de pago, `FormaPago` como secundaria sólo para desambiguar método concreto en PUE, y el nuevo warning cuando no hay match.

**Fuera de alcance (decisión operativa aparte, no parte de este proposal):** corrección retroactiva de compras ya mal clasificadas en prod.

## Capabilities

### New Capabilities
(ninguna)

### Modified Capabilities
- `purchases-ui`: el requirement "Carga de factura SAT (CFDI) para prellenar la compra" cambia — la forma de pago ya no se deriva únicamente de `FormaPago`; ahora `MetodoPago` (PPD/PUE) es la señal primaria, y se agrega un warning explícito cuando la forma de pago no puede determinarse (hoy el flujo falla en silencio).

## Impact

- `app/(private)/purchases/_logic/lib/satXmlParser.ts` — sin cambios de parseo (ya expone `metodoPago`), sólo empieza a consumirse.
- `app/(private)/purchases/_logic/lib/satInvoiceMapping.ts` — cambia la firma/lógica de `mapFormaPagoToPaymentMethod` y la generación de `warnings` en `buildSatApplyResult`.
- `app/(private)/purchases/_blocks/CreatePurchasePage.tsx` — sin cambios esperados; `satApplied` ya depende de `warnings.length`, se beneficia automáticamente del nuevo warning. Verificar en implementación que no haya un segundo cálculo duplicado.
- `app/(private)/purchases/_logic/hooks/useCreatePurchaseForm.ts` — sin cambios de contrato esperados (recibe `SatApplyResult` igual que hoy); verificar en implementación.
- `openspec/specs/purchases-ui/spec.md` — actualización del requirement de carga SAT.
- Tests existentes de `satInvoiceMapping` (si existen) deben actualizarse para cubrir los nuevos casos PPD/PUE/sin-match.
- No afecta backend (`src/modules/purchases/`) ni schema — el fix es puramente client-side, de prellenado/asistencia; la validación de `paymentMethod.isCredit` en el backend ya existe y no se toca.
