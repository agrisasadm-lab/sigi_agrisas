import type { ReturnDetail } from "../_logic/types/domain";
import { fmtDateTimeLong } from "../../../_lib/formatDate";

function fmtDate(d: Date) {
  return fmtDateTimeLong(d);
}

interface ReturnMetaPanelProps {
  ret: ReturnDetail;
}

export function ReturnMetaPanel({ ret }: ReturnMetaPanelProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 bg-surface-container-low rounded-lg p-4">
        <div>
          <p className="text-label-sm text-on-surface-variant">Cliente</p>
          <p className="text-body-sm text-on-surface">{ret.customerName ?? "—"}</p>
          {ret.customerRfc && (
            <p className="text-label-sm text-on-surface-variant">{ret.customerRfc}</p>
          )}
        </div>
        <div>
          <p className="text-label-sm text-on-surface-variant">Sucursal</p>
          <p className="text-body-sm text-on-surface">{ret.branchName ?? "—"}</p>
        </div>
        <div>
          <p className="text-label-sm text-on-surface-variant">Devuelto por</p>
          <p className="text-body-sm text-on-surface">
            {ret.creatorName ?? ret.creatorId.slice(0, 8)}
          </p>
        </div>
        <div className="col-span-full">
          <p className="text-label-sm text-on-surface-variant mb-1">Motivo de devolución</p>
          <p className="text-body-sm text-on-surface whitespace-pre-line">{ret.reason}</p>
        </div>
        {ret.notes && (
          <div className="col-span-full">
            <p className="text-label-sm text-on-surface-variant mb-1">Notas</p>
            <p className="text-body-sm text-on-surface whitespace-pre-line">{ret.notes}</p>
          </div>
        )}
      </div>

      {ret.status === "cancelled" && ret.cancelledAt && (
        <div className="bg-surface-container-highest text-on-surface-variant rounded-md p-4 text-body-sm">
          <p className="font-medium text-on-surface mb-1">
            Cancelada el {fmtDate(ret.cancelledAt)}
          </p>
          {ret.cancelledBy && (
            <p>Por: {ret.cancelledBy}</p>
          )}
          {ret.cancellationReason && (
            <p className="mt-1">Motivo: {ret.cancellationReason}</p>
          )}
        </div>
      )}
    </div>
  );
}
