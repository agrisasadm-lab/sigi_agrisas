"use client";

import Link from "next/link";
import { useCurrentUser } from "../../../_hooks/useCurrentUser";
import { useSaleInvoices } from "../_logic/hooks/useSaleInvoices";
import { InvoiceStatusBadge } from "./InvoiceStatusBadge";
import { useInvoiceMutations } from "../_logic/hooks/useInvoiceMutations";
import { Spinner } from "../../../_components/atoms/Spinner/Spinner";
import { DownloadPdfButton } from "../../../_components/molecules/PdfDownloadButton/PdfDownloadButton";
import { formatMxCurrency } from "../../../_lib/formatMxCurrency";

interface SaleInvoicesSectionProps {
  saleId: string;
  saleStatus: string;
  saleFolioLabel?: string;
}

export function SaleInvoicesSection({ saleId, saleStatus, saleFolioLabel }: SaleInvoicesSectionProps) {
  const { can } = useCurrentUser();
  const canRead = can("billing:read");
  const canWrite = can("billing:write");

  const { invoices, hasStampedInvoice, isLoading, refresh } = useSaleInvoices(canRead !== false ? saleId : "");

  const { isDownloading, download } = useInvoiceMutations(() => refresh());

  if (canRead === false) return null;

  return (
    <div className="bg-surface-container-low rounded-lg border border-outline-variant overflow-hidden">
      <div className="px-4 py-3 border-b border-outline-variant flex items-center justify-between gap-2">
        <h2 className="text-title-sm font-semibold text-on-surface">Facturas CFDI</h2>
        {saleStatus === "completed" && !hasStampedInvoice && canWrite === true && (
          <Link
            href={`/billing/new?saleId=${saleId}${saleFolioLabel ? `&saleLabel=${encodeURIComponent(saleFolioLabel)}` : ""}`}
            className="rounded-full bg-primary text-on-primary px-4 py-1.5 text-label-sm font-medium hover:bg-primary/90 transition-colors"
          >
            Facturar
          </Link>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-6"><Spinner size="sm" /></div>
      ) : invoices.length === 0 ? (
        <div className="px-4 py-4 text-body-sm text-on-surface-variant">Sin facturas emitidas para esta venta.</div>
      ) : (
        <div className="divide-y divide-outline-variant/40">
          {invoices.map((inv) => (
            <div key={inv.id} className="px-4 py-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <InvoiceStatusBadge status={inv.status} />
                <Link
                  href={`/billing/${inv.id}`}
                  className="font-mono text-label-sm text-primary hover:underline truncate max-w-[180px]"
                  title={inv.uuid ?? inv.id}
                >
                  {inv.uuid ? inv.uuid.slice(0, 18) + "…" : inv.id.slice(-8).toUpperCase()}
                </Link>
                <span className="text-label-sm text-on-surface-variant tabular-nums">{formatMxCurrency(inv.total)}</span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <DownloadPdfButton onClick={() => download(inv.id, "pdf")} loading={isDownloading} size="sm" />
                <button
                  type="button"
                  onClick={() => download(inv.id, "xml")}
                  disabled={isDownloading}
                  className="text-label-sm text-on-surface-variant hover:text-on-surface transition-colors disabled:opacity-50"
                >
                  XML
                </button>
                <Link href={`/billing/${inv.id}`} className="text-label-sm text-primary hover:text-primary/80 transition-colors">
                  Ver
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
