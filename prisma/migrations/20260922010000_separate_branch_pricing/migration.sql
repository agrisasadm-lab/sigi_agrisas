-- separate-branch-pricing
-- Elimina el bucket de precio global: `product_prices.branch_id` pasa a NOT NULL
-- y cada sucursal (Matriz incluida) tiene su propio juego de precios, sin herencia.
--
-- Orden obligatorio (ver design.md — Decisión 2):
--   1. Abortar si no hay sucursal matriz (sin destino para el paso 3).
--   2. Materializar: copiar cada tier base a toda sucursal donde el producto esté
--      asignado (`branch_inventory`) y que aún no tenga un precio con ese `name`.
--      Debe correr ANTES del paso 3: después ya no habría filas `branch_id IS NULL`.
--   3. Reasignar los base remanentes a la matriz (moviendo la fila, no copiándola:
--      conserva el `id` y con él las referencias desde sale_items/quote_items/
--      return_items, que son ON DELETE SET NULL). Por eso la matriz se excluye
--      del paso de materialización.
--   4. SET NOT NULL + limpieza de los índices parciales del bucket global.

-- 1. Guard: si hay precios base que reasignar, hace falta una matriz de destino.
--    Un deployment limpio (sin precios base) no necesita matriz y pasa de largo.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "product_prices" WHERE "branch_id" IS NULL)
     AND NOT EXISTS (SELECT 1 FROM "branches" WHERE "is_headquarters" = TRUE) THEN
    RAISE EXCEPTION 'separate_branch_pricing: hay precios base (branch_id IS NULL) pero no existe sucursal matriz (branches.is_headquarters = TRUE); marca una antes de migrar';
  END IF;
END $$;

-- 2. Guard: una fila base no puede moverse a la matriz si la matriz ya tiene un
--    precio propio con ese mismo nombre. No se resuelve automáticamente (implicaría
--    borrar o renombrar datos cargados a mano); se aborta para que lo decida quien opera.
DO $$
DECLARE
  hq TEXT := (SELECT "id" FROM "branches" WHERE "is_headquarters" = TRUE LIMIT 1);
  colisiones INT;
BEGIN
  IF hq IS NULL THEN RETURN; END IF;
  SELECT count(*) INTO colisiones
  FROM "product_prices" base
  WHERE base."branch_id" IS NULL
    AND EXISTS (
      SELECT 1 FROM "product_prices" m
      WHERE m."branch_id" = hq AND m."product_id" = base."product_id" AND m."name" = base."name"
    );
  IF colisiones > 0 THEN
    RAISE EXCEPTION 'separate_branch_pricing: % precio(s) base chocan con un precio ya existente de la matriz con el mismo nombre; resuélvelos manualmente antes de migrar', colisiones;
  END IF;
END $$;

-- 3. Materializar una copia por sucursal donde el producto está asignado.
--    La matriz se excluye a propósito: sus precios llegan en el paso 4 moviendo la
--    fila base original, que conserva su `id` y con él las referencias desde
--    sale_items/quote_items/return_items.
INSERT INTO "product_prices" (
  "id", "product_id", "branch_id", "name", "price",
  "min_quantity", "discount_pct", "is_default", "created_at", "updated_at"
)
SELECT
  gen_random_uuid()::text, bi."product_id", bi."branch_id", pp."name", pp."price",
  pp."min_quantity", pp."discount_pct", pp."is_default", NOW(), NOW()
FROM "branch_inventory" bi
JOIN "product_prices" pp
  ON pp."product_id" = bi."product_id" AND pp."branch_id" IS NULL
WHERE bi."branch_id" IS DISTINCT FROM (SELECT "id" FROM "branches" WHERE "is_headquarters" = TRUE LIMIT 1)
  AND NOT EXISTS (
    SELECT 1 FROM "product_prices" o
    WHERE o."product_id" = bi."product_id"
      AND o."branch_id" = bi."branch_id"
      AND o."name" = pp."name"
  );

-- 4. Los base remanentes pasan a ser precios de la matriz.
UPDATE "product_prices"
SET "branch_id" = (SELECT "id" FROM "branches" WHERE "is_headquarters" = TRUE LIMIT 1),
    "updated_at" = NOW()
WHERE "branch_id" IS NULL;

-- 5a. Fuera los índices del bucket global (su predicado ya no puede cumplirse).
DROP INDEX IF EXISTS "product_price_global_name_idx";
DROP INDEX IF EXISTS "product_default_price_global_idx";

-- 5b. El parcial de nombre por sucursal es redundante con el unique plano una vez
--     que branch_id no admite NULL.
DROP INDEX IF EXISTS "product_price_branch_name_idx";

-- 5c. La columna pasa a obligatoria.
ALTER TABLE "product_prices" ALTER COLUMN "branch_id" SET NOT NULL;

-- 5d. El guard de default deja de necesitar el predicado sobre NULL.
DROP INDEX IF EXISTS "product_default_price_branch_idx";
CREATE UNIQUE INDEX "product_default_price_idx"
  ON "product_prices"("product_id", "branch_id") WHERE "is_default";
