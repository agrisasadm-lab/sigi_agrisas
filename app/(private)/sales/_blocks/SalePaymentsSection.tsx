"use client";

import { useState, Fragment } from "react";
import { useCurrentUser } from "../../../_hooks/useCurrentUser";
import { useSalePayments } from "../../payments/_logic/hooks/useSalePayments";
import { PaymentStatusBadge } from "../../payments/_blocks/PaymentStatusBadge";
import { RegisterPaymentModal } from "../../payments/_blocks/RegisterPaymentModal";
import { CancelPaymentModal } from "../../payments/_blocks/CancelPaymentModal";
import { Skeleton } from "../../../_components/atoms/Skeleton/Skeleton";
import type { SaleDetail } from "../_logic/types/domain";
import { formatMxCurrency } from "../../../_lib/formatMxCurrency";
import { fmtDateTimeShort } from "../../../_lib/formatDate";

function fmt(n: number) { return formatMxCurrency(n); }
function fmtDate(d: Date) {
  return fmtDateTimeShort(d);
}

interface SalePaymentsSectionProps {
  saleId: string;
  sale: SaleDetail;
  onPaymentMutated: () => void;
}

export function SalePaymentsSection({ saleId, sale, onPaymentMutated }: SalePaymentsSectionProps) {
  const { can } = useCurrentUser();
  const canCreate = can("payments:create");
  const { payments, paidAmount, total, paymentStatus, lineBalances, isLoading, refresh } = useSalePayments(saleId);
  const [showRegister, setShowRegister] = useState(false);
  const [cancelPaymentId, setCancelPaymentId] = useState<string | null>(null);
  const [expandedPaymentId, setExpandedPaymentId] = useState<string | null>(null);

  const dueAmount = Math.max(0, total - paidAmount);
  const progressPct = total > 0 ? Math.min(100, Math.round((paidAmount / total) * 100)) : 0;

  const showCta = sale.status === "completed" && canCreate === true && dueAmount > 0;

  const handlePaymentMutated = () => {
    refresh();
    onPaymentMutated();
  };

  return (
    <div className="bg-surface-container-low rounded-lg border border-outline-variant overflow-hidden">
      <div className="px-4 py-3 border-b border-outline-variant flex items-center justify-between gap-4">
        <h2 className="text-title-sm font-semibold text-on-surface">
          Abonos {!isLoading && payments.length > 0 ? `(${payments.length})` : ""}
        </h2>
        {showCta && (
          <button
            type="button"
            onClick={() => setShowRegister(true)}
            className="rounded-full bg-primary text-on-primary px-4 py-1.5 text-label-md font-medium hover:bg-primary/90 transition-colors"
          >
            + Registrar abono
          </button>
        )}
      </div>

      <div className="p-4 space-y-4">
        {/* Progress bar */}
        {!isLoading && total > 0 && (
          <div className="space-y-1">
            <div className="flex justify-between text-body-sm">
              <span className="text-on-surface-variant">
                {fmt(paidAmount)} abonado de {fmt(total)}
              </span>
              <span className="font-medium text-on-surface">{progressPct}%</span>
            </div>
            <div className="w-full bg-surface-container-highest rounded-full h-2">
              <div
                className="bg-primary h-2 rounded-full transition-all"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} height={48} width="100%" />
            ))}
          </div>
        ) : (
          <>
            {payments.length === 0 ? (
              <p className="text-body-sm text-on-surface-variant">Sin abonos registrados.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-body-sm">
                  <thead>
                    <tr className="border-b border-outline-variant text-label-sm text-on-surface-variant uppercase tracking-wide">
                      <th className="px-3 py-2 text-left font-medium">Folio recibo</th>
                      <th className="px-3 py-2 text-left font-medium">Cobrador</th>
                      <th className="px-3 py-2 text-left font-medium">Método</th>
                      <th className="px-3 py-2 text-right font-medium">Monto</th>
                      <th className="px-3 py-2 text-left font-medium">Fecha</th>
                      <th className="px-3 py-2 text-left font-medium">Estado</th>
                      <th className="px-3 py-2 text-left font-medium" />
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((p) => {
                      const folioLabel = p.folioPrefix
                        ? `${p.folioPrefix}${p.folioNumber}`
                        : String(p.folioNumber);
                      const canCancel = can("payments:cancel");
                      const hasItems = !!p.items && p.items.length > 0;
                      const isExpanded = expandedPaymentId === p.id;
                      return (
                        <Fragment key={p.id}>
                          <tr className="border-b border-outline-variant/40 hover:bg-surface-container-low/60 transition-colors">
                            <td className="px-3 py-2 font-mono text-on-surface-variant">
                              {folioLabel}
                              {hasItems && (
                                <button
                                  type="button"
                                  onClick={() => setExpandedPaymentId(isExpanded ? null : p.id)}
                                  className="ml-2 text-label-sm text-primary hover:underline font-sans"
                                >
                                  {isExpanded ? "Ocultar desglose" : "Ver desglose"}
                                </button>
                              )}
                            </td>
                            <td className="px-3 py-2 text-on-surface-variant max-w-[140px] truncate">{p.userName ?? "—"}</td>
                            <td className="px-3 py-2 text-on-surface-variant">{p.paymentMethodName ?? "—"}</td>
                            <td className="px-3 py-2 text-right tabular-nums font-medium">{fmt(p.amount)}</td>
                            <td className="px-3 py-2 text-on-surface-variant tabular-nums">{fmtDate(p.createdAt)}</td>
                            <td className="px-3 py-2">
                              <PaymentStatusBadge status={p.status} salePaymentStatus={paymentStatus} />
                            </td>
                            <td className="px-3 py-2">
                              {p.status === "completed" && canCancel === true && (
                                <button
                                  type="button"
                                  onClick={() => setCancelPaymentId(p.id)}
                                  className="text-label-sm text-error hover:underline"
                                >
                                  Cancelar
                                </button>
                              )}
                            </td>
                          </tr>
                          {isExpanded && hasItems && (
                            <tr className="bg-surface-container-low/40">
                              <td colSpan={7} className="px-3 py-2">
                                <ul className="text-label-sm text-on-surface-variant space-y-0.5">
                                  {p.items!.map((item) => (
                                    <li key={item.saleItemId} className="flex justify-between max-w-xs">
                                      <span className="truncate">{item.productNameSnapshot}</span>
                                      <span className="tabular-nums">{fmt(item.amount)}</span>
                                    </li>
                                  ))}
                                </ul>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {lineBalances.length > 0 && (
              <div className="overflow-x-auto pt-2">
                <p className="text-label-md text-on-surface-variant mb-2">Saldo por producto</p>
                <table className="w-full text-body-sm">
                  <thead>
                    <tr className="border-b border-outline-variant text-label-sm text-on-surface-variant uppercase tracking-wide">
                      <th className="px-3 py-2 text-left font-medium">Producto</th>
                      <th className="px-3 py-2 text-right font-medium">Total línea</th>
                      <th className="px-3 py-2 text-right font-medium">Pagado</th>
                      <th className="px-3 py-2 text-right font-medium">Pendiente</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineBalances.map((lb) => (
                      <tr key={lb.saleItemId} className="border-b border-outline-variant/40">
                        <td className="px-3 py-2 text-on-surface truncate max-w-[200px]">{lb.productNameSnapshot}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmt(lb.lineTotal)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmt(lb.paidAmount)}</td>
                        <td className="px-3 py-2 text-right tabular-nums font-medium">{fmt(lb.dueAmount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {showRegister && (
        <RegisterPaymentModal
          saleId={saleId}
          dueAmount={dueAmount}
          lineBalances={lineBalances}
          onSuccess={() => {
            setShowRegister(false);
            handlePaymentMutated();
          }}
          onClose={() => setShowRegister(false)}
        />
      )}

      {cancelPaymentId && (
        <CancelPaymentModal
          paymentId={cancelPaymentId}
          onSuccess={() => {
            setCancelPaymentId(null);
            handlePaymentMutated();
          }}
          onClose={() => setCancelPaymentId(null)}
        />
      )}
    </div>
  );
}
