import { z } from "zod";

export const uuidSchema = z.string().uuid("Invalid ID format");

export const entityCodeSchema = z
  .string()
  .regex(/^[A-Z0-9_]{1,32}$/, "code must be uppercase letters, digits, or underscores (1–32 chars)");

const RFC_REGEX = /^([A-ZÑ&]{3,4})\d{6}([A-Z\d]{3})$/;
const TAX_REGIME_REGEX = /^\d{3}$/;

/**
 * RFC opcional. Preserva la distinción `undefined` (campo ausente/no tocado) vs `null`
 * (limpiar explícitamente) — necesaria para que el PATCH detecte "al menos un campo
 * actualizable" con `"rfc" in data`. `""` se normaliza a `null`; un valor no vacío se
 * valida igual que rfcSchema.
 */
export const optionalRfcSchema = z
  .string()
  .nullable()
  .optional()
  .transform((v) => {
    if (v === undefined) return undefined;
    if (v === null) return null;
    const trimmed = v.trim().toUpperCase();
    return trimmed === "" ? null : trimmed;
  })
  .pipe(
    z.union([z.undefined(), z.null(), z.string().regex(RFC_REGEX, "rfc must be a valid Mexican RFC")])
  );

export const taxRegimeSchema = z.string().regex(TAX_REGIME_REGEX, "taxRegime must be 3 digits");
