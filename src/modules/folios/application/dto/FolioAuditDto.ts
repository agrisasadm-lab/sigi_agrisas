export interface AuditSequenceRaw {
  num: number;
  doc_type: "sale" | "quote" | "payment" | "purchase";
  doc_id: string;
  status: string;
  issued_at: Date;
}

export interface AuditSequenceItemDto {
  number: number;
  documentType: "sale" | "quote" | "payment" | "purchase";
  documentId: string;
  status: string;
  issuedAt: string;
}

export interface FolioAuditResultDto {
  folioId: string;
  code: string;
  prefix: string | null;
  currentNumber: number;
  totalIssued: number;
  withoutFolioNumber: number;
  gaps: number[];
  truncated: boolean;
  sequence: AuditSequenceItemDto[];
  /** Presente cuando la auditoría se filtró a una sucursal (folio branch-scoped + `?branchId=`). */
  branchId: string | null;
  branchCode: string | null;
}
