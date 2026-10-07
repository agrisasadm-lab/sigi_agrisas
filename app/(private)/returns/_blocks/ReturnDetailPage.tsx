"use client";

import { useState } from "react";
import Link from "next/link";
import { useCurrentUser } from "../../../_hooks/useCurrentUser";
import { useReturnDetail } from "../_logic/hooks/useReturnDetail";
import { ReturnStatusBadge } from "./ReturnStatusBadge";
import { ReturnItemsTable } from "./ReturnItemsTable";
import { ReturnMetaPanel } from "./ReturnMetaPanel";
import { ReturnActionsBar } from "./ReturnActionsBar";
import { CancelReturnModal } from "./CancelReturnModal";
import { EmptyState } from "../../../_components/molecules/EmptyState/EmptyState";
import { TaxBreakdownRows } from "../../../_components/molecules/TaxBreakdownRows/TaxBreakdownRows";
import { Spinner } from "../../../_components/atoms/Spinner/Spinner";
import { Icon } from "../../../_components/atoms/Icon/Icon";
import { ReturnNotFoundError, ReturnReadForbiddenError, ReturnScopingForbiddenError } from "../_logic/errors";
import { formatMxCurrency } from "../../../_lib/formatMxCurrency";
import { fmtDateLong } from "../../../_lib/formatDate";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function fmt(n: number) { return formatMxCurrency(n); }

function fmtDate(d: Date) {
  return fmtDateLong(d);
}

interface ReturnDetailPageProps {
  id: string;
}

export function ReturnDetailPage({ id }: ReturnDetailPageProps) {
  const { can } = useCurrentUser();
  const canCancel = can("returns:cancel");

  const isValidId = UUID_RE.test(id);
  const { returnDetail, isLoading, error, refresh } = useReturnDetail(isValidId ? id : "__skip__");

  const [showCancel, setShowCancel] = useState(false);

  if (!isValidId) {
    return (
      <EmptyState
        icon="warning"
        title="ID inválido"
        description="El identificador de la devolución no es válido."
        action={<Link href="/returns" className="text-primary hover:underline text-body-sm">Volver a devoluciones</Link>}
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
    if (error instanceof ReturnNotFoundError) {
      return (
        <EmptyState
          icon="assignment_return"
          title="Devolución no encontrada"
          description="Esta devolución no existe o fue eliminada."
          action={<Link href="/returns" className="text-primary hover:underline text-body-sm">Volver a devoluciones</Link>}
        />
      );
    }
    if (error instanceof ReturnReadForbiddenError || error instanceof ReturnScopingForbiddenError) {
      return (
        <EmptyState
          icon="block"
          title="No tienes acceso a esta devolución"
          description="No tienes permiso para ver esta devolución."
          action={<Link href="/returns" className="text-primary hover:underline text-body-sm">Volver a devoluciones</Link>}
        />
      );
    }
    return (
      <EmptyState
        icon="warning"
        title="Error al cargar la devolución"
        description={error.message}
      />
    );
  }

  if (!returnDetail) return null;

  const ret = returnDetail;
  const shortId = ret.id.slice(-6).toUpperCase();

  return (
    <div className="flex flex-col gap-lg px-gutter py-lg mx-auto w-full max-w-4xl">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Link href={`/sales/${ret.saleId}`} className="text-on-surface-variant hover:text-on-surface" title="Volver al ticket">
              <Icon name="arrow_back" size={20} />
            </Link>
            <h1 className="text-headline-sm font-semibold text-on-surface font-mono">
              Devolución #{shortId}
            </h1>
            <ReturnStatusBadge status={ret.status} />
          </div>
          <p className="text-body-sm text-on-surface-variant pl-9">
            Devuelto el {fmtDate(ret.returnedAt)} ·{" "}
            <Link href={`/sales/${ret.saleId}`} className="text-primary hover:underline">
              Ver ticket origen
            </Link>
          </p>
        </div>

        <div className="text-right space-y-1">
          <TaxBreakdownRows
            ivaTotal={ret.items.reduce((s, i) => s + i.lineIva, 0)}
            iepsTotal={ret.items.reduce((s, i) => s + i.lineIeps, 0)}
            format={fmt}
            variant="compact"
          />
          <p className="text-label-sm text-on-surface-variant">Reembolso total</p>
          <p className="text-display-sm font-bold tabular-nums text-on-surface">
            {fmt(ret.refundTotal)}
          </p>
        </div>
      </div>

      {/* Items */}
      <div className="bg-surface-container-low rounded-lg border border-outline-variant overflow-hidden">
        <div className="px-4 py-3 border-b border-outline-variant">
          <h2 className="text-title-sm font-semibold text-on-surface">Artículos devueltos</h2>
        </div>
        <ReturnItemsTable items={ret.items} />
      </div>

      {/* Meta */}
      <ReturnMetaPanel ret={ret} />

      {/* Actions */}
      <ReturnActionsBar
        ret={ret}
        canCancel={canCancel}
        onCancelClick={() => setShowCancel(true)}
      />

      {showCancel && (
        <CancelReturnModal
          returnId={ret.id}
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
