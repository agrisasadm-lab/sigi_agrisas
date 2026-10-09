## Context

Ver `proposal.md` — `## Why`. El backend (`PaymentMethodsController`, `createPaymentMethodSchema` del servidor) ya acepta `isCredit` en `POST` y lo ignora en `PATCH`; el gap es exclusivamente en `app/(private)/catalogs/payment-methods/_blocks/PaymentMethodEditModal.tsx` y su schema cliente, que nunca exponen ni envían ese campo.

## Goals / Non-Goals

**Goals:**
- Que el Administrador pueda marcar `isCredit=true` al crear una forma de pago (fila 1 de la Historia de Usuario), sin tocar backend.
- Mantener visible el valor de `isCredit` en modo edición, pero no editable — refleja la inmutabilidad ya implementada en el servidor.

**Non-Goals:**
- No se habilita edición de `isCredit` tras creación (fuera de alcance; contradice el requirement ya vigente en `admin-payment-methods`).
- No se corrige ningún dato histórico — eso ya se resolvió fuera de este change.
- No se agrega un botón ni flujo para "convertir" una forma de pago existente a crédito; si se necesita una nueva forma de pago de crédito, se crea una nueva fila (ya soportado por backend, ver escenario "Admin may create additional credit methods" en `admin-payment-methods`).

## Decisions

- **Switch en vez de checkbox**: reutiliza el átomo `Switch` ya usado para `isActive` en el mismo modal — consistencia visual, cero componente nuevo.
- **Deshabilitar en vez de ocultar en `mode="edit"`**: se eligió mostrar el switch deshabilitado (mismo patrón que el input `code`) en vez de ocultarlo, para que el administrador vea el valor actual de `isCredit` sin ambigüedad, en lugar de preguntarse si existe. Alternativa descartada: ocultarlo en edición — se rechaza porque esconde información relevante para diagnosticar por qué una forma de pago no activa el flujo de crédito.
- **`isCredit` sólo en `createPaymentMethodSchema`, no en `updatePaymentMethodSchema`**: espeja exactamente el contrato ya definido en el spec de backend (`admin-payment-methods` — "PATCH... SHALL silently ignore"). Mantener el campo fuera del schema de update evita que `getDiff()` del modal pueda alguna vez incluirlo, sin depender de que el desarrollador recuerde excluirlo manualmente.
- **Default `false` en el switch de creación**: coincide con el default del backend (`isCredit ?? false`) — sin cambio de comportamiento para el flujo ya existente (fila 1, AC "no toco el switch").

Criterios de Seguridad de la tabla: no aplica RBAC/branch-scoping nuevo — el gate `payment_methods:write` que ya protege la acción de crear/editar sigue siendo el único control, y el diseño refuerza (no relaja) la restricción de inmutabilidad existente.

## Risks / Trade-offs

- [Riesgo] Un administrador podría pensar que puede "arreglar" una forma de pago mal creada editando el switch, se da cuenta de que está deshabilitado → confusión momentánea → Mitigación: mismo patrón ya usado para `code` (deshabilitado + estilo `disabled:opacity-40` reconocible); no requiere texto adicional porque la convención ya existe en el mismo modal.
- [Riesgo] Ninguno de arquitectura o datos — cambio aislado a un componente cliente y un schema Zod cliente, sin tocar rutas, permisos ni base de datos.

## Migration Plan

Despliegue estándar (PR → `develop` → release). Sin migración de datos, sin flag, sin pasos de rollback especiales — revertir el PR restaura el comportamiento anterior sin dejar estado inconsistente (el campo es opcional y el backend sigue defaulteando `false`).
