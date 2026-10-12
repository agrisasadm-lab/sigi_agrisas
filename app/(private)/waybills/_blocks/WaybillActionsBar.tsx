"use client";

import type { WaybillDetail } from "../_logic/types/domain";
import { Button } from "../../../_components/atoms/Button/Button";
import { DownloadPdfButton } from "../../../_components/molecules/PdfDownloadButton/PdfDownloadButton";

interface WaybillActionsBarProps {
  waybill: WaybillDetail;
  canCancel: boolean | "loading";
  isDownloading: boolean;
  isSaving: boolean;
  onDownload: (format: "pdf" | "xml") => void;
  onCancelClick: () => void;
}

export function WaybillActionsBar({
  waybill: wb,
  canCancel,
  isDownloading,
  isSaving,
  onDownload,
  onCancelClick,
}: WaybillActionsBarProps) {
  const canDownload = wb.type === "carta_porte" && !!wb.cfdiUuid;

  return (
    <div className="flex flex-wrap gap-3 justify-end">
      {canDownload && (
        <>
          <DownloadPdfButton onClick={() => onDownload("pdf")} loading={isDownloading} />
          <Button
            type="button"
            variant="outlined"
            onClick={() => onDownload("xml")}
            loading={isDownloading}
            className="text-label-sm"
          >
            Descargar XML
          </Button>
        </>
      )}
      {wb.status === "completed" && canCancel === true && (
        <Button
          type="button"
          variant="outlined"
          onClick={onCancelClick}
          loading={isSaving}
          className="border-error text-error hover:bg-error-container/20"
        >
          Cancelar traspaso
        </Button>
      )}
    </div>
  );
}
