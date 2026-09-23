import { Prisma } from "@prisma/client";
import { InactiveResourceError } from "@/modules/pos/domain/errors/InactiveResourceError";
import { formatBranchFolioCode } from "@/shared/domain/folios/formatBranchFolioCode";
import { isBranchScopedFolioCode } from "@/shared/domain/folios/branchScopedFolioCodes";
import { allocateFolio } from "./allocateFolio";

type TxClient = Prisma.TransactionClient;

/**
 * Allocator used by Sale/Quote/Purchase repos for ANY folio, regardless of its
 * code — callers never know in advance whether the caller-selected folio is
 * one of TK/TC/COT/CP (per-branch counter) or a custom/legacy one (global
 * counter), since a folio's only enforced constraint at that layer is
 * `scope === 'POS'` (or the hardcoded "CP" for purchases). This function peeks
 * the folio's `code` first and dispatches to the correct mechanism so the
 * global counter is never silently bypassed for a non-branch-scoped folio.
 *
 * Branch-scoped path: atomically increments the (folioId, branchId) counter in
 * `folio_branch_counters` — creating the row on first use, starting at 1 — and
 * returns the new number plus the branch-scoped formatted folio code. A single
 * INSERT ... ON CONFLICT DO UPDATE ... RETURNING is the serialization point:
 * two concurrent requests for the same branch never read the same
 * current_number before incrementing.
 *
 * Non-branch-scoped path: delegates to `allocateFolio` (global `folios.current_number`
 * counter, legacy format) — same mechanism as RB/AB/DEV/PP/TS, so a custom folio
 * with `scope='POS'` outside {TK,TC,COT,CP} keeps behaving exactly as before
 * this capability, per `admin-folios` — "folios NOT in {TK,TC,COT,CP} are NOT affected".
 *
 * Throws InactiveResourceError when the folio is missing/inactive or (in the
 * branch-scoped path) the branch does not exist.
 */
export async function allocateBranchFolio(
  tx: TxClient,
  folioId: string,
  branchId: string
): Promise<{ folioNumber: number; folioCode: string }> {
  const codeRows = await tx.$queryRaw<{ code: string }[]>`
    SELECT code FROM folios WHERE id = ${folioId} AND is_active = true
  `;
  if (codeRows.length === 0) throw new InactiveResourceError("Folio");
  if (!isBranchScopedFolioCode(codeRows[0].code)) {
    return allocateFolio(tx, folioId);
  }

  type Row = { current_number: number; code: string; prefix: string | null; branch_code: string };
  const rows = await tx.$queryRaw<Row[]>`
    WITH f AS (SELECT id, code, prefix FROM folios WHERE id = ${folioId} AND is_active = true),
         b AS (SELECT id, code FROM branches WHERE id = ${branchId}),
         c AS (
           INSERT INTO folio_branch_counters (folio_id, branch_id, current_number, created_at, updated_at)
           SELECT f.id, b.id, 1, NOW(), NOW() FROM f, b
           ON CONFLICT (folio_id, branch_id)
           DO UPDATE SET current_number = folio_branch_counters.current_number + 1, updated_at = NOW()
           RETURNING current_number
         )
    SELECT c.current_number, f.code, f.prefix, b.code AS branch_code FROM c, f, b
  `;
  if (rows.length === 0) {
    throw new InactiveResourceError("Folio");
  }
  const r = rows[0];
  return {
    folioNumber: r.current_number,
    folioCode: formatBranchFolioCode(r.prefix, r.code, r.branch_code, r.current_number),
  };
}
