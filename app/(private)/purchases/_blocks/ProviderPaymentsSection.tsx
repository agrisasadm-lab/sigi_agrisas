"use client";

import { useState } from "react";
import { Button } from "../../../_components/atoms/Button/Button";
import { Table, THead, TBody, Tr, Th, Td } from "../../../_components/molecules/DataTable/DataTable";
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
          <Button
            type="button"
            variant="tonal"
            onClick={() => setShowRegister(true)}
            className="px-3 py-1.5 text-label-sm hover:opacity-90"
          >
            Registrar abono
          </Button>
        )}
      </div>

      {purchase.providerPayments.length === 0 ? (
        <p className="p-4 text-body-sm text-on-surface-variant">Sin abonos registrados</p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <THead>
              <Tr hoverable={false}>
                <Th>Folio</Th>
                <Th align="right">Monto</Th>
                <Th>Fecha</Th>
                <Th>Estado</Th>
                <Th>Acción</Th>
              </Tr>
            </THead>
            <TBody>
              {purchase.providerPayments.map((pp) => (
                <Tr key={pp.id} hoverable={false} className="border-b border-outline-variant/40">
                  <Td className="font-mono text-on-surface-variant">{pp.folioCode}</Td>
                  <Td align="right" className="font-medium">{fmt(pp.amount)}</Td>
                  <Td className="text-on-surface-variant">{fmtDate(pp.paidAt)}</Td>
                  <Td>
                    {pp.status === "completed" ? (
                      <span className="text-label-sm text-primary">Activo</span>
                    ) : (
                      <span className="text-label-sm text-on-surface-variant">Cancelado</span>
                    )}
                  </Td>
                  <Td>
                    {pp.status === "completed" && canPayCancel === true && (
                      <Button
                        type="button"
                        variant="text"
                        onClick={() => setCancellingId(pp.id)}
                        className="px-0 py-0 text-label-sm text-error hover:bg-transparent hover:text-error/80"
                      >
                        Cancelar
                      </Button>
                    )}
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
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
