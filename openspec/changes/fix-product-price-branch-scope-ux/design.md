## Context

`ProductPricesTab.tsx` (`app/(private)/catalogs/products/_blocks/ProductPricesTab.tsx`) renderiza el selector "Sucursal" con `useBranchesOptions()` (`app/_hooks/useBranchesOptions.ts`), que consulta `GET /api/v1/admin/branches?pageSize=100&includeInactive=false` sin ningún filtro por usuario — este endpoint lista el catálogo completo de sucursales para cualquiera con `branches:read`, independientemente de su scope operativo.

El backend, en cambio, sí aplica scope al crear un override: `ProductPricesController.create` (`src/modules/products/infrastructure/http/ProductPricesController.ts:83-86`) llama `enforceBranchScope(req, parsed.data.branchId)` cuando `branchId` no es `null`. `enforceBranchScope` (`src/modules/rbac/infrastructure/http/enforceBranchScope.ts`) resuelve `branches:access_all` vía `AuthorizationService.userCan` y compara contra el header `x-user-branch-id`; si no coincide, responde `403 {"error":"Forbidden","required":"branches:access_all"}`.

Confirmado en dev (usuario real, rol `zarioz_test`, `branchId` = ZARIOZ): el selector deja elegir "Matriz" y el POST resultante recibe ese 403, mostrado sin traducir en el banner `saveError` del componente (`handleSave` en `ProductPricesTab.tsx:190-200` solo intercepta `DuplicatePriceNameError`/`DuplicateDefaultPriceError`; cualquier otro error queda como el mensaje crudo que produce `authFetch`/el service).

## Goals / Non-Goals

**Goals:**
- (Historia 1) Filtrar el `<select>` de sucursal en `ProductPricesTab` a la sucursal propia del usuario cuando no tiene `branches:access_all`, para que no pueda ni intentar elegir una sucursal ajena.
- (Historia 2) Traducir el 403 de branch-scope a un mensaje claro en español cuando de todos modos ocurra (llamada residual, estado stale, o un usuario con `branches:access_all` revocado en caliente mientras el modal ya estaba abierto).

**Non-Goals:**
- No se modifica `enforceBranchScope`, `ProductPricesController`, `CreateProductPriceUseCase`, ni ningún endpoint — el backend ya es correcto y es la única fuente de verdad de autorización; el frontend nunca debe ser el único guard.
- No se modifica `useBranchesOptions` ni `GET /branches` (siguen sin scope — son la fuente para admins/`branches:access_all`, y otras pantallas del panel dependen de listar todas las sucursales).
- No se toca el resto de `ProductPricesTab` (tabla, modal de edición, eliminar, precio default) más allá del selector y el mapeo de este error puntual.

## Decisions

**1. Dónde obtener el `branchId`/bypass del usuario: `useCurrentUser()`, no una nueva llamada.**
`app/_hooks/useCurrentUser.ts` ya expone `branchId` (derivado del JWT, `null` si no tiene sucursal asignada) y `can(permission): boolean | "loading"` (cacheado 60s, mismo hook que ya gatea `canWrite` en la página padre). Se reutiliza `can("branches:access_all")` para decidir si filtrar, evitando una fuente de verdad nueva o una llamada HTTP adicional. Alternativa descartada: derivar el bypass de la lista de sucursales visibles en otro componente — acoplaría estado entre hermanos sin necesidad, cuando el hook global ya resuelve esto.

**2. Filtrado en el propio `ProductPricesTab`, no en `useBranchesOptions`.**
`useBranchesOptions` es un hook global (`app/_hooks/`) consumido también por selectores admin genéricos (branches filter en `/sales`, `/inventory`, etc. — ver CLAUDE.md) donde SÍ se listan todas las sucursales intencionalmente (ej. filtros de listado con `resolveScopedBranchId` que el propio backend ya acota). Cambiar el hook global para filtrar por defecto rompería esos otros usos o forzaría un parámetro nuevo que ningún otro caller necesita. Se filtra localmente en `ProductPricesTab` con un `useMemo` sobre `branches` (de `useBranchesOptions`) + `branchId`/`can(...)` (de `useCurrentUser`):

```
const canAccessAllBranches = can("branches:access_all");
const visibleBranches = useMemo(() => {
  if (canAccessAllBranches === true) return branches;
  if (canAccessAllBranches === "loading") return branches; // optimista, mismo patrón que NavigationRail
  return branches.filter((b) => b.id === userBranchId);
}, [branches, canAccessAllBranches, userBranchId]);
```

Durante `"loading"` se muestra la lista completa (optimista) para no parpadear el selector — mismo patrón ya usado en `NavigationRail` (`can()` optimista mientras carga). El costo de ese breve flash de opciones no filtradas es nulo: el backend igual bloquea la escritura real.

**3. Traducción del error: interceptar por `error.required === "branches:access_all"`, no por el string "Forbidden".**
`authFetch` ya lanza `ForbiddenError(required?: string)` directamente para cualquier respuesta 403, con `message` fijo `"Forbidden"` (`app/_lib/authFetch.ts:88-95`). `createPrice`/`updatePrice` (`app/(private)/catalogs/products/_logic/services/prices.ts`) no interceptan `ForbiddenError` — pasa intacto hasta `useProductPrices.createOne`/`updateOne` (`app/(private)/catalogs/products/_logic/hooks/useProductPrices.ts`), cuyo `catch` sólo re-lanza `DuplicatePriceNameError`/`DuplicateDefaultPriceError` y para cualquier otro error hace `setSaveError((err as Error).message ?? "Error al guardar precio.")` — con `ForbiddenError`, eso evalúa a literalmente `"Forbidden"`, la cadena cruda que se ve hoy en el banner. El fix va ahí: en esos dos `catch` de `useProductPrices.ts`, antes del `setSaveError` genérico, se agrega `if (err instanceof ForbiddenError && err.required === "branches:access_all") { setSaveError("No puedes crear precios para otra sucursal."); return null; }`. Se distingue por el campo tipado `required`, no por parsear el texto del mensaje — más robusto ante cambios de copy del backend, y consistente con cómo ya se maneja `ForbiddenError` en el resto del panel (`useCurrentUser`, guards de página).

**4. No se elimina la opción "Crear override aquí" en filas heredadas para sucursales fuera de scope.**
Como el selector ya no ofrece sucursales ajenas, ese flujo (`openEditModal`/prefill de override) nunca se alcanza con un `branchId` inválido — no requiere guard adicional.

## Risks / Trade-offs

- **[Riesgo] Usuario sin sucursal asignada (`branchId: null`) y sin `branches:access_all`** → el filtro deja el selector solo con "Precio base (todas)" (cubierto por la Historia 1, AC3). No es un caso nuevo: hoy esos usuarios ya no pueden crear overrides (el backend los bloquea igual); el cambio solo hace visible esa limitación de entrada.
- **[Riesgo] `can("branches:access_all")` cacheado 60s queda desactualizado tras un cambio de rol en caliente** → mismo comportamiento ya aceptado en el resto del panel (ver `AuthorizationService`, TTL 60s documentado en CLAUDE.md); no se introduce riesgo nuevo. El 403 traducido (Historia 2) cubre justamente esta ventana residual.
- **[Trade-off] Filtrado client-side, no una nueva query `?branchId=own` al backend** → evita una llamada HTTP extra y mantiene `useBranchesOptions` sin cambios; el costo es procesar en cliente una lista ya cacheada 5 min (máx. ~100 sucursales), despreciable.

