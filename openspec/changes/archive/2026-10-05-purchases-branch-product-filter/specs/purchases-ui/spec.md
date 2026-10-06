## MODIFIED Requirements

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
