"use client";

import { useState } from "react";
import Link from "next/link";
import { useCurrentUser } from "../../../_hooks/useCurrentUser";
import { usePaymentsHistory } from "../_logic/hooks/usePaymentsHistory";
import { useBranchesOptions } from "../../../_hooks/useBranchesOptions";
import { useCashiersOptions } from "../_logic/hooks/useCashiersOptions";
import { usePaymentMethodsOptions } from "../../../_hooks/usePaymentMethodsOptions";
import { CatalogPagination } from "../../catalogs/_blocks/CatalogPagination";
import { PaymentStatusBadge } from "./PaymentStatusBadge";
import { PaymentsHistoryToolbar } from "./PaymentsHistoryToolbar";
import { GroupedPaymentsTable } from "./GroupedPaymentsTable";
import { EmptyState } from "../../../_components/molecules/EmptyState/EmptyState";
import { Spinner } from "../../../_components/atoms/Spinner/Spinner";
import { PageShell } from "../../../_components/organisms/PageShell";
import { SegmentedButton } from "../../../_components/molecules/SegmentedButton/SegmentedButton";
import { groupPaymentsBySale } from "../_logic/lib/groupPaymentsBySale";
import type { PaymentStatus } from "../_logic/types/domain";
import type { PaymentHistoryRowDto } from "../_logic/types/api";
import { formatMxCurrency } from "../../../_lib/formatMxCurrency";
import { fmtDateShort } from "../../../_lib/formatDate";

function fmt(n: number) { return formatMxCurrency(n); }
function fmtDate(s: string) {
  return fmtDateShort(new Date(s));
}

export function PaymentsHistoryPage() {
  const { can } = useCurrentUser();
  const canReport = can("payments:report_read");
  const isBypass = can("branches:access_all");
  const { options: branchOptions } = useBranchesOptions();
  const branches = branchOptions.map((b) => ({ id: b.id, name: b.name }));
  const { options: cashiers } = useCashiersOptions();
  const { options: paymentMethodOptions } = usePaymentMethodsOptions();
  const paymentMethods = paymentMethodOptions.map((m) => ({ id: m.id, name: m.name }));

  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [userId, setUserId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [productId, setProductId] = useState("");
  const [paymentMethodId, setPaymentMethodId] = useState("");
  const [status, setStatus] = useState<PaymentStatus | "">("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [branchId, setBranchId] = useState("");
  const [toastError, setToastError] = useState<string | null>(null);
  const [view, setView] = useState<"flat" | "grouped">("flat");

  const { report, isLoading, error, isExporting, exportPdf, exportXlsx } = usePaymentsHistory({
    page,
    pageSize,
    userId: userId || undefined,
    customerId: customerId || undefined,
    productId: productId || undefined,
    paymentMethodId: paymentMethodId || undefined,
    status: status || undefined,
    from: from || undefined,
    to: to || undefined,
    branchId: branchId || undefined,
  });

  async function handleExportPdf() {
    setToastError(null);
    try {
      await exportPdf();
    } catch (err) {
      if (err instanceof Error) {
        setToastError(err.message);
      }
    }
  }

  async function handleExportXlsx() {
    setToastError(null);
    try {
      await exportXlsx();
    } catch (err) {
      if (err instanceof Error) {
        setToastError(err.message);
      }
    }
  }

  function handleReset() {
    setUserId("");
    setCustomerId("");
    setProductId("");
    setPaymentMethodId("");
    setStatus("");
    setFrom("");
    setTo("");
    setBranchId("");
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
        description="No tienes permiso para ver el historial de abonos."
      />
    );
  }

  return (
    <PageShell title="Historial de abonos" backHref="/payments">
      <div className="flex flex-col gap-lg">
      <PaymentsHistoryToolbar
        userId={userId}
        onUserIdChange={(v) => { setUserId(v); setPage(1); }}
        cashiers={cashiers}
        customerId={customerId}
        onCustomerIdChange={(v) => { setCustomerId(v); setPage(1); }}
        productId={productId}
        onProductIdChange={(v) => { setProductId(v); setPage(1); }}
        paymentMethodId={paymentMethodId}
        onPaymentMethodIdChange={(v) => { setPaymentMethodId(v); setPage(1); }}
        paymentMethods={paymentMethods}
        status={status}
        onStatusChange={(v) => { setStatus(v); setPage(1); }}
        from={from}
        onFromChange={(v) => { setFrom(v); setPage(1); }}
        to={to}
        onToChange={(v) => { setTo(v); setPage(1); }}
        branchId={branchId}
        onBranchIdChange={(v) => { setBranchId(v); setPage(1); }}
        branches={branches}
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
      ) : !report ? (
        <EmptyState
          icon="payments"
          title="Sin resultados"
          description="No se encontraron abonos con los filtros seleccionados."
        />
      ) : (
        <>
          {report.items.length === 0 ? (
            <EmptyState
              icon="payments"
              title="Sin resultados"
              description="No se encontraron abonos con los filtros seleccionados."
            />
          ) : (
            <>
          <div className="flex justify-end px-1">
            <SegmentedButton
              value={view}
              options={[
                { value: "flat", label: "Vista plana" },
                { value: "grouped", label: "Vista agrupada" },
              ]}
              onChange={setView}
              aria-label="Vista"
            />
          </div>

          {view === "grouped" ? (
            <div className="rounded-lg border border-outline-variant bg-surface-container-low overflow-hidden">
              <GroupedPaymentsTable<PaymentHistoryRowDto>
                groups={groupPaymentsBySale(report.items)}
                isLoading={isLoading}
                columnCount={isBypass === true ? 6 : 5}
                headerRow={
                  <tr className="border-b border-outline-variant text-label-sm text-on-surface-variant uppercase tracking-wide">
                    <th className="px-4 py-3 text-left font-medium">Folio recibo</th>
                    <th className="px-4 py-3 text-left font-medium">Cobrador</th>
                    <th className="px-4 py-3 text-left font-medium">Método</th>
                    {isBypass === true && <th className="px-4 py-3 text-left font-medium">Sucursal</th>}
                    <th className="px-4 py-3 text-right font-medium">Monto</th>
                    <th className="px-4 py-3 text-left font-medium">Fecha</th>
                    <th className="px-4 py-3 text-left font-medium">Estado</th>
                  </tr>
                }
                renderPaymentRow={(p) => {
                  const folioLabel = p.folioCode ?? "—";
                  return (
                    <tr key={p.id} className="border-b border-outline-variant/40 hover:bg-surface-container-low/60 transition-colors">
                      <td className="px-4 py-3 font-mono text-on-surface-variant">{folioLabel}</td>
                      <td className="px-4 py-3 max-w-[140px] truncate text-on-surface-variant">{p.userName ?? "—"}</td>
                      <td className="px-4 py-3 text-on-surface-variant">{p.paymentMethodCode ?? "—"}</td>
                      {isBypass === true && (
                        <td className="px-4 py-3 text-on-surface-variant">{p.branchName ?? "—"}</td>
                      )}
                      <td className="px-4 py-3 text-right tabular-nums font-medium">{fmt(Number(p.amount))}</td>
                      <td className="px-4 py-3 text-on-surface-variant tabular-nums">{fmtDate(p.createdAt)}</td>
                      <td className="px-4 py-3">
                        <PaymentStatusBadge status={p.status} salePaymentStatus={p.salePaymentStatus} />
                      </td>
                    </tr>
                  );
                }}
              />
            </div>
          ) : (
          <div className="overflow-x-auto rounded-lg border border-outline-variant bg-surface-container-low">
            <table className="w-full text-body-sm">
              <thead>
                <tr className="border-b border-outline-variant text-label-sm text-on-surface-variant uppercase tracking-wide">
                  <th className="px-4 py-3 text-left font-medium">Folio recibo</th>
                  <th className="px-4 py-3 text-left font-medium">Folio venta</th>
                  <th className="px-4 py-3 text-left font-medium">Cliente</th>
                  <th className="px-4 py-3 text-left font-medium">Cobrador</th>
                  <th className="px-4 py-3 text-left font-medium">Método</th>
                  {isBypass === true && <th className="px-4 py-3 text-left font-medium">Sucursal</th>}
                  <th className="px-4 py-3 text-right font-medium">Monto</th>
                  <th className="px-4 py-3 text-right font-medium">Monto total</th>
                  <th className="px-4 py-3 text-right font-medium">Saldo pendiente</th>
                  <th className="px-4 py-3 text-left font-medium">Fecha</th>
                  <th className="px-4 py-3 text-left font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {report.items.map((p) => {
                  const folioLabel = p.folioCode ?? "—";
                  return (
                    <tr key={p.id} className="border-b border-outline-variant/40 hover:bg-surface-container-low/60 transition-colors">
                      <td className="px-4 py-3 font-mono text-on-surface-variant">{folioLabel}</td>
                      <td className="px-4 py-3">
                        {p.saleFolioCode ? (
                          <Link href={`/sales/${p.saleId}`} className="text-primary hover:underline">
                            {p.saleFolioCode}
                          </Link>
                        ) : "—"}
                      </td>
                      <td className="px-4 py-3 max-w-[140px] truncate text-on-surface-variant">{p.customerName ?? "—"}</td>
                      <td className="px-4 py-3 max-w-[140px] truncate text-on-surface-variant">{p.userName ?? "—"}</td>
                      <td className="px-4 py-3 text-on-surface-variant">{p.paymentMethodCode ?? "—"}</td>
                      {isBypass === true && (
                        <td className="px-4 py-3 text-on-surface-variant">{p.branchName ?? "—"}</td>
                      )}
                      <td className="px-4 py-3 text-right tabular-nums font-medium">{fmt(Number(p.amount))}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-on-surface-variant">{fmt(Number(p.saleTotal))}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-on-surface-variant">{fmt(Number(p.saleDueAmount))}</td>
                      <td className="px-4 py-3 text-on-surface-variant tabular-nums">{fmtDate(p.createdAt)}</td>
                      <td className="px-4 py-3">
                        <PaymentStatusBadge status={p.status} salePaymentStatus={p.salePaymentStatus} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          )}
            </>
          )}

          <div className="rounded-lg border border-outline-variant bg-surface-container px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-label-sm text-on-surface-variant font-medium">
            <span>
              Total registros: {report.totals.rowCount} — {report.totals.completedCount} completados / {report.totals.cancelledCount} cancelados
            </span>
            <span className="tabular-nums">
              <span className="text-green-700">{fmt(Number(report.totals.totalAmountCompleted))}</span>
              {" · "}
              <span>{fmt(Number(report.totals.totalAmountCancelled))} canc.</span>
            </span>
          </div>

          {report.items.length > 0 && (
            <CatalogPagination
              page={page}
              pageSize={pageSize}
              total={report.total}
              count={report.items.length}
              onPageChange={setPage}
              onPageSizeChange={() => {}}
            />
          )}
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
