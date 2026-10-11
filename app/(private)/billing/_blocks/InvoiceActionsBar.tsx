"use client";

import type { Invoice } from "../_logic/types/domain";
import { Button } from "../../../_components/atoms/Button/Button";
import { DownloadPdfButton } from "../../../_components/molecules/PdfDownloadButton/PdfDownloadButton";

interface InvoiceActionsBarProps {
  invoice: Invoice;
  canCancel: boolean | "loading";
  isDownloading: boolean;
  isSaving: boolean;
  onDownload: (format: "pdf" | "xml") => void;
  onSendEmailClick: () => void;
  onCancelClick: () => void;
}

export function InvoiceActionsBar({
  invoice: inv,
  canCancel,
  isDownloading,
  isSaving,
  onDownload,
  onSendEmailClick,
  onCancelClick,
}: InvoiceActionsBarProps) {
  return (
    <div className="flex flex-wrap gap-3 justify-end">
      <DownloadPdfButton onClick={() => onDownload("pdf")} loading={isDownloading} />
      <Button
        type="button"
        variant="outlined"
        onClick={() => onDownload("xml")}
        loading={isDownloading}
        className="text-label-sm hover:bg-surface-container"
      >
        Descargar XML
      </Button>
      <Button
        type="button"
        variant="outlined"
        onClick={onSendEmailClick}
        className="text-label-sm hover:bg-surface-container"
      >
        Enviar por correo
      </Button>
      {inv.status === "stamped" && canCancel === true && (
        <Button
          type="button"
          variant="outlined"
          onClick={onCancelClick}
          loading={isSaving}
          className="border-error text-label-sm text-error hover:bg-error/5"
        >
          Cancelar CFDI
        </Button>
      )}
    </div>
  );
}
