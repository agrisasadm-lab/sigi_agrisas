export type FolioScope = "POS" | "INVENTORY" | "OPERATIONS";

export interface Folio {
  id: string;
  code: string;
  name: string;
  prefix: string | null;
  scope: FolioScope;
  currentNumber: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  /** Consecutivo de la sucursal consultada (`?branchId=`). `null` sin ella o si el folio no es branch-scoped. */
  branchCurrentNumber: number | null;
  /** Siguiente `folioCode` que emitiría esa sucursal. `null` en los mismos casos. */
  nextFolioCode: string | null;
}

export interface AuditSequenceItem {
  number: number;
  documentType: "sale" | "quote" | "payment" | "purchase";
  documentId: string;
  status: string;
  issuedAt: string;
}

export interface FolioAuditResult {
  folioId: string;
  code: string;
  prefix: string | null;
  currentNumber: number;
  totalIssued: number;
  withoutFolioNumber: number;
  gaps: number[];
  truncated: boolean;
  sequence: AuditSequenceItem[];
  branchId: string | null;
  branchCode: string | null;
}
