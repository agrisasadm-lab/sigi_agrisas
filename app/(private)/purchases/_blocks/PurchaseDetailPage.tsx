"use client";

import { useState } from "react";
import Link from "next/link";
import { useCurrentUser } from "../../../_hooks/useCurrentUser";
import { usePurchaseDetail } from "../_logic/hooks/usePurchaseDetail";
import { PurchaseStatusBadge } from "./PurchaseStatusBadge";
import { PurchaseItemsTable } from "./PurchaseItemsTable";
import { PurchaseMetaPanel } from "./PurchaseMetaPanel";
import { ProviderPaymentsSection } from "./ProviderPaymentsSection";
import { PurchaseActionsBar } from "./PurchaseActionsBar";
import { CancelPurchaseModal } from "./CancelPurchaseModal";
import { EmptyState } from "../../../_components/molecules/EmptyState/EmptyState";
import { Spinner } from "../../../_components/atoms/Spinner/Spinner";
import { PurchaseNotFoundError, PurchaseReadForbiddenError, PurchaseScopingForbiddenError } from "../_logic/errors";
import { formatMxCurrency } from "../../../_lib/formatMxCurrency";
import { fmtDateLong } from "../../../_lib/formatDate";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function fmt(n: number) { return formatMxCurrency(n); }
function fmtDate(d: Date) { return fmtDateLong(d); }

interface PurchaseDetailPageProps {
  id: string;
}

export function PurchaseDetailPage({ id }: PurchaseDetailPageProps) {
  const { can } = useCurrentUser();
  const canCancel = can("purchases:cancel");
  const canPay = can("purchases:pay");
  const canPayCancel = can("purchases:pay_cancel");

  const isValidId = UUID_RE.test(id);
  const { purchaseDetail, isLoading, error, refresh } = usePurchaseDetail(isValidId ? id : "__skip__");

  const [showCancel, setShowCancel] = useState(false);

  if (!isValidId) {
    return (
      <EmptyState
        icon="warning"
        title="ID inválido"
        description="El identificador de la compra no es válido."
        action={<Link href="/purchases" className="text-primary hover:underline text-body-sm">Volver a compras</Link>}
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
    if (error instanceof PurchaseNotFoundError) {
      return (
        <EmptyState
          icon="shopping_cart"
          title="Compra no encontrada"
          description="Esta compra no existe o fue eliminada."
          action={<Link href="/purchases" className="text-primary hover:underline text-body-sm">Volver a compras</Link>}
        />
      );
    }
    if (error instanceof PurchaseReadForbiddenError || error instanceof PurchaseScopingForbiddenError) {
      return (
        <EmptyState
          icon="block"
          title="No tienes acceso a esta compra"
          description="No tienes permiso para ver esta compra."
          action={<Link href="/purchases" className="text-primary hover:underline text-body-sm">Volver a compras</Link>}
        />
      );
    }
    return (
      <EmptyState
        icon="warning"
        title="Error al cargar la compra"
        description={error.message}
      />
    );
  }

  if (!purchaseDetail) return null;

  const purchase = purchaseDetail;

  return (
    <div className="flex flex-col gap-lg px-gutter py-lg mx-auto w-full max-w-4xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Link href="/purchases" className="text-on-surface-variant hover:text-on-surface" title="Volver a compras">
              ←
            </Link>
            <h1 className="text-headline-sm font-semibold text-on-surface font-mono">{purchase.folioCode}</h1>
            <PurchaseStatusBadge status={purchase.status} />
          </div>
          <p className="text-body-sm text-on-surface-variant pl-9">
            Comprado el {fmtDate(purchase.purchasedAt)}
          </p>
        </div>

        <div className="text-right space-y-1">
          <p className="text-label-sm text-on-surface-variant">Total</p>
          <p className="text-display-sm font-bold tabular-nums text-on-surface">{fmt(purchase.total)}</p>
          {purchase.paymentMethodIsCredit && (
            <p className="text-label-sm text-on-surface-variant">
              Pagado {fmt(purchase.paidAmount)} de {fmt(purchase.total)}
            </p>
          )}
        </div>
      </div>

      <div className="bg-surface-container-low rounded-lg border border-outline-variant overflow-hidden">
        <div className="px-4 py-3 border-b border-outline-variant">
          <h2 className="text-title-sm font-semibold text-on-surface">Productos comprados</h2>
        </div>
        <PurchaseItemsTable items={purchase.items} />
      </div>

      <PurchaseMetaPanel purchase={purchase} />

      <ProviderPaymentsSection
        purchase={purchase}
        canPay={canPay}
        canPayCancel={canPayCancel}
        onChange={refresh}
      />

      <PurchaseActionsBar
        purchase={purchase}
        canCancel={canCancel}
        onCancelClick={() => setShowCancel(true)}
      />

      {showCancel && (
        <CancelPurchaseModal
          purchaseId={purchase.id}
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
