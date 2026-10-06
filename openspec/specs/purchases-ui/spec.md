# Spec: purchases-ui

## Purpose

Define el comportamiento de la interfaz de usuario del módulo de Compras: listado, creación, detalle y las acciones de ciclo de vida (cancelar compra, registrar/cancelar abono a proveedor), consumiendo la API definida en el change `add-purchases-crud`.

---
## Requirements
### Requirement: Listado paginado de compras con filtros

La página `/purchases` SHALL mostrar un listado paginado de compras con filtros por proveedor (búsqueda server-side, mínimo 2 caracteres, debounce 300ms), sucursal (visible solo con el permiso `branches:access_all`), estado y rango de fechas. SHALL estar gateada por el permiso `purchases:read`.

#### Scenario: Listado con filtros aplicados
- **WHEN** un usuario con `purchases:read` visita `/purchases` y aplica un filtro de proveedor, estado o rango de fechas
- **THEN** el listado se recarga mostrando solo las compras que cumplen los filtros, con paginación (`page`/`pageSize`)

#### Scenario: Filtro de sucursal solo visible con acceso total
- **WHEN** el usuario NO tiene el permiso `branches:access_all`
- **THEN** el filtro de sucursal no se muestra en el toolbar y el listado ya viene acotado por el backend a la sucursal del usuario

#### Scenario: Listado vacío
- **WHEN** no existen compras que cumplan los filtros aplicados
- **THEN** se muestra un estado vacío en lugar de una tabla sin filas

#### Scenario: Página gateada por permiso
- **WHEN** un usuario sin `purchases:read` intenta acceder a `/purchases`
- **THEN** la página no muestra el contenido del listado (gate optimista durante `"loading"`, oculto cuando resuelve a `false`)

#### Scenario: CTA de nueva compra en el listado
- **WHEN** el usuario tiene `purchases:read` y el permiso `purchases:create` en el listado `/purchases`
- **THEN** el toolbar muestra un botón "Nueva compra" que navega a `/purchases/new`
- **AND** el botón NO se muestra cuando el usuario carece de `purchases:create`

---

### Requirement: Registro de una compra desde la interfaz

La página `/purchases/new` SHALL permitir capturar una compra completa: selección de proveedor (con búsqueda server-side y creación rápida), líneas de producto (producto, cantidad, costo unitario, descuento % opcional, lote y caducidad opcionales como par completo o ninguno), forma de pago (contado/crédito desde el catálogo de formas de pago activas), sucursal (sólo seleccionable cuando el usuario tiene `branches:access_all`; en cualquier otro caso viene fija de la sesión) y notas opcionales. Los totales SHALL calcularse en el cliente con la misma fórmula de redondeo half-to-even a 4 decimales que usa el backend. SHALL estar gateada por el permiso `purchases:create`.

El buscador de productos usado para agregar líneas SHALL filtrarse por la sucursal activa del formulario: la sucursal propia del usuario cuando no tiene `branches:access_all`, o la sucursal seleccionada en el formulario cuando el usuario sí tiene ese permiso. El buscador SHALL mostrar únicamente productos con una fila de asignación a esa sucursal (mismo criterio de filtrado que ya aplica el catálogo general cuando se consulta con `branchId`). Cuando el usuario tiene `branches:access_all` y aún no ha seleccionado ninguna sucursal, el buscador SHALL permanecer inactivo (sin disparar búsqueda) y mostrar un hint indicando que debe seleccionar sucursal primero.

#### Scenario: Selector de proveedor con búsqueda y creación rápida
- **WHEN** el usuario escribe en el selector de proveedor
- **THEN** se ejecuta una búsqueda server-side (debounce) y, si el usuario tiene el permiso `providers:write`, se muestra la opción "+ Nuevo proveedor" para crear uno sin salir del formulario

#### Scenario: Totales recalculados en tiempo real
- **WHEN** el usuario agrega, edita o elimina una línea de producto
- **THEN** el subtotal, IVA, IEPS y total se recalculan inmediatamente en el cliente usando banker's rounding a 4 decimales

#### Scenario: Envío bloqueado sin proveedor o sin líneas
- **WHEN** el formulario no tiene proveedor seleccionado o no tiene al menos una línea válida
- **THEN** el botón de confirmar compra permanece deshabilitado

#### Scenario: Compra a crédito no solicita monto pagado
- **WHEN** el usuario selecciona una forma de pago con `isCredit=true`
- **THEN** el formulario no solicita un monto pagado inicial (la compra queda pendiente de saldar)

#### Scenario: Envío exitoso redirige al detalle
- **WHEN** el usuario confirma una compra válida
- **THEN** la aplicación llama al endpoint de creación y, en éxito, redirige a `/purchases/[id]` de la compra recién creada

#### Scenario: Error de proveedor o producto inactivo mostrado inline
- **WHEN** el backend responde 400 por proveedor o producto inactivo
- **THEN** el formulario muestra un mensaje inline específico (no un error genérico) sin perder los datos capturados

#### Scenario: Envío bloqueado por lote o caducidad incompletos en una línea
- **WHEN** alguna línea de la compra tiene `lotNumber` capturado sin `expirationDate`, o `expirationDate` capturado sin `lotNumber`
- **THEN** el botón de confirmar compra permanece deshabilitado y esa línea muestra un aviso indicando que lote y caducidad deben capturarse juntos o dejarse ambos vacíos

#### Scenario: Envío bloqueado por sucursal sin elegir
- **WHEN** el usuario tiene `branches:access_all` y no ha seleccionado ninguna sucursal en el formulario
- **THEN** el botón de confirmar compra permanece deshabilitado

#### Scenario: Cualquier error 400 no contemplado se muestra con el mensaje real del servidor
- **WHEN** el backend responde 400 al confirmar la compra con un mensaje distinto a los casos ya mapeados de proveedor/producto inactivo o líneas vacías
- **THEN** el formulario muestra el mensaje de error tal como lo devolvió el servidor, en vez de un mensaje genérico, sin perder los datos capturados

#### Scenario: Buscador de productos filtrado por la sucursal propia del operador
- **WHEN** un usuario sin `branches:access_all` busca un producto en el formulario de alta de compra
- **THEN** sólo aparecen productos con una fila de asignación (`branch_inventory`) en su propia sucursal

#### Scenario: Producto no asignado a la sucursal no aparece en resultados
- **WHEN** el usuario busca por código o nombre un producto que existe en el catálogo activo pero no está asignado a la sucursal activa del formulario
- **THEN** ese producto no aparece en los resultados de búsqueda

#### Scenario: Sin coincidencias asignadas a la sucursal
- **WHEN** ningún producto asignado a la sucursal activa del formulario coincide con el término buscado
- **THEN** el buscador muestra el estado de lista vacía existente, sin un estado especial adicional

#### Scenario: Buscador respeta la sucursal seleccionada por un usuario con acceso total
- **WHEN** un usuario con `branches:access_all` ya seleccionó una sucursal en el formulario y busca un producto
- **THEN** sólo aparecen productos asignados a esa sucursal seleccionada

#### Scenario: Buscador inactivo sin sucursal seleccionada
- **WHEN** un usuario con `branches:access_all` aún no ha seleccionado ninguna sucursal en el formulario
- **THEN** el buscador no dispara ninguna búsqueda y se muestra un hint indicando que debe seleccionar sucursal primero

#### Scenario: Resultados se refrescan al cambiar de sucursal
- **WHEN** un usuario con `branches:access_all` cambia la sucursal seleccionada mientras hay un término de búsqueda activo
- **THEN** los resultados se refrescan filtrados por la nueva sucursal, sin dejar resultados obsoletos de la sucursal anterior

### Requirement: Carga de factura SAT (CFDI) para prellenar la compra

La página `/purchases/new` SHALL incluir un uploader de XML de factura CFDI (`SatInvoiceUploader`). El parseo SHALL ocurrir en el cliente (`fast-xml-parser`, sin subir el XML al servidor). Al cargar un XML válido, el formulario SHALL prellenarse: proveedor (`newProvider` con RFC/nombre/regimen fiscal del `cfdi:Emisor`), líneas auto-mapeadas producto por producto (ver estrategia de matching abajo, con `ValorUnitario` como costo y cantidades agregadas cuando varios conceptos resuelven al mismo producto), forma de pago derivada de `FormaPago` SAT, y metadatos de la factura (`UUID` de `TimbreFiscalDigital`, serie+folio, fecha, nombre del archivo). La fecha de compra (`purchasedAt`) SHALL ser editable y se prefill con la fecha de la factura.

Cada `Concepto` del XML SHALL resolverse de forma independiente contra el catálogo de productos, SIN agruparse previamente por `ClaveProdServ` (el catálogo SAT no distingue por SKU en este rubro: es común que todos los productos de un mismo proveedor compartan el mismo `ClaveProdServ`). La estrategia de matching es:

1. Extraer el nombre de producto desde `Descripcion` del concepto, removiendo el prefijo `"[NoIdentificacion] "` cuando está presente.
2. Buscar candidatos en el catálogo por ese nombre (coincidencia de texto, ambas direcciones — el nombre de factura puede ser un substring del nombre de catálogo o viceversa).
3. Si hay exactamente 1 candidato, se usa como línea de esa concepto.
4. Si hay 0 candidatos, el concepto queda `unmatched`.
5. Si hay 2 o más candidatos, se desempata comparando `ClaveUnidad` del concepto contra la unidad del producto; si exactamente 1 candidato coincide en unidad se usa ese, si 0 o ≥2 siguen empatados el concepto queda `unmatched` con un aviso indicando ambigüedad (el sistema NUNCA adivina entre candidatos ambiguos).

Cuando dos o más conceptos resuelven al mismo producto, sus cantidades SHALL agregarse en una sola línea de compra (comportamiento preexistente, sin cambios).

#### Scenario: Carga de XML válido prellena el formulario
- **WHEN** el usuario selecciona un archivo `.xml` con un CFDI 4.0 válido
- **THEN** el proveedor (RFC del emisor), las líneas con producto resuelto por nombre (ver estrategia de matching), la forma de pago y los metadatos CFDI se prellenan, y se muestra el nombre del archivo y UUID cargados

#### Scenario: Conceptos con múltiples productos distintos resuelven a líneas separadas
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

#### Scenario: XML inválido muestra error inline
- **WHEN** el archivo no es un XML válido, no tiene nodo `cfdi:Comprobante` o no tiene extensión `.xml`
- **THEN** el uploader muestra un mensaje de error sin modificar el formulario

#### Scenario: Nuevo proveedor desde la factura
- **WHEN** la factura se carga y el RFC del emisor no existe en el catálogo
- **THEN** el formulario usa `newProvider` y muestra un aviso "Proveedor de la factura ... Se creará al registrar la compra"; si el usuario elige manualmente otro proveedor, el aviso desaparece

#### Scenario: UUID duplicado rechazado con mensaje específico
- **WHEN** al enviar, el backend responde 409 porque el `satUuid` ya existe en otra compra
- **THEN** el formulario muestra el mensaje de error específico del UUID sin perder los datos capturados

#### Scenario: Quitar factura cargada
- **WHEN** el usuario hace clic en "Quitar" junto a la factura cargada
- **THEN** los metadatos CFDI y el `newProvider` se limpian; las líneas capturadas permanecen editables

#### Scenario: Detalle de compra muestra datos de la factura
- **WHEN** una compra tiene `satUuid`
- **THEN** el panel de metadatos del detalle muestra nombre del archivo, folio fiscal, UUID y fecha de la factura

---

### Requirement: Detalle de una compra

La página `/purchases/[id]` SHALL mostrar el folio, proveedor, sucursal, estado y forma de pago de la compra, sus líneas con los valores snapshot, un panel de metadatos (creador, fecha, notas, y motivo/fecha de cancelación si aplica) y la sección de abonos a proveedor asociados. SHALL estar gateada por el permiso `purchases:read`; las acciones dentro de la página (registrar abono, cancelar) SHALL gatearse independientemente por su propio permiso.

#### Scenario: Sección de abonos visible solo si la compra es a crédito
- **WHEN** la compra tiene forma de pago con `isCredit=false`
- **THEN** la sección de abonos a proveedor no se muestra

#### Scenario: CTA de registrar abono visible solo si aplica
- **WHEN** la compra es a crédito, `paymentStatus != "paid"` y el usuario tiene el permiso `purchases:pay`
- **THEN** se muestra el CTA "Registrar abono"; en cualquier otro caso (compra pagada, de contado, o sin el permiso) no se muestra

#### Scenario: Banner de cancelación visible en compras canceladas
- **WHEN** la compra tiene `status="cancelled"`
- **THEN** el panel de metadatos muestra un banner con el motivo, fecha y usuario que canceló

---

### Requirement: Registro de abono a proveedor desde el detalle

El detalle de compra SHALL incluir un modal para registrar un abono a proveedor, validando en cliente que el monto no exceda el saldo pendiente antes de enviarlo. SHALL estar gateado por el permiso `purchases:pay`.

#### Scenario: Validación de monto en cliente antes de enviar
- **WHEN** el usuario ingresa un monto mayor al saldo pendiente (`total - paidAmount`) y confirma
- **THEN** el formulario muestra el error antes de llamar al backend

#### Scenario: Registro exitoso refresca el detalle
- **WHEN** el abono se registra exitosamente
- **THEN** el detalle se refresca mostrando el nuevo abono en la lista, el saldo pendiente recalculado y el `paymentStatus` actualizado

#### Scenario: Error 409 del backend mostrado inline
- **WHEN** el backend responde 409 porque el monto excede el saldo pendiente
- **THEN** el modal muestra el mensaje con el monto disponible, sin cerrar el modal

---

### Requirement: Cancelación de un abono a proveedor desde el detalle

El detalle de compra SHALL incluir una acción para cancelar un abono a proveedor en estado `completed`, con confirmación previa. SHALL estar gateada por el permiso `purchases:pay_cancel`.

#### Scenario: Botón de cancelar solo visible en abonos activos
- **WHEN** un abono tiene `status="cancelled"`
- **THEN** no se muestra la acción de cancelar junto a ese abono

#### Scenario: Cancelación exitosa refresca el detalle
- **WHEN** el usuario confirma la cancelación de un abono `completed`
- **THEN** el detalle se refresca reflejando el saldo del proveedor y el `paymentStatus` de la compra actualizados

#### Scenario: Error 409 por doble cancelación mostrado sin crash
- **WHEN** el backend responde 409 porque el abono ya estaba cancelado
- **THEN** el modal muestra el mensaje de error sin romper la interfaz

---

### Requirement: Cancelación de una compra desde el detalle

El detalle de compra SHALL incluir una acción para cancelar la compra, con un campo de razón obligatorio antes de confirmar. El botón SHALL deshabilitarse (con mensaje explicativo) cuando la compra tiene abonos a proveedor activos. SHALL estar gateada por el permiso `purchases:cancel`.

#### Scenario: Razón obligatoria antes de confirmar
- **WHEN** el usuario intenta confirmar la cancelación sin escribir una razón
- **THEN** el modal bloquea el envío hasta que el campo tenga contenido

#### Scenario: Botón deshabilitado por abonos activos
- **WHEN** la compra tiene uno o más abonos en `status="completed"`
- **THEN** el botón "Cancelar compra" se muestra deshabilitado con un mensaje indicando que deben cancelarse los abonos primero

#### Scenario: Cancelación exitosa muestra el banner
- **WHEN** la cancelación se confirma exitosamente
- **THEN** el detalle se refresca mostrando el banner de cancelación con la razón capturada

---

### Requirement: Acceso a Compras desde el NavigationRail

El `NavigationRail` SHALL incluir un item para acceder a `/purchases`, visible únicamente para usuarios con el permiso `purchases:read`, siguiendo el mismo comportamiento optimista durante la carga del permiso que el resto de items del rail.

#### Scenario: Item visible con permiso concedido
- **WHEN** el usuario tiene `purchases:read`
- **THEN** el item "Compras" aparece en el `NavigationRail`

#### Scenario: Item oculto sin permiso
- **WHEN** el permiso `purchases:read` ha resuelto a `false`
- **THEN** el item "Compras" no aparece en el `NavigationRail`

#### Scenario: Item visible optimistamente durante carga
- **WHEN** la verificación de `purchases:read` está en curso (`"loading"`)
- **THEN** el item "Compras" se muestra optimistamente para evitar layout shift

