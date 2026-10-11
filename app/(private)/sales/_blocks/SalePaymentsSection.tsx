"use client";

import { useState, Fragment } from "react";
import { useCurrentUser } from "../../../_hooks/useCurrentUser";
import { useSalePayments } from "../../payments/_logic/hooks/useSalePayments";
import { PaymentStatusBadge } from "../../payments/_blocks/PaymentStatusBadge";
import { RegisterPaymentModal } from "../../payments/_blocks/RegisterPaymentModal";
import { CancelPaymentModal } from "../../payments/_blocks/CancelPaymentModal";
import { Button } from "../../../_components/atoms/Button/Button";
import { Skeleton } from "../../../_components/atoms/Skeleton/Skeleton";
import { Table, THead, TBody, Tr, Th, Td } from "../../../_components/molecules/DataTable/DataTable";
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
          <Button type="button" variant="filled" onClick={() => setShowRegister(true)} className="px-4 py-1.5 text-label-md">
            + Registrar abono
          </Button>
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
                <Table>
                  <THead>
                    <Tr hoverable={false}>
                      <Th className="py-2 px-3">Folio recibo</Th>
                      <Th className="py-2 px-3">Cobrador</Th>
                      <Th className="py-2 px-3">Método</Th>
                      <Th align="right" className="py-2 px-3">Monto</Th>
                      <Th className="py-2 px-3">Fecha</Th>
                      <Th className="py-2 px-3">Estado</Th>
                      <Th className="py-2 px-3" />
                    </Tr>
                  </THead>
                  <TBody>
                    {payments.map((p) => {
                      const folioLabel = p.folioPrefix
                        ? `${p.folioPrefix}${p.folioNumber}`
                        : String(p.folioNumber);
                      const canCancel = can("payments:cancel");
                      const hasItems = !!p.items && p.items.length > 0;
                      const isExpanded = expandedPaymentId === p.id;
                      return (
                        <Fragment key={p.id}>
                          <Tr className="border-b border-outline-variant/40 hover:bg-surface-container-low/60">
                            <Td className="py-2 px-3 font-mono text-on-surface-variant">
                              {folioLabel}
                              {hasItems && (
                                <Button
                                  type="button"
                                  variant="text"
                                  onClick={() => setExpandedPaymentId(isExpanded ? null : p.id)}
                                  className="ml-2 rounded-none p-0 text-label-sm font-sans underline hover:bg-transparent"
                                >
                                  {isExpanded ? "Ocultar desglose" : "Ver desglose"}
                                </Button>
                              )}
                            </Td>
                            <Td className="py-2 px-3 text-on-surface-variant max-w-[140px] truncate">{p.userName ?? "—"}</Td>
                            <Td className="py-2 px-3 text-on-surface-variant">{p.paymentMethodName ?? "—"}</Td>
                            <Td align="right" className="py-2 px-3 font-medium">{fmt(p.amount)}</Td>
                            <Td className="py-2 px-3 text-on-surface-variant tabular-nums">{fmtDate(p.createdAt)}</Td>
                            <Td className="py-2 px-3">
                              <PaymentStatusBadge status={p.status} salePaymentStatus={paymentStatus} />
                            </Td>
                            <Td className="py-2 px-3">
                              {p.status === "completed" && canCancel === true && (
                                <Button
                                  type="button"
                                  variant="text"
                                  onClick={() => setCancelPaymentId(p.id)}
                                  className="rounded-none p-0 text-label-sm text-error underline hover:bg-transparent"
                                >
                                  Cancelar
                                </Button>
                              )}
                            </Td>
                          </Tr>
                          {isExpanded && hasItems && (
                            <Tr hoverable={false} className="bg-surface-container-low/40">
                              <Td colSpan={7} className="py-2 px-3">
                                <ul className="text-label-sm text-on-surface-variant space-y-0.5">
                                  {p.items!.map((item) => (
                                    <li key={item.saleItemId} className="flex justify-between max-w-xs">
                                      <span className="truncate">{item.productNameSnapshot}</span>
                                      <span className="tabular-nums">{fmt(item.amount)}</span>
                                    </li>
                                  ))}
                                </ul>
                              </Td>
                            </Tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </TBody>
                </Table>
              </div>
            )}

            {lineBalances.length > 0 && (
              <div className="overflow-x-auto pt-2">
                <p className="text-label-md text-on-surface-variant mb-2">Saldo por producto</p>
                <Table>
                  <THead>
                    <Tr hoverable={false}>
                      <Th className="py-2 px-3">Producto</Th>
                      <Th align="right" className="py-2 px-3">Total línea</Th>
                      <Th align="right" className="py-2 px-3">Pagado</Th>
                      <Th align="right" className="py-2 px-3">Pendiente</Th>
                    </Tr>
                  </THead>
                  <TBody>
                    {lineBalances.map((lb) => (
                      <Tr key={lb.saleItemId} hoverable={false} className="border-b border-outline-variant/40">
                        <Td className="py-2 px-3 text-on-surface truncate max-w-[200px]">{lb.productNameSnapshot}</Td>
                        <Td align="right" className="py-2 px-3">{fmt(lb.lineTotal)}</Td>
                        <Td align="right" className="py-2 px-3">{fmt(lb.paidAmount)}</Td>
                        <Td align="right" className="py-2 px-3 font-medium">{fmt(lb.dueAmount)}</Td>
                      </Tr>
                    ))}
                  </TBody>
                </Table>
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
