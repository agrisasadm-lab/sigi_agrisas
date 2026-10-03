## Context

Ver `proposal.md` — Why / Historia de Usuario. Este módulo es nuevo (no toca módulos existentes) y sigue tres patrones ya probados en el repo, sin desviación arquitectónica: CRUD simple con soft delete (`src/modules/departments/`), storage de imagen con puerto/adaptador Supabase (`src/modules/products/` → `ProductImageStoragePort`), y reporte exportable JSON/PDF/XLSX (`src/modules/payments/` → `GetPaymentHistoryReportUseCase`). No se introduce ningún patrón arquitectónico nuevo.

## Goals / Non-Goals

**Goals:**
- CRUD de `Expense` con branch scoping idéntico al resto de módulos operativos (filas 1, 2, 4, 5 de Historia de Usuario).
- Gestión independiente de fotografía de comprobante vía endpoint dedicado (fila 3).
- Reporte exportable con el mismo límite de 10 000 filas y mismo patrón PDF/XLSX que `payments/history` (fila 6).
- RBAC nuevo, aditivo, sin tocar permisos existentes (fila 7).

**Non-Goals:**
- No hay flujo de cancelación con motivo ni estados intermedios — decisión ya tomada en plan mode (soft delete simple).
- No hay categorización/clasificación de gastos (sólo `concept` libre) — no pedido por el usuario.
- No afecta `branch_inventory`, `customers.currentBalance` ni ningún folio del catálogo — `expenses` es un recurso aislado, no consume folio.
- No se resuelve aquí el consumo desde frontend (change separado `add-expenses-ui`).

## Decisions

**1. Modelo `Expense` con FKs en TEXT salvo `creatorId`.**
Sigue la regla confirmada en CLAUDE.md: FKs normales (`branchId`) son `TEXT` porque las PKs del dominio son `String @default(uuid())` mapeadas a columna `TEXT`; `creatorId` es la excepción documentada — FKs a `users.id` son `@db.Uuid` real en Supabase. Alternativa descartada: usar `@db.Uuid` en `branchId` — rompería el FK por mismatch de tipo de columna, igual que ya documentado para `Department.providerId`.

**2. `expenseDate` como `@db.Date`, separado de `createdAt`.**
El usuario captura una fecha de gasto que puede no coincidir con la fecha de registro en sistema (gasto de ayer capturado hoy). Se modela como campo propio, igual que `Sale` separa `completedAt` de auditoría. Alternativa descartada: reusar `createdAt` como fecha del gasto — perdería la distinción entre "cuándo ocurrió" y "cuándo se capturó".

**3. Fotografía gestionada por endpoint separado (`POST/DELETE /:id/photo`), no como campo del `PATCH` general.**
Calca 1:1 el patrón de `products` (`UploadProductImageUseCase` + endpoint dedicado) en vez de aceptar `photoUrl` como string arbitrario en el body de creación/edición. Motivo: el campo requiere manejo binario (`FormData`, validación MIME/tamaño, borrado de la imagen previa en storage) que no encaja en un body JSON; aceptar `photoUrl` como string editable también abriría una vía para que el cliente apunte a una URL arbitraria sin pasar por validación de storage. El `id` del gasto debe existir antes de subir la foto — el frontend (change `add-expenses-ui`) resuelve esto encadenando `createExpense` → `uploadExpensePhoto` cuando el usuario adjunta imagen en el alta.

**4. Bucket de Supabase Storage dedicado `expense-photos` (no reusar `product-images`).**
Aislar buckets por dominio de datos evita mezclar políticas de acceso/retención de fotos de producto (catálogo, potencialmente públicas) con comprobantes de gasto (potencialmente sensibles/financieros). Mismo criterio que ya separa buckets por tipo de asset en el proyecto.

**5. Reporte reusa exactamente el límite y mecanismo de `payments/history` (10 000 filas, `forPdf` trae dataset completo sin paginar, `tooLarge` → 409).**
Evita reinventar un umbral distinto sin justificación; el volumen esperado de gastos por sucursal es comparable o menor al de pagos.

**6. Permisos separados `read`/`write`/`report_read` (no `create`/`cancel` como payments/returns).**
Decisión ya tomada en plan mode: como no hay flujo de cancelación con motivo, no aplica el patrón de permisos granulares por transición de estado (`payments:create`/`payments:cancel`); `write` cubre crear+editar+soft-delete, igual que `providers:write`/`departments:write`.

## Riesgos / Trade-offs

- **[Riesgo]** Borrar la fotografía previa en storage al reemplazarla es best-effort (igual que `UploadProductImageUseCase`): si falla el borrado del objeto viejo, queda un archivo huérfano en el bucket. → **Mitigación**: mismo comportamiento aceptado ya en `products`; no bloquea la operación principal (persistir la nueva URL). No se requiere job de limpieza en este change.
- **[Riesgo]** Un gasto sin fotografía sembrado antes de que exista el bucket `expense-photos` fallaría silenciosamente si el bucket no se aprovisiona antes del deploy. → **Mitigación**: paso explícito en Migration Plan para crear el bucket antes de habilitar el endpoint de foto en producción; el resto del CRUD no depende del bucket.
- **[Trade-off]** Separar `add-expenses-api` de `add-expenses-ui` en dos changes (siguiendo el patrón `product-kardex-api`/`product-kardex-ui`) implica que el backend puede quedar mergeado sin UI que lo consuma temporalmente. → Aceptado: permite testear el backend end-to-end (Jest + curl/Postman) antes de construir UI, igual que se hizo con otros pares api/ui archivados.

## Migration Plan

1. `npx prisma migrate dev --name add_expenses_table` (dev) — crea tabla `expenses` con índices `branchId`, `expenseDate`.
2. Crear bucket Supabase Storage `expense-photos` (política equivalente a `product-images`) antes de habilitar el endpoint de foto en el ambiente correspondiente.
3. Agregar permisos `expenses:*` a `prisma/seed.ts` y correr `npm run seed` (idempotente) en cada ambiente.
4. `npx prisma migrate deploy` en CI/CD para producción.
5. Rollback: la tabla `expenses` es aislada (sin FKs entrantes desde otros módulos) — un rollback de migración (`prisma migrate resolve` + revertir SQL) no afecta datos de otros módulos. Los permisos sembrados pueden quedar huérfanos sin efecto si se revierte el código (no se auto-eliminan, pero tampoco se usan).
