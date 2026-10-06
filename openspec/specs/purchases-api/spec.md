## Purpose

Define el comportamiento del backend para registrar compras que la empresa hace a proveedores, incluyendo el incremento de inventario resultante y el control de cuentas por pagar (abonos a proveedor) cuando la compra es a crédito.
## Requirements
### Requirement: Registro de una compra a un proveedor

El sistema SHALL permitir registrar una compra (`Purchase`) contra un proveedor activo, compuesta de una o más líneas (`PurchaseItem`). Al confirmarse, SHALL asignar un folio del catálogo con `code="CP"` y `scope="OPERATIONS"` (resuelto automáticamente por el backend, no seleccionable por el cliente), numerado de forma independiente por sucursal (contador `folio_branch_counters`, mismo mecanismo que `pos-api` — "Create sale (atomic emission)"; el `folioCode` resultante tiene el formato `CP-<BRANCH_CODE>-<NNNNNN>`, ej. `CP-ZARIOZ-000001`, distinto del legacy `CP-NNNNNN` global que se preserva sin migrar), SHALL incrementar el inventario de la sucursal por cada línea, y SHALL snapshotear código, nombre y costo unitario del producto en el momento de la compra. Los totales (`subtotal`, `ivaTotal`, `iepsTotal`, `total`) SHALL calcularse con redondeo half-to-even a 4 decimales, misma fórmula que Sale/Quote/Return — incluyendo la extracción de impuesto descrita abajo. Cada línea SHALL aceptar opcionalmente `lotNumber` y `expirationDate` (par completo o ninguno; ver capability `inventory-lots` para el detalle de captura y validación). Adicionalmente, dentro de la misma transacción, el sistema SHALL actualizar `products.acquisition_price` de cada producto referenciado con el `unitCost` de su línea — si una compra confirma correctamente, el costo de adquisición del producto queda igualado al último costo comprado; si la compra tiene múltiples líneas para el mismo producto, la última línea procesada gana.

#### Scenario: Compra de contado registrada exitosamente
- **WHEN** un usuario con `purchases:create` envía una compra con proveedor activo, forma de pago sin crédito (`paymentMethod.isCredit=false`) y líneas válidas (producto activo, cantidad > 0, costo ≥ 0)
- **THEN** la compra se crea con folio `CP-<BRANCH_CODE>-NNNNNN` (numerado dentro del consecutivo propio de esa sucursal), `paidAmount=total`, `paymentStatus="paid"`, el inventario de cada producto en la sucursal incrementa en la cantidad de su línea, y cada línea queda con `productCodeSnapshot`/`productNameSnapshot`/`unitCost` fijos

#### Scenario: Compra a crédito incrementa el saldo del proveedor
- **WHEN** la compra se registra con `paymentMethod.isCredit=true`
- **THEN** la compra se crea con `paidAmount=0`, `paymentStatus="pending"`, y `providers.currentBalance` incrementa en el total de la compra

#### Scenario: Totales calculados con redondeo half-to-even
- **WHEN** se registra una compra con líneas que incluyen `ivaRate`/`iepsRate` del producto
- **THEN** `unitCost` se trata como el costo final que Agrisas paga (impuesto ya incluido): `lineGross = round(quantity * unitCost * (1 - discountPct/100), 4)`, `divisor = 1 + ivaRate + iepsRate`, `lineSubtotal = round(lineGross / divisor, 4)`, `lineIva`/`lineIeps` se calculan sobre `lineSubtotal`, `lineTotal = lineGross` — misma fórmula de banker's rounding que `SaleTotalsCalculator`/`QuoteTotalsCalculator`/`ReturnTotalsCalculator`, preservando la equivalencia byte-a-byte entre los 4 calculadores

#### Scenario: Proveedor inactivo o inexistente rechazado
- **WHEN** el `providerId` enviado no existe o corresponde a un proveedor con `isActive=false`
- **THEN** la API responde 400/404 y no se crea la compra ni se modifica inventario

#### Scenario: Compra sin líneas rechazada
- **WHEN** el body no incluye ninguna línea
- **THEN** la API responde 400 y no se crea la compra

#### Scenario: Producto inactivo referenciado en una línea
- **WHEN** alguna línea referencia un `productId` con `isActive=false`
- **THEN** la API responde 400 y no se crea la compra

#### Scenario: Inventario incrementado de forma atómica junto al folio
- **WHEN** la compra se confirma exitosamente
- **THEN** la asignación de folio, el incremento de inventario por línea, la actualización del saldo del proveedor (si aplica), la actualización del costo de adquisición por producto y la inserción de la compra ocurren dentro de una única transacción; si cualquier paso falla, ninguno se aplica

#### Scenario: Línea con lote y caducidad crea metadata de trazabilidad
- **WHEN** una línea de la compra incluye `lotNumber` y `expirationDate` válidos
- **THEN** la compra se crea normalmente y, dentro de la misma transacción, se registra el lote de esa línea (ver capability `inventory-lots`)

#### Scenario: Costo de adquisición del producto actualizado al completar la compra
- **WHEN** una compra con una línea de `productId="P1"` y `unitCost=52.30` se confirma exitosamente
- **THEN** `products.acquisition_price` de `P1` queda en `52.3000`, dentro de la misma transacción de la compra

#### Scenario: Línea repetida del mismo producto — última gana
- **WHEN** una compra confirma con dos líneas del mismo `productId` con `unitCost=40` y `unitCost=45` respectivamente
- **THEN** `products.acquisition_price` de ese producto queda en `45.0000` (la última línea procesada)

#### Scenario: Cancelar una compra no revierte el costo de adquisición
- **WHEN** una compra previamente completada (que ya actualizó `acquisition_price`) se cancela
- **THEN** `products.acquisition_price` permanece con el valor que dejó la compra — la cancelación NO lo revierte

#### Scenario: Folio de compras es independiente por sucursal
- **WHEN** la sucursal ZARIOZ ya registró 9 compras (`CP-ZARIOZ-000001`..`CP-ZARIOZ-000009`) y la sucursal PRADERA registra su primera compra
- **THEN** PRADERA recibe `CP-PRADERA-000001` — no continúa el consecutivo de ZARIOZ ni de ningún otro folio `CP` global legacy

### Requirement: Carga de factura SAT (CFDI) al registrar compras

El sistema SHALL permitir registrar una compra a partir de un XML de factura CFDI: el frontend parsea el XML en el cliente y prellena el formulario; el backend SHALL aceptar los metadatos de la factura en `POST /api/v1/admin/purchases` y, cuando el RFC del emisor no existe, SHALL auto-crear el proveedor dentro de la misma transacción (sin requerir `providers:write`).

El body de `POST /api/v1/admin/purchases` SHALL aceptar exactamente uno de `providerId` o `newProvider` (si ambos o ninguno, HTTP 400). `newProvider` SHALL ser `{ rfc, name, legalName?, taxRegime? }` con `rfc` en formato `^([A-ZÑ&]{3,4}\d{6}[A-Z\d]{3})$` (upper-normalizado) y `taxRegime` de 3 dígitos. Los campos adicionales opcionales: `purchasedAt` (fecha de la compra editable; si se omite, `NOW()`), `satUuid` (UUID de TimbreFiscalDigital), `supplierInvoiceNumber` (serie+folio), `invoiceDate` (fecha de la factura), `xmlFileName`. `purchasedAt`/`invoiceDate` SHALL aceptar datetime ISO con o sin offset (CFDI `Fecha` local, ej. `2026-08-05T09:30:00`) vía `z.coerce.date()`. `createdAt` SHALL ser siempre `NOW()` en el servidor (independiente de `purchasedAt`).

Los metadatos SHALL persistirse en la tabla `purchases`: `sat_uuid` (único, `TEXT`), `supplier_invoice_number`, `invoice_date`, `xml_file_name`. El `sat_uuid` SHALL ser único en toda la tabla (índice único) y su duplicado SHALL devolver HTTP 409 con `{ error, existingPurchaseFolio }` — incluso si la compra original fue cancelada (el UUID no se libera).

#### Scenario: Proveedor auto-creado desde el RFC del emisor
- **WHEN** el body incluye `newProvider` con un RFC que no existe en `providers`
- **THEN** el proveedor se crea dentro de la misma transacción de la compra con `code = "PROV_<rfc>"`, `rfc`, `name`, `legalName` y `taxRegime`, y la compra queda referenciándolo

#### Scenario: Proveedor existente reutilizado por RFC
- **WHEN** el body incluye `newProvider` con un RFC que ya existe en `providers`
- **THEN** se reutiliza el proveedor existente (no se duplica ni se modifica) y la compra queda referenciándolo

#### Scenario: newProvider sin providerId
- **WHEN** el body omite `providerId` y `newProvider` o los incluye ambos
- **THEN** la API responde HTTP 400 y no se crea la compra

#### Scenario: UUID de factura duplicado rechazado
- **WHEN** se registra una compra con `satUuid` que ya existe en otra compra (activa o cancelada)
- **THEN** la API responde HTTP 409 y no se crea la compra

#### Scenario: RFC inválido rechazado
- **WHEN** `newProvider.rfc` no cumple la regex mexicana
- **THEN** la API responde HTTP 400 y no se crea la compra

### Requirement: Cancelación de una compra

El sistema SHALL permitir cancelar una compra en estado `completed`, revirtiendo el inventario incrementado y, si era a crédito, el saldo del proveedor en la proporción aún no pagada. La cancelación SHALL ser idempotente y SHALL rechazarse si la compra tiene abonos a proveedor activos. Si alguna línea de la compra tenía lote/caducidad capturados, la cancelación SHALL eliminar los registros de trazabilidad asociados (ver capability `inventory-lots`) dentro de la misma transacción.

#### Scenario: Cancelación exitosa revierte inventario
- **WHEN** un usuario con `purchases:cancel` cancela una compra `completed` sin abonos activos
- **THEN** el inventario de cada producto en la sucursal decrementa en la cantidad de la línea correspondiente, la compra pasa a `status="cancelled"` con `cancelledAt`/`cancelledBy`/`cancellationReason` registrados

#### Scenario: Cancelación revierte saldo de proveedor si era a crédito
- **WHEN** se cancela una compra a crédito con `paidAmount < total` (aún no saldada completamente)
- **THEN** `providers.currentBalance` decrementa en `(total - paidAmount)` de esa compra

#### Scenario: Doble cancelación rechazada
- **WHEN** se intenta cancelar una compra que ya está en `status="cancelled"`
- **THEN** la API responde 409 y no vuelve a modificar inventario ni saldo

#### Scenario: Cancelación bloqueada por abonos activos
- **WHEN** la compra tiene uno o más `ProviderPayment` en `status="completed"`
- **THEN** la API responde 409 indicando que deben cancelarse los abonos primero, y no se cancela la compra

### Requirement: Registro de un abono a proveedor

El sistema SHALL permitir registrar un abono (`ProviderPayment`) contra una compra a crédito (`paymentMethod.isCredit=true`), asignando folio del catálogo con `code="PP"` y `scope="OPERATIONS"`. El monto SHALL validarse contra el saldo pendiente de esa compra específica.

#### Scenario: Abono registrado exitosamente
- **WHEN** un usuario con `purchases:pay` registra un abono con `amount <= (purchase.total - purchase.paidAmount)` sobre una compra a crédito
- **THEN** se asigna folio `PP-NNNNNN`, `providers.currentBalance` decrementa en `amount`, `purchase.paidAmount` incrementa en `amount`, y `purchase.paymentStatus` se recalcula (`pending`→`partial`→`paid`)

#### Scenario: Abono sobre compra de contado rechazado
- **WHEN** se intenta registrar un abono sobre una compra con `paymentMethod.isCredit=false`
- **THEN** la API responde 409 y no se crea el abono

#### Scenario: Abono que excede el saldo pendiente rechazado
- **WHEN** `amount > (purchase.total - purchase.paidAmount)`
- **THEN** la API responde 409 indicando el monto pendiente disponible, y no se crea el abono

### Requirement: Cancelación de un abono a proveedor

El sistema SHALL permitir cancelar un abono en estado `completed`, revirtiendo el saldo del proveedor y recalculando el estado de pago de la compra asociada. La cancelación SHALL ser idempotente.

#### Scenario: Cancelación de abono revierte saldo
- **WHEN** un usuario con `purchases:pay_cancel` cancela un abono `completed`
- **THEN** `providers.currentBalance` incrementa en el monto del abono, `purchase.paidAmount` decrementa en el mismo monto, y `purchase.paymentStatus` se recalcula

#### Scenario: Doble cancelación de abono rechazada
- **WHEN** se intenta cancelar un abono que ya está en `status="cancelled"`
- **THEN** la API responde 409 y no vuelve a modificar el saldo

### Requirement: Consulta de compras (listado y detalle)

El sistema SHALL exponer un listado paginado de compras con filtros por proveedor, sucursal, estado y rango de fechas, y un detalle por compra que incluya sus líneas y los abonos a proveedor asociados.

#### Scenario: Listado paginado con filtros
- **WHEN** un usuario con `purchases:read` solicita el listado con `page`/`pageSize` (máximo 100) y opcionalmente `providerId`/`branchId`/`status`/`from`/`to`
- **THEN** la API responde la página solicitada filtrada según los criterios enviados

#### Scenario: Detalle de compra incluye líneas y abonos
- **WHEN** un usuario con `purchases:read` solicita el detalle de una compra por id
- **THEN** la respuesta incluye las líneas (`PurchaseItem` con snapshot) y los `ProviderPayment` asociados con su estado

#### Scenario: Branch scoping aplica al listado sin branchId explícito
- **WHEN** un usuario sin `branches:access_all` solicita el listado sin especificar `branchId`
- **THEN** el listado se limita automáticamente a la sucursal del usuario (`x-user-branch-id`)

### Requirement: Control de acceso y branch scoping en todos los endpoints de compras

Cada endpoint de compras y abonos a proveedor SHALL requerir el permiso RBAC correspondiente (`purchases:read`, `purchases:create`, `purchases:cancel`, `purchases:pay`, `purchases:pay_cancel`) y SHALL aplicar el mismo mecanismo de branch scoping usado por el resto del sistema (`enforceBranchScope` para operaciones sobre un recurso existente, `resolveScopedBranchId` para listados), con `branches:access_all` como único bypass.

#### Scenario: Creación de compra fuera del branch del usuario rechazada
- **WHEN** un usuario sin `branches:access_all` intenta crear una compra con `branchId` distinto a su `x-user-branch-id`
- **THEN** la API responde 403 y no se crea la compra

#### Scenario: Operación sobre compra de otra sucursal rechazada
- **WHEN** un usuario sin `branches:access_all` intenta cancelar, pagar o cancelar un abono de una compra cuyo `branchId` no coincide con `x-user-branch-id`
- **THEN** la API responde 403

#### Scenario: Permiso faltante rechazado
- **WHEN** un usuario sin el permiso RBAC requerido para la operación (por ejemplo `purchases:pay` para registrar un abono) intenta ejecutarla
- **THEN** la API responde 403 indicando el permiso faltante

