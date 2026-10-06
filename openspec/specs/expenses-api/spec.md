# expenses-api Specification

## Purpose
Permite a los usuarios de una sucursal registrar, editar, desactivar y reportar sus gastos operativos (concepto, monto, notas, fotografía de comprobante y fecha), con el mismo aislamiento por sucursal y control de permisos que el resto de los módulos operativos del panel.
## Requirements
### Requirement: Registro de gasto
El sistema SHALL permitir crear un gasto con `concept`, `amount`, `expenseDate` obligatorios y `notes` opcional, asociado a la sucursal del usuario autenticado.

#### Scenario: Creación exitosa
- **GIVEN** un usuario autenticado con permiso `expenses:write` envía `concept`, `amount > 0`, `expenseDate` válidos
- **WHEN** hace `POST /api/v1/admin/expenses`
- **THEN** el sistema crea el gasto con `isActive=true`, `branchId` resuelto de la sesión del usuario y `creatorId` del token, y responde 201 con el DTO creado

#### Scenario: Monto inválido
- **GIVEN** un usuario autenticado con permiso `expenses:write` envía `amount <= 0`
- **WHEN** hace `POST /api/v1/admin/expenses`
- **THEN** el sistema responde 400 sin crear el registro

#### Scenario: Campos obligatorios ausentes
- **GIVEN** un usuario autenticado con permiso `expenses:write` envía `concept` vacío o sin `expenseDate`
- **WHEN** hace `POST /api/v1/admin/expenses`
- **THEN** el sistema responde 400 sin crear el registro

#### Scenario: Intento de crear gasto en sucursal ajena
- **GIVEN** un usuario sin permiso `branches:access_all` envía un `branchId` distinto al de su propia sesión
- **WHEN** hace `POST /api/v1/admin/expenses`
- **THEN** el sistema responde 403 sin crear el registro

### Requirement: Edición de gasto
El sistema SHALL permitir actualizar parcialmente un gasto existente de la sucursal del usuario.

#### Scenario: Edición exitosa
- **GIVEN** un gasto existente en la sucursal del usuario y un body con al menos un campo válido
- **WHEN** hace `PATCH /api/v1/admin/expenses/:id`
- **THEN** el sistema actualiza únicamente los campos enviados y responde 200 con el DTO actualizado

#### Scenario: Body vacío
- **GIVEN** un gasto existente
- **WHEN** hace `PATCH /api/v1/admin/expenses/:id` con body vacío
- **THEN** el sistema responde 400 sin modificar el registro

#### Scenario: Gasto inexistente
- **GIVEN** un `id` que no corresponde a ningún gasto
- **WHEN** hace `PATCH /api/v1/admin/expenses/:id`
- **THEN** el sistema responde 404

#### Scenario: Edición de gasto de otra sucursal sin bypass
- **GIVEN** un usuario sin permiso `branches:access_all` y un gasto que pertenece a otra sucursal
- **WHEN** hace `PATCH /api/v1/admin/expenses/:id`
- **THEN** el sistema responde 403 sin modificar el registro

### Requirement: Gestión de fotografía de comprobante
El sistema SHALL permitir subir, reemplazar y eliminar la fotografía de comprobante de un gasto existente de forma independiente a la edición de sus demás campos.

#### Scenario: Subida exitosa
- **GIVEN** un gasto existente en la sucursal del usuario y un archivo `image/jpeg`, `image/png` o `image/webp` de hasta 2MB
- **WHEN** hace `POST /api/v1/admin/expenses/:id/photo`
- **THEN** el sistema almacena el archivo, persiste `photoUrl` en el gasto, elimina la fotografía previa si existía, y responde con la nueva URL

#### Scenario: Archivo inválido
- **GIVEN** un gasto existente y un archivo con MIME no permitido o mayor a 2MB
- **WHEN** hace `POST /api/v1/admin/expenses/:id/photo`
- **THEN** el sistema responde 400 (MIME no permitido) o 413 (tamaño excedido) sin modificar `photoUrl`

#### Scenario: Eliminación idempotente
- **GIVEN** un gasto sin fotografía asociada
- **WHEN** hace `DELETE /api/v1/admin/expenses/:id/photo`
- **THEN** el sistema responde exitosamente sin error, dejando `photoUrl` en `null`

### Requirement: Listado y consulta de gastos con aislamiento por sucursal
El sistema SHALL listar y exponer el detalle de gastos filtrados por fecha, concepto y sucursal, restringiendo el resultado a la sucursal del usuario salvo que tenga permiso de bypass.

#### Scenario: Listado restringido a la propia sucursal
- **GIVEN** un usuario autenticado con permiso `expenses:read` sin `branches:access_all`
- **WHEN** hace `GET /api/v1/admin/expenses`
- **THEN** el sistema responde sólo con gastos de su propia sucursal

#### Scenario: Listado con bypass de sucursal
- **GIVEN** un usuario con permiso `branches:access_all`
- **WHEN** hace `GET /api/v1/admin/expenses?branchId=<otra-sucursal>`
- **THEN** el sistema responde con los gastos de la sucursal solicitada

#### Scenario: Filtro de fecha inválido
- **GIVEN** un usuario autenticado con permiso `expenses:read`
- **WHEN** hace `GET /api/v1/admin/expenses` con un filtro de fecha malformado
- **THEN** el sistema responde 400

### Requirement: Desactivación de gasto (soft delete)
El sistema SHALL permitir desactivar un gasto sin eliminarlo físicamente, excluyéndolo del listado activo por defecto.

#### Scenario: Desactivación exitosa
- **GIVEN** un gasto activo en la sucursal del usuario
- **WHEN** hace `DELETE /api/v1/admin/expenses/:id`
- **THEN** el sistema marca `isActive=false` y responde 204

#### Scenario: Desactivar un gasto ya inactivo
- **GIVEN** un gasto con `isActive=false`
- **WHEN** hace `DELETE /api/v1/admin/expenses/:id`
- **THEN** el sistema responde 404

#### Scenario: Inclusión de inactivos en listado
- **GIVEN** gastos activos e inactivos en la sucursal del usuario
- **WHEN** hace `GET /api/v1/admin/expenses?includeInactive=true`
- **THEN** el sistema incluye también los gastos inactivos en la respuesta

### Requirement: Reporte exportable de gastos
El sistema SHALL generar un reporte de gastos filtrado por fecha, concepto y sucursal, exportable en JSON, PDF o XLSX, respetando el aislamiento por sucursal del usuario.

#### Scenario: Reporte en JSON
- **GIVEN** un usuario con permiso `expenses:report_read`
- **WHEN** hace `GET /api/v1/admin/expenses/report?format=json` con filtros válidos
- **THEN** el sistema responde paginado con los gastos filtrados y sus totales agregados

#### Scenario: Exportación PDF o XLSX dentro del límite
- **GIVEN** un usuario con permiso `expenses:report_read` y un dataset filtrado de hasta 10 000 filas
- **WHEN** hace `GET /api/v1/admin/expenses/report?format=pdf` o `?format=xlsx`
- **THEN** el sistema responde con un archivo binario descargable que refleja los filtros aplicados y los totales

#### Scenario: Dataset excede el límite de exportación
- **GIVEN** un usuario con permiso `expenses:report_read` y un dataset filtrado mayor a 10 000 filas
- **WHEN** hace `GET /api/v1/admin/expenses/report?format=pdf` o `?format=xlsx`
- **THEN** el sistema responde 409 indicando que el dataset es demasiado grande para exportar

### Requirement: Permisos RBAC del módulo de gastos
El sistema SHALL definir y sembrar los permisos `expenses:read`, `expenses:write` y `expenses:report_read`, asignados de forma idempotente a los roles `admin`, `operator` y `viewer`.

#### Scenario: Semilla de permisos
- **GIVEN** el seed idempotente del sistema
- **WHEN** se ejecuta `npm run seed`
- **THEN** existen los permisos `expenses:read`, `expenses:write` y `expenses:report_read`, con `admin` y `operator` asignados a los tres, y `viewer` asignado sólo a `expenses:read` y `expenses:report_read`

#### Scenario: Idempotencia del seed
- **GIVEN** que el seed ya se ejecutó una vez
- **WHEN** se ejecuta `npm run seed` nuevamente
- **THEN** no se crean permisos ni asignaciones duplicadas

