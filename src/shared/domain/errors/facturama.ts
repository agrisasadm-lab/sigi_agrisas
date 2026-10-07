/**
 * Errores de dominio compartidos entre `billing` y `waybills` — ambos módulos
 * timbran/cancelan CFDI contra Facturama y necesitan la misma forma de error.
 */
export class FacturamaStampError extends Error {
  readonly detail: string;
  constructor(detail: string) {
    super(`Facturama stamp error: ${detail}`);
    this.name = "FacturamaStampError";
    this.detail = detail;
  }
}

export class FacturamaCancelError extends Error {
  readonly detail: string;
  constructor(detail: string) {
    super(`Facturama cancel error: ${detail}`);
    this.name = "FacturamaCancelError";
    this.detail = detail;
  }
}

export { BranchScopeViolationError } from "@/shared/domain/errors/BranchScopeViolationError";
