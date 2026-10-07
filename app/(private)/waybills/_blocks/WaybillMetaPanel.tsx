import Link from "next/link";
import type { WaybillDetail, WaybillAddressDto } from "../_logic/types/domain";
import { fmtDateTimeLong } from "../../../_lib/formatDate";

function fmtDate(d: Date) {
  return fmtDateTimeLong(d);
}

function fmtAddress(a: WaybillAddressDto): string {
  const parts = [
    `${a.street} ${a.exteriorNumber}${a.interiorNumber ? ` Int. ${a.interiorNumber}` : ""}`,
    a.neighborhood,
    a.municipality,
    a.state,
    a.country,
    a.zipCode,
  ];
  return parts.filter(Boolean).join(", ");
}

interface WaybillMetaPanelProps {
  wb: WaybillDetail;
  branchNameById: Record<string, string>;
}

export function WaybillMetaPanel({ wb, branchNameById }: WaybillMetaPanelProps) {
  const isCartaPorte = wb.type === "carta_porte";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 bg-surface-container-low rounded-lg p-4">
        <div>
          <p className="text-label-sm text-on-surface-variant">Origen</p>
          <p className="text-body-sm text-on-surface font-medium">
            {branchNameById[wb.originBranchId] ?? wb.originBranchId.slice(0, 8)}
          </p>
          {wb.originAddress && <p className="text-label-sm text-on-surface-variant">{fmtAddress(wb.originAddress)}</p>}
        </div>
        <div>
          <p className="text-label-sm text-on-surface-variant">Destino</p>
          {isCartaPorte ? (
            <p className="text-body-sm text-on-surface font-medium">
              {wb.destinationCustomerName ?? "Cliente"}
              {wb.destinationCustomerCode ? ` (${wb.destinationCustomerCode})` : ""}
            </p>
          ) : (
            <p className="text-body-sm text-on-surface font-medium">
              {wb.destinationBranchId ? branchNameById[wb.destinationBranchId] ?? wb.destinationBranchId.slice(0, 8) : "—"}
            </p>
          )}
          {wb.destinationAddress && (
            <p className="text-label-sm text-on-surface-variant">{fmtAddress(wb.destinationAddress)}</p>
          )}
          {isCartaPorte && wb.saleId && (
            <Link href={`/sales/${wb.saleId}`} className="text-label-sm text-primary underline">
              Ver venta
            </Link>
          )}
        </div>

        {isCartaPorte ? (
          <>
            <div>
              <p className="text-label-sm text-on-surface-variant">Vehículo</p>
              <p className="text-body-sm text-on-surface">
                Placa {wb.vehiclePlate} · Config. {wb.vehicleConfig}
              </p>
              <p className="text-label-sm text-on-surface-variant">
                Permiso SCT {wb.vehiclePermitType} — {wb.vehiclePermitNumber}
              </p>
              <p className="text-label-sm text-on-surface-variant">
                {wb.insuranceCompany} — Póliza {wb.insurancePolicy}
              </p>
            </div>
            <div>
              <p className="text-label-sm text-on-surface-variant">Operador</p>
              <p className="text-body-sm text-on-surface">{wb.driverName}</p>
              {wb.driverRfc && <p className="text-label-sm text-on-surface-variant">RFC: {wb.driverRfc}</p>}
              <p className="text-label-sm text-on-surface-variant">Licencia: {wb.driverLicenseNumber}</p>
            </div>

            <div>
              <p className="text-label-sm text-on-surface-variant">Horario</p>
              <p className="text-body-sm text-on-surface">Salida: {fmtDate(wb.departureAt)}</p>
              {wb.arrivalAt && <p className="text-body-sm text-on-surface">Llegada: {fmtDate(wb.arrivalAt)}</p>}
              <p className="text-label-sm text-on-surface-variant">Distancia: {wb.distanceKm} km</p>
            </div>
            <div>
              <p className="text-label-sm text-on-surface-variant">CFDI</p>
              <p className="text-body-sm text-on-surface font-mono">{wb.cfdiUuid ?? "—"}</p>
            </div>
          </>
        ) : (
          <>
            <div>
              <p className="text-label-sm text-on-surface-variant">Fecha de traspaso</p>
              <p className="text-body-sm text-on-surface">{fmtDate(wb.departureAt)}</p>
            </div>
            <div>
              <p className="text-label-sm text-on-surface-variant">Notas</p>
              <p className="text-body-sm text-on-surface">{wb.notes ?? "—"}</p>
            </div>
          </>
        )}
      </div>

      {wb.status === "cancelled" && wb.cancelledAt && (
        <div className="bg-surface-container-highest text-on-surface-variant rounded-md p-4 text-body-sm">
          <p className="font-medium text-on-surface mb-1">Cancelado el {fmtDate(wb.cancelledAt)}</p>
          {wb.cancellationReason && <p className="mt-1">Motivo: {wb.cancellationReason}</p>}
        </div>
      )}
    </div>
  );
}
