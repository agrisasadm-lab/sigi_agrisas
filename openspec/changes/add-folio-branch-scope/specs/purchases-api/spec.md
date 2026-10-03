## MODIFIED Requirements

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
