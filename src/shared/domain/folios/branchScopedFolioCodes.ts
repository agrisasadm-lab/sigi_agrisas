/**
 * Códigos de folio con contador independiente por sucursal (ver
 * `FolioBranchCounter` / `allocateBranchFolio`). El resto (RB, AB, DEV, PP,
 * TS) sigue con el contador global de `Folio.currentNumber`.
 */
export const BRANCH_SCOPED_FOLIO_CODES = ["TK", "TC", "COT", "CP"] as const;

export type BranchScopedFolioCode = (typeof BRANCH_SCOPED_FOLIO_CODES)[number];

export function isBranchScopedFolioCode(code: string): code is BranchScopedFolioCode {
  return (BRANCH_SCOPED_FOLIO_CODES as readonly string[]).includes(code);
}
