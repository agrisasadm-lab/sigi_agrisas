"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Button } from "../../../_components/atoms/Button/Button";
import { useCurrentUser } from "../../../_hooks/useCurrentUser";
import { useWaybillDetail } from "../_logic/hooks/useWaybillDetail";
import { useWaybillMutations } from "../_logic/hooks/useWaybillMutations";
import { WaybillStatusBadge } from "./WaybillStatusBadge";
import { WaybillTypeBadge } from "./WaybillTypeBadge";
import { WaybillItemsTable } from "./WaybillItemsTable";
import { WaybillMetaPanel } from "./WaybillMetaPanel";
import { WaybillActionsBar } from "./WaybillActionsBar";
import { CancelWaybillModal } from "./CancelWaybillModal";
import { EmptyState } from "../../../_components/molecules/EmptyState/EmptyState";
import { Spinner } from "../../../_components/atoms/Spinner/Spinner";
import { Icon } from "../../../_components/atoms/Icon/Icon";
import { useBranchesOptions } from "../../../_hooks/useBranchesOptions";
import { WaybillNotFoundError, WaybillReadForbiddenError, WaybillScopingForbiddenError } from "../_logic/errors";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface WaybillDetailPageProps {
  id: string;
}

export function WaybillDetailPage({ id }: WaybillDetailPageProps) {
  const { can } = useCurrentUser();
  const canCancel = can("waybills:cancel");

  const isValidId = UUID_RE.test(id);
  const { waybill, isLoading, error, refresh } = useWaybillDetail(isValidId ? id : "__skip__");

  const { isSaving, isDownloading, mutationError, clearError, cancel, download } = useWaybillMutations(() => {
    refresh();
  });

  const { options: branchOptions } = useBranchesOptions();
  const branchNameById = useMemo(
    () => Object.fromEntries(branchOptions.map((b) => [b.id, b.name])),
    [branchOptions]
  );

  const [showCancel, setShowCancel] = useState(false);

  if (!isValidId) {
    return (
      <EmptyState
        icon="warning"
        title="ID inválido"
        description="El identificador del traspaso no es válido."
        action={
          <Link href="/waybills" className="text-primary hover:underline text-body-sm">
            Volver a traspasos
          </Link>
        }
      />
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error) {
    if (error instanceof WaybillNotFoundError) {
      return (
        <EmptyState
          icon="swap_horiz"
          title="Traspaso no encontrado"
          description="Este traspaso no existe o fue eliminado."
          action={
            <Link href="/waybills" className="text-primary hover:underline text-body-sm">
              Volver a traspasos
            </Link>
          }
        />
      );
    }
    if (error instanceof WaybillReadForbiddenError || error instanceof WaybillScopingForbiddenError) {
      return (
        <EmptyState
          icon="block"
          title="No tienes acceso a este traspaso"
          description="No tienes permiso para ver este traspaso."
          action={
            <Link href="/waybills" className="text-primary hover:underline text-body-sm">
              Volver a traspasos
            </Link>
          }
        />
      );
    }
    return <EmptyState icon="warning" title="Error al cargar el traspaso" description={error.message} />;
  }

  if (!waybill) return null;

  const wb = waybill;

  return (
    <div className="flex flex-col gap-lg px-gutter py-lg mx-auto w-full max-w-4xl">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Link href="/waybills" className="text-on-surface-variant hover:text-on-surface" title="Volver a traspasos">
              <Icon name="arrow_back" size={20} />
            </Link>
            <h1 className="text-headline-sm font-semibold text-on-surface font-mono">{wb.folioCode}</h1>
            <WaybillTypeBadge type={wb.type} />
            <WaybillStatusBadge status={wb.status} />
          </div>
          {wb.cfdiUuid && (
            <p className="text-body-sm text-on-surface-variant pl-9 font-mono truncate max-w-md" title={wb.cfdiUuid}>
              {wb.cfdiUuid}
            </p>
          )}
        </div>
      </div>

      {/* Mutation error banner */}
      {mutationError && (
        <div className="rounded-md bg-error-container/30 border border-error/30 px-4 py-3 flex items-start justify-between gap-2">
          <p className="text-body-sm text-error">{mutationError.message}</p>
          <Button
            type="button"
            variant="text"
            onClick={clearError}
            className="flex-shrink-0 rounded-none p-0 text-label-sm text-error hover:bg-transparent hover:underline"
          >
            Cerrar
          </Button>
        </div>
      )}

      {/* Items */}
      <div className="bg-surface-container-low rounded-lg border border-outline-variant overflow-hidden">
        <div className="px-4 py-3 border-b border-outline-variant">
          <h2 className="text-title-sm font-semibold text-on-surface">Mercancías</h2>
        </div>
        <WaybillItemsTable items={wb.items} type={wb.type} />
      </div>

      {/* Meta */}
      <WaybillMetaPanel wb={wb} branchNameById={branchNameById} />

      {/* Actions */}
      <WaybillActionsBar
        waybill={wb}
        canCancel={canCancel}
        isDownloading={isDownloading}
        isSaving={isSaving}
        onDownload={(format) => download(wb.id, format)}
        onCancelClick={() => setShowCancel(true)}
      />

      {showCancel && (
        <CancelWaybillModal
          waybillId={wb.id}
          type={wb.type}
          open={showCancel}
          onClose={() => setShowCancel(false)}
          onSuccess={() => {
            setShowCancel(false);
            refresh();
          }}
        />
      )}
    </div>
  );
}
