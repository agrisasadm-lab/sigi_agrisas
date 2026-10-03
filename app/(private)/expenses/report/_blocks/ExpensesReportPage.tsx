"use client";

import { useState } from "react";
import { useCurrentUser } from "../../../../_hooks/useCurrentUser";
import { useDebounce } from "../../../../_hooks/useDebounce";
import { useBranchesOptions } from "../../../../_hooks/useBranchesOptions";
import { useExpensesReport } from "../../_logic/hooks/useExpensesReport";
import { CatalogPagination } from "../../../catalogs/_blocks/CatalogPagination";
import { ExpensesReportToolbar } from "./ExpensesReportToolbar";
import { EmptyState } from "../../../../_components/molecules/EmptyState/EmptyState";
import { Spinner } from "../../../../_components/atoms/Spinner/Spinner";
import { PageShell } from "../../../../_components/organisms/PageShell";
import { Table, THead, TBody, Tr, Th, Td } from "../../../../_components/molecules/DataTable/DataTable";

const MX = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 2 });
function fmt(n: string | number) { return MX.format(Number(n)); }
function fmtDate(s: string) {
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "short", timeZone: "UTC" }).format(new Date(s));
}

const CONCEPT_MIN_LENGTH = 2;

export function ExpensesReportPage() {
  const { can } = useCurrentUser();
  const canReport = can("expenses:report_read");
  const isBypass = can("branches:access_all");
  const { options: branchOptions } = useBranchesOptions();
  const branches = branchOptions.map((b) => ({ id: b.id, name: b.name }));

  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [conceptInput, setConceptInput] = useState("");
  const debouncedConcept = useDebounce(conceptInput, 300);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [branchId, setBranchId] = useState("");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [toastError, setToastError] = useState<string | null>(null);

  const effectiveConcept = debouncedConcept.length >= CONCEPT_MIN_LENGTH ? debouncedConcept : undefined;

  const { report, isLoading, error, isExporting, exportPdf, exportXlsx } = useExpensesReport({
    page,
    pageSize,
    concept: effectiveConcept,
    from: from || undefined,
    to: to || undefined,
    branchId: branchId || undefined,
    includeInactive,
  });

  async function handleExportPdf() {
    setToastError(null);
    try {
      await exportPdf();
    } catch (err) {
      if (err instanceof Error) setToastError(err.message);
    }
  }

  async function handleExportXlsx() {
    setToastError(null);
    try {
      await exportXlsx();
    } catch (err) {
      if (err instanceof Error) setToastError(err.message);
    }
  }

  function handleReset() {
    setConceptInput("");
    setFrom("");
    setTo("");
    setBranchId("");
    setIncludeInactive(false);
    setPage(1);
  }

  if (canReport === "loading") {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (canReport === false) {
    return (
      <EmptyState
        icon="block"
        title="Sin acceso"
        description="No tienes permiso para ver el reporte de gastos."
      />
    );
  }

  return (
    <PageShell title="Reporte de gastos" backHref="/expenses">
      <div className="flex flex-col gap-lg">
        <ExpensesReportToolbar
          concept={conceptInput}
          onConceptChange={(v) => { setConceptInput(v); setPage(1); }}
          from={from}
          onFromChange={(v) => { setFrom(v); setPage(1); }}
          to={to}
          onToChange={(v) => { setTo(v); setPage(1); }}
          branchId={branchId}
          onBranchIdChange={(v) => { setBranchId(v); setPage(1); }}
          branches={branches}
          showBranchFilter={isBypass === true}
          includeInactive={includeInactive}
          onIncludeInactiveChange={(v) => { setIncludeInactive(v); setPage(1); }}
          isExporting={isExporting}
          onExportPdf={handleExportPdf}
          onExportXlsx={handleExportXlsx}
          onReset={handleReset}
        />

        {error && (
          <div className="bg-error-container/20 rounded-md px-4 py-3 text-body-sm text-error">
            {error.message}
          </div>
        )}

        {isLoading ? (
          <div className="flex h-40 items-center justify-center">
            <Spinner size="lg" />
          </div>
        ) : !report || report.items.length === 0 ? (
          <EmptyState
            icon="trending_down"
            title="Sin resultados"
            description="No se encontraron gastos con los filtros seleccionados."
          />
        ) : (
          <>
            <div className="overflow-x-auto rounded-lg border border-outline-variant bg-surface-container-low">
              <Table>
                <THead>
                  <Tr hoverable={false}>
                    <Th>Fecha</Th>
                    <Th>Concepto</Th>
                    {isBypass === true && <Th>Sucursal</Th>}
                    <Th>Registrado por</Th>
                    <Th align="right">Monto</Th>
                    <Th>Estado</Th>
                  </Tr>
                </THead>
                <TBody>
                  {report.items.map((item) => (
                    <Tr key={item.id}>
                      <Td className="text-on-surface-variant tabular-nums">{fmtDate(item.expenseDate)}</Td>
                      <Td className="text-on-surface">{item.concept}</Td>
                      {isBypass === true && (
                        <Td className="text-on-surface-variant">{item.branchName ?? "—"}</Td>
                      )}
                      <Td className="max-w-[140px] truncate text-on-surface-variant">{item.creatorName ?? "—"}</Td>
                      <Td align="right" className="font-medium">{fmt(item.amount)}</Td>
                      <Td className="text-on-surface-variant">{item.isActive ? "Activo" : "Inactivo"}</Td>
                    </Tr>
                  ))}
                </TBody>
              </Table>
            </div>

            <div className="rounded-lg border border-outline-variant bg-surface-container px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-label-sm text-on-surface-variant font-medium">
              <span>Total registros: {report.totals.rowCount}</span>
              <span className="tabular-nums font-semibold text-on-surface">{fmt(report.totals.totalAmount)}</span>
            </div>

            <CatalogPagination
              page={page}
              pageSize={pageSize}
              total={report.total}
              count={report.items.length}
              onPageChange={setPage}
              onPageSizeChange={() => {}}
            />
          </>
        )}

        {toastError && (
          <div
            role="alert"
            className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-error-container text-on-error-container px-5 py-3 rounded-full text-body-sm shadow-lg z-50"
          >
            {toastError}
          </div>
        )}
      </div>
    </PageShell>
  );
}
