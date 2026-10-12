import { Icon } from "../../../../_components/atoms/Icon/Icon";
import { Button } from "../../../../_components/atoms/Button/Button";
import { DownloadPdfButton } from "../../../../_components/molecules/PdfDownloadButton/PdfDownloadButton";

interface ExportButtonsProps {
  disabled: boolean;
  isExporting: boolean;
  onExportXlsx: () => void;
  onExportPdf: () => void;
}

export function ExportButtons({ disabled, isExporting, onExportXlsx, onExportPdf }: ExportButtonsProps) {
  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="outlined"
        onClick={onExportXlsx}
        disabled={disabled}
        loading={isExporting}
        className="gap-1.5 rounded-md text-label-lg hover:bg-surface-container"
      >
        <Icon name="summarize" size={18} />
        Exportar Excel
      </Button>
      <DownloadPdfButton onClick={onExportPdf} loading={isExporting} disabled={disabled} />
    </div>
  );
}
