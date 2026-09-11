## Context

`/purchases/new` (`CreatePurchasePage.tsx` + `useCreatePurchaseForm.ts` + `PurchaseLineRow.tsx` + `createPurchase.ts`) es el único formulario de captura de compras. `canSubmit` en `useCreatePurchaseForm.ts` hoy sólo valida proveedor, forma de pago y ≥1 línea; no valida `branchId` ni la pareja lote/caducidad por línea, ambas exigidas por el backend (`PurchasesController.ts`, `createPurchaseSchema`). El servicio `createPurchase.ts` mapea sólo 3 mensajes de 400 a errores tipados; cualquier otro 400 cae a `NetworkError` genérico, ocultando la causa real al usuario. Este comportamiento produjo el incidente descrito en el proposal (Historia 1 y 2). La revisión del mismo archivo expuso Historia 3 (branchId) e Historia 4 (orden del schema RFC), del mismo patrón.

## Goals / Non-Goals

**Goals:**
- Bloquear en cliente el envío cuando el payload resultante violaría una regla que el backend ya exige (lote/caducidad pareados — Historia 1; `branchId` no vacío — Historia 3), con aviso visual accionable.
- Que cualquier 400 no contemplado hoy llegue a pantalla con el texto real del servidor, en vez de un mensaje genérico (Historia 2).
- Corregir el orden `.regex()`/`.toUpperCase()` del RFC para que el backend acepte lo que `purchases-api/spec.md` ya documenta como válido (Historia 4).

**Non-Goals:**
- No se cambia ninguna regla de negocio del backend (lote/caducidad, formato de RFC, branch scoping). El backend ya es la fuente de verdad correcta; este cambio es enteramente de comunicación cliente↔servidor y validación defensiva en cliente.
- No se agrega un sistema genérico de mapeo de errores de validación (ej. parsear `path` de Zod por campo) — alcance limitado a mostrar el `error` string que el backend ya envía.
- No se toca el flujo de carga de XML CFDI (`SatInvoiceUploader`, `satInvoiceMapping.ts`) más allá de que ahora el RFC extraído en minúsculas se acepta correctamente.

## Decisions

**D1 — Guardia de lote/caducidad como derivado puro en `canSubmit` (Historia 1).** `canSubmit` gana un `linesValid = lines.every(l => Boolean(l.lotNumber) === Boolean(l.expirationDate))`, mismo criterio booleano que el `.refine()` del backend (`Boolean(item.lotNumber) === Boolean(item.expirationDate)`), para que cliente y servidor queden sincronizados por construcción. Alternativa descartada: validar sólo en el submit handler (mostrar error post-click) — se prefiere deshabilitar el botón porque es consistente con el resto del formulario (`canSubmit` ya deshabilita por proveedor/forma de pago faltante) y evita un roundtrip innecesario al servidor.

**D2 — Aviso visual por línea, no a nivel de formulario (Historia 1).** El aviso vive en `PurchaseLineRow.tsx` (la fila específica), no como un mensaje genérico en la parte inferior del formulario, porque con múltiples líneas un mensaje global no indica cuál fila tiene el problema. Consistente con Criterio de Aceptación de Historia 1 ("aparece un aviso visual en esa línea").

**D3 — `branchId` vacío bloquea sólo cuando el `<select>` es visible (Historia 3).** `canSubmit` valida `Boolean(branchId)` sin ramificar por `isBypass`, porque `branchId` ya es `""` únicamente en el caso bypass sin selección (para no-bypass siempre viene poblado del JWT) — un solo check cubre ambos casos sin duplicar lógica de `isBypass` que ya vive en `CreatePurchasePage.tsx`.

**D4 — Nueva clase de error tipada en vez de reutilizar `NetworkError` (Historia 2).** Se añade `PurchaseValidationError` (o nombre equivalente) en `app/(private)/purchases/_logic/errors.ts`, siguiendo el patrón ya establecido del módulo (una clase `Error` por caso, ver `ProviderNotFoundOrInactiveError` etc.), que porta el `message` del backend tal cual. `createPurchase.ts` la lanza como fallback del `else` cuando el 400 no matchea los 3 casos ya mapeados. Alternativa descartada: hacer que `NetworkError` acepte un mensaje opcional — se rechaza porque `NetworkError` es un tipo compartido de `app/_lib/authFetch.ts` usado por todos los módulos para errores de *red* (fetch falló); sobrecargarlo con mensajes de *validación* del servidor mezclaría dos conceptos distintos y podría afectar el manejo de errores de otros módulos que ya distinguen `NetworkError` de errores 400 específicos.

**D5 — Orden de la cadena Zod del RFC (Historia 4).** Cambiar `rfc: z.string().trim().regex(...).toUpperCase()` a `rfc: z.string().trim().toUpperCase().regex(...)`. Es un reorden de dos llamadas encadenadas, sin cambio de patrón ni de tipo — el fix más pequeño posible que alinea la implementación a `purchases-api/spec.md:57` ("rfc ... upper-normalizado").

**Reflejo de Criterios de Seguridad (proposal):** D1/D2/D3 son explícitamente "defensa en profundidad" — el backend sigue re-validando lo mismo (`.refine()` en `PurchasesController.ts`, `z.string().uuid()` para `branchId`, `enforceBranchScope`), así que un bypass del cliente (ej. DevTools) no puede crear una compra inconsistente. D4 sólo muestra texto que el backend ya decidió que es seguro exponer (mensajes de `safeParse`/errores de dominio, nunca stack traces). D5 no relaja el patrón regex, sólo reordena cuándo se aplica la normalización de mayúsculas respecto al check.

## Risks / Trade-offs

- **[Riesgo] Un futuro 400 del backend con mensaje técnico en inglés (ej. de un error de Prisma no capturado) se mostraría tal cual en pantalla** → Mitigación: fuera de alcance de este cambio — los 400 que ya lanza intencionalmente el controller (`PurchasesController.ts`) son mensajes pensados para mostrarse (ya sea en inglés genérico tipo "Invalid uuid" o en los casos de dominio). Si en el futuro se requiere traducir/mejorar esos textos, es un cambio de spec de `purchases-api`, no de este UI fix.
- **[Riesgo] `linesValid` en `canSubmit` es `O(n)` en cada render con el número de líneas** → Mitigación: irrelevante en la práctica (compras típicas tienen pocas decenas de líneas como máximo; incluso sin memoizar el costo es despreciable).

