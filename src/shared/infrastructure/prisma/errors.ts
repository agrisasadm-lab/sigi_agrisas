/**
 * Detección de errores de Prisma por código, compartida entre repositorios.
 * `target`, si se pasa, exige que el nombre de columna/índice del constraint
 * único incluya ese substring — soporta el caso de múltiples constraints
 * únicos distintos en la misma tabla (ej. `code` vs `rfc`).
 *
 * Reconoce dos formas de violación de unicidad:
 * - `P2002` (ORM, ej. `tx.model.create(...)`): el constraint va en `meta.target`.
 * - `P2010` + `meta.code === "23505"` (INSERT crudo vía `$executeRaw`/`$queryRaw`):
 *   Prisma envuelve el error de Postgres como "Raw query failed"; el nombre del
 *   índice/constraint va en `meta.message`, no en `meta.target`.
 */
export function isPrismaUniqueError(err: unknown, target?: string): boolean {
  if (typeof err !== "object" || err === null) return false;
  const e = err as {
    code?: string;
    meta?: { target?: string[] | string; code?: string; message?: string };
  };

  if (e.code === "P2002") {
    if (!target) return true;
    const t = e.meta?.target;
    if (Array.isArray(t)) return t.some((f) => f.includes(target));
    if (typeof t === "string") return t.includes(target);
    return false;
  }

  if (e.code === "P2010" && e.meta?.code === "23505") {
    if (!target) return true;
    return typeof e.meta?.message === "string" && e.meta.message.includes(target);
  }

  return false;
}

export function isPrismaNotFoundError(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "P2025";
}
