import { Prisma } from "@prisma/client";
import { InactiveResourceError } from "@/modules/pos/domain/errors/InactiveResourceError";
import { formatBranchFolioCode } from "@/shared/domain/folios/formatBranchFolioCode";

type TxClient = Prisma.TransactionClient;

/**
 * Atomically increments the (folioId, branchId) counter in `folio_branch_counters`
 * — creating the row on first use, starting at 1 — and returns the new number
 * plus the branch-scoped formatted folio code. A single INSERT ... ON CONFLICT
 * DO UPDATE ... RETURNING is the serialization point: two concurrent requests
 * for the same branch never read the same current_number before incrementing.
 *
 * Throws InactiveResourceError when the folio is missing/inactive or the branch
 * does not exist — same error as `allocateFolio` for an inactive folio, since in
 * practice both conditions should already be impossible by the time this runs
 * (the operation's branchId was already validated by branch scoping upstream).
 *
 * Does NOT touch `folios.current_number` — that stays the counter for
 * non-branch-scoped folios (RB/AB/DEV/PP/TS), allocated via `allocateFolio`.
 */
export async function allocateBranchFolio(
  tx: TxClient,
  folioId: string,
  branchId: string
): Promise<{ folioNumber: number; folioCode: string }> {
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
