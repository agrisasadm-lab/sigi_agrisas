"use client";

import { useState } from "react";
import Link from "next/link";
import { useCurrentUser } from "../../../_hooks/useCurrentUser";
import { useQuoteDetail } from "../_logic/hooks/useQuoteDetail";
import { useQuoteMutations } from "../_logic/hooks/useQuoteMutations";
import { useQuoteExport } from "../_logic/hooks/useQuoteExport";
import { QuoteStatusBadge } from "./QuoteStatusBadge";
import { QuoteItemsTable } from "./QuoteItemsTable";
import { QuoteActionsBar } from "./QuoteActionsBar";
import { AuthorizeQuoteModal } from "./AuthorizeQuoteModal";
import { CancelQuoteModal } from "./CancelQuoteModal";
import { ConvertQuoteModal } from "./ConvertQuoteModal";
import { EmptyState } from "../../../_components/molecules/EmptyState/EmptyState";
import { TaxBreakdownRows } from "../../../_components/molecules/TaxBreakdownRows/TaxBreakdownRows";
import { Spinner } from "../../../_components/atoms/Spinner/Spinner";
import { Icon } from "../../../_components/atoms/Icon/Icon";
import { formatMxCurrency } from "../../../_lib/formatMxCurrency";
import { fmtDateTimeLong } from "../../../_lib/formatDate";

function fmt(n: number) { return formatMxCurrency(n); }
function fmtDate(d: Date | null | undefined) {
  if (!d) return "—";
  return fmtDateTimeLong(d);
}

type Modal = "authorize" | "cancel" | "convert" | null;

interface QuoteDetailPageProps {
  id: string;
}

export function QuoteDetailPage({ id }: QuoteDetailPageProps) {
  const { can } = useCurrentUser();
  const { quote, isLoading, error, refresh } = useQuoteDetail(id);
  const { isSaving, authorize, cancel, convert } = useQuoteMutations();
  const { isExporting, downloadPdf } = useQuoteExport();
  const [modal, setModal] = useState<Modal>(null);
  const [toast, setToast] = useState<string | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  }

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error || !quote) {
    return (
      <EmptyState
        icon="warning"
        title="No se encontró la cotización"
        description={error?.message ?? "La cotización no existe o no tienes acceso."}
        action={
          <Link href="/quotes" className="text-primary hover:underline text-body-sm">
            Volver a cotizaciones
          </Link>
        }
      />
    );
  }

  const folioLabel = quote.folioPrefix
    ? `${quote.folioPrefix}-${quote.folioNumber}`
    : String(quote.folioNumber);

  return (
    <div className="flex flex-col gap-lg px-gutter py-lg mx-auto w-full max-w-4xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Link href="/quotes" className="text-on-surface-variant hover:text-on-surface">
              <Icon name="arrow_back" size={20} />
            </Link>
            <h1 className="text-headline-sm font-semibold text-on-surface">
              Cotización {folioLabel}
            </h1>
            <QuoteStatusBadge
              status={quote.status as "draft" | "authorized" | "converted" | "cancelled"}
              isExpired={quote.isExpired}
            />
          </div>
          <p className="text-body-sm text-on-surface-variant pl-9">
            Creada {fmtDate(quote.createdAt)}
          </p>
        </div>

        <div className="text-right">
          <div className="text-display-sm font-bold text-on-surface tabular-nums">
            {fmt(quote.total)}
          </div>
          <div className="text-body-sm text-on-surface-variant">Total cotización</div>
        </div>
      </div>

      {/* Expired banner */}
      {quote.isExpired && (
        <div className="flex items-center gap-2 bg-error-container text-on-error-container rounded-md px-4 py-3">
          <Icon name="warning" size={20} />
          <span className="text-body-sm font-medium">
            Esta cotización venció el {fmtDate(quote.expiresAt)}.
            Las acciones Autorizar y Convertir están deshabilitadas.
          </span>
        </div>
      )}

      {/* Cancelled banner */}
      {quote.status === "cancelled" && quote.cancellationReason && (
        <div className="bg-surface-container-high rounded-md px-4 py-3">
          <p className="text-label-sm text-on-surface-variant">Motivo de cancelación</p>
          <p className="text-body-sm text-on-surface mt-1">{quote.cancellationReason}</p>
        </div>
      )}

      {/* Converted banner */}
      {quote.status === "converted" && quote.convertedSaleId && (
        <div className="flex items-center gap-2 bg-primary-container text-on-primary-container rounded-md px-4 py-3">
          <Icon name="task_alt" size={20} />
          <span className="text-body-sm font-medium">
            Convertida a venta.{" "}
            <Link href={`/sales/${quote.convertedSaleId}`} className="underline">
              Ver venta generada
            </Link>
          </span>
        </div>
      )}

      {/* Action bar */}
      <QuoteActionsBar
        quote={quote}
        can={can}
        isSaving={isSaving}
        isExporting={isExporting}
        onAuthorize={() => setModal("authorize")}
        onCancel={() => setModal("cancel")}
        onConvert={() => setModal("convert")}
        onDownloadPdf={() => downloadPdf(quote)}
      />

      {/* Metadata grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 bg-surface-container-low rounded-lg p-4">
        <div>
          <p className="text-label-sm text-on-surface-variant">Cliente</p>
          <p className="text-body-md text-on-surface">{quote.customerName ?? "—"}</p>
        </div>
        <div>
          <p className="text-label-sm text-on-surface-variant">Sucursal</p>
          <p className="text-body-md text-on-surface">{quote.branchName ?? "—"}</p>
        </div>
        <div>
          <p className="text-label-sm text-on-surface-variant">Vendedor</p>
          <p className="text-body-md text-on-surface">{quote.creatorName ?? "—"}</p>
        </div>
        <div>
          <p className="text-label-sm text-on-surface-variant">Vencimiento</p>
          <p className="text-body-md text-on-surface">{fmtDate(quote.expiresAt)}</p>
        </div>
        {quote.authorizedAt && (
          <div>
            <p className="text-label-sm text-on-surface-variant">Autorizada por</p>
            <p className="text-body-md text-on-surface">{quote.authorizedByName ?? "—"}</p>
          </div>
        )}
        {quote.notes && (
          <div className="col-span-2 md:col-span-3">
            <p className="text-label-sm text-on-surface-variant">Notas</p>
            <p className="text-body-md text-on-surface">{quote.notes}</p>
          </div>
        )}
      </div>

      {/* Items */}
      <div className="bg-surface-container-low rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-outline-variant">
          <h2 className="text-title-md font-semibold text-on-surface">Artículos</h2>
        </div>
        <QuoteItemsTable items={quote.items} />
      </div>

      {/* Totals */}
      <div className="flex justify-end">
        <div className="space-y-1 text-right min-w-[240px]">
          <div className="flex justify-between gap-8">
            <span className="text-body-sm text-on-surface-variant">Subtotal</span>
            <span className="tabular-nums">{fmt(quote.subtotal)}</span>
          </div>
          <TaxBreakdownRows
            ivaTotal={quote.items.reduce((s, i) => s + i.lineIva, 0)}
            iepsTotal={quote.items.reduce((s, i) => s + i.lineIeps, 0)}
            format={fmt}
            variant="quote"
          />
          <div className="flex justify-between gap-8 border-t border-outline-variant pt-1 mt-1">
            <span className="text-body-md font-semibold text-on-surface">Total</span>
            <span className="tabular-nums font-bold text-title-md">{fmt(quote.total)}</span>
          </div>
        </div>
      </div>

      {/* Modals */}
      {modal === "authorize" && (
        <AuthorizeQuoteModal
          quote={quote}
          onClose={() => setModal(null)}
          onSuccess={() => { setModal(null); refresh(); }}
          onError={showToast}
          authorize={authorize}
          isSaving={isSaving}
        />
      )}
      {modal === "cancel" && (
        <CancelQuoteModal
          quote={quote}
          onClose={() => setModal(null)}
          onSuccess={() => { setModal(null); refresh(); }}
          onError={showToast}
          cancel={cancel}
          isSaving={isSaving}
        />
      )}
      {modal === "convert" && (
        <ConvertQuoteModal
          quote={quote}
          onClose={() => setModal(null)}
          onError={showToast}
          convert={convert}
          isSaving={isSaving}
        />
      )}

      {toast && (
        <div className="fixed bottom-4 right-4 z-50 bg-error-container text-on-error-container rounded-md px-4 py-3 text-body-sm shadow-lg max-w-sm">
          {toast}
        </div>
      )}
    </div>
  );
}
