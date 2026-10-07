"use client";

import { useState } from "react";
import { useCurrentUser } from "../../../../../_hooks/useCurrentUser";
import { useBranchesOptions } from "../../../../../_hooks/useBranchesOptions";
import { useCustomerCollectionsReport } from "../../_logic/by-customer/hooks/useCustomerCollectionsReport";
import { CollectionsFilters } from "./CollectionsFilters";
import { ByCustomerTable } from "./ByCustomerTable";
import { ByTicketTable } from "./ByTicketTable";
import { SegmentedButton } from "../../../../../_components/molecules/SegmentedButton/SegmentedButton";
import { EmptyState } from "../../../../../_components/molecules/EmptyState/EmptyState";
import { Card } from "../../../../../_components/molecules/Card/Card";
import { Button } from "../../../../../_components/atoms/Button/Button";
import { ExportPdfButton } from "../../../../../_components/molecules/PdfDownloadButton/PdfDownloadButton";
import { Spinner } from "../../../../../_components/atoms/Spinner/Spinner";
import { formatMxCurrency } from "../../../../../_lib/formatMxCurrency";

type View = "customer" | "ticket";

function defaultFrom(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
}
function defaultTo(): string {
  return new Date().toISOString().slice(0, 10);
}

export function ByCustomerCollectionsView() {
  const { can } = useCurrentUser();
  const isBypass = can("branches:access_all");
  const { options: branches } = useBranchesOptions();

  const [view, setView] = useState<View>("customer");
  const [branchId, setBranchId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [from, setFrom] = useState(defaultFrom());
  const [to, setTo] = useState(defaultTo());

  const { report, isLoading, error, isExportingPdf, isExportingXlsx, exportPdf, exportXlsx } =
    useCustomerCollectionsReport({ branchId: branchId || undefined, customerId: customerId || undefined, from, to });

  const hasData = report && report.rows.length > 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <CollectionsFilters
          branchId={branchId}
          onBranchIdChange={setBranchId}
          branches={branches}
          showBranchFilter={isBypass === true}
          customerId={customerId}
          onCustomerIdChange={setCustomerId}
          from={from}
          onFromChange={setFrom}
          to={to}
          onToChange={setTo}
        />
        <div className="flex gap-2">
          <ExportPdfButton onClick={() => exportPdf()} loading={isExportingPdf} disabled={!hasData} />
          <Button variant="outlined" icon="summarize" onClick={() => exportXlsx()} disabled={isExportingXlsx || !hasData}>
            {isExportingXlsx ? "Generando…" : "Exportar Excel"}
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-error-container/20 rounded px-4 py-3 text-body-sm text-error">{error.message}</div>
      )}

      {isLoading || !report ? (
        <div className="flex h-40 items-center justify-center">
          <Spinner size="lg" />
        </div>
      ) : !hasData ? (
        <EmptyState icon="groups" title="Sin cobranza" description="No hay abonos cobrados en el periodo seleccionado." />
      ) : (
        <div className="space-y-5">
          <Card className="flex flex-col w-fit">
            <span className="text-label-sm text-on-surface-variant">Total cobrado</span>
            <span className="text-title-md font-semibold text-on-surface tabular-nums">
              {formatMxCurrency(Number(report.totals.totalCollected))}
            </span>
          </Card>

          <SegmentedButton<View>
            value={view}
            onChange={setView}
            aria-label="Vista de cobranza"
            options={[
              { value: "customer", label: "Por Cliente" },
              { value: "ticket", label: "Por Ticket" },
            ]}
          />

          {view === "customer" ? <ByCustomerTable rows={report.byCustomer} /> : <ByTicketTable rows={report.byTicket} />}
        </div>
      )}
    </div>
  );
}
