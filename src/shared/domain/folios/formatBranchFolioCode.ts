/**
 * Formatea el `folioCode` de un documento branch-scoped: `<prefix><BRANCH_CODE>-<NNNNNN>`
 * (con prefix) o `<code>-<BRANCH_CODE>-<NNNNNN>` (sin prefix). Distinto del formato legacy
 * (`allocateFolio.ts`), que no incluye la sucursal.
 */
export function formatBranchFolioCode(
  prefix: string | null,
  code: string,
  branchCode: string,
  n: number
): string {
  const padded = String(n).padStart(6, "0");
  return prefix ? `${prefix}${branchCode}-${padded}` : `${code}-${branchCode}-${padded}`;
}

/**
 * Patrón `LIKE` para localizar los `folioCode` branch-scoped de una sucursal
 * (auditoría). Escapa `\`, `%` y `_` en `branchCode` — los códigos de sucursal
 * pueden llevar guion bajo, que de otro modo Postgres interpretaría como
 * comodín de un solo carácter. Úsese siempre junto a `ESCAPE '\\'` en el SQL.
 */
export function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

export function branchFolioCodeLikePattern(prefix: string | null, code: string, branchCode: string): string {
  const escaped = escapeLikePattern(branchCode);
  return prefix ? `${prefix}${escaped}-%` : `${code}-${escaped}-%`;
}
