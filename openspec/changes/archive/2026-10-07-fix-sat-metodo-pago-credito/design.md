## Context

Ver `proposal.md` → `Why` para la motivación completa. Resumen técnico: `satXmlParser.ts:37,141` ya extrae `metodoPago` (`PPD`/`PUE`) del `cfdi:Comprobante`, pero `satInvoiceMapping.ts` (`FORMA_PAGO_KEYWORDS:8-15`, `mapFormaPagoToPaymentMethod:17-29`, `buildSatApplyResult:159`) nunca lo recibe ni lo usa — sólo matchea `FormaPago` contra texto. `CreatePurchasePage.handleSatParsed` ya calcula `satApplied = warnings.length === 0 && unmatched.length === 0`, así que agregar un warning al array existente basta para corregir el falso positivo (fila 2 de la Historia de Usuario) sin tocar ese componente.

Todo el flujo es client-side (`"use client"`, parseo con `fast-xml-parser` sin red). El backend (`PrismaPurchaseRepository.ts:212-309`) ya valida `paymentMethod.isActive` e `isCredit` de forma independiente al confirmar — ese guardrail no cambia.

## Goals / Non-Goals

**Goals:**
- Usar `MetodoPago` (PPD/PUE) como señal primaria de forma de pago en la carga de XML CFDI (fila 1).
- Nunca dejar al usuario con una bandera de "aplicado sin problemas" cuando la forma de pago no se pudo determinar (fila 2).
- Mantener el comportamiento actual de `FormaPago`/keyword-match intacto para el caso PUE (no regresión).

**Non-Goals:**
- No se corrige retroactivamente ninguna compra ya registrada en prod con forma de pago incorrecta — decisión operativa separada, pendiente de medir alcance con query a `mcp__supabase-prod` antes de decidir con el usuario.
- No se cambia el backend (`src/modules/purchases/`) ni el schema — el guardrail de validación ya existe ahí.
- No se agrega ninguna UI nueva (banner especial, modal) — el warning usa el mecanismo de warnings ya existente (`satWarnings` / lista de avisos bajo el uploader).

## Decisions

**1. Firma de `mapFormaPagoToPaymentMethod` cambia a recibir `metodoPago` explícito, no se infiere desde otro lado.**
Alternativa descartada: inferir "es crédito" sólo por `FormaPago==="99"`. Se descarta porque `"99"` ("Por definir") es una convención común pero no garantizada — el campo correcto y normativo del CFDI para esto es `MetodoPago`. Usar `"99"` como proxy mantendría la misma clase de bug (señal indirecta) en vez de corregir la causa raíz.

**2. Match por `isCredit=true` en catálogo, no por nombre/keyword, cuando `MetodoPago="PPD"`.**
Razón: no hay ninguna garantía de que el método de pago "de crédito" del catálogo de un negocio se llame "Crédito" literalmente (puede ser "30 días", "Cuenta por pagar", etc.). El flag `isCredit` ya es la fuente de verdad en todo el resto del sistema (`payment-methods`, `payments`, `pos`, `reports` — ver `isCredit` en esos módulos), así que matchear por flag es consistente con el resto de la arquitectura en vez de introducir otro heurístico de texto.
Alternativa descartada: agregar más keywords a `FORMA_PAGO_KEYWORDS["99"]` (ej. `["crédito", "credito"]`). Se descarta porque sigue dependiendo de que el nombre del método de pago contenga esa palabra — mismo modo de falla que el bug original, sólo que para otro código.

**3. Si hay ≥2 métodos de pago activos con `isCredit=true`, no se elige ninguno — se trata igual que "no hay match" (warning, sin preselección).**
Razón: no hay señal en el CFDI para desambiguar entre dos formas de pago de crédito distintas (ej. "30 días" vs "60 días"); adivinar uno arbitrariamente repetiría el error de fondo (misclasificación silenciosa). Consistente con la regla ya existente en el matching de productos: "el sistema NUNCA adivina entre candidatos ambiguos" (`purchases-ui` spec, estrategia de matching de conceptos).

**4. El warning de forma de pago se agrega al mismo array `warnings` que ya consumen IVA/IEPS, no un array separado.**
Razón: `CreatePurchasePage.handleSatParsed` ya calcula `satApplied` a partir de `warnings.length === 0`; reutilizar el array existente corrige la fila 2 de la historia de usuario sin tocar ese componente ni el tipo `SatApplyResult.warnings: string[]`. Alternativa descartada (array `warnings` tipado con categoría, ej. `{ kind: "tax" | "payment"; message: string }[]`) — se descarta por ahora porque ningún consumidor actual necesita distinguir categoría de warning; se puede migrar después si se requiere (ver Open Questions, no aplica aquí porque no cambia la spec/approach actual).

## Risks / Trade-offs

- **[Riesgo] Catálogos de métodos de pago sin ningún `isCredit=true` activo** → el fix no puede preseleccionar nada y sólo avisa; el usuario sigue teniendo que crear/activar un método de pago de crédito manualmente en `/catalogs/payment-methods`. Mitigación: el warning debe ser explícito sobre esta causa exacta ("no hay forma de pago de crédito activa en catálogo"), no un mensaje genérico — ya contemplado en el texto de warning de la spec (escenario "Factura a crédito (PPD) sin forma de pago de crédito en catálogo").
- **[Riesgo] CFDI mal formado o de versión anterior a 4.0 sin nodo `MetodoPago`** → `metodoPago` llega `null` desde el parser; el fix lo trata igual que `PUE` (comportamiento preexistente), evitando crash. Ya cubierto como escenario explícito en la spec.
- **[Trade-off] No se corrigen compras históricas** → acepta dejar datos ya corruptos en prod sin tocar como parte de este cambio, por decisión explícita del usuario de separar el fix hacia adelante de la remediación retroactiva. Seguimiento: pendiente correr query de medición en `mcp__supabase-prod` antes de decidir el plan de remediación (fuera de este proposal).

## Migration Plan

Cambio puramente client-side (TypeScript en `app/(private)/purchases/_logic/lib/`), sin migración de base de datos ni variable de entorno nueva. Deploy estándar vía PR a `develop` → verificación manual en `/purchases/new` con al menos un XML CFDI real `PPD` y uno `PUE` → merge. Rollback trivial: revertir el commit, no hay estado persistente nuevo que limpiar.
