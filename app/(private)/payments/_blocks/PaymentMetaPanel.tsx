import type { PaymentDetail } from "../_logic/types/domain";
import { formatMxCurrency } from "../../../_lib/formatMxCurrency";
import { fmtDateTimeLong } from "../../../_lib/formatDate";

function fmt(n: number) { return formatMxCurrency(n); }
function fmtDate(d: Date) {
  return fmtDateTimeLong(d);
}

interface PaymentMetaPanelProps {
  payment: PaymentDetail;
}

export function PaymentMetaPanel({ payment }: PaymentMetaPanelProps) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 bg-surface-container-low rounded-lg p-4">
      <div>
        <p className="text-label-sm text-on-surface-variant">Cliente</p>
        <p className="text-body-sm text-on-surface">{payment.customerName ?? "—"}</p>
      </div>
      <div>
        <p className="text-label-sm text-on-surface-variant">Cobrador</p>
        <p className="text-body-sm text-on-surface">{payment.userName ?? "—"}</p>
      </div>
      <div>
        <p className="text-label-sm text-on-surface-variant">Método de pago</p>
        <p className="text-body-sm text-on-surface">{payment.paymentMethodName ?? "—"}</p>
      </div>
      <div>
        <p className="text-label-sm text-on-surface-variant">Sucursal</p>
        <p className="text-body-sm text-on-surface">{payment.branchName ?? "—"}</p>
      </div>
      <div>
        <p className="text-label-sm text-on-surface-variant">Fecha</p>
        <p className="text-body-sm text-on-surface">{fmtDate(payment.createdAt)}</p>
      </div>
      <div>
        <p className="text-label-sm text-on-surface-variant">Monto</p>
        <p className="text-body-sm font-medium text-on-surface">{fmt(payment.amount)}</p>
      </div>
      {payment.notes && (
        <div className="col-span-2 sm:col-span-3">
          <p className="text-label-sm text-on-surface-variant">Notas</p>
          <p className="text-body-sm text-on-surface">{payment.notes}</p>
        </div>
      )}
      {payment.status === "cancelled" && payment.cancellationReason && (
        <div className="col-span-2 sm:col-span-3 bg-error-container/20 rounded-md p-3">
          <p className="text-label-sm text-on-surface-variant">Motivo de cancelación</p>
          <p className="text-body-sm text-on-surface">{payment.cancellationReason}</p>
          {payment.cancelledAt && (
            <p className="text-label-sm text-on-surface-variant mt-1">
              Cancelado el {fmtDate(payment.cancelledAt)}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
