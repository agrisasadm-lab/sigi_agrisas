# agrisas-panel

Panel de administración agrícola. Next.js 14 App Router + TypeScript + Arquitectura Hexagonal + Supabase Postgres.

> Las reglas finas por módulo (endpoints, campos, regex, scenarios) viven en `openspec/specs/<capability>/spec.md`. Este archivo conserva sólo la guía transversal que un agente necesita antes de tocar código.

## Idioma

Responde siempre en español.

## Rol y tarea por defecto

**Rol:** Software engineer experto, 10 años de experiencia en Next.js 14 y desarrollo de sistemas POS.

**Tarea:** Diseñar, implementar y revisar features del proyecto con buenas prácticas, siguiendo los lineamientos de este archivo, de `designer.md` y de `openspec/specs/`.

Rol y tarea se sobrescriben cuando el usuario asigna un rol y/o una tarea explícitos en su mensaje. El rol asignado rige hasta que el usuario indique otro.

**Todo plan (incluido Plan Mode) y todo superprompt se aborda con este rol y tarea por defecto, salvo indicación explícita en contrario del usuario.**

## Protocolo de desarrollo (obligatorio) — SDD con OpenSpec

Este proyecto sigue **Spec-Driven Development**. Rol y tarea por defecto ya están fijos arriba — no hace falta redactar un "superprompt" desde cero repitiendo rol/tarea/contexto genérico en cada tarea; eso es tiempo perdido cuando todas comparten el mismo rol. Lo que sí es obligatorio, tarea por tarea, es correr el workflow de OpenSpec — **ese proposal ES el superprompt** (scope, archivos a tocar, criterios de aceptación, plan de verificación), versionado en el repo en vez de texto de chat descartable:

1. **Identificar la tarea.** Alcance, módulo(s) tocados, capability(ies) de `openspec/specs/` involucradas (nuevas o modificadas).
2. **`opsx:propose`** — genera `openspec/changes/<nombre>/{proposal.md, design.md, tasks.md, specs/}`. Si la tarea ya pasó por Plan Mode, usa ese plan aprobado como insumo — **no lo sustituye**: el plan file es efímero y no vive en el repo, el proposal sí.
3. **Presentar el proposal al usuario y esperar aprobación explícita.** Sin aprobación no se edita ningún archivo ni se corre ningún comando de escritura.
4. **`opsx:apply`** — implementar siguiendo `tasks.md`.
5. **`opsx:verify`** — confirmar que la implementación cumple specs y design.
6. **`opsx:archive`** — **sólo cuando el usuario lo indique explícitamente.** Nunca automático al terminar apply/verify, ni siquiera con toda la suite en verde.

Cambio de alcance a mitad de ejecución → proposal actualizado y re-aprobado, no se improvisa.

**Excepción:** consultas de sólo lectura (explicar código, localizar símbolos, `git status`, leer specs) se responden directo, sin propose ni aprobación. Cambios triviales de 1 línea sin impacto de spec (typo, rename mecánico) pueden saltarse el propose únicamente si el usuario lo indica explícitamente para esa tarea puntual — no por default.

## Skills activas

Usa estas skills en cada sesión:

- **`caveman`** — modo de comunicación ultra-comprimido. Actívalo siempre con `/caveman` al inicio. Elimina artículos, relleno y cortesías; conserva toda la sustancia técnica. Nivel por defecto: `full`. Cambiar con `/caveman lite|full|ultra`.
- **`searching-sourcegraph`** — búsqueda en código indexado. Úsala para localizar patrones, ejemplos de uso de una función o entender cómo fluye una feature antes de proponer cambios. Actívala cuando la pregunta sea "¿cómo funciona X?", "¿dónde se usa Y?", o antes de cualquier refactor que cruce módulos.

## Flujo Git

**Todo PR va contra `develop`. Nunca contra `master`/`main`.** `master` es release; `develop` es integración. Al crear PR con `gh pr create`, usar siempre `--base develop`.

## CodeGraph

Este repo tiene `.codegraph/` indexado. Úsalo ANTES de grep/find o leer archivos cuando necesites localizar o entender código.

**MCP tool** (preferido): `codegraph_explore` — responde preguntas de código en una sola llamada: fuente verbatim + call paths + blast radius. Nombra un símbolo o archivo en el query para obtener su fuente line-numbered lista para editar con `Edit`.

**Shell** (siempre disponible): `codegraph explore "<símbolos o pregunta>"` — mismo output.

**Cuándo usarlo:**
- "¿dónde está definido X?", "¿qué llama a Y?", "¿qué depende de Z?" → codegraph primero
- Antes de editar: obtén fuente + blast radius en una llamada, no en un loop grep+read
- Cambios cross-módulo: traza call paths incluyendo dynamic dispatch (callbacks, JSX children) que grep no sigue

**Cuándo NO usarlo:** si no hay `.codegraph/` en el root, omitir completamente.

## Stack

| Capa | Tecnología |
|---|---|
| Framework | Next.js 14+ (App Router) |
| Lenguaje | TypeScript strict |
| Auth | JWT custom (`jsonwebtoken` + `bcryptjs`) — NO Supabase Auth SDK |
| Validación | Zod (en adaptadores HTTP, nunca en dominio) |
| ORM | Prisma 5 |
| Base de datos | Supabase Postgres — proyecto `agrisas` (`qzzjpyepggwautckqeex`) |
| Tests | Jest + ts-jest (node) — RTL + jsdom para UI |
| Estilos | Tailwind CSS v3 + PostCSS |

## Arquitectura Hexagonal (`src/`)

```
src/modules/<módulo>/
├── domain/         # entities, value-objects, errors (puros, sin Next/Prisma)
├── application/    # ports (interfaces), use-cases, dto, mappers
└── infrastructure/ # repositories (Prisma/InMemory), services, http (controller), di

src/shared/domain/                       # Entity, ValueObject, Result
src/shared/infrastructure/prisma/client.ts  # singleton PrismaClient
src/shared/infrastructure/http/parseListQuery.ts  # page/pageSize/includeInactive Zod
app/api/v1/<...>/route.ts                # delegan a <módulo>Controller vía DI
middleware.ts                            # delega a AuthMiddlewareAdapter
```

Módulos hexagonales activos: `auth`, `rbac`, `users`, `payment-methods`, `folios`, `departments`, `branches`, `providers`, `products`, `inventory`, `customers`, `pos`, `quotes`, `returns`, `payments`, `expenses`, `billing`, `reports`, `purchases`, `waybills`, `sat-codes`, `tax-rates`, `settings`.

**Reglas de capas (backend):**
- El dominio no importa nada de infraestructura ni de Next.js.
- Los use cases reciben ports (interfaces), nunca implementaciones concretas.
- Los route handlers de `app/api/v1/` no contienen lógica; delegan al controller.
- Validación Zod ocurre en el controller, antes de los use cases.
- **Orden en handlers scoped por sucursal**: validar UUID + body (Zod → 400) → `enforceBranchScope` (401/403) → use case. No invertir; preserva los códigos HTTP esperados.

## Arquitectura Frontend (`app/`)

Convención: **Atomic Design + Route Groups + `_logic/` por feature**. Todo lo de UI vive bajo `app/`; `src/` es exclusivo del backend hexagonal.

```
app/
├── api/v1/                # Route Handlers versionados → delegan a src/ vía DI
├── _components/           # Atomic Design — UI genérica, 0 lógica de negocio
│   ├── atoms/             # Button, Input, Select, Spinner, Switch, Badge, Skeleton
│   ├── molecules/         # FormField, DataTable, PageLoading, SearchBar, Combobox,
│   │                      # ConfirmDialog, EmptyState, RailFlyout, SegmentedButton
│   └── organisms/         # PageShell, NavigationRail, TopAppBar
├── _hooks/                # Hooks globales reutilizables en ≥2 módulos
│   ├── useCurrentUser.ts useHeadquarters.ts useFoliosOptions.ts
│   └── usePaymentMethodsOptions.ts useDebounce.ts useMediaQuery.ts ...
├── _lib/                  # Utilidades puras: cn, formatters, validators, jwt, authFetch
├── (public)/auth/         # /auth/login, /auth/register — split-panel
└── (private)/             # dashboard, pos, sales, quotes, inventory, catalogs,
                           # users, roles, settings
```

**Reglas de capas (frontend):**
- **`_components/` y `_blocks/` son presentational**: NO `fetch`, `sessionStorage`, `localStorage`, `useRouter().push/replace`, ni validación inline. Sólo `useState` para inputs controlados.
- **`_hooks/` (global)**: React/framework-agnostic; no importa de `app/(private)/(public)`; reutilizable en ≥2 módulos.
- **`_logic/hooks/` (módulo)**: acoplado al feature; importa de `_logic/services/`; orquesta estado + validación + HTTP + navegación.
- **`_logic/services/`**: encapsulan `fetch` a `/api/v1/...`, normalizan errores HTTP a errores tipados del módulo, aceptan `fetchImpl?: typeof fetch` para tests. Nunca devuelven `Response` crudo.
- **`_logic/schemas/`**: validación Zod cliente; el backend mantiene sus propios schemas.
- **`_logic/types/`**: `api.ts` (DTOs HTTP) + `domain.ts` (tipos de dominio del frontend).
- **Páginas (`page.tsx`)**: Server Components por defecto, exportan `metadata`, leen cookies con `next/headers`. Nunca llevan `"use client"`.
- **Naming**: el prefijo `_` (en `_components`, `_hooks`, `_lib`, `_logic`, `_blocks`) marca carpetas privadas no enrutables para Next.js.
- **Imports**: `@/*` apunta a `src/*`; para `app/` usar rutas relativas o `app/*`.

## Sistema de diseño

**Lectura obligatoria antes de tocar cualquier archivo bajo `app/`:** [`designer.md`](./designer.md) (raíz del repo). Fuente canónica: Stitch proyecto `5227157529282603342` ("Agro-Systemic", Material 3). Cubre paleta, escala tipográfica (16 tokens en `tailwind.config.ts`), spacing, radios, elevación, catálogo de primitivas (`PageShell`, `Button`, `DataTable`, `Select`, `Input`/`FormField`, `Card`, `PageLoading`), recetas cerradas por tipo de pantalla, prohibiciones y desviaciones documentadas.

Todo spec `openspec/specs/*-ui/spec.md` **referencia la capability `design-system`** y no redefine tokens de color, tipografía, spacing, radio ni elevación — esas viven únicamente en `designer.md` y `tailwind.config.ts`.

Guardarraíl automatizado: `tests/unit/ui/design-system/tokens.test.ts` falla ante clases tipográficas fuera de escala, hex crudo, `bg-gray-*`, `rounded-2xl`/`rounded-3xl`, o `<button>`/`<table>`/`<select>` crudos nuevos en `_blocks/` (los existentes están en una allowlist de deuda declarada que sólo puede encoger).

**Nota de implementación:** `app/_lib/cn.ts` extiende `tailwind-merge` (`extendTailwindMerge`) para registrar la escala tipográfica M3 como grupo `font-size` propio. Sin esa extensión, `tailwind-merge` clasifica erróneamente clases como `text-label-lg` o `text-headline-sm` como "color de texto" y las descarta silenciosamente al combinarlas con una clase de color real (`text-on-primary`, etc.) en el mismo `cn(...)`. Si se añade un token nuevo a `tailwind.config.ts` → `fontSize`, agregarlo también a `M3_FONT_SIZE_TOKENS` en `cn.ts`.

## Prisma y Supabase

```
DATABASE_URL  → pooler PgBouncer puerto 6543 (runtime)
DIRECT_URL    → conexión directa puerto 5432 (migraciones)
```

- Migraciones: `npx prisma migrate dev --name <descripción>` (dev), `npx prisma migrate deploy` (CI/CD).
- **FKs en `TEXT`, no `uuid`**. Los IDs son `String @id @default(uuid())` → columna `TEXT`. Las FKs (`department_id`, `product_id`, `branch_id`, etc.) son `TEXT` para coincidir con la PK; un `@db.Uuid` rompería la FK por mismatch. La validación Zod sí usa `z.string().uuid()` porque los **valores** son UUIDs.
  - **Excepción confirmada en DB**: `users.id` y todas las FK que referencian usuarios (`cashier_id`, `creator_id`, `cancelled_by`, `authorized_by`, `user_id`, `created_by`) SÍ son columna `uuid` real en Supabase (verificado via `information_schema.columns`), y las FKs correspondientes ya llevan `@db.Uuid` en varios modelos (ver `cancelledBy`/`creatorId`/`userId` más abajo). `User.id` en `schema.prisma` no declara `@db.Uuid` explícito pero la columna real ya es `uuid` — desalineación cosmética en el schema fuente, no en la DB. No aplicar la regla general de "TEXT" a FKs de usuario; no "corregir" quitando `@db.Uuid` de esas relaciones.
- Modelos: `User, Role, Permission, RolePermission, UserRole, PaymentMethod, Folio, Department, Branch, Provider, Product, ProductPrice, ProductDosification, BranchInventory, Customer, Sale, SaleItem, Quote, QuoteItem`.

## Ambientes: PROD vs dev/test

| Variable | dev/test | PROD |
|---|---|---|
| Proyecto Supabase | `qzzjpyepggwautckqeex` (`.env.local`) | `cggfhiyxufjdzxzcxugo` (Vercel env) |
| Migraciones | `prisma migrate dev` | `prisma migrate deploy` (CI/CD) |
| Seed | `npm run seed` / `npm run seed:folios` | **Prohibido** sin autorización explícita |
| MCP Supabase | `mcp__supabase-prod__*` apunta a PROD — usar con cuidado | — |

**Reglas:**
- Todo chequeo contra `.env.local` → declarar explícitamente "test/dev", no reportar como verificación de prod.
- `mcp__supabase-prod__*` toca prod directo — consultas de lectura OK; mutations (`execute_sql`, `apply_migration`) requieren confirmación explícita del usuario.
- No correr `prisma migrate dev` contra `DIRECT_URL` de prod — genera migrations shadow y puede marcar migraciones como "drift".
- Seeds (`npm run seed`, `npm run seed:folios`) solo en dev/test. Prohibido en prod sin instrucción explícita del usuario.
- `git filter-repo` / force-push sobre historial: requiere autorización explícita, no ejecutar por iniciativa propia.

## Comandos frecuentes

```bash
npm run dev          # Servidor de desarrollo
npm run build        # Build de producción (verifica tipos)
npm test             # Todos los tests
npm run test:watch   # Watch
npm run seed         # Seed RBAC idempotente
npm run seed:folios  # Seed catálogo canónico de 8 folios (TK, TC, RB, COT, DEV, TS, AB, CP)
npx prisma studio    # GUI de BD
npx prisma generate  # Regenerar Prisma Client
```

## Usuario de prueba (dev/QA)

Para pruebas manuales locales (browser automation, QA exploratorio) usar:

- Email: `admin@example.com`
- Password: `admin1234`

Nota: `CLAUDE.md` está versionado en git — este es un usuario admin sembrado solo para entornos locales de desarrollo, no una credencial de producción.

## Alias de rutas

`@/*` → `src/*` (configurado en `tsconfig.json` y `jest.config.ts`).

## Convenciones de tests

- Tests unitarios backend: `tests/unit/modules/<módulo>/...` — `testEnvironment: "node"`.
- Tests unitarios frontend: `tests/unit/ui/...` — `testEnvironment: "jsdom"` con React Testing Library.
- Tests de integración: `tests/integration/modules/<módulo>/...`.
- E2E: `tests/e2e/` (sin runner aún).
- Los use cases se prueban con `InMemory<Repo>`, nunca mock de BD real.
- `jest.config.ts` usa `projects` para separar `node` (backend) y `jsdom` (UI).
- **Verificación manual/visual en browser: usar Playwright (`mcp__playwright__*`), nunca Claude-in-Chrome** — Claude-in-Chrome mostró timeouts de captura/script no reproducibles ni siquiera en páginas externas (`example.com`), Playwright es la vía confiable en este entorno.

## JWT

- **Access token**: HS256, TTL 15 min, `Authorization: Bearer`. Claims: `sub`, `email`, `roles[]`, `branchId` (string | null).
- **Refresh token**: HS256, TTL 7 días (sliding), cookie `refreshToken` HttpOnly + SameSite=Strict. Claims: `sub`, `email`, `branchId`. Cada llamada a `/api/v1/auth/refresh` exitosa rota la cookie con TTL renovado de 7 días.
- Secrets: `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` — fallar en startup si no están.
- **`branchId`**: sucursal asignada (`null` para admins). Cambiar `branchId` en BD NO invalida tokens activos; el refresh propaga el viejo. Para efecto inmediato, re-loguearse.
- **Auto-refresh client-side**: `app/_lib/session/refreshScheduler.ts` programa el refresh ~60 s antes del `exp` del access token. `authFetch` reintenta con refresh ante 401 (dedupe de 1 sola promesa concurrente).
- **Cierre por inactividad**: `useInactivityTimer` (30 min default) cierra la sesión con `logoutClient("inactivity")` → redirige a `/auth/login?reason=inactivity`. Login muestra banner contextual según `?reason=inactivity|session_lost`.
- **Coordinación multi-pestaña**: `BroadcastChannel("agrisas-auth")` en `SessionLifecycleProvider`. Solo la pestaña líder llama a `/auth/refresh`; las demás actualizan su token vía broadcast. Logout en cualquier pestaña cierra las demás.

## Middleware de autenticación

- `middleware.ts` (raíz) usa matcher `"/((?!_next/static|_next/image|favicon.ico).*)"`.
- `AuthMiddlewareAdapter` mantiene lista propia de rutas públicas (defensa en profundidad):
  - Exactas: `/api/v1/auth/{login,register,refresh,logout}`, `/auth/{login,register}`, `/favicon.ico`.
  - Prefijo: `/_next/`.
- Sin token en `/api/**` → 401 JSON. Token expirado → 401 `{"error":"Token expired"}`.
- Sin token en rutas de página → redirect 302 a `/auth/login`.
- Con token válido → propaga `x-user-id`, `x-user-email`, `x-user-roles` (coma) y `x-user-branch-id` (cadena vacía si null).

## Autorización (RBAC)

Módulo `src/modules/rbac/` — modelo `users → roles → permissions`.

- Tablas: `roles`, `permissions`, `role_permissions`, `user_roles` (migración `add_rbac_tables`).
- `PermissionKey`: `^[a-z][a-z0-9_]{0,31}:[a-z][a-z0-9_]{0,31}$` (ej. `users:write`).
- **Guard**: `requirePermission(req, "resource:action")` en `src/modules/rbac/infrastructure/http/requirePermission.ts` — 401 si falta `x-user-id`, 403 si `userCan` es false.
- `AuthorizationService.userCan(userId, key)` — caché en memoria 60 s; `invalidate(userId)` e `invalidateByRole(roleId)` para invalidación explícita.
- **JWT** lleva `roles: string[]` (nombres), no permisos. Los permisos se resuelven en backend.
- **Seed**: `npm run seed` idempotente; 47 permisos, 3 roles base (`admin`, `operator`, `viewer`). `RBAC_DEFAULT_ROLE=viewer` al registrar.
- Detalle de qué permisos otorga cada rol → `openspec/specs/rbac/spec.md`.

## Branch scoping (transversal)

`users.branch_id` (nullable) asocia a un operador con una sucursal. El claim `branchId` del JWT y el header `x-user-branch-id` lo propagan. Cada handler que opere sobre `:branchId` aplica:

```ts
const bypass = await authz.userCan(userId, "branches:access_all");
if (!bypass && resourceBranchId !== req.headers.get("x-user-branch-id")) return 403;
```

Helpers: `enforceBranchScope(req, resourceBranchId)` y `resolveScopedBranchId(req, requestedBranchId)` en `src/modules/rbac/infrastructure/http/enforceBranchScope.ts`. El permiso `branches:access_all` (sólo `admin`) es el único bypass.

## Sucursal matriz (HQ)

`branches.is_headquarters BOOLEAN DEFAULT FALSE` con índice único parcial `branches_hq_idx ON branches(is_headquarters) WHERE is_headquarters = TRUE`. Crear/editar a `true` cuando ya hay otra → 409 `{"error":"Another branch is already marked as headquarters"}`. Cero matrices está permitido (sólo bloquea editar tickets completados).

Helper: `branchRepo.findHeadquarters(): Promise<Branch | null>`.

## Cliente HTTP autenticado y RBAC en UI

### `authFetch` (`app/_lib/authFetch.ts`)

Wrapper sobre `fetch` para peticiones autenticadas.
- Inyecta `Authorization: Bearer <token>` desde `sessionStorage.accessToken`; `init.skipAuth === true` lo omite.
- Errores tipados: `UnauthenticatedError` (401), `ForbiddenError(required?: string)` (403, `err.required` = permiso faltante), `NetworkError`.
- Devuelve `Response` crudo; el caller parsea según su dominio.
- Los services aceptan `fetchImpl?: typeof fetch` para tests.

### `useCurrentUser` (`app/_hooks/useCurrentUser.ts`)

```ts
const { userId, email, roles, branchId, isLoading, can, refresh } = useCurrentUser();
```

- Decodifica el JWT desde `sessionStorage` con `decodeJwtPayload` (sin verificar firma); `branchId === ""` se normaliza a `null`.
- `can(permission): boolean | "loading"` — consulta `/api/v1/admin/users/:id/permissions`. Caché de módulo `Map<userId, { permissions, expiresAt, promise }>` TTL 60 000 ms con dedupe de promesa.
- `refresh()` invalida la entrada y fuerza re-fetch.
- **NavigationRail** filtra items con `requires` usando `can()`: muestra optimistamente durante `"loading"`, oculta cuando es `false`.

### Hooks globales reutilizables

- `useHeadquarters` — consulta `GET /api/v1/admin/branches?pageSize=100`, filtra `isHeadquarters===true`, caché 60 s.
- `useFoliosOptions`, `usePaymentMethodsOptions` — listas activas con caché 60 s (consumidos por POS y Cotizaciones).

## Capacidades CRUD admin (visión general)

Cada módulo CRUD admin sigue el mismo patrón hexagonal y la misma forma de endpoints. Los detalles (campos, regex, paginación, errores) viven en su spec.

| Módulo | Permisos | Spec |
|---|---|---|
| Users | `users:read` / `users:write` | `admin-users` |
| Payment Methods | `payment_methods:read` / `payment_methods:write` | `admin-payment-methods` |
| Folios | `folios:read` / `folios:write` | `admin-folios` |
| Departments | `departments:read` / `departments:write` | `admin-departments` |
| Branches | `branches:read` / `branches:write` (+ `branches:access_all`) | `admin-branches` |
| Providers | `providers:read` / `providers:write` | `admin-providers` |
| Products | `products:read` / `products:write` | `products-api` |
| Inventory | `inventory:read` / `inventory:write` | `inventory-api` |
| Customers | `customers:read` / `customers:write` | `customers-api` |

**Reglas comunes (todos):**
- `code`: `^[A-Z0-9_]{1,32}$` — inmutable tras creación, único; uppercase+trim normalizado; duplicado → 409. `code` en PATCH se ignora.
- Soft delete vía `isActive=false`; GET `?includeInactive=true` para incluirlos.
- `pageSize` máximo 100; `PATCH` requiere ≥1 campo (body vacío → 400); no encontrado → 404.
- Helper `parseListQuery` en `src/shared/infrastructure/http/`.

**Reglas específicas a recordar:**
- **Users**: admin no puede editar/eliminar su propia cuenta (403); `avatarUrl` jamás `null` en respuesta (fallback Gravatar md5(email)); `PATCH avatarUrl: null` resetea a Gravatar; hard delete.
- **Providers / Customers**: `rfc` regex `^([A-ZÑ&]{3,4}\d{6}[A-Z\d]{3})$` único, editable, upper-normalizado (409 si duplicado). Datos fiscales MX con regex: `taxRegime` `^\d{3}$`, `cfdiUse` `^[A-Z]\d{2}$`, `taxZipCode` `^\d{5}$`.
- **Customers**: `currentBalance` read-only (no se mueve desde POST/PATCH/sales — diferido a futuro `add-customer-credit`). `creditLimit >= 0` o `null`. `creditDays` entero `>= 0` (default `30`, sin tope superior), administrable vía POST/PATCH; consumido por `PrismaSaleRepository` para calcular `dueDate` en ventas a crédito (`addDays(completedAt, customer.creditDays ?? 30)`).
- **Products**: `iva_rate`/`ieps_rate` decimal `0–1` nullable; el controller normaliza valores `> 1` dividiendo entre 100 (acepta `16` → `0.16`). `sat_product_code` `^\d{8}$`. `department_id` FK obligatoria a depto **activo** (sino 400).
  - **Prices**: `name` único por producto; máximo un `is_default=true` (partial unique index `product_default_price_idx`); en PATCH `isDefault:true` desactiva el default previo atómicamente. Hard delete.
  - **Dosifications**: `name` único por producto; `num_parts >= 2`. Soft delete. `computedUnitPrice = basePrice / numParts * (1 + dosificationSurchargePct / 100)` vía `DosificationPriceCalculator` (servicio puro, sin I/O). El recargo YA NO es constante fija — se resuelve en runtime desde `settings-api` (`GET/PATCH /api/v1/admin/settings/pricing`, tabla `pricing_settings` singleton, default `5.0`% si no hay fila). Mismo % aplica en catálogo (`toProductDosificationDto`) y en POS (`CreateSaleUseCase`/`EditCompletedSaleUseCase` vía `PosLookupService.getDosificationSurchargePct()`) — un solo punto de configuración. Sin precio default → `computedUnitPrice: null`, `requiresDefaultPrice: true`.
- **Inventory**: rutas bajo `/api/v1/admin/branches/[id]/inventory` (Next.js no permite slugs distintos hermanos como `[branchId]`). `(branch_id, product_id)` único (409). `POST /adjust` aplica delta atómico vía `UPDATE ... WHERE quantity + delta >= 0`; 0 filas afectadas → 404 o 409 (`Negative stock not allowed`). `?belowReorder=true` filtra `quantity < reorder_point`. `quantity` **puede ser negativo** sólo cuando lo origina una venta del POS (la migración `add-pos` eliminó el CHECK `quantity >= 0`); el admin `/adjust` sigue rechazando negativos. Aplica branch scoping.
- **Branches**: campo `isHeadquarters` con regla descrita en sección HQ.
- **Folios**: campo `scope: 'POS' | 'INVENTORY' | 'OPERATIONS'` (NOT NULL, default `'OPERATIONS'`, editable on PATCH). Catálogo canónico de 8 folios sembrado vía `npm run seed:folios`: TK/TC/COT (POS), TS (INVENTORY), RB/AB/DEV/CP (OPERATIONS). `GET /folios?scope=POS` filtra. Backend enforza scope en `CreateSale`/`CreateQuote`/`ConvertQuote` (esperan `POS`) y `RegisterPayment` (espera `OPERATIONS`); mismatch → 400 `{"error":"FolioScopeMismatch","expected":"...","actual":"..."}`. El seed `prisma/seeds/folios.ts` borra folios legacy sin referencias y aborta con mensaje claro si alguno tiene FKs activas.

### Migraciones relevantes

- `add_rbac_tables`, `20260518000001_add_avatar_url_to_users`, `20260519000001_add_settings_catalog_tables`, `20260525000001_add_providers_table`, `20260528000001_add_products_and_inventory_tables`, `20260530000001_add_pos_tables_and_branch_scoping`, `20260531000001_add_quotes_tables_and_link_to_sale`, `20260611000001_add_folios_scope_column`, `20260806000001_add_pricing_settings`, `20260930023601_add_expenses_table`.

## POS y Cotizaciones (Backend)

Módulos `src/modules/customers/`, `src/modules/pos/`, `src/modules/quotes/`. Specs: `customers-api`, `pos-api`, `quotes-api`.

### Estados y ciclos de vida

- **Sale**: `completed` | `cancelled` | `edited`. No hay `draft`/`open`: el carrito vive en cliente.
  - **Crear** (`CreateSaleUseCase`, transaccional): valida customer/branch/folio/paymentMethod activos → valida `productPrice.productId === item.productId` → snapshotea por línea → calcula totales → incrementa `folios.current_number` atómico → decrementa `branch_inventory.quantity` (allow negative; crea registro con `-qty` si falta) → persiste.
  - **Cancelar** (`CancelSaleUseCase`): idempotente; restaura stock; `status='cancelled'`, `cancelledAt`, `cancellationReason`. Folio NO se libera (numeración fiscal MX consecutiva sin reuso).
  - **Editar** (`EditCompletedSaleUseCase`): rechaza si `cancelled`; restaura stock viejo → borra `sale_items` → re-aplica nuevas → recalcula → `status='edited'`, `editedAt`. Folio/branch inmutables. **Sólo desde HQ** (guard en `SalesController.edit`: bypass con `branches:access_all` o `x-user-branch-id === hq.id`; sin matriz → todos los non-admin reciben 403).
- **Quote**: `draft → authorized → converted | cancelled | expired`. Sólo `draft` editable. Sólo `authorized` convertible. `converted` y `cancelled` terminales. `expired` se calcula en lectura (`status='authorized' AND expires_at < NOW()` → `isExpired: true`; sin cron).
  - **NO toca inventario** en create/update/authorize/cancel. Único momento de movimiento de stock: la conversión, delegada al pipeline POS (`SaleRepository.createCompletedFromQuote`).
  - **Inmutables tras creación**: `customerId`, `branchId`, `folioId`, `folioNumber`. Para cambiarlos: cancelar y crear otra.
  - **Folio de cotización ≠ folio fiscal**: la cotización usa típicamente un folio `code='COT'`; al convertir, el body de `/convert` indica el folio fiscal de la venta resultante.
  - **Cancelación NO idempotente**: cancelar dos veces → 409. Cancelar una `converted` → 409 con `saleId` (UI debe redirigir al flujo de cancelación de venta).
  - **Expiración rechazada en autorización y conversión**: `expiresAt < NOW()` → 409 `QuoteExpiredError`.

### Snapshot por línea (transversal Sale ↔ Quote ↔ ReturnItem)

Tanto `SaleItem` como `QuoteItem` y `ReturnItem` snapshotean: `productCodeSnapshot`, `productNameSnapshot`, `priceNameSnapshot`, `unitPrice`, `discountPct`, `ivaRate`, `iepsRate`. Sobreviven renames/borrados del catálogo. La conversión preserva el snapshot sin re-resolver el catálogo (gana el precio cotizado aunque el de catálogo haya cambiado).

### Cálculo de totales (transversal)

Servicios puros: `SaleTotalsCalculator`, `QuoteTotalsCalculator`, `ReturnTotalsCalculator` (en sus respectivos `domain/services/`). Por línea:

```
lineSubtotal = round(quantity * unitPrice * (1 - discountPct/100), 4)
lineIva       = round(lineSubtotal * ivaRate, 4)
lineIeps      = round(lineSubtotal * iepsRate, 4)
lineTotal     = lineSubtotal + lineIva + lineIeps
```

Redondeo half-to-even (banker's) a 4 decimales (escala `Decimal(14,4)`). UI muestra a 2 decimales. **Test de equivalencia obligatorio** entre los tres calculadores sobre vectores compartidos (`tests/fixtures/totals-vectors.ts`).

### Enlace Quote ↔ Sale

- `Sale.quoteId: string | null` — FK opcional a `quotes(id)` `ON DELETE SET NULL`. `null` para ventas directas; poblado por `/quotes/:id/convert`.
- `POST /sales` acepta `quoteId?: string | null`; si se envía, `CreateSaleUseCase` (con `QuoteRepository` inyectado) valida `status='authorized'`, `convertedSaleId === null`, `branchId/customerId` coincidan (sino 400).
- `SaleRepository.createCompletedFromQuote(data)`: en una sola transacción aloca folio fiscal, decrementa inventario, inserta `sales`+`sale_items` con `quote_id`, marca cotización `converted` (`convertedAt=NOW()`, `convertedSaleId=<newSaleId>`). El use case de conversión también llama `quoteRepo.markConverted` para consistencia bidireccional.
- **Conversión idempotente**: si `convertedSaleId !== null`, la segunda llamada devuelve la misma venta sin doble decremento ni doble folio.
- El POS DI container importa `PrismaQuoteRepository` localmente (no desde `quotes/di`) para evitar import circular.

### Arquitectura

- `PosLookupService` (impl. `PrismaPosLookupService`) abstrae consultas a Product/ProductPrice/Customer/Branch/Folio/PaymentMethod para que los use cases no acoplen Prisma.
- `PrismaSaleRepository.{createCompleted,cancel,replaceItemsAndRecalculate,createCompletedFromQuote}` orquestan transacciones; usan `$executeRaw` para los UPDATE atómicos de inventario. Helpers internos compartidos: `allocateFolio`, `decrementInventoryAllowNegative`, `toSaleItemCreate`.
- `PrismaQuoteRepository.createWithItems` ejecuta `prisma.$transaction` con `UPDATE folios SET current_number = current_number + 1 ... RETURNING` + inserts. **No toca `branch_inventory`** en ningún punto.

## Devoluciones (Backend)

Módulo `src/modules/returns/`. Spec: `returns-api`. Migración: `20260602000001_add_returns_tables` (tablas `returns`, `return_items`).

**Ciclo de vida**: `completed → cancelled`. No hay más transiciones. `completed` = devolución activa; `cancelled` = revertida.

**Endpoints** (`returns:read` / `returns:create` / `returns:cancel`):
- `GET /api/v1/admin/returns` — lista paginada con branch scoping
- `POST /api/v1/admin/returns` — crea devolución; el `branchId` se deriva del sale (no va en body)
- `GET /api/v1/admin/returns/:id` — detalle con items
- `POST /api/v1/admin/returns/:id/cancel` — cancela; revierte inventario
- `GET /api/v1/admin/sales/:id/returns` — todas las devoluciones de una venta (incluye `cancelled`)

**Reglas de negocio:**
- Solo se puede devolver una venta con `status='completed'`. `cancelled` y `edited` → 409 `SaleNotReturnableError`.
- `ReturnableQuantityCalculator.computeRemaining(soldQty, priorItems)`: sólo las devoluciones `completed` descuentan del remanente. Una devolución `cancelled` **libera** su espacio (el espacio se puede re-devolver).
- `createWithItems` (tx Prisma): incrementa `branch_inventory.quantity` por cada item (crea registro si no existe, igual que el helper del POS). `markCancelled` (tx): decrementa (permite negativo).
- **No toca `sale_items`** en ningún paso. Los snapshots se copian del `sale_item` original.
- **`customerBalance` no muta** al crear ni cancelar devoluciones. Diferido a `add-customer-credit`.
- **No usa folio** del catálogo (diseño explícito; no acopla al sistema de folios).
- `cancelledBy` y `creatorId` son `@db.Uuid` (igual que `sales.cashier_id`).

**Caveat de inventario al cancelar ventas con devoluciones vigentes**: si una venta `completed` tiene devoluciones `completed`, cancelar la venta restaura el stock ORIGINAL vendido (no neto). El stock queda "inflado" por las unidades ya devueltas. Este comportamiento es intencional y requiere reconciliación manual.

**`SaleDetailDto.returnedQuantityBySaleItem`**: `Record<saleItemId, number>` — agrega `SUM(quantity)` de devoluciones `completed` por `sale_item_id`. Poblado en `PrismaSaleRepository.findByIdWithItems` via `$queryRaw`. `{}` si no hay devoluciones.

**Branch scoping**: idéntico al resto de módulos — `resolveScopedBranchId` para `list`; `enforceBranchScope` cargando el recurso primero para `getById`/`cancel`/`listBySale`/`create`. Para `create` el `branchId` se extrae del `sale` (el body no lo recibe).

**Permisos RBAC**:
| Permiso | admin | operator | viewer |
|---|---|---|---|
| `returns:read` | ✅ | ✅ | ✅ |
| `returns:create` | ✅ | ✅ | ❌ |
| `returns:cancel` | ✅ | ✅ | ❌ |

**Arquitectura**:
- Puerto: `src/modules/returns/application/ports/ReturnRepository.ts`
- Use cases: `CreateReturnUseCase`, `ListReturnsUseCase`, `GetReturnUseCase`, `ListReturnsBySaleUseCase`, `CancelReturnUseCase`
- Repositorio Prisma: `src/modules/returns/infrastructure/repositories/PrismaReturnRepository.ts`
- Repositorio InMemory (tests): `src/modules/returns/infrastructure/repositories/InMemoryReturnRepository.ts`
- Controller: `src/modules/returns/infrastructure/http/ReturnsController.ts`
- DI: `src/modules/returns/infrastructure/di/container.ts` → exporta `returnsController`. Instancia `PrismaSaleRepository` localmente (no desde `pos/di`) para evitar import circular.

## Abonos (Backend)

Módulo `src/modules/payments/`. Spec: `payments-api`. Migración: `20260608000001_add_customer_payments` (tablas `customer_payments`; columnas `paid_amount`, `payment_status` en `sales`; columna `is_credit` en `payment_methods`).

**Ciclo de vida del pago**: `completed → cancelled`. Solo esas dos transiciones. No hay draft ni pending en `CustomerPayment`.

**Ciclo de vida de `sale.paymentStatus`**: `pending → partial → paid` (o cualquier transición al crear/cancelar abonos). `pending` = venta a crédito sin ningún abono; `partial` = abonos parciales; `paid` = liquidada. Ventas cash crean directamente con `paidAmount=total` y `paymentStatus='paid'`.

**El carácter "crédito" se deriva de `paymentMethod.isCredit`**, no de una columna en `sales`. Si `paymentMethod.isCredit=true`: venta crea con `paidAmount=0`, `paymentStatus='pending'`, incrementa `customer.currentBalance` en el total. Si `false`: `paidAmount=total`, `paymentStatus='paid'`, balance no se toca.

**Endpoints** (`payments:read` / `payments:create` / `payments:cancel` / `payments:report_read`):
- `GET /api/v1/admin/payments` — lista paginada con branch scoping
- `POST /api/v1/admin/payments` — registra abono; valida que la venta sea crédito y que el monto no exceda el due
- `GET /api/v1/admin/payments/:id` — detalle
- `POST /api/v1/admin/payments/:id/cancel` — cancela; revierte `sale.paidAmount`, `sale.paymentStatus`, `customer.currentBalance`
- `GET /api/v1/admin/payments/history` — historial con filtros (`?format=json|pdf`; `productId` via EXISTS en sale_items)
- `GET /api/v1/admin/sales/:id/payments` — abonos de una venta + agregados

**Reglas de negocio:**
- Solo se puede abonar ventas con `paymentMethod.isCredit=true` (`SaleNotPayableError` si no).
- `amount ≤ (total - paidAmount)` — exceso → 409 `PaymentExceedsDueAmount(due)`.
- `createCompleted` (tx Prisma): (a) aloca folio RB (scope=OPERATIONS) via `allocateFolio`, (b) `UPDATE sales SET paid_amount = paid_amount + ? WHERE paid_amount + ? <= total` (0 filas → `PaymentExceedsDueAmountError`), (c) `UPDATE customers SET current_balance = current_balance - ?` (nunca puede sobrepasar el total pagado), (d) INSERT en `customer_payments`.
- `markCancelled` (tx): cancela en DB, recalcula `paymentStatus` via `SalePaymentApplier`, revierte `sale.paidAmount`, revierte `customer.currentBalance`.
- **Cancelar venta con abonos activos → 409 `SaleHasActivePayments`** (con array de paymentIds). El caller debe cancelar los abonos primero.
- **Editar venta con abonos activos → 409** por la misma razón.
- `cancelledBy` y `userId` son `@db.Uuid`.
- **Folio RB**: semilla `code='RB'`, `prefix='RB-'`, `scope='OPERATIONS'`. Cada abono consume un número secuencial. El folio de la cotización/venta fiscal es independiente. El backend valida `folio.scope === 'OPERATIONS'` antes de allocate; folios POS/INVENTORY → 400 `FolioScopeMismatch`.
- **`payment_methods.isCredit`**: inmutable tras creación (PATCH lo ignora silenciosamente, igual que `code`).
- **PDF**: `renderToBuffer(<PaymentHistoryPdf/>)` server-side con `@react-pdf/renderer`. Si `items.length > 10000` → 409 `tooLarge=true`.
- **`allocateFolio` compartido**: `src/shared/infrastructure/folios/allocateFolio.ts` — reutilizado por `PrismaSaleRepository`, `PrismaQuoteRepository`, `PrismaPaymentRepository`.

**Branch scoping**: idéntico al resto — `resolveScopedBranchId` para `list` e `history`; `enforceBranchScope` cargando el recurso para `getById`/`cancel`/`listBySale`. Para `register` el `branchId` se extrae del sale.

**Permisos RBAC**:
| Permiso | admin | operator | viewer |
|---|---|---|---|
| `payments:read` | ✅ | ✅ | ✅ |
| `payments:create` | ✅ | ✅ | ❌ |
| `payments:cancel` | ✅ | ✅ | ❌ |
| `payments:report_read` | ✅ | ✅ | ✅ |
| `sales:create_credit` | ✅ | ✅ | ❌ |

**Arquitectura**:
- Puerto: `src/modules/payments/application/ports/PaymentRepository.ts`
- Use cases: `RegisterPaymentUseCase`, `CancelPaymentUseCase`, `ListPaymentsUseCase`, `GetPaymentUseCase`, `ListPaymentsBySaleUseCase`, `GetPaymentHistoryReportUseCase`
- Servicio de dominio puro: `SalePaymentApplier` — calcula `newPaidAmount` y `newPaymentStatus` sin I/O
- Repositorio Prisma: `src/modules/payments/infrastructure/repositories/PrismaPaymentRepository.ts`
- Repositorio InMemory (tests): `src/modules/payments/infrastructure/repositories/InMemoryPaymentRepository.ts`
- Controller: `src/modules/payments/infrastructure/http/PaymentsController.ts`
- PDF: `src/modules/payments/infrastructure/pdf/PaymentHistoryPdf.tsx`
- DI: `src/modules/payments/infrastructure/di/container.ts` → exporta `paymentsController`. Instancia `PrismaSaleRepository` localmente (no desde `pos/di`) para evitar import circular.

## Gastos (Backend)

Módulo `src/modules/expenses/`. Specs: `add-expenses-api` (change activo en `openspec/changes/`). Migración: `20260930023601_add_expenses_table`.

**Entidad `Expense`**: `branchId`, `concept` (max 200), `amount` (Decimal almacenado como string), `notes?` (max 1000), `photoUrl?`, `expenseDate`, `creatorId`, `isActive`. Sin estados complejos — ciclo de vida: activo → soft-deleted (`isActive=false`).

**Endpoints** (`expenses:read` / `expenses:write` / `expenses:report_read`):
- `GET /api/v1/admin/expenses` — lista paginada, filtros: `branchId`, `concept`, `from`, `to`; branch scoping
- `POST /api/v1/admin/expenses` — crear; `branchId` en body + branch scoping
- `GET /api/v1/admin/expenses/:id` — detalle con branch scoping
- `PATCH /api/v1/admin/expenses/:id` — editar; ≥1 campo (concept/amount/notes/expenseDate)
- `DELETE /api/v1/admin/expenses/:id` — soft delete; 204
- `POST /api/v1/admin/expenses/:id/photo` — upload foto multipart (`file` field); 413 si excede tamaño
- `DELETE /api/v1/admin/expenses/:id/photo` — borrar foto; 204
- `GET /api/v1/admin/expenses/report` — reporte `?format=json|pdf|xlsx`; filtros: branchId, concept, from/to, includeInactive; límite 10 000 rows → 409 `ReportTooLarge`

**Foto**: port `ExpensePhotoStoragePort`, impl `SupabaseExpensePhotoStorage` (Supabase Storage bucket). `InMemoryExpensePhotoStorage` para tests.

**Permisos RBAC**:
| Permiso | admin | operator | viewer |
|---|---|---|---|
| `expenses:read` | ✅ | ✅ | ✅ |
| `expenses:write` | ✅ | ✅ | ❌ |
| `expenses:report_read` | ✅ | ✅ | ✅ |

**Arquitectura**:
- Puerto: `src/modules/expenses/application/ports/ExpenseRepository.ts`
- Use cases: `CreateExpenseUseCase`, `UpdateExpenseUseCase`, `SoftDeleteExpenseUseCase`, `GetExpenseUseCase`, `ListExpensesUseCase`, `UploadExpensePhotoUseCase`, `DeleteExpensePhotoUseCase`, `GetExpensesReportUseCase`
- Repositorio Prisma: `src/modules/expenses/infrastructure/repositories/PrismaExpenseRepository.ts`
- Repositorio InMemory (tests): `src/modules/expenses/infrastructure/repositories/InMemoryExpenseRepository.ts`
- Controller: `src/modules/expenses/infrastructure/http/ExpensesController.ts`
- PDF/XLSX: `src/modules/expenses/infrastructure/pdf/ExpensesReportPdf.tsx`, `src/modules/expenses/infrastructure/xlsx/buildExpensesReportWorkbook.ts`
- DI: `src/modules/expenses/infrastructure/di/container.ts` → exporta `expensesController`

## UI por feature

### Convenciones compartidas

- **Modal create/edit con diff**: un único `<Módulo>EditModal` con prop `mode: "create" | "edit"`. En `edit` el `code` está deshabilitado (inmutable backend); submit sólo si el diff no está vacío. Campo opcional vacío envía `null` en el PATCH. Error 409 → mensaje inline en el campo correspondiente.
- **Búsqueda — client vs. server**:
  - `payment-methods`, `folios`, `departments`, `branches`: client-side sobre la página cargada (backend no acepta `?search=`).
  - `providers`, `products`, `sales`, `quotes`: **server-side** vía `?search=` (mín 2 chars) con debounce 300 ms. `CatalogToolbar` recibe `searchScope="server"` para renderizar badge "Búsqueda en servidor · 2+ caracteres".
- **Gating por permisos**: cada `*Page` usa `useCurrentUser().can(permission)`; muestra optimistamente durante `"loading"` para evitar layout shift.

### Catálogos (`/catalogs`)

Hub con 8 tarjetas. Rutas bajo `app/(private)/catalogs/`:

- `/catalogs/payment-methods` (`payment_methods:*`)
- `/catalogs/folios` (`folios:*`)
- `/catalogs/departments` (`departments:*`)
- `/catalogs/branches` (`branches:*`)
- `/catalogs/providers` (`providers:*`) — modal con 3 secciones (Datos básicos / Datos fiscales / Contacto)
- `/catalogs/products` (`products:*`) — detalle en `/catalogs/products/[id]` con 3 tabs (General / Precios / Dosificaciones) que gestionan el agregado sin modales anidados
- `/catalogs/tax-rates` (`tax_rates:*`)
- `/catalogs/customers` (`customers:*`) — modal con 3 secciones (Datos básicos / Datos fiscales / Contacto y crédito, incluye `creditLimit` y `creditDays`); búsqueda server-side; `_logic/` propio, sin imports cruzados con `pos/_logic` (el quick-add del POS/Cotizaciones/Facturación es un flujo separado, ver sección POS)

Bloques compartidos en `app/(private)/catalogs/_blocks/`: `CatalogShell`, `CatalogToolbar`, `CatalogPagination`, `CatalogStatusBadge`, `CatalogEmpty`, `CatalogError`, `CatalogHubCard`, `CatalogsHubPage`.

### Usuarios (`/users`)

`useUserMutations` calcula diff PATCH (`name`/`email`/`avatarUrl`) y sincroniza roles en paralelo sólo si `stagedRoleIds` difiere del original. "Resetear a Gravatar" envía `avatarUrl: null`. `ForbiddenError` sin `required` → `SelfModificationError`; con `required` → re-throw como error de permisos.

### POS / Ventas (`/pos`, `/sales`)

- `/pos` (`sales:create`): layout split-pane catálogo izquierda / carrito derecha.
- `/sales` (`sales:read`): listado paginado, filtros estado/sucursal (sucursal sólo con `branches:access_all`)/rango fechas.
- `/sales/[id]` (`sales:read`): detalle; permite cancelar (`sales:cancel`) y editar (`sales:edit_completed` + HQ guard cliente).
- `/sales/[id]/edit` (`sales:edit_completed`): reusa bloques POS; redirige a detalle si no se cumplen los guards.

**HQ guard cliente** (defensa en profundidad, backend también rechaza con 403):
```
mostrarEditar = can("sales:edit_completed") && (branchId === hq.id || can("branches:access_all"))
```
Optimista durante `hqLoading`. `EditSalePage` repite el guard en `useEffect`.

**`computeTotalsClient`** (`app/(private)/pos/_logic/lib/computeTotalsClient.ts`): port puro del `SaleTotalsCalculator` con banker's rounding. No depende de `src/modules/` (Prisma) en cliente.

**Quick-add de cliente**: `CustomerPicker` acepta `footerSlot` con "+ Nuevo cliente" sólo si `can("customers:write")`. `CustomerQuickAddModal` crea via `POST /customers`; al confirmar queda pre-seleccionado. 409 con "rfc" → `CustomerRfcAlreadyInUseError`; sin "rfc" → `CustomerCodeAlreadyInUseError`.

### Cotizaciones (`/quotes`)

- `/quotes` (`quotes:read`): listado paginado, filtros sucursal/estado/fechas/búsqueda server-side.
- `/quotes/new` (`quotes:create`): split-pane catálogo/carrito.
- `/quotes/[id]` (`quotes:read`): acciones contextuales por estado (Autorizar, Editar, Cancelar, Convertir).
- `/quotes/[id]/edit` (`quotes:write`): sólo si `status='draft'`; redirige sino.

**Modo "Cotización" en el POS**:
- `PosHeader` muestra `SegmentedButton` "Venta | Cotización" cuando el usuario tiene `quotes:create`.
- `CartPanel` en `mode="quote"` oculta forma de pago, muestra `expiresAt`, CTA "Crear cotización" (`bg-secondary-container`).
- Si el usuario sólo tiene `quotes:create` (sin `sales:create`): POS monta forzado en `mode="quote"`, oculta el SegmentedButton.

**Conversión**: `ConvertQuoteModal` pide `paymentMethodId` + `folioId` fiscal (distintos al folio de la cotización). Éxito → redirige a `/sales/[saleId]`.

### Devoluciones (UI) (`/returns`)

- `/returns` (`returns:read`): listado paginado con filtros estado/sucursal/fechas/búsqueda server-side (mín 2 chars, debounce 300 ms). Columnas: Folio venta, Cliente, Sucursal (solo con bypass), Devuelto por, Reembolso, Fecha, Estado, Acción.
- `/returns/[id]` (`returns:read`): detalle con header (link al ticket, `ReturnStatusBadge`, reembolso), `ReturnItemsTable` (snapshots), `ReturnMetaPanel` (cliente, motivo, notas, banner cancelación), `ReturnActionsBar` (botón cancelar si `completed` y `returns:cancel`).
- `/sales/[id]/returns/new` (`returns:create`): formulario contra ticket existente. Gate: `sale.status === 'completed'`. Extiende `SaleItemsTable` con `renderQuantityCell` (inputs de cantidad por fila, `ReturnLineRow`). Redirige a `/returns/<id>` en éxito.
- `SaleDetailPage` incluye `SaleReturnsSection`: lista devoluciones del ticket y muestra CTA "+ Registrar devolución" si `status='completed'` + `returns:create` + hay líneas disponibles.
- `SaleItemsTable` extendida con `returnedQuantityBySaleItem?` y `renderQuantityCell?` — backwards compatible.

**Bloques**: `ReturnsListPage`, `ReturnsToolbar`, `ReturnsTable`, `ReturnsEmpty`, `ReturnStatusBadge`, `ReturnDetailPage`, `ReturnItemsTable`, `ReturnMetaPanel`, `ReturnActionsBar`, `CancelReturnModal`, `SaleReturnsSection`, `CreateReturnPage`, `ReturnLineRow`, `CreateReturnFooter`.
**Hooks**: `useReturnsList`, `useReturnDetail`, `useReturnMutations`, `useSaleReturns`, `useCreateReturnForm`.
**Servicios**: `listReturns`, `getReturn`, `listSaleReturns`, `createReturn`, `cancelReturn`.
**Sin guard de matriz**: las devoluciones no requieren acceso a HQ.

### Gastos (UI) (`/expenses`)

- `/expenses` (`expenses:read`): listado paginado, filtros sucursal/fechas/concepto con búsqueda server-side (mín 1 char, debounce 300 ms); CTA crear si `expenses:write`.
- `/expenses/report` (`expenses:report_read`): reporte con filtros + exportar PDF/XLSX.

**Bloques**: `ExpensesPage`, `ExpensesToolbar`, `ExpensesTable`, `ExpenseEditModal`, `ExpensesReportPage`, `ExpensesReportToolbar`.
**Hooks**: `useExpenses`, `useExpenseMutations`, `useExpensesReport`.
**Servicios**: `listExpenses`, `getExpense`, `createExpense`, `updateExpense`, `softDeleteExpense`, `uploadExpensePhoto`, `deleteExpensePhoto`, `getExpensesReport`.
**Sin guard de matriz**: gastos no requieren acceso a HQ.

### NavigationRail

`RailItem` `{ key, href, icon, label, requires?, children? }`. Items con `children` (sólo un nivel) renderizan botón padre + `RailFlyout` en hover (anchored `left: 80px`). El padre es visible si AL MENOS UN hijo está en `true` o `"loading"`. Click en el padre navega al `href` del padre; click en hijo navega y cierra el flyout.

Items primarios y su `requires`:

| key | href | icon | requires |
|---|---|---|---|
| dashboard | `/dashboard` | `dashboard` | — |
| pos | `/pos` | `point_of_sale` | `sales:create` |
| sales | `/sales` | `receipt_long` | `sales:read` |
| quotes | `/quotes` | `request_quote` | `quotes:read` |
| returns | `/returns` | `assignment_return` | `returns:read` |
| expenses | `/expenses` | `trending_down` | `expenses:read` |
| inventory | `/inventory` | `inventory_2` | `inventory:read` |
| catalogs | `/catalogs` | `category` | (children) |
| users | `/users` | `group` | `users:read` |
| roles | `/roles` | `shield_person` | `roles:read` |

Children de `catalogs`: `payment_methods:read`, `folios:read`, `departments:read`, `branches:read`, `providers:read`, `products:read`, `customers:read`. Bajo los secundarios (`/support`, `/account`), un botón de logout invoca `useLogout` (deshabilitado mientras está en vuelo).

## OpenSpec

Workflow obligatorio: ver "Protocolo de desarrollo (obligatorio) — SDD con OpenSpec" arriba.

Specs canónicas (source of truth para reglas finas): ver `openspec/specs/<capability>/spec.md`.

Changes archivados (en orden cronológico): create-auth-api, add-login-ui, fix-login, emit-token-on-register, panel-front, add-roles-permissions, add-roles-ui, admin-users-crud, users-ui, logout-ui, crud-settings-models, add-catalogs-ui, add-providers-crud, add-providers-ui, inventory-backend, ui-ux-inventory, add-pos, ui-ux-pos, add-quotes-crud, ui-ux-quotes, apis-devoluciones, ui-ux-devoluciones, api-abonos, dosification-surcharge-settings, add-ticket-issuer-fiscal-data, remove-ticket-header-text.

Changes activos: ver `openspec/changes/` (excluyendo `archive/`).
