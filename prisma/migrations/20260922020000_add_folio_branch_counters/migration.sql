-- add-folio-branch-scope
-- Contador independiente por (folio, sucursal) para folios branch-scoped
-- (TK/TC/COT/CP). `folios.current_number` no se toca — sigue siendo el
-- contador de RB/AB/DEV/PP/TS. Sin backfill: cada sucursal arranca en 0.

-- 1. Tabla de contadores por sucursal
CREATE TABLE "folio_branch_counters" (
  "folio_id" TEXT NOT NULL,
  "branch_id" TEXT NOT NULL,
  "current_number" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "folio_branch_counters_pkey" PRIMARY KEY ("folio_id","branch_id")
);

CREATE INDEX "folio_branch_counters_branch_id_idx" ON "folio_branch_counters"("branch_id");

ALTER TABLE "folio_branch_counters" ADD CONSTRAINT "folio_branch_counters_folio_id_fkey"
  FOREIGN KEY ("folio_id") REFERENCES "folios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "folio_branch_counters" ADD CONSTRAINT "folio_branch_counters_branch_id_fkey"
  FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 2. Guard defensivo: aborta si ya hay folio_code duplicado (no debería, pero
--    evita romper el UNIQUE nuevo a ciegas).
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "sales" GROUP BY "folio_code" HAVING COUNT(*) > 1)
  OR EXISTS (SELECT 1 FROM "quotes" GROUP BY "folio_code" HAVING COUNT(*) > 1)
  OR EXISTS (SELECT 1 FROM "purchases" GROUP BY "folio_code" HAVING COUNT(*) > 1)
  THEN RAISE EXCEPTION 'add_folio_branch_counters: folio_code duplicado detectado; resolver antes de migrar';
  END IF;
END $$;

-- 3. Ampliar folio_code a VarChar(64) — el formato nuevo <prefix><BRANCH_CODE>-<NNNNNN>
--    es más largo que el legacy <prefix><NNNNNN>.
ALTER TABLE "sales" ALTER COLUMN "folio_code" TYPE VARCHAR(64);
ALTER TABLE "quotes" ALTER COLUMN "folio_code" TYPE VARCHAR(64);
ALTER TABLE "purchases" ALTER COLUMN "folio_code" TYPE VARCHAR(64);
ALTER TABLE "inventory_movements" ALTER COLUMN "folio_code" TYPE VARCHAR(64);

-- 4. Reemplazar el unique (folio_id, folio_number) por uno sobre folio_code:
--    folio_number deja de ser único por folio (dos sucursales pueden compartir
--    número), folio_code sí lo es siempre (incorpora la sucursal).
ALTER TABLE "sales" ADD CONSTRAINT "sales_folio_code_key" UNIQUE ("folio_code");
CREATE INDEX "sales_folio_id_idx" ON "sales"("folio_id");
DROP INDEX "sales_folio_id_folio_number_key";

ALTER TABLE "quotes" ADD CONSTRAINT "quotes_folio_code_key" UNIQUE ("folio_code");
CREATE INDEX "quotes_folio_id_idx" ON "quotes"("folio_id");
DROP INDEX "quotes_folio_id_folio_number_key";

ALTER TABLE "purchases" ADD CONSTRAINT "purchases_folio_code_key" UNIQUE ("folio_code");
CREATE INDEX "purchases_folio_id_idx" ON "purchases"("folio_id");
DROP INDEX "purchases_folio_id_folio_number_key";
