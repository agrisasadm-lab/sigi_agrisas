"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "../../../../_components/atoms/Icon/Icon";
import { Skeleton } from "../../../../_components/atoms/Skeleton/Skeleton";
import { auditFolio } from "../_logic/services/listFolios";
import type { FolioAuditResult } from "../_logic/types/domain";
import { useCurrentUser } from "../../../../_hooks/useCurrentUser";
import { useBypassBranchOptions } from "../../../../_hooks/useBypassBranchOptions";
import { isBranchScopedFolioCode } from "@/shared/domain/folios/branchScopedFolioCodes";

const DOC_TYPE_LABEL: Record<string, string> = {
  sale: "Venta",
  quote: "Cotización",
  payment: "Abono",
  purchase: "Compra",
};

const STATUS_LABEL: Record<string, string> = {
  completed: "Completado",
  cancelled: "Cancelado",
  edited: "Editado",
  draft: "Borrador",
  authorized: "Autorizado",
  converted: "Convertido",
  pending: "Pendiente",
  partial: "Parcial",
  paid: "Pagado",
};

interface FolioAuditModalProps {
  folioId: string;
  open: boolean;
  onClose: () => void;
}

const PAGE_SIZE = 50;

export function FolioAuditModal({ folioId, open, onClose }: FolioAuditModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [data, setData] = useState<FolioAuditResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [auditBranchId, setAuditBranchId] = useState<string>("");

  const { can, branchId: ownBranchId } = useCurrentUser();
  const isBypass = can("branches:access_all");
  const { branches } = useBypassBranchOptions(isBypass, ownBranchId ?? null);
  // Sólo se sabe si el folio es branch-scoped tras la primera carga (sin branchId).
  const isBranchScoped = data ? isBranchScopedFolioCode(data.code) : false;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) dialog.showModal();
    else dialog.close();
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handleCancel = (e: Event) => {
      e.preventDefault();
      onClose();
    };
    dialog.addEventListener("cancel", handleCancel);
    return () => dialog.removeEventListener("cancel", handleCancel);
  }, [onClose]);

  useEffect(() => {
    if (!open) {
      setData(null);
      setError(null);
      setPage(1);
      setAuditBranchId("");
      return;
    }
    setIsLoading(true);
    setError(null);
    setData(null);
    setPage(1);
    auditFolio(folioId, auditBranchId || null)
      .then(setData)
      .catch(() => setError("No se pudo cargar la auditoría."))
      .finally(() => setIsLoading(false));
  }, [open, folioId, auditBranchId]);

  const pageItems = data ? data.sequence.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE) : [];
  const totalPages = data ? Math.ceil(data.sequence.length / PAGE_SIZE) : 0;

  return (
    <dialog
      ref={dialogRef}
      className="rounded-lg bg-surface-container p-0 shadow-lg w-full max-w-2xl backdrop:bg-black/40"
    >
      <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant">
        <h2 className="text-title-md font-semibold text-on-surface">Auditoría de folio</h2>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded text-on-surface-variant hover:bg-surface-container-high"
        >
          <Icon name="close" size={20} />
        </button>
      </div>

      <div className="px-6 py-5 max-h-[70vh] overflow-y-auto space-y-5">
        {isLoading && (
          <div className="space-y-3">
            <Skeleton height={32} width="60%" />
            <Skeleton height={24} width="40%" />
            <Skeleton height={200} className="w-full" />
          </div>
        )}

        {error && (
          <p className="text-body-md text-error bg-error-container px-4 py-3 rounded-md">{error}</p>
        )}

        {data && (
          <>
            {isBranchScoped && (
              <div className="flex items-center gap-2">
                <label htmlFor="audit-branch-scope" className="text-label-sm text-on-surface-variant">Sucursal</label>
                <select
                  id="audit-branch-scope"
                  value={auditBranchId}
                  onChange={(e) => setAuditBranchId(e.target.value)}
                  className="px-3 py-1.5 rounded-md border border-outline-variant bg-surface-container-lowest text-body-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">Global (histórico)</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex flex-wrap gap-4">
              <div className="flex flex-col">
                <span className="text-label-sm text-on-surface-variant">Folio</span>
                <span className="text-title-sm font-mono font-semibold text-on-surface">
                  {data.code}{data.prefix ? ` (${data.prefix})` : ""}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-label-sm text-on-surface-variant">Número actual</span>
                <span className="text-title-sm tabular-nums text-on-surface">{data.currentNumber}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-label-sm text-on-surface-variant">Documentos emitidos</span>
                <span className="text-title-sm tabular-nums text-on-surface">
                  {data.truncated ? `+${data.totalIssued}` : data.totalIssued}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-label-sm text-on-surface-variant">Integridad</span>
                {data.gaps.length === 0 ? (
                  <span className="inline-flex items-center gap-1 text-label-md font-medium text-on-tertiary-container bg-tertiary-container px-2 py-0.5 rounded">
                    <Icon name="check_circle" size={14} />
                    Secuencia íntegra
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-label-md font-medium text-on-error-container bg-error-container px-2 py-0.5 rounded">
                    <Icon name="warning" size={14} />
                    {data.gaps.length} {data.gaps.length === 1 ? "hueco" : "huecos"} detectados
                  </span>
                )}
              </div>
            </div>

            {data.withoutFolioNumber > 0 && (
              <div className="flex items-start gap-3 bg-secondary-container rounded-md px-4 py-3">
                <Icon name="info" size={18} className="text-on-secondary-container mt-0.5 shrink-0" />
                <p className="text-body-sm text-on-secondary-container">
                  {data.withoutFolioNumber} {data.withoutFolioNumber === 1 ? "documento vinculado a este folio no tiene" : "documentos vinculados a este folio no tienen"} número asignado. Fueron creados antes de activar la numeración.
                </p>
              </div>
            )}

            {data.gaps.length > 0 && (
              <div className="bg-error-container rounded-md px-4 py-3">
                <p className="text-label-md font-medium text-on-error-container mb-1">Números faltantes</p>
                <p className="text-body-sm text-on-error-container font-mono">
                  {data.gaps.slice(0, 50).join(", ")}
                  {data.gaps.length > 50 && ` … (+${data.gaps.length - 50} más)`}
                </p>
              </div>
            )}

            {data.truncated ? (
              <div className="flex items-start gap-3 bg-secondary-container rounded-md px-4 py-3">
                <Icon name="info" size={18} className="text-on-secondary-container mt-0.5 shrink-0" />
                <p className="text-body-sm text-on-secondary-container">
                  La secuencia supera 10,000 documentos. Solo se muestra el resumen.
                </p>
              </div>
            ) : (
              <>
                {data.sequence.length > 0 && (
                  <div className="overflow-x-auto rounded-md border border-outline-variant">
                    <table className="w-full text-body-sm">
                      <thead>
                        <tr className="border-b border-outline-variant bg-surface-container">
                          <th className="text-left px-3 py-2 text-label-sm text-on-surface-variant font-medium tabular-nums">Número</th>
                          <th className="text-left px-3 py-2 text-label-sm text-on-surface-variant font-medium">Tipo</th>
                          <th className="text-left px-3 py-2 text-label-sm text-on-surface-variant font-medium">Estado</th>
                          <th className="text-left px-3 py-2 text-label-sm text-on-surface-variant font-medium">Fecha</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pageItems.map((item) => (
                          <tr
                            key={`${item.documentType}-${item.documentId}`}
                            className="border-b border-outline-variant last:border-0 hover:bg-surface-container-low"
                          >
                            <td className="px-3 py-2 font-mono text-on-surface tabular-nums">{item.number}</td>
                            <td className="px-3 py-2 text-on-surface">{DOC_TYPE_LABEL[item.documentType] ?? item.documentType}</td>
                            <td className="px-3 py-2 text-on-surface-variant">
                              {STATUS_LABEL[item.status] ?? item.status}
                            </td>
                            <td className="px-3 py-2 text-on-surface-variant tabular-nums">
                              {new Date(item.issuedAt).toLocaleDateString("es-MX", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {totalPages > 1 && (
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-body-sm text-on-surface-variant">
                      Página {page} de {totalPages}
                    </span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="px-3 py-1.5 rounded border border-outline text-label-sm text-on-surface disabled:opacity-40 hover:bg-surface-container-high transition-colors"
                      >
                        Anterior
                      </button>
                      <button
                        type="button"
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                        className="px-3 py-1.5 rounded border border-outline text-label-sm text-on-surface disabled:opacity-40 hover:bg-surface-container-high transition-colors"
                      >
                        Siguiente
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      <div className="flex justify-end px-6 py-4 border-t border-outline-variant bg-surface-container-lowest">
        <button
          type="button"
          onClick={onClose}
          className="px-5 py-2.5 rounded-md border border-outline text-label-lg text-on-surface font-medium hover:bg-surface-container-high transition-colors"
        >
          Cerrar
        </button>
      </div>
    </dialog>
  );
}
