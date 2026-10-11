"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Button } from "../../../_components/atoms/Button/Button";
import { Spinner } from "../../../_components/atoms/Spinner/Spinner";
import { DownloadPdfButton } from "../../../_components/molecules/PdfDownloadButton/PdfDownloadButton";
import type { QuoteDetail } from "../_logic/types/domain";

interface QuoteActionsBarProps {
  quote: QuoteDetail;
  can: (perm: string) => boolean | "loading";
  isSaving: boolean;
  isExporting: boolean;
  onAuthorize: () => void;
  onCancel: () => void;
  onConvert: () => void;
  onDownloadPdf: () => void;
}

export function QuoteActionsBar({
  quote,
  can,
  isSaving,
  isExporting,
  onAuthorize,
  onCancel,
  onConvert,
  onDownloadPdf,
}: QuoteActionsBarProps) {
  const { status, isExpired, id, convertedSaleId } = quote;

  const canAuthorize = can("quotes:authorize");
  const canWrite = can("quotes:write");
  const canCancel = can("quotes:cancel");
  const canConvert = can("quotes:convert");

  const printButton = <DownloadPdfButton onClick={onDownloadPdf} loading={isExporting} />;

  if (canAuthorize === "loading" || canWrite === "loading" || canCancel === "loading" || canConvert === "loading") {
    return (
      <div className="flex gap-2">
        <Spinner size="sm" />
      </div>
    );
  }

  let statusContent: ReactNode = null;

  if (status === "converted") {
    if (convertedSaleId) {
      statusContent = (
        <Link
          href={`/sales/${convertedSaleId}`}
          className="rounded-full bg-primary-container text-on-primary-container px-4 py-2 text-label-lg font-medium hover:bg-primary-container/80 transition-colors"
        >
          Ver venta generada
        </Link>
      );
    }
  } else if (status !== "cancelled") {
    statusContent = (
      <>
        {status === "draft" && canAuthorize === true && (
          <Button
            type="button"
            variant="filled"
            onClick={onAuthorize}
            disabled={isExpired}
            loading={isSaving}
            title={isExpired ? "Extiende la fecha de vencimiento primero" : undefined}
          >
            Autorizar
          </Button>
        )}

        {status === "draft" && canWrite === true && (
          <Link
            href={`/quotes/${id}/edit`}
            className="rounded-full border border-outline px-4 py-2 text-label-lg font-medium hover:bg-surface-container-low transition-colors"
          >
            Editar
          </Link>
        )}

        {status === "authorized" && canConvert === true && (
          <Button
            type="button"
            variant="filled"
            onClick={onConvert}
            disabled={isExpired}
            loading={isSaving}
            title={isExpired ? "Cotización vencida — cancela y crea otra" : undefined}
          >
            Convertir a venta
          </Button>
        )}

        {(status === "draft" || status === "authorized") && canCancel === true && (
          <Button
            type="button"
            variant="outlined"
            onClick={onCancel}
            loading={isSaving}
            className="border-error text-error hover:bg-error-container/20"
          >
            Cancelar
          </Button>
        )}
      </>
    );
  }

  return (
    <div className="flex flex-wrap gap-3">
      {statusContent}
      {printButton}
    </div>
  );
}
