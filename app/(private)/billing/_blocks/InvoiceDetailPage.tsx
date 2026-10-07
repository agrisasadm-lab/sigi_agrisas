"use client";

import { useState } from "react";
import Link from "next/link";
import { useCurrentUser } from "../../../_hooks/useCurrentUser";
import { useInvoiceDetail } from "../_logic/hooks/useInvoiceDetail";
import { useInvoiceMutations } from "../_logic/hooks/useInvoiceMutations";
import { InvoiceStatusBadge } from "./InvoiceStatusBadge";
import { InvoiceItemsTable } from "./InvoiceItemsTable";
import { InvoiceMetaPanel } from "./InvoiceMetaPanel";
import { InvoiceActionsBar } from "./InvoiceActionsBar";
import { CancelInvoiceModal } from "./CancelInvoiceModal";
import { SendInvoiceEmailModal } from "./SendInvoiceEmailModal";
import { EmptyState } from "../../../_components/molecules/EmptyState/EmptyState";
import { Spinner } from "../../../_components/atoms/Spinner/Spinner";
import { Icon } from "../../../_components/atoms/Icon/Icon";
import { InvoiceNotFoundError, BillingForbiddenError } from "../_logic/errors";
import { formatInvoiceDate } from "../_logic/lib/formatInvoiceDate";
import { formatMxCurrency } from "../../../_lib/formatMxCurrency";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function fmt(n: number) { return formatMxCurrency(n); }

interface InvoiceDetailPageProps { id: string; }

export function InvoiceDetailPage({ id }: InvoiceDetailPageProps) {
  const { can } = useCurrentUser();
  const canCancel = can("billing:cancel");

  const isValidId = UUID_RE.test(id);
  const { invoice, isLoading, error, refresh } = useInvoiceDetail(isValidId ? id : "__skip__");

  const { isSaving, isDownloading, mutationError, clearError, cancel, download } = useInvoiceMutations((updated) => {
    void updated;
    refresh();
  });

  const [showCancel, setShowCancel] = useState(false);
  const [showSendEmail, setShowSendEmail] = useState(false);

  if (!isValidId) {
    return (
      <EmptyState
        icon="warning"
        title="ID inválido"
        description="El identificador de la factura no es válido."
        action={<Link href="/billing" className="text-primary hover:underline text-body-sm">Volver a facturas</Link>}
      />
    );
  }

  if (isLoading) {
    return <div className="flex h-64 items-center justify-center"><Spinner size="lg" /></div>;
  }

  if (error) {
    if (error instanceof InvoiceNotFoundError) {
      return (
        <EmptyState
          icon="receipt_long"
          title="Factura no encontrada"
          description="Esta factura no existe o fue eliminada."
          action={<Link href="/billing" className="text-primary hover:underline text-body-sm">Volver a facturas</Link>}
        />
      );
    }
    if (error instanceof BillingForbiddenError) {
      return (
        <EmptyState
          icon="block"
          title="Sin acceso"
          description="No tienes permiso para ver esta factura."
          action={<Link href="/billing" className="text-primary hover:underline text-body-sm">Volver a facturas</Link>}
        />
      );
    }
    return <EmptyState icon="warning" title="Error al cargar la factura" description={error.message} />;
  }

  if (!invoice) return null;

  return (
    <div className="flex flex-col gap-lg px-gutter py-lg mx-auto w-full max-w-4xl">
      {/* Header */}
      <div className="grid grid-cols-[1fr_auto] items-start gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3 mb-1">
            <Link href="/billing" className="text-on-surface-variant hover:text-on-surface">
              <Icon name="arrow_back" size={20} />
            </Link>
            <h1 className="text-headline-sm font-semibold text-on-surface font-mono truncate max-w-xs" title={invoice.uuid ?? undefined}>
              {invoice.uuid ? invoice.uuid.slice(0, 18) + "…" : `Factura #${invoice.id.slice(-8).toUpperCase()}`}
            </h1>
            <InvoiceStatusBadge status={invoice.status} />
          </div>
          {invoice.issuerEmail && (
            <p className="pl-9 text-body-sm text-on-surface-variant">{invoice.issuerEmail}</p>
          )}
          <div className="pl-9 mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1 text-body-sm text-on-surface-variant">
            <div>
              <p>Emitida: {formatInvoiceDate(invoice.createdAt)}</p>
              {invoice.saleId && (
                <Link href={`/sales/${invoice.saleId}`} className="text-primary hover:underline">
                  Ver venta origen
                </Link>
              )}
            </div>
            <div className="min-w-0">
              <p>Folio: <span className="font-mono">{`Factura #${invoice.id.slice(-8).toUpperCase()}`}</span></p>
              <p className="break-all">UUID: <span className="font-mono">{invoice.uuid ?? "—"}</span></p>
            </div>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-label-sm text-on-surface-variant">Total facturado</p>
          <p className="text-display-sm font-bold tabular-nums text-on-surface">{fmt(invoice.total)}</p>
        </div>
      </div>

      {/* Mutation error banner */}
      {mutationError && (
        <div className="rounded-md bg-error-container/30 border border-error/30 px-4 py-3 flex items-start justify-between gap-2">
          <p className="text-body-sm text-error">{mutationError.message}</p>
          <button type="button" onClick={clearError} className="text-error text-label-sm hover:underline flex-shrink-0">Cerrar</button>
        </div>
      )}

      {/* Items */}
      {invoice.items && invoice.items.length > 0 && (
        <div className="bg-surface-container-low rounded-lg border border-outline-variant overflow-hidden">
          <div className="px-4 py-3 border-b border-outline-variant">
            <h2 className="text-title-sm font-semibold text-on-surface">Conceptos</h2>
          </div>
          <InvoiceItemsTable
            items={invoice.items}
            subtotal={invoice.subtotal}
            taxTotal={invoice.taxTotal}
            total={invoice.total}
          />
        </div>
      )}

      {/* Meta */}
      <InvoiceMetaPanel invoice={invoice} />

      {/* Actions */}
      <InvoiceActionsBar
        invoice={invoice}
        canCancel={canCancel}
        isDownloading={isDownloading}
        isSaving={isSaving}
        onDownload={(format) => download(invoice.id, format)}
        onSendEmailClick={() => setShowSendEmail(true)}
        onCancelClick={() => setShowCancel(true)}
      />

      {showCancel && (
        <CancelInvoiceModal
          invoiceId={invoice.id}
          open={showCancel}
          onClose={() => setShowCancel(false)}
          onSuccess={() => { setShowCancel(false); refresh(); }}
        />
      )}

      {showSendEmail && (
        <SendInvoiceEmailModal
          invoiceId={invoice.id}
          open={showSendEmail}
          onClose={() => setShowSendEmail(false)}
        />
      )}
    </div>
  );
}
