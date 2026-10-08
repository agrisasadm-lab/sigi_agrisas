## 1. Verificación previa al backfill (sólo lectura, prod)

- [x] 1.1 Confirmar sucursales Huajuapan/Pradera existen y están activas en prod (`SELECT` por nombre en `branches`) — hecho en la sesión de diagnóstico.
- [x] 1.2 Contar pares `branch_inventory` sin `product_prices` por sucursal (query de `design.md` — Decisión 2) — hecho: PRADERA 28, HUAJUAPAN 11, ZARIOZ 8.
- [x] 1.3 Correr el `SELECT` de "fuente única por `name`" — resultado: 43 pares con fuente única, 4 sin fuente única (Bio-freeze 1l en HUAJUAPAN: $1250 vs $1320 en TLAXIACO; Promesol 5X litreado en PRADERA: $152 vs $149; MANGANESSE QUELAT 1KG y SALIBRO DOS en PRADERA: sin precio en ninguna sucursal).
- [x] 1.4 Presentado al usuario — aprobado ("adelante").

## 2. Backfill en prod (sólo tras aprobación de la tarea 1.4)

- [x] 2.1 Ejecutado el `INSERT ... SELECT ... RETURNING id` para los 43 pares con fuente única.
- [x] 2.2 43 IDs insertados (para reversión puntual si se detecta un error):

  ```
  86dd0441-7f0a-4941-a68c-1854bcbce7cc, 2781f412-1e73-4655-9a18-01a0f84881d4, 32e424dc-868f-4ed5-b4d3-82bac3b2635f,
  28ff09ea-2b3c-456d-b5eb-49672b677844, de0be23d-aae5-4f77-a6d7-397defcd857f, c1f679a4-d99c-45a6-870c-d796b1a8e0f6,
  cd892360-7ce2-424c-b76d-b8c8bafd14a5, e9a1f57b-802a-4f7d-87dc-d5ade6363b8c, a7beecaf-3df1-4f63-ac38-99d9ab5e3594,
  9d03663f-d9f4-4679-b7de-7e96b65eb27c, fb57a550-3548-479e-8a1d-ccf50e90736e, d6717164-dfe4-41f6-bae0-b6d1612f5199,
  19386dfc-e975-45d6-b04b-324b23bd8c59, 82deb30f-3529-4265-accc-64f03d6bc8cc, 3f7211fb-feaa-4fc8-b45a-498fb311e942,
  93c6a2de-4402-4a9e-9705-551e9eec4025, fe4c00a9-58e0-4de5-ba8a-6b0f4458e727, 26d7de29-e227-4c12-9f39-8ccbe8722d10,
  fe4b2910-cfde-4b21-9f66-508049acbe8a, f26dd854-8d59-4f0b-b930-a1f9306ea923, da33c9d4-da76-4b83-bd4a-617fd7e37846,
  705d6fd2-a64d-441c-890c-d2f2df3132a1, 5367da38-0620-4ff4-974e-1dcd5d4d3232, 0f0cb399-c784-4571-9f84-56b429ad40e1,
  81c26de0-4984-4a62-a018-738f4f441fce, 6a165b31-77ee-44d3-8c09-03ec3cda7280, ee7ce8e6-1d33-4cff-9f85-79f6f88aae96,
  922e8d81-3201-489e-ae57-9eb22eba3bf5, 2e422ba2-ef8a-42a2-a478-8301a7e1713d, b887f526-f380-4aff-880c-f417c05916bf,
  23795b65-ac6a-4a5f-8fbe-f4c03990452e, 3fd8f979-2aa8-4afd-9c7d-70b7a511ff87, 5f935ce7-f91d-4e75-b7cf-1947dab662ad,
  12d5f111-c58c-419e-ad8c-65db15843666, 6e142024-a57f-4f6f-9702-5c501f6efb13, 0c95af2f-4f55-47bd-bd06-b14b8f39aa62,
  b27a705e-b150-4858-bedf-92cac802489a, fe24c783-819b-4f4e-8ec4-7063c9c1988e, 7ea8a9ae-032c-4dd1-add8-445883e8589e,
  aab73b0b-5864-4dd9-82c2-dba14a16ac18, f84258cb-e683-4670-8e5a-f7549683dfb0, db3efd1c-ed1b-4969-9ebe-e6a1e7eecea8,
  b4538c43-1c85-4714-8daa-4c531a793bc1
  ```

  Reversión si se necesita: `DELETE FROM product_prices WHERE id IN (<lista anterior>);` contra prod (`cggfhiyxufjdzxzcxugo`), sólo con aprobación explícita.
- [x] 2.3 Conteo re-corrido: PRADERA bajó de 28 a 3 restantes, HUAJUAPAN de 11 a 1, ZARIOZ de 8 a 0. Los 4 restantes son exactamente los reportados en 1.3 como "sin fuente única" — pendientes de decisión manual del negocio (fijar precio para Bio-freeze/Promesol/MANGANESSE/SALIBRO en las sucursales faltantes), no bloquean el resto del change.
- [x] 2.4 Decisión manual del negocio resuelta (2026-10-07) — precio fijado por el usuario para los 4 pares restantes e insertado vía `mcp__supabase-prod__execute_sql`:
  - BIOFRE (Bio-freeze 1l) / HUAJUAPAN: `$1250.00` — mayoría 2/3 entre sucursales existentes (CHICHICAPAM $1250, ZARIOZ $1250; outlier TLAXIACO $1320).
  - P5X1LT (Promesol 5X litreado) / PRADERA: `$152.00` — elegido por el usuario entre el empate HUAJUAPAN $152 / TLAXIACO $149.
  - MANG1KG (MANGANESSE QUELAT 1KG) / PRADERA: `$150.00` — sin precio previo en ninguna sucursal; usuario definió 1.5x sobre costo registrado ($100).
  - SALB (SALIBRO DOS) / PRADERA: `$8.00` — sin precio previo en ninguna sucursal; usuario definió 1.6x sobre costo registrado ($5).

  IDs insertados (para reversión puntual): `d324e10c-8909-40b9-8e5d-137b53e1f95a`, `3535e3ae-d7a8-4acc-9f1c-e233301d8673`, `6bcf63be-1320-40f9-8e6c-d07e42ce4db2`, `9be05e3d-89fb-4dde-8f56-cc4ce6f4d6ae`.

  Reversión si se necesita: `DELETE FROM product_prices WHERE id IN ('d324e10c-8909-40b9-8e5d-137b53e1f95a','3535e3ae-d7a8-4acc-9f1c-e233301d8673','6bcf63be-1320-40f9-8e6c-d07e42ce4db2','9be05e3d-89fb-4dde-8f56-cc4ce6f4d6ae');` contra prod (`cggfhiyxufjdzxzcxugo`), sólo con aprobación explícita.

  Conteo final re-corrido: **0 pares `(branch_inventory, product_prices)` faltantes en prod** — 47/47 cerrado.

## 3. Guardrail automatizado (CI)

- [x] 3.1 Creada `findBranchInventoryPairsMissingPrice(prisma)` en `src/shared/infrastructure/inventory/findBranchInventoryPairsMissingPrice.ts` (query raw, excluye branch/producto inactivos vía JOIN condicionado).
- [x] 3.2 Agregado test de integración `tests/integration/modules/inventory/branchPriceCoverage.test.ts` — caso cubierto (sin hueco) y caso con hueco real, ambos verificados.
- [x] 3.3 Confirmado: el test incluye casos específicos para sucursal inactiva y producto inactivo, ambos excluidos correctamente.
- [x] 3.4 `npx jest tests/integration/modules/inventory/branchPriceCoverage.test.ts` — 4/4 tests pasan.

## 4. Corregir `priceWriter.ts` y destrabar el seeder de onboarding

- [x] 4.1 `writeBasePriceTiers` reescrito — recibe `matrizBranchId` explícito en vez de `branchId: null`.
- [x] 4.2 Shim `upsertBase`/`findFirstBase` eliminado de `inventory-tiendas.ts` y de `PrismaLike` en `types.ts`; reemplazado por `findFirst`/`upsert` estándar con `branchId` real.
- [x] 4.3 `writeBranchPriceIfDivergent` ajustado — recibe `matrizBranchId` y compara contra el precio de Matriz como una sucursal más.
- [x] 4.4 `seedBranch.ts` actualizado (resuelve `matrizBranchId` una vez por fila vía `ctx.resolveBranchId("MATRIZ")`, cacheado); tests unitarios actualizados (`seedBranch.test.ts`, `context.test.ts`, `orphanProducts.test.ts`, `inventoryTiendasSeedLogic.test.ts`) — fixtures de precio de Matriz ahora usan `branchId: "matriz-id"` real en vez de `null`.
- [x] 4.5 `npx jest tests/unit/modules/seeds` — 79/79 tests pasan.
- [x] 4.6 `npm run seed:inventory-tiendas` corrido contra BD dev/test (`qzzjpyepggwautckqeex`, confirmado por `DATABASE_URL`/`DIRECT_URL` de `.env.local` antes de correr). Terminó limpio: 1817 filas de inventario upserted, 0 errores, **sin** el error "Argument branchId must not be null". Reporte final: Matriz refrescada 509 productos, Tlaxiaco 367 matcheados, overrides por sucursal (CHICHICAPAM 55, HUAJUAPAN 46, PRADERA 55, ZARIOZ 56, TLAXIACO 343), 5 productos huérfanos preexistentes (no relacionados a este fix — productos activos sin ninguna fila de inventario, ej. de test/QA).

## 5. Specs y verificación final

- [x] 5.1 Especificar los deltas de `products-api` y `pos-api` eliminando el modelo documentado de precio base global/herencia (ya incluido en `specs/` de este change).
- [x] 5.2 `opsx:verify` corrido — sin issues CRITICAL; 1 WARNING detectado (IDs del backfill sólo en historial de chat, no en archivo) y corregido en la tarea 2.2 de este mismo archivo. `npm test` completo: 4278/4278 (1 SIGSEGV de worker en `UserMapper.test.ts`, confirmado flake no relacionado — pasa aislado).
- [x] 5.3 Reportado al usuario: 43/47 pares backfillados en la pasada inicial, 4 pendientes resueltos posteriormente por decisión manual del negocio (ver tarea 2.4) — **47/47 pares cerrados en prod**, guardrail de CI y fix del seeder verificados contra BD real.
