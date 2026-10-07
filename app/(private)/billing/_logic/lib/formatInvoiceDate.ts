import { fmtDateTimeLong } from "../../../../_lib/formatDate";
export function formatInvoiceDate(d: Date | null): string {
  return d ? fmtDateTimeLong(d) : "—";
}
