## Historia de Usuario

| # | Rol | Tarea | Motivo | Criterios de Aceptación | Criterios de Seguridad |
|---|---|---|---|---|---|
| 1 | Operador de sucursal | Como operador de sucursal, quiero registrar un gasto (concepto, cantidad, notas opcionales, fecha) vía `POST /api/v1/admin/expenses` para dejar constancia del egreso de su sucursal | Control financiero por sucursal, sin depender de otro módulo para asentar egresos operativos | - Given concepto/cantidad/fecha válidos, When POST, Then crea gasto `isActive=true` con `branchId` resuelto del usuario y `creatorId` del token<br>- Given `amount <= 0`, When POST, Then 400<br>- Given `concept` vacío o `expenseDate` ausente, When POST, Then 400<br>- Given usuario sin `branches:access_all` envía `branchId` distinto al propio, When POST, Then 403 | - Requiere `expenses:write`<br>- `branchId` en body se ignora/rechaza si no coincide con `x-user-branch-id` salvo bypass `branches:access_all` (`enforceBranchScope`)<br>- Validación Zod antes de tocar DB (orden: Zod 400 → enforceBranchScope 401/403 → use case) |
| 2 | Operador de sucursal | Como operador de sucursal, quiero editar un gasto existente vía `PATCH /api/v1/admin/expenses/:id` para corregir datos capturados por error | Evita gastos duplicados por error de captura sin perder trazabilidad | - Given body con ≥1 campo válido, When PATCH, Then actualiza sólo campos enviados<br>- Given body vacío, When PATCH, Then 400<br>- Given id inexistente, When PATCH, Then 404<br>- Given gasto de otra sucursal sin bypass, When PATCH, Then 403 | - Requiere `expenses:write`<br>- `enforceBranchScope` carga el recurso primero, luego valida branch antes de aplicar cambios |
| 3 | Operador de sucursal | Como operador de sucursal, quiero adjuntar/reemplazar/eliminar la fotografía del comprobante vía `POST`/`DELETE /api/v1/admin/expenses/:id/photo` para respaldar el gasto con evidencia visual | La fotografía es opcional pero, cuando existe, debe poder gestionarse sin recrear el gasto completo | - Given archivo jpeg/png/webp ≤2MB, When POST, Then sube a storage y persiste `photoUrl`, borra la foto previa si existía<br>- Given archivo con MIME no permitido o >2MB, When POST, Then 400/413<br>- Given gasto sin foto, When DELETE, Then no falla (idempotente) | - Requiere `expenses:write`<br>- `enforceBranchScope` sobre el gasto antes de aceptar el archivo<br>- No se acepta `photoUrl` arbitrario vía PATCH del gasto (sólo se setea a través del endpoint dedicado de subida) |
| 4 | Operador / Visualizador | Como operador o visualizador, quiero listar y consultar gastos (`GET /api/v1/admin/expenses`, `GET /:id`) con filtros de fecha/concepto/sucursal para revisar el histórico de egresos | Visibilidad operativa diaria sin exponer gastos de sucursales ajenas | - Given usuario sin bypass, When GET lista, Then sólo ve gastos de su `branchId` (`resolveScopedBranchId`)<br>- Given usuario con `branches:access_all`, When GET con `?branchId=`, Then ve la sucursal solicitada<br>- Given filtros de fecha inválidos, When GET, Then 400 | - Requiere `expenses:read`<br>- `pageSize` máximo 100 (helper `parseListQuery`) |
| 5 | Operador de sucursal | Como operador de sucursal, quiero desactivar (soft delete) un gasto capturado por error vía `DELETE /api/v1/admin/expenses/:id` para que deje de contar en reportes sin perder el registro | Corrige errores de captura preservando auditoría, sin borrado físico | - Given id existente y activo, When DELETE, Then `isActive=false`<br>- Given id ya inactivo, When DELETE, Then 404 (no reaparece en listado activo)<br>- Given `?includeInactive=true`, When GET lista, Then incluye inactivos | - Requiere `expenses:write`<br>- `enforceBranchScope` antes de desactivar |
| 6 | Administrador / Operador / Visualizador | Como administrador, operador o visualizador, quiero generar el reporte de gastos (`GET /api/v1/admin/expenses/report?format=json\|pdf\|xlsx`) filtrado por fecha/concepto/sucursal para auditar egresos por periodo | Cierre contable/administrativo periódico de gastos operativos | - Given `format=json`, When GET, Then responde paginado con totales<br>- Given `format=pdf`/`xlsx` y dataset ≤10 000 filas, When GET, Then responde archivo binario descargable con filtros aplicados y totales<br>- Given dataset >10 000 filas y `format` de export, When GET, Then 409 `tooLarge` | - Requiere `expenses:report_read`<br>- Export respeta el mismo branch scoping que el listado |
| 7 | Administrador (seed) | Como administrador del sistema, quiero que existan los permisos `expenses:read`/`expenses:write`/`expenses:report_read` sembrados y asignados por rol (admin y operator con los tres, viewer con read+report_read) para controlar el acceso al módulo desde el día uno | RBAC consistente con el resto del panel, sin gastos huérfanos de permisos tras el deploy | - Given `npm run seed`, When corre, Then los 3 permisos existen y quedan asignados según la tabla de roles definida<br>- Given segunda corrida del seed, When corre, Then es idempotente | - Nombres de permiso cumplen regex `^[a-z][a-z0-9_]{0,31}:[a-z][a-z0-9_]{0,31}$`<br>- `viewer` nunca recibe `expenses:write` |

## Why

El panel no tiene forma de asentar egresos operativos de sucursal (compras menores, viáticos, imprevistos) fuera del flujo de compras a proveedor. Sin un registro dedicado, esos gastos quedan fuera de cualquier reporte y sin trazabilidad por sucursal/usuario/fecha, dificultando el cierre administrativo periódico. Se necesita un recurso `expense` propio, con el mismo branch scoping y RBAC que el resto de módulos operativos (sales/payments/returns/purchases), más un reporte exportable para auditoría.

## What Changes

- Nuevo modelo Prisma `Expense` (`expenses`): `concept`, `amount` (decimal), `notes` opcional, `photoUrl` opcional, `expenseDate`, `branchId`, `creatorId`, `isActive` + timestamps.
- Nuevo módulo hexagonal `src/modules/expenses/` (domain/application/infrastructure) calcado del patrón CRUD simple (`departments`) + storage de imagen (`products`) + reporte (`payments`).
- Nuevos endpoints bajo `app/api/v1/admin/expenses/`: `GET/POST /`, `GET/PATCH/DELETE /:id`, `POST/DELETE /:id/photo`, `GET /report` (`?format=json|pdf|xlsx`).
- Nuevos permisos RBAC `expenses:read`, `expenses:write`, `expenses:report_read` sembrados en `prisma/seed.ts` y asignados por rol.
- Nuevo bucket de Supabase Storage `expense-photos` para fotografías de comprobantes.

## Capabilities

### New Capabilities
- `expenses-api`: CRUD de gastos con branch scoping, soft delete, subida/borrado de fotografía de comprobante, y reporte exportable (JSON/PDF/XLSX) con filtros.

### Modified Capabilities
(ninguna — no se modifica comportamiento de specs existentes; `rbac` gana permisos nuevos pero eso es aditivo, cubierto dentro de `expenses-api`)

## Impact

- **Código nuevo**: `src/modules/expenses/**`, `app/api/v1/admin/expenses/**`.
- **Prisma**: nueva tabla `expenses` + migración `add_expenses_table`; `schema.prisma` gana modelo `Expense` con relaciones a `Branch` y `User`.
- **RBAC**: `prisma/seed.ts` gana 3 permisos y sus grants por rol; requiere `npm run seed` tras deploy.
- **Infraestructura**: nuevo bucket Supabase Storage `expense-photos` (paralelo a `product-images`).
- **Sin impacto** en módulos existentes (sales/payments/purchases/returns) — `expenses` es un recurso independiente, no toca inventario ni balances de cliente.
- **Complementado por** `add-expenses-ui` (frontend, change separado) que consume estos endpoints.
