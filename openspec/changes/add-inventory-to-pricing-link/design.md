## Context

`InventoryPage.tsx:92-104` (`handleAssign`) llama `assignOne(branchId, { productId, quantity, reorderPoint })` (`useInventoryMutations.ts:29-41`), que retorna el `InventoryItem` completo (`productId`, `productCode`, `productName`, etc. — `types/domain.ts:1-14`) o `null` en error. Hoy el resultado exitoso se descarta (`await assignOne(...)`); el handler solo cierra el modal y refresca la tabla — sin ningún rastro para el usuario de que el producto recién asignado sigue sin precio de venta.

`ProductDetailPage.tsx:23-28` inicializa `const [tab, setTab] = useState<Tab>("general")` sin leer la URL — no existe forma de aterrizar directo en una tab específica desde un link externo.

En sentido opuesto, `ProductsPage.tsx:114-145` (`handleSave`, modo `create`) ya captura `const product = await createOne(data as CreateProductBody)` (usado hoy solo para la subida de imagen condicional) pero no muestra ningún banner de éxito tras crear — solo `setModalState(null); refresh()`. La única señal existente de que un producto creado no es vendible en ninguna sucursal es el aviso estático de `ProductsPage.tsx:218-224` (gateado por `inventoryScopeMode === "branch"`, ya leído vía `useInventoryScopeMode()` en la línea 37), que es permanente y genérico — no contextual al producto recién creado.

No existe en el proyecto un componente de banner/toast de éxito reutilizable (`app/_components/molecules/` no tiene ninguno); el patrón establecido para mensajes de estado en esta misma pantalla es local: `assignError`/`adjustError`/`mutationError` son `string | null` en estado del componente, renderizados inline (`InventoryPage.tsx:59-60,197`).

## Goals / Non-Goals

**Goals:**
- (Historia 1) Tras asignar un producto exitosamente, mostrar un banner con link directo a la tab Precios del producto, sólo si el usuario tiene `products:write`.
- (Historia 2) Si el usuario no tiene `products:write`, mostrar solo la confirmación de asignación, sin el link.
- (Historia 3) Tras crear un producto nuevo en modo `branch`, mostrar un banner con link a `/inventory`, sólo si el usuario tiene `inventory:write`.
- (Historia 4) Si el usuario no tiene `inventory:write`, mostrar solo la confirmación de creación, sin el link.
- Habilitar que cualquier link externo pueda aterrizar directo en la tab "Precios" (u otra) de `/catalogs/products/[id]`.

**Non-Goals:**
- No se crea un componente de toast/snackbar genérico reutilizable — se sigue el patrón local ya establecido en cada pantalla (estado `string`/objeto `| null` + render inline), evitando una abstracción nueva para dos casos de uso puntuales.
- No se modifica el backend, `ProductPricesController`, `enforceBranchScope`, ni ningún endpoint.
- No se modifica `ProductPricesTab.tsx` ni el fix del PR #84 (`fix-product-price-branch-scope-ux`).
- No se persiste el estado del banner (sessionStorage/localStorage) — es un banner de sesión de página, se pierde al navegar o refrescar, igual que `assignError`/`mutationError` hoy.
- (Historia 3/4) El link a `/inventory` es genérico — NO pre-abre el modal "Asignar producto" ni preselecciona el producto recién creado (decisión explícita del usuario: "link simple", más rápido de implementar que un deep-link con estado precargado). El usuario deberá volver a buscar el producto en el modal de asignación.
- (Historia 3/4) El aviso estático permanente de `ProductsPage.tsx:218-224` no se elimina ni se reemplaza — el nuevo banner es un complemento contextual y temporal, no un sustituto.

## Decisions

**1. Capturar el resultado de `assignOne` en `handleAssign` para poblar el banner, en vez de descartarlo.**
`assignOne` ya retorna el `InventoryItem` con `productId`/`productCode`/`productName` — no se necesita ninguna llamada extra ni cambio de firma en el servicio. `handleAssign` pasa de `await assignOne(...)` a `const item = await assignOne(...); if (item) setAssignSuccess({ productId: item.productId, productName: item.productName, productCode: item.productCode });`.

**2. Nuevo estado local `assignSuccess: { productId: string; productName: string; productCode: string } | null` en `InventoryPage`, no un componente compartido.**
Sigue el patrón exacto de `assignError`/`adjustError` (estado local `| null`, limpiado al abrir un nuevo modal o al descartar). Se renderiza como un bloque inline bajo el toolbar (mismo lugar donde hoy vive `mutationError`), con estilo `bg-primary-container` (token M3 ya usado en el proyecto para CTAs secundarios, ej. `ProductPricesTab.tsx` `hover:bg-primary-container/40`). Alternativa descartada: crear un `SuccessBanner` molecule compartido — prematuro para un único caso de uso; si aparece un segundo caso futuro, ahí se extrae.

**3. El link usa `can("products:write")`, ya resuelto en `InventoryPage` (variable `canWrite` existente es de `inventory:write` — se necesita una lectura adicional del permiso `products:write`).**
`InventoryPage.tsx:39` ya desestructura `can` de `useCurrentUser()`. Se agrega `const canWriteProducts = can("products:write");` (nombre distinto de `canWrite`, que ya está tomado por `inventory:write`, para no confundir ambos gates). El link se renderiza solo si `canWriteProducts === true` (no optimista en `"loading"` — a diferencia de otros gates de este proyecto que muestran optimista durante loading, aquí el costo de un falso negativo transitorio — banner sin link por un instante — es menor que el de ofrecer un link que fallará; ver Riesgos).

**4. Deep-link de tab vía `useSearchParams` de `next/navigation`, con validación estricta contra el union type `Tab`.**
`ProductDetailPage.tsx` importa `useSearchParams` (`next/navigation`, ya usado en otras páginas Client Component del proyecto — patrón estándar App Router) y calcula la tab inicial:
```
const searchParams = useSearchParams();
const initialTab = (["general", "prices", "dosifications"] as const).includes(searchParams.get("tab") as Tab)
  ? (searchParams.get("tab") as Tab)
  : "general";
const [tab, setTab] = useState<Tab>(initialTab);
```
Se calcula una sola vez como valor inicial de `useState` (no `useEffect` + `setTab`) — si el usuario cambia de tab manualmente después, no debe "saltar" de vuelta por un re-render del query param. El query param no se sincroniza de vuelta a la URL al cambiar de tab manualmente (fuera de alcance — no lo pide ninguna historia).

**5. El link en el banner usa `Link href={`/catalogs/products/${productId}?tab=prices`}` de `next/link` (ya importado en patrones similares del proyecto), no `router.push`.**
Es un link estático, no requiere lógica adicional — consistente con el resto de "Gestionar"/"Volver" en `ProductsTable.tsx`/`ProductDetailPage.tsx`.

**6. Banner post-create en `ProductsPage.tsx`, mismo patrón que el post-assign, gateado por `inventoryScopeMode === "branch"` Y `can("inventory:write")`.**
`handleSave` (modo `create`) ya obtiene `const product = await createOne(...)`. Se agrega estado local `createSuccess: { productId: string; productCode: string; productName: string } | null`, poblado solo cuando `product` no es `null` **y** `inventoryScopeMode === "branch"` (en modo `general` el producto ya es vendible en todas las sucursales sin asignación — no aplica el banner, ver Non-Goals). El link "Asignar a sucursal" hacia `/inventory` (estático, sin query param — decisión del usuario de mantenerlo simple) se muestra solo si `can("inventory:write") === true`. Se limpia al abrir cualquier modal (create/edit) de nuevo, igual que `createSuccess`/`assignSuccess` en el caso simétrico de `InventoryPage`. El aviso estático existente (`inventoryScopeMode === "branch"` → `<p>` fijo en el toolbar) permanece sin cambios; el banner nuevo es un elemento adicional, no un reemplazo.

## Risks / Trade-offs

- **[Riesgo] `canWriteProducts` en `"loading"` durante el primer render tras asignar** → el banner puede aparecer sin el link por un instante (60s cache de permisos ya resuelto por entonces en la mayoría de los casos, ya que el usuario ya interactuó con la página). Mitigación: no aplica un patrón optimista aquí porque el costo de mostrar un link roto (que en el mejor caso agrega frustración y en el peor confunde con un 403) es mayor que el de un banner momentáneamente sin CTA — decisión consciente, distinta al patrón optimista de `NavigationRail`.
- **[Riesgo] Deep-link `?tab=prices` no persiste al cambiar de tab manualmente** → aceptado (Non-Goal), no lo pide ninguna historia; si se navega hacia atrás desde General a Precios manualmente, la URL no refleja el cambio, pero el comportamiento visual es correcto.
- **[Trade-off] Sin componente de toast compartido** → cambio más pequeño y localizado, consistente con el patrón ya usado en esta pantalla; el costo es que si en el futuro se necesita el mismo patrón "banner de éxito con CTA" en otra pantalla, se duplicará hasta que se decida extraerlo (ahora hay dos instancias casi idénticas del mismo patrón — `InventoryPage` e `ProductsPage` — candidatas naturales a extracción si aparece una tercera).
- **[Trade-off] Link a `/inventory` sin preselección (Historia 3/4)** → el usuario debe volver a buscar el producto recién creado en el modal "Asignar producto". Aceptado explícitamente por el usuario a cambio de menor esfuerzo de implementación; si en el futuro se repite el mismo reclamo, la alternativa (`?assignProductId=`) queda documentada aquí para retomarla sin re-descubrir el problema.
