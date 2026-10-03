"use client";

import { Button } from "../../../../_components/atoms/Button/Button";
import { Select } from "../../../../_components/atoms/Select/Select";
import { DownloadPdfButton } from "../../../../_components/molecules/PdfDownloadButton/PdfDownloadButton";

interface BranchOption {
  id: string;
  name: string;
}

interface ExpensesReportToolbarProps {
  concept: string;
  onConceptChange: (v: string) => void;
  from: string;
  onFromChange: (v: string) => void;
  to: string;
  onToChange: (v: string) => void;
  branchId: string;
  onBranchIdChange: (v: string) => void;
  branches: BranchOption[];
  showBranchFilter: boolean;
  includeInactive: boolean;
  onIncludeInactiveChange: (v: boolean) => void;
  isExporting: boolean;
  onExportPdf: () => void;
  onExportXlsx: () => void;
  onReset: () => void;
}

export function ExpensesReportToolbar({
  concept,
  onConceptChange,
  from,
  onFromChange,
  to,
  onToChange,
  branchId,
  onBranchIdChange,
  branches,
  showBranchFilter,
  includeInactive,
  onIncludeInactiveChange,
  isExporting,
  onExportPdf,
  onExportXlsx,
  onReset,
}: ExpensesReportToolbarProps) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1">
        <label className="text-label-sm text-on-surface-variant">Concepto</label>
        <input
          type="text"
          value={concept}
          onChange={(e) => onConceptChange(e.target.value)}
          placeholder="Buscar por concepto..."
          className="rounded-md border border-outline bg-surface px-3 py-2 text-body-sm text-on-surface focus:outline-none focus:border-primary w-56"
        />
      </div>

      <div className="flex items-end gap-2">
        <div className="flex flex-col gap-1">
          <label className="text-label-sm text-on-surface-variant">Desde</label>
          <input
            type="date"
            value={from}
            onChange={(e) => onFromChange(e.target.value)}
            className="rounded-md border border-outline bg-surface px-3 py-2 text-body-sm text-on-surface focus:outline-none focus:border-primary"
          />
        </div>
        <span className="text-on-surface-variant text-body-sm mb-2">—</span>
        <div className="flex flex-col gap-1">
          <label className="text-label-sm text-on-surface-variant">Hasta</label>
          <input
            type="date"
            value={to}
            onChange={(e) => onToChange(e.target.value)}
            className="rounded-md border border-outline bg-surface px-3 py-2 text-body-sm text-on-surface focus:outline-none focus:border-primary"
          />
        </div>
      </div>

      {showBranchFilter && (
        <div className="flex flex-col gap-1">
          <label className="text-label-sm text-on-surface-variant">Sucursal</label>
          <Select value={branchId} onChange={(e) => onBranchIdChange(e.target.value)}>
            <option value="">Todas</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </Select>
        </div>
      )}

      <label className="flex items-center gap-2 cursor-pointer select-none pb-2">
        <input
          type="checkbox"
          checked={includeInactive}
          onChange={(e) => onIncludeInactiveChange(e.target.checked)}
          className="h-4 w-4 rounded border-outline-variant"
        />
        <span className="text-label-sm text-on-surface-variant">Incluir inactivos</span>
      </label>

      <div className="flex items-end gap-2">
        <Button variant="outlined" onClick={onReset}>
          Limpiar
        </Button>
        <DownloadPdfButton onClick={onExportPdf} loading={isExporting} />
        <Button variant="tonal" onClick={onExportXlsx} loading={isExporting}>
          Exportar Excel
        </Button>
      </div>
    </div>
  );
}
