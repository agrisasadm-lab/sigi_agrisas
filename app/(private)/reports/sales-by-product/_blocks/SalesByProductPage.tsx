"use client";

import { useState } from "react";
import { useCurrentUser } from "../../../../_hooks/useCurrentUser";
import { useDepartmentsOptions } from "../../../../_hooks/useDepartmentsOptions";
import { useBranchesOptions } from "../../../../_hooks/useBranchesOptions";
import { useSalesByProductReport } from "../_logic/hooks/useSalesByProductReport";
import { SalesByProductFilters } from "./SalesByProductFilters";
import { SalesByProductBreakdownCard, SalesByProductScope } from "./SalesByProductBreakdownCard";
import { PageShell } from "../../../../_components/organisms/PageShell";
import { EmptyState } from "../../../../_components/molecules/EmptyState/EmptyState";
import { PageLoading } from "../../../../_components/molecules/PageLoading/PageLoading";
import { Card } from "../../../../_components/molecules/Card/Card";
import { Button } from "../../../../_components/atoms/Button/Button";
import { ExportPdfButton } from "../../../../_components/molecules/PdfDownloadButton/PdfDownloadButton";
import { Spinner } from "../../../../_components/atoms/Spinner/Spinner";
import { formatMxCurrency } from "../../../../_lib/formatMxCurrency";

function defaultFrom(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
}
function defaultTo(): string {
  return new Date().toISOString().slice(0, 10);
}

export function SalesByProductPage() {
  const { can } = useCurrentUser();
  const canRead = can("reports:sales_by_product_read");
  const isBypass = can("branches:access_all");
  const { options: branches } = useBranchesOptions();
  const { options: departments } = useDepartmentsOptions();

  const [scope, setScope] = useState<SalesByProductScope>("global");
  const [branchId, setBranchId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [from, setFrom] = useState(defaultFrom());
  const [to, setTo] = useState(defaultTo());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const resetPage = () => setPage(1);

  const effectiveCustomerId = scope === "customer" ? customerId : "";

  const { report, isLoading, error, isExportingPdf, isExportingXlsx, exportError, exportPdf, exportXlsx } =
    useSalesByProductReport({
      branchId: branchId || undefined,
      departmentId: departmentId || undefined,
      customerId: effectiveCustomerId || undefined,
      from,
      to,
      page,
      pageSize,
    });

  if (canRead === "loading") {
    return <PageLoading />;
  }

  if (canRead === false) {
    return <EmptyState icon="block" title="Sin acceso" description="No tienes permiso para ver el reporte de ventas por producto." />;
  }

  const hasData = report && report.totals.ticketCount > 0;

  return (
    <PageShell title="Ventas por Producto" backHref="/reports">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <SalesByProductFilters
            branchId={branchId}
            onBranchIdChange={(v) => { setBranchId(v); resetPage(); }}
            branches={branches}
            showBranchFilter={isBypass === true}
            departmentId={departmentId}
            onDepartmentIdChange={(v) => { setDepartmentId(v); resetPage(); }}
            departments={departments}
            from={from}
            onFromChange={(v) => { setFrom(v); resetPage(); }}
            to={to}
            onToChange={(v) => { setTo(v); resetPage(); }}
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
        {exportError && (
          <div className="bg-error-container/20 rounded px-4 py-3 text-body-sm text-error">{exportError.message}</div>
        )}

        {isLoading || !report ? (
          <div className="flex h-40 items-center justify-center">
            <Spinner size="lg" />
          </div>
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Card className="flex flex-col">
                <span className="text-label-sm text-on-surface-variant">Tickets</span>
                <span className="text-title-md font-semibold text-on-surface tabular-nums">{report.totals.ticketCount}</span>
              </Card>
              <Card className="flex flex-col">
                <span className="text-label-sm text-on-surface-variant">Total</span>
                <span className="text-title-md font-semibold text-on-surface tabular-nums">{formatMxCurrency(Number(report.totals.total))}</span>
              </Card>
            </div>

            {!hasData ? (
              <EmptyState icon="trending_up" title="Sin ventas" description="No hay ventas en el periodo seleccionado." />
            ) : (
              <SalesByProductBreakdownCard
                scope={scope}
                onScopeChange={(s) => { setScope(s); resetPage(); }}
                customerId={customerId}
                onCustomerIdChange={(v) => { setCustomerId(v); resetPage(); }}
                page={page}
                pageSize={pageSize}
                rowsTotal={report.rowsTotal}
                onPageChange={setPage}
                onPageSizeChange={(n) => { setPageSize(n); resetPage(); }}
                rows={report.rows}
              />
            )}
          </div>
        )}
      </div>
    </PageShell>
  );
}
