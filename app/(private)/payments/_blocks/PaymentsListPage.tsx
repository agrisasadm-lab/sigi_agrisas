"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCurrentUser } from "../../../_hooks/useCurrentUser";
import { usePaymentsList } from "../_logic/hooks/usePaymentsList";
import { useBranchesOptions } from "../../../_hooks/useBranchesOptions";
import { PageShell } from "../../../_components/organisms/PageShell";
import { CatalogPagination } from "../../catalogs/_blocks/CatalogPagination";
import { PaymentsToolbar } from "./PaymentsToolbar";
import { PaymentsTable } from "./PaymentsTable";
import { PaymentsEmpty } from "./PaymentsEmpty";
import { GroupedPaymentsTable } from "./GroupedPaymentsTable";
import { PaymentStatusBadge } from "./PaymentStatusBadge";
import { EmptyState } from "../../../_components/molecules/EmptyState/EmptyState";
import { Spinner } from "../../../_components/atoms/Spinner/Spinner";
import { SegmentedButton } from "../../../_components/molecules/SegmentedButton/SegmentedButton";
import { groupPaymentsBySale } from "../_logic/lib/groupPaymentsBySale";
import type { PaymentStatus, Payment } from "../_logic/types/domain";
import { formatMxCurrency } from "../../../_lib/formatMxCurrency";
import { fmtDateShort } from "../../../_lib/formatDate";

function fmt(n: number) { return formatMxCurrency(n); }
function fmtDate(d: Date) {
  return fmtDateShort(d);
}

export function PaymentsListPage() {
  const router = useRouter();
  const { can } = useCurrentUser();
  const canRead = can("payments:read");
  const isBypass = can("branches:access_all");

  const { options: branchOptions } = useBranchesOptions();
  const branches = branchOptions.map((b) => ({ id: b.id, name: b.name }));

  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [searchInput, setSearchInput] = useState("");
  const [branchId, setBranchId] = useState("");
  const [status, setStatus] = useState<PaymentStatus | "">("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [view, setView] = useState<"flat" | "grouped">("flat");

  const { items, total, isLoading, error } = usePaymentsList({
    page,
    pageSize,
    status: status || undefined,
    branchId: branchId || undefined,
    from: from || undefined,
    to: to || undefined,
    search: searchInput,
  });

  function handleReset() {
    setSearchInput("");
    setBranchId("");
    setStatus("");
    setFrom("");
    setTo("");
    setPage(1);
  }

  if (canRead === "loading") {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (canRead === false) {
    return (
      <EmptyState
        icon="block"
        title="Sin acceso"
        description="No tienes permiso para ver abonos."
      />
    );
  }

  if (error) {
    return (
      <EmptyState
        icon="warning"
        title="Error al cargar abonos"
        description={error.message}
      />
    );
  }

  return (
    <PageShell
      title="Abonos"
      description="Historial de abonos registrados"
      toolbar={
        <PaymentsToolbar
          search={searchInput}
          onSearchChange={(v) => { setSearchInput(v); setPage(1); }}
          branchId={branchId}
          onBranchChange={(v) => { setBranchId(v); setPage(1); }}
          branches={branches}
          showBranchFilter={isBypass === true}
          status={status}
          onStatusChange={(v) => { setStatus(v); setPage(1); }}
          from={from}
          to={to}
          onFromChange={(v) => { setFrom(v); setPage(1); }}
          onToChange={(v) => { setTo(v); setPage(1); }}
          onReset={handleReset}
        />
      }
    >
      {!isLoading && items.length === 0 ? (
        <PaymentsEmpty />
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

          {view === "flat" ? (
            <PaymentsTable
              items={items}
              isLoading={isLoading}
              showBranch={isBypass === true}
              onEnter={(p) => router.push(`/payments/${p.id}`)}
            />
          ) : (
            <GroupedPaymentsTable<Payment>
              groups={groupPaymentsBySale(items)}
              isLoading={isLoading}
              columnCount={7}
              headerRow={
                <tr className="border-b border-outline-variant text-label-sm text-on-surface-variant uppercase tracking-wide">
                  <th className="px-4 py-3 text-left font-medium">Folio recibo</th>
                  <th className="px-4 py-3 text-left font-medium">Cobrador</th>
                  <th className="px-4 py-3 text-left font-medium">Método</th>
                  <th className="px-4 py-3 text-right font-medium">Monto</th>
                  <th className="px-4 py-3 text-left font-medium">Fecha</th>
                  <th className="px-4 py-3 text-left font-medium">Estado</th>
                  <th className="px-4 py-3 text-left font-medium">Acción</th>
                </tr>
              }
              renderPaymentRow={(p) => {
                const folioLabel = p.folioPrefix ? `${p.folioPrefix}${p.folioNumber}` : String(p.folioNumber);
                return (
                  <tr key={p.id} className="border-b border-outline-variant/40 hover:bg-surface-container-low transition-colors">
                    <td className="px-4 py-3 font-mono text-on-surface-variant">{folioLabel}</td>
                    <td className="px-4 py-3 max-w-[140px] truncate text-on-surface-variant">{p.userName ?? "—"}</td>
                    <td className="px-4 py-3 text-on-surface-variant">{p.paymentMethodName ?? "—"}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium">{fmt(p.amount)}</td>
                    <td className="px-4 py-3 text-on-surface-variant tabular-nums">{fmtDate(p.createdAt)}</td>
                    <td className="px-4 py-3">
                      <PaymentStatusBadge status={p.status} salePaymentStatus={p.salePaymentStatus} />
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => router.push(`/payments/${p.id}`)}
                        className="text-label-sm text-primary hover:underline"
                      >
                        Ver
                      </button>
                    </td>
                  </tr>
                );
              }}
            />
          )}

          <CatalogPagination
            page={page}
            pageSize={pageSize}
            total={total}
            count={items.length}
            onPageChange={setPage}
            onPageSizeChange={() => {}}
          />
        </>
      )}
    </PageShell>
  );
}
