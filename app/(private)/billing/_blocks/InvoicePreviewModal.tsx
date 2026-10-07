"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "../../../_components/atoms/Button/Button";
import { DownloadPdfButton } from "../../../_components/molecules/PdfDownloadButton/PdfDownloadButton";
import { Spinner } from "../../../_components/atoms/Spinner/Spinner";
import { downloadInvoicePreviewPdf } from "../_logic/services/downloadInvoicePreviewPdf";
import { formatMxCurrency } from "../../../_lib/formatMxCurrency";
import {
  resolveFiscalRegimeDescription,
  resolveCfdiUseDescription,
  resolveSatProductCodeDescription,
} from "../_logic/services/resolveSatDescription";
import { describePaymentForm, describePaymentMethod } from "@/shared/domain/catalogs/satPaymentCatalogs";
import type { InvoicePreviewData } from "../_logic/types/preview";

function fmt(n: number) { return formatMxCurrency(n); }
function pct(n: number) { return `${(n * 100).toFixed(0)}%`; }

// Anchos proporcionales al contenido (Concepto lleva nombre+código+"SAT: ..." de hasta
// 3 líneas; "Total línea"/"Subtotal" son los labels más largos del resto). Definido una
// sola vez y reutilizado igual en el header y en cada fila para que nunca se desalineen
// entre sí por una discrepancia de clases (ver D12 en design.md).
const LINE_ITEMS_GRID_TEMPLATE = "grid-cols-[2.2fr_0.6fr_0.9fr_0.6fr_0.6fr_0.6fr_0.9fr_1fr]";

interface InvoicePreviewModalProps {
  open: boolean;
  onClose: () => void;
  data: InvoicePreviewData | null;
  isLoading?: boolean;
  loadError?: Error | null;
  onConfirmStamp: () => void;
  isSubmitting: boolean;
}

export function InvoicePreviewModal({
  open,
  onClose,
  data,
  isLoading = false,
  loadError = null,
  onConfirmStamp,
  isSubmitting,
}: InvoicePreviewModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<Error | null>(null);
  const [labels, setLabels] = useState<{
    issuerFiscalRegime: string;
    receiverFiscalRegime: string;
    receiverCfdiUse: string;
  } | null>(null);
  const [satCodeLabels, setSatCodeLabels] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!data) {
      setLabels(null);
      setSatCodeLabels({});
      return;
    }
    let cancelled = false;
    Promise.all([
      resolveFiscalRegimeDescription(data.issuer.fiscalRegime ?? ""),
      resolveFiscalRegimeDescription(data.receiver.fiscalRegime),
      resolveCfdiUseDescription(data.receiver.cfdiUse),
    ]).then(([issuerFiscalRegime, receiverFiscalRegime, receiverCfdiUse]) => {
      if (cancelled) return;
      setLabels({ issuerFiscalRegime, receiverFiscalRegime, receiverCfdiUse });
    });

    const uniqueSatCodes = [...new Set(data.lines.map((l) => l.satProductCode).filter((c): c is string => !!c))];
    if (uniqueSatCodes.length > 0) {
      Promise.all(uniqueSatCodes.map((code) => resolveSatProductCodeDescription(code))).then((resolvedLabels) => {
        if (cancelled) return;
        const mapping: Record<string, string> = {};
        uniqueSatCodes.forEach((code, idx) => {
          mapping[code] = resolvedLabels[idx];
        });
        setSatCodeLabels(mapping);
      });
    } else {
      setSatCodeLabels({});
    }

    return () => {
      cancelled = true;
    };
  }, [data]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) {
      dialog.showModal();
      setDownloadError(null);
    } else {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handleCancel = (e: Event) => { e.preventDefault(); onClose(); };
    dialog.addEventListener("cancel", handleCancel);
    return () => dialog.removeEventListener("cancel", handleCancel);
  }, [onClose]);

  const canConfirm = !isLoading && !loadError && !!data && !isSubmitting;
  const canDownload = !isLoading && !loadError && !!data && !isDownloading;

  async function handleDownloadPdf() {
    if (!data) return;
    setDownloadError(null);
    setIsDownloading(true);
    try {
      await downloadInvoicePreviewPdf(data);
    } catch (err) {
      setDownloadError(err as Error);
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="invoice-preview-modal-title"
      className="rounded-md bg-surface-container p-6 shadow-lg w-full max-w-5xl max-h-[85vh] overflow-y-auto backdrop:bg-black/40"
    >
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="Agrisas" className="h-10 w-auto" />
          <div>
            <h2 id="invoice-preview-modal-title" className="text-title-md font-semibold text-on-surface">
              Factura
            </h2>
            {data?.issuer.branchName && (
              <p className="text-label-sm text-on-surface-variant">{data.issuer.branchName}</p>
            )}
            {data?.issuer.email && (
              <p className="text-label-sm text-on-surface-variant">{data.issuer.email}</p>
            )}
          </div>
        </div>
        <div className="text-right space-y-1">
          <span className="inline-flex items-center rounded-full bg-secondary-container text-on-secondary-container px-3 py-1 text-label-sm font-medium">
            BORRADOR — no válido fiscalmente
          </span>
          <p className="text-label-sm text-on-surface-variant font-mono">Folio: PENDIENTE DE TIMBRAR</p>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Spinner size="lg" />
        </div>
      )}

      {loadError && !isLoading && (
        <div className="rounded bg-error-container/30 border border-error/30 px-4 py-3 text-body-sm text-error mb-4">
          {loadError.message}
        </div>
      )}

      {data && !isLoading && (
        <div className="space-y-4">
          <div className="bg-surface-container-low rounded-lg border border-outline-variant p-4">
            <h3 className="text-title-sm font-semibold text-on-surface mb-3">Datos del emisor</h3>
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <dt className="text-label-sm text-on-surface-variant">RFC</dt>
                <dd className="text-body-sm text-on-surface font-mono">{data.issuer.rfc || "—"}</dd>
              </div>
              <div>
                <dt className="text-label-sm text-on-surface-variant">Razón social</dt>
                <dd className="text-body-sm text-on-surface">{data.issuer.name || "—"}</dd>
              </div>
              <div>
                <dt className="text-label-sm text-on-surface-variant">Régimen fiscal</dt>
                <dd className="text-body-sm text-on-surface">{labels?.issuerFiscalRegime || data.issuer.fiscalRegime || "—"}</dd>
              </div>
              <div>
                <dt className="text-label-sm text-on-surface-variant">Código postal</dt>
                <dd className="text-body-sm text-on-surface">{data.issuer.zipCode || "—"}</dd>
              </div>
              <div>
                <dt className="text-label-sm text-on-surface-variant">Dirección</dt>
                <dd className="text-body-sm text-on-surface">{data.issuer.address || "—"}</dd>
              </div>
            </dl>
          </div>

          <div className="bg-surface-container-low rounded-lg border border-outline-variant p-4">
            <h3 className="text-title-sm font-semibold text-on-surface mb-3">Datos del receptor</h3>
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <dt className="text-label-sm text-on-surface-variant">RFC</dt>
                <dd className="text-body-sm text-on-surface font-mono">{data.receiver.rfc || "—"}</dd>
              </div>
              <div>
                <dt className="text-label-sm text-on-surface-variant">Nombre</dt>
                <dd className="text-body-sm text-on-surface">{data.receiver.name}</dd>
              </div>
              <div>
                <dt className="text-label-sm text-on-surface-variant">Uso CFDI</dt>
                <dd className="text-body-sm text-on-surface">{labels?.receiverCfdiUse || data.receiver.cfdiUse || "—"}</dd>
              </div>
              <div>
                <dt className="text-label-sm text-on-surface-variant">Régimen fiscal</dt>
                <dd className="text-body-sm text-on-surface">{labels?.receiverFiscalRegime || data.receiver.fiscalRegime || "—"}</dd>
              </div>
              <div>
                <dt className="text-label-sm text-on-surface-variant">Código postal</dt>
                <dd className="text-body-sm text-on-surface">{data.receiver.taxZipCode || "—"}</dd>
              </div>
            </dl>
          </div>

          <div className="bg-surface-container-low rounded-lg border border-outline-variant p-4">
            <h3 className="text-title-sm font-semibold text-on-surface mb-3">Datos de pago CFDI</h3>
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <dt className="text-label-sm text-on-surface-variant">Forma de pago</dt>
                <dd className="text-body-sm text-on-surface">{describePaymentForm(data.paymentForm)}</dd>
              </div>
              <div>
                <dt className="text-label-sm text-on-surface-variant">Método de pago</dt>
                <dd className="text-body-sm text-on-surface">{describePaymentMethod(data.paymentMethod)}</dd>
              </div>
            </dl>
          </div>

          <div className="border border-outline-variant rounded-md overflow-x-auto min-w-0">
            <div className={`grid ${LINE_ITEMS_GRID_TEMPLATE} gap-2 border-b border-outline-variant bg-surface-container-low px-4 py-2 text-label-sm text-on-surface-variant uppercase tracking-wide min-w-0`}>
              <span>Concepto</span>
              <span className="text-right">Cant.</span>
              <span className="text-right">Precio</span>
              <span className="text-right">Desc.</span>
              <span className="text-right">IVA</span>
              <span className="text-right">IEPS</span>
              <span className="text-right">Subtotal</span>
              <span className="text-right">Total línea</span>
            </div>
            {data.lines.map((line, idx) => (
              <div
                key={`${line.productCode}-${idx}`}
                className={`grid ${LINE_ITEMS_GRID_TEMPLATE} gap-2 px-4 py-2 border-b border-outline-variant/40 text-body-sm last:border-b-0 min-w-0`}
              >
                <div>
                  <p className="text-on-surface font-medium">{line.description}</p>
                  <p className="text-label-sm text-on-surface-variant font-mono">{line.productCode}</p>
                  {(line.satProductCode && (satCodeLabels[line.satProductCode] || line.satProductCode)) && (
                    <p className="text-label-sm text-on-surface-variant font-mono">
                      SAT: {satCodeLabels[line.satProductCode] || line.satProductCode}
                    </p>
                  )}
                </div>
                <span className="text-right tabular-nums">{line.quantity}</span>
                <span className="text-right tabular-nums">{fmt(line.unitPrice)}</span>
                <span className="text-right tabular-nums">{line.discountPct.toFixed(0)}%</span>
                <span className="text-right tabular-nums">{pct(line.ivaRate)}</span>
                <span className="text-right tabular-nums">{pct(line.iepsRate)}</span>
                <span className="text-right tabular-nums">{fmt(line.lineSubtotal)}</span>
                <span className="text-right tabular-nums font-medium">{fmt(line.lineTotal)}</span>
              </div>
            ))}
          </div>

          <div className="flex justify-end">
            <div className="space-y-1 text-body-sm w-full max-w-xs">
              <div className="flex justify-between gap-8">
                <span className="text-on-surface-variant">Subtotal</span>
                <span className="tabular-nums">{fmt(data.subtotal)}</span>
              </div>
              <div className="flex justify-between gap-8">
                <span className="text-on-surface-variant">Impuestos</span>
                <span className="tabular-nums">{fmt(data.taxTotal)}</span>
              </div>
              <div className="flex justify-between gap-8 font-semibold text-title-sm">
                <span>Total</span>
                <span className="tabular-nums">{fmt(data.total)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {downloadError && (
        <div className="rounded bg-error-container/30 border border-error/30 px-4 py-3 text-body-sm text-error mt-4">
          {downloadError.message || "No se pudo descargar el PDF."}
        </div>
      )}

      <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-outline-variant">
        <Button type="button" variant="text" onClick={onClose}>
          Volver a editar
        </Button>
        <DownloadPdfButton onClick={handleDownloadPdf} disabled={!canDownload} loading={isDownloading} />
        <Button type="button" onClick={onConfirmStamp} disabled={!canConfirm} loading={isSubmitting}>
          Timbrar ahora
        </Button>
      </div>
    </dialog>
  );
}