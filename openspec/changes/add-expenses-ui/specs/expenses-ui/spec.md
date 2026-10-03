## Purpose

Ofrece la interfaz con la que el operador de sucursal captura, revisa, edita, desactiva y audita sus gastos operativos, consumiendo la capability `expenses-api`.

## ADDED Requirements

### Requirement: Listado de gastos con filtros y aislamiento por sucursal
La interfaz SHALL mostrar un listado paginado de gastos en `/expenses` con filtros de fecha, concepto y, cuando el usuario tenga bypass de sucursal, un selector de sucursal.

#### Scenario: Listado visible para usuario con permiso de lectura
- **GIVEN** un usuario con `expenses:read` y gastos existentes en su sucursal
- **WHEN** navega a `/expenses`
- **THEN** ve una tabla paginada con concepto, monto, fecha y estado de cada gasto

#### Scenario: Filtro de fecha inválido bloqueado en cliente
- **GIVEN** el usuario ingresa una fecha "desde" posterior a la fecha "hasta"
- **WHEN** intenta aplicar el filtro
- **THEN** la interfaz muestra un error inline y omite el filtro de fecha inválido de la petición al backend (la petición se sigue enviando, pero sin `from`/`to`)

#### Scenario: Selector de sucursal oculto sin bypass
- **GIVEN** un usuario sin permiso `branches:access_all`
- **WHEN** carga `/expenses`
- **THEN** no ve selector de sucursal en la barra de filtros

### Requirement: Alta de gasto con fotografía opcional
La interfaz SHALL permitir crear un gasto desde un modal con concepto, cantidad, notas opcionales, fecha y una fotografía opcional del comprobante.

#### Scenario: Alta exitosa sin fotografía
- **GIVEN** un usuario con `expenses:write` completa concepto, cantidad y fecha válidos sin adjuntar foto
- **WHEN** confirma el formulario
- **THEN** la interfaz crea el gasto, cierra el modal y refresca el listado

#### Scenario: Alta exitosa con fotografía
- **GIVEN** el usuario adjunta una imagen válida (`jpeg`/`png`/`webp`, ≤2MB) además de los campos requeridos
- **WHEN** confirma el formulario
- **THEN** la interfaz crea el gasto y, tras el éxito, sube la fotografía asociándola al gasto recién creado

#### Scenario: Validación de campos requeridos en cliente
- **GIVEN** el usuario deja el concepto vacío o ingresa una cantidad menor o igual a cero
- **WHEN** intenta confirmar el formulario
- **THEN** la interfaz bloquea el envío y muestra el error inline correspondiente sin llamar al backend

#### Scenario: Fallo de subida de fotografía tras alta exitosa
- **GIVEN** el gasto se creó correctamente pero la subida de la fotografía falla
- **WHEN** ocurre el error
- **THEN** la interfaz conserva el gasto creado en el listado y muestra un aviso de que la fotografía no se guardó, sin revertir la creación

### Requirement: Edición de gasto existente
La interfaz SHALL permitir editar un gasto existente, incluyendo reemplazar o eliminar su fotografía, enviando únicamente los campos modificados.

#### Scenario: Precarga de datos en modo edición
- **GIVEN** un usuario con `expenses:write` abre un gasto existente para editar
- **WHEN** se abre el modal
- **THEN** los campos se precargan con los valores actuales, incluida la miniatura de la fotografía si existe

#### Scenario: Envío diff-only
- **GIVEN** el usuario modifica sólo un campo del gasto
- **WHEN** confirma la edición
- **THEN** la interfaz envía únicamente ese campo en la actualización

#### Scenario: Reemplazo o eliminación de fotografía
- **GIVEN** un gasto con fotografía existente
- **WHEN** el usuario selecciona una nueva imagen o elige eliminarla
- **THEN** la interfaz sube el nuevo archivo o solicita la eliminación de la fotografía, según corresponda

#### Scenario: Error de branch scoping en edición
- **GIVEN** el backend responde 403 por intento de editar un gasto de otra sucursal
- **WHEN** ocurre el error
- **THEN** la interfaz muestra un mensaje inline sin bloquear el resto de la aplicación

### Requirement: Desactivación de gasto desde el listado
La interfaz SHALL permitir desactivar un gasto activo desde el listado con confirmación explícita, y permitir ver los gastos inactivos mediante un filtro.

#### Scenario: Desactivación con confirmación
- **GIVEN** un gasto activo y un usuario con `expenses:write`
- **WHEN** selecciona "Desactivar" y confirma en el diálogo de confirmación
- **THEN** el gasto deja de aparecer en el listado activo por defecto

#### Scenario: Inclusión de inactivos
- **GIVEN** el usuario activa el filtro de incluir inactivos
- **WHEN** se recarga el listado
- **THEN** los gastos inactivos aparecen marcados con su badge de estado correspondiente

### Requirement: Reporte de gastos exportable
La interfaz SHALL ofrecer una página de reporte en `/expenses/report` con filtros de fecha, concepto y sucursal, y botones para exportar el resultado a PDF y a Excel.

#### Scenario: Reporte filtrado
- **GIVEN** un usuario con `expenses:report_read` aplica filtros de fecha, concepto y/o sucursal
- **WHEN** la página carga los resultados
- **THEN** la tabla y los totales al pie reflejan únicamente el subconjunto filtrado

#### Scenario: Exportación exitosa
- **GIVEN** el usuario pulsa "Descargar PDF" o "Excel"
- **WHEN** la exportación está en curso
- **THEN** el botón muestra estado de carga y, al finalizar, descarga el archivo con los filtros aplicados

#### Scenario: Dataset demasiado grande para exportar
- **GIVEN** el backend responde que el dataset filtrado excede el límite de exportación
- **WHEN** el usuario intenta descargar PDF o Excel
- **THEN** la interfaz muestra el error de dataset demasiado grande en vez de iniciar una descarga

### Requirement: Acceso al módulo desde la navegación principal
La interfaz SHALL mostrar un ítem "Gastos" en el `NavigationRail` que enlaza a `/expenses`, visible únicamente para usuarios con permiso de lectura sobre el módulo.

#### Scenario: Ítem visible con permiso resuelto o en carga
- **GIVEN** un usuario cuyo permiso `expenses:read` es `true` o aún está `"loading"`
- **WHEN** carga cualquier página privada del panel
- **THEN** ve el ítem "Gastos" en el rail de navegación apuntando a `/expenses`

#### Scenario: Ítem oculto sin permiso
- **GIVEN** el permiso `expenses:read` del usuario resuelve a `false`
- **WHEN** el rail termina de cargar
- **THEN** el ítem "Gastos" no se muestra
