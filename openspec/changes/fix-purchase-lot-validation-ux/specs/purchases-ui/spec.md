## MODIFIED Requirements

### Requirement: Registro de una compra desde la interfaz

La página `/purchases/new` SHALL permitir capturar una compra completa: selección de proveedor (con búsqueda server-side y creación rápida), líneas de producto (producto, cantidad, costo unitario, descuento % opcional, lote y caducidad opcionales como par completo o ninguno), forma de pago (contado/crédito desde el catálogo de formas de pago activas), sucursal (sólo seleccionable cuando el usuario tiene `branches:access_all`; en cualquier otro caso viene fija de la sesión) y notas opcionales. Los totales SHALL calcularse en el cliente con la misma fórmula de redondeo half-to-even a 4 decimales que usa el backend. SHALL estar gateada por el permiso `purchases:create`.

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
