## Context

Ver `proposal.md — Why` para motivación. Este es un refactor puro: ningún endpoint, schema Prisma, regla de negocio ni comportamiento observable cambia. El cambio cruza ~82 archivos en backend y frontend, justificando decisiones explícitas de approach para cada área.

Estado actual relevante:
- Errores de dominio duplicados: 4 clases con copias byte-a-byte en ≥2 módulos. `AuthController` ya importa ambas versiones de `UserNotFoundError`/`EmailAlreadyInUseError` con aliases distintos — evidencia del problema.
- Formatters inline: 58 instancias de `Intl.NumberFormat("es-MX", MXN)` y ~21 de `Intl.DateTimeFormat("es-MX")` dispersas. Algunas sin `timeZone`, otras con `"UTC"` — inconsistente.
- Campos `@db.Date`: Prisma los retorna como `Date` a midnight UTC. Aplicar `America/Mexico_City` (UTC-6) desplaza 6 horas y cruza la medianoche → muestra día anterior.

## Goals / Non-Goals

**Goals:**
- Un único punto de definición por clase de error compartida
- `instanceof` funcionando correctamente al cruzar límites de módulo
- Un único formatter MXN y un único archivo de formatters de fecha, ambos con `timeZone: "America/Mexico_City"`
- Variables de entorno requeridas documentadas en `.env.example`
- Cero regresiones de compilación introducidas por este cambio

**Non-Goals:**
- Modificar comportamiento observable por usuarios finales
- Cambiar contratos de API o schema Prisma
- Resolver errores de `tsc` pre-existentes (stale Prisma client, mismatches de test fixtures)
- Unificar otros símbolos duplicados fuera del alcance auditado (ej. `BranchNotFoundError` por bounded context — aislamiento hexagonal intencional)

## Decisions

### D1: Re-exports en lugar de actualizar todos los imports de módulo

**Decisión:** Los archivos de error en cada módulo se convierten en re-exports hacia `src/shared/domain/errors/`. NO se actualizan los imports en los consumidores de cada módulo.

**Rationale:** Mantiene compatibilidad hacia atrás con todos los imports existentes (`../../domain/errors/BranchScopeViolationError`). El diff resultante es mínimo (1 línea por archivo de error) y sin riesgo de omisión.

**Alternativa descartada:** Actualizar todos los imports de consumidores a apuntar directamente a shared — mayor blast radius, mayor riesgo de omisión, sin beneficio funcional adicional.

### D2: `fmtDateOnly` para campos `@db.Date` — extracción de componentes UTC

**Decisión:** Para campos marcados `@db.Date` en el schema Prisma, usar `fmtDateOnly` que extrae `year/month/day` del ISO string directamente (sin conversión de timezone), en lugar de `timeZone: "UTC"` con `Intl`.

**Rationale:** Prisma retorna `@db.Date` como `Date` a midnight UTC. Con `timeZone: "America/Mexico_City"` la conversión corre 6 horas hacia atrás y cruza la medianoche: `2026-12-31T00:00:00Z` → `2026-12-30T18:00:00-06:00` → muestra "30/12/2026". `fmtDateOnly` evita la conversión completamente. El nombre documenta el contrato explícitamente.

**Alternativa descartada:** `timeZone: "UTC"` — funciona pero no documenta el porqué; confundiría a quien intente homogenizar timezones en el futuro.

### D3: `skip_specs: true` — refactor sin cambio de spec

**Decisión:** `.openspec.yaml` lleva `skip_specs: true`. No se crean ni modifican specs de capabilities.

**Rationale:** Las specs describen comportamiento observable (endpoints, validaciones, reglas de negocio). Ninguna de esas superficies cambia. Crear specs vacías o cosméticas solo aumenta el mantenimiento de la documentación sin aportar valor.

### D4: Dashboard mock — fuera de alcance de este change

**Decisión:** Los servicios de dashboard que retornan datos mock (`getDashboardKpis`, `getLowStockAlerts`, `getRecentActivity`) se documentan como deuda pero NO se tocan en este change.

**Rationale:** Implementar los endpoints reales es un feature nuevo, no un refactor. Requiere diseño de API, spec propia y aprobación de alcance separada.

## Risks / Trade-offs

| Riesgo | Mitigación |
|---|---|
| Re-export introduce cadena de importación (módulo → shared) que puede romper si el path de shared cambia | Los paths de shared son estables por convención del repo; riesgo mínimo |
| `fmtDateOnly` muestra formato `dd/mm/yyyy` hardcodeado — si el locale cambia, no respeta el formato del locale | Aceptado: el sistema es mono-locale (es-MX). Si cambia, hay un único punto a actualizar |
| Errores pre-existentes de `tsc` (stale Prisma client) ocultan posibles regresiones introducidas | Verificar que los errores de `tsc` post-cambio sean exactamente los mismos archivos/líneas que pre-cambio. El fork del backend lo confirmó explícitamente |
| `BranchScopeViolationError` unificada usa mensaje `"Branch scope violation"` (más corto) — la copia de payments tenía mensaje más largo | El `message` de Error no es parte de ningún contrato de API (no se serializa en responses); el `name` es idéntico — `instanceof` es el mecanismo de discriminación |

## Migration Plan

El cambio ya fue aplicado en la rama `chore/archive-openspec-changes`. No requiere migración de datos ni steps de deploy especiales:

1. `npm run build` — verifica que Next.js compile sin errores nuevos
2. `npm test` — suite de tests (node + jsdom) pasa
3. Deploy normal — sin downtime, sin migración de schema
4. **Rollback**: revertir el commit del PR — sin estado persistente afectado
