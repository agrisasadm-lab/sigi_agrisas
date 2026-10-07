## MODIFIED Requirements

### Requirement: Carga de factura SAT (CFDI) para prellenar la compra

La página `/purchases/new` SHALL incluir un uploader de XML de factura CFDI (`SatInvoiceUploader`). El parseo SHALL ocurrir en el cliente (`fast-xml-parser`, sin subir el XML al servidor). Al cargar un XML válido, el formulario SHALL prellenarse: proveedor (`newProvider` con RFC/nombre/regimen fiscal del `cfdi:Emisor`), líneas auto-mapeadas producto por producto (ver estrategia de matching abajo, con `ValorUnitario` como costo y cantidades agregadas cuando varios conceptos resuelven al mismo producto), forma de pago, y metadatos de la factura (`UUID` de `TimbreFiscalDigital`, serie+folio, fecha, nombre del archivo). La fecha de compra (`purchasedAt`) SHALL ser editable y se prefill con la fecha de la factura.

La forma de pago SHALL derivarse priorizando `MetodoPago` del CFDI (`PPD` = Pago en Parcialidades o Diferido, `PUE` = Pago en una sola Exhibición) sobre `FormaPago`:

- Si `MetodoPago="PPD"`, el sistema SHALL buscar en el catálogo de métodos de pago los `paymentMethod` activos con `isCredit=true`. Si existe exactamente uno, SHALL preseleccionarlo. `FormaPago` SHALL ignorarse en este caso (una factura PPD es a crédito independientemente de lo que indique `FormaPago`, típicamente `"99"` Por definir).
- Si no existe ningún `paymentMethod` activo con `isCredit=true` en catálogo, o si existen dos o más sin forma de desambiguar entre ellos (ej. "Crédito 30 días" y "Crédito 60 días", ambos activos), el sistema SHALL dejar la forma de pago sin preseleccionar — SHALL NUNCA adivinar entre candidatos de crédito ambiguos — y SHALL agregar un aviso a la lista de warnings indicando que la factura es a crédito pero no hay una única forma de pago de crédito activa, y que debe seleccionarse manualmente.
- Si `MetodoPago="PUE"` o es `null`/ausente, el sistema SHALL mantener el comportamiento de matcheo por `FormaPago` contra nombre/código del catálogo de métodos de pago (keyword-match), sin cambios respecto al comportamiento preexistente.
- Si esta rama (`PUE`/sin `MetodoPago`) no encuentra ningún `paymentMethod` que matchee, el sistema SHALL dejar la forma de pago sin preseleccionar y SHALL agregar un aviso a la lista de warnings indicando que no se pudo determinar la forma de pago desde la factura.

Cuando la lista de warnings generada por la carga del XML incluye al menos un aviso relacionado a forma de pago no determinada, el sistema SHALL NOT marcar la carga como aplicada sin problemas (el indicador de éxito visible al usuario SHALL reflejar que algo requiere su atención manual).

Cada `Concepto` del XML SHALL resolverse de forma independiente contra el catálogo de productos, SIN agruparse previamente por `ClaveProdServ` (el catálogo SAT no distingue por SKU en este rubro: es común que todos los productos de un mismo proveedor compartan el mismo `ClaveProdServ`). La estrategia de matching es:

1. Extraer el nombre de producto desde `Descripcion` del concepto, removiendo el prefijo `"[NoIdentificacion] "` cuando está presente.
2. Buscar candidatos en el catálogo por ese nombre (coincidencia de texto, ambas direcciones — el nombre de factura puede ser un substring del nombre de catálogo o viceversa).
3. Si hay exactamente 1 candidato, se usa como línea de esa concepto.
4. Si hay 0 candidatos, el concepto queda `unmatched`.
5. Si hay 2 o más candidatos, se desempata comparando `ClaveUnidad` del concepto contra la unidad del producto; si exactamente 1 candidato coincide en unidad se usa ese, si 0 o ≥2 siguen empatados el concepto queda `unmatched` con un aviso indicando ambigüedad (el sistema NUNCA adivina entre candidatos ambiguos).

Cuando dos o más conceptos resuelven al mismo producto, sus cantidades SHALL agregarse en una sola línea de compra (comportamiento preexistente, sin cambios).

#### Scenario: Carga de XML válido prellena el formulario
- **WHEN** el usuario selecciona un archivo `.xml` con un CFDI 4.0 válido
- **THEN** el proveedor (RFC del emisor), las líneas con producto resuelto por nombre (ver estrategia de matching), la forma de pago (derivada según `MetodoPago`/`FormaPago`) y los metadatos CFDI se prellenan, y se muestra el nombre del archivo y UUID cargados

#### Scenario: Factura a crédito (PPD) preselecciona forma de pago de crédito
- **WHEN** el XML tiene `MetodoPago="PPD"` y existe en catálogo al menos un `paymentMethod` activo con `isCredit=true`
- **THEN** ese `paymentMethod` se preselecciona como forma de pago, sin intentar matchear `FormaPago` contra texto

#### Scenario: Factura a crédito (PPD) sin una única forma de pago de crédito en catálogo
- **WHEN** el XML tiene `MetodoPago="PPD"` y el catálogo no tiene ningún `paymentMethod` activo con `isCredit=true`, o tiene dos o más sin forma de desambiguar entre ellos
- **THEN** no se preselecciona ninguna forma de pago (el sistema nunca adivina entre candidatos de crédito ambiguos) y se agrega un aviso indicando que la factura es a crédito pero no hay una única forma de pago de crédito activa, pidiendo selección manual

#### Scenario: Factura de pago en una sola exhibición (PUE) mantiene matcheo por FormaPago
- **WHEN** el XML tiene `MetodoPago="PUE"` o no incluye `MetodoPago`
- **THEN** la forma de pago se deriva por coincidencia de `FormaPago` contra nombre/código del catálogo, igual que el comportamiento preexistente

#### Scenario: Forma de pago no determinada genera aviso y evita falso "aplicado sin problemas"
- **WHEN** ninguna rama (PPD o PUE) logra determinar una forma de pago para preseleccionar
- **THEN** se agrega un aviso a la lista de warnings de la carga, y el indicador de "aplicado sin problemas" visible al usuario NO se marca como éxito mientras ese aviso esté presente

#### Scenario: Múltiples productos distintos resuelven a líneas separadas
- **WHEN** el XML tiene varios conceptos de productos distintos que comparten el mismo `ClaveProdServ`
- **THEN** cada concepto se resuelve de forma independiente por nombre y genera su propia línea (o se agrega a la línea de otro concepto solo si ambos resuelven al mismo producto), sin colapsar conceptos de productos distintos en una sola línea

#### Scenario: Conceptos sin producto equivalente avisados
- **WHEN** hay conceptos cuyo nombre (extraído de `Descripcion`) no coincide con ningún producto activo
- **THEN** se muestra un aviso listando los conceptos sin mapear (descripción, cantidad, importe) para que el usuario los agregue manualmente

#### Scenario: Coincidencia ambigua de nombre no se adivina
- **WHEN** el nombre de un concepto coincide con 2 o más productos activos y `ClaveUnidad` del concepto no permite desempatar a un único candidato (porque ninguno coincide en unidad, o porque más de uno coincide)
- **THEN** el concepto queda como no mapeado (mismo tratamiento que "sin producto equivalente"), con un aviso que indica que hubo múltiples candidatos ambiguos, en vez de elegir uno al azar

#### Scenario: Diferencias de impuestos avisadas
- **WHEN** la tasa IVA/IEPS de un producto difiere de la del XML
- **THEN** se muestra un aviso comparando ambas tasas, sin bloquear el envío (se usa la tasa del producto)
