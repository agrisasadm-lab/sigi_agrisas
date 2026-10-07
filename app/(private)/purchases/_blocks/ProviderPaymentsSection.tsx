"use client";

import { useState } from "react";
import { RegisterProviderPaymentModal } from "./RegisterProviderPaymentModal";
import { CancelProviderPaymentModal } from "./CancelProviderPaymentModal";
import type { PurchaseDetail } from "../_logic/types/domain";
import { formatMxCurrency } from "../../../_lib/formatMxCurrency";
import { fmtDateShort } from "../../../_lib/formatDate";

function fmt(n: number) { return formatMxCurrency(n); }
function fmtDate(d: Date) { return fmtDateShort(d); }

interface ProviderPaymentsSectionProps {
  purchase: PurchaseDetail;
  canPay: boolean | "loading";
  canPayCancel: boolean | "loading";
  onChange: () => void;
}

export function ProviderPaymentsSection({ purchase, canPay, canPayCancel, onChange }: ProviderPaymentsSectionProps) {
  const [showRegister, setShowRegister] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  if (!purchase.paymentMethodIsCredit) return null;

  const dueAmount = purchase.total - purchase.paidAmount;
  const canRegister = canPay === true && purchase.paymentStatus !== "paid" && purchase.status === "completed";

  return (
    <div className="bg-surface-container-low rounded-lg border border-outline-variant overflow-hidden">
      <div className="px-4 py-3 border-b border-outline-variant flex items-center justify-between">
        <h2 className="text-title-sm font-semibold text-on-surface">Abonos a proveedor</h2>
        {canRegister && (
          <button
            type="button"
            onClick={() => setShowRegister(true)}
            className="rounded-full bg-secondary-container text-on-secondary-container px-3 py-1.5 text-label-sm font-medium hover:opacity-90 transition-opacity"
          >
            Registrar abono
          </button>
        )}
      </div>

      {purchase.providerPayments.length === 0 ? (
        <p className="p-4 text-body-sm text-on-surface-variant">Sin abonos registrados</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-body-sm">
            <thead>
              <tr className="border-b border-outline-variant text-label-sm text-on-surface-variant uppercase tracking-wide">
                <th className="px-4 py-3 text-left font-medium">Folio</th>
                <th className="px-4 py-3 text-right font-medium">Monto</th>
                <th className="px-4 py-3 text-left font-medium">Fecha</th>
                <th className="px-4 py-3 text-left font-medium">Estado</th>
                <th className="px-4 py-3 text-left font-medium">Acción</th>
              </tr>
            </thead>
            <tbody>
              {purchase.providerPayments.map((pp) => (
                <tr key={pp.id} className="border-b border-outline-variant/40">
                  <td className="px-4 py-3 font-mono text-on-surface-variant">{pp.folioCode}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-medium">{fmt(pp.amount)}</td>
                  <td className="px-4 py-3 text-on-surface-variant tabular-nums">{fmtDate(pp.paidAt)}</td>
                  <td className="px-4 py-3">
                    {pp.status === "completed" ? (
                      <span className="text-label-sm text-primary">Activo</span>
                    ) : (
                      <span className="text-label-sm text-on-surface-variant">Cancelado</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {pp.status === "completed" && canPayCancel === true && (
                      <button
                        type="button"
                        onClick={() => setCancellingId(pp.id)}
                        className="text-label-sm text-error hover:text-error/80 font-medium transition-colors"
                      >
                        Cancelar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showRegister && (
        <RegisterProviderPaymentModal
          purchaseId={purchase.id}
          dueAmount={dueAmount}
          open={showRegister}
          onClose={() => setShowRegister(false)}
          onSuccess={onChange}
        />
      )}

      {cancellingId && (
        <CancelProviderPaymentModal
          providerPaymentId={cancellingId}
          open={Boolean(cancellingId)}
          onClose={() => setCancellingId(null)}
          onSuccess={onChange}
        />
      )}
    </div>
  );
}
