"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCurrentUser } from "../../../_hooks/useCurrentUser";
import { useHeadquarters } from "../../../_hooks/useHeadquarters";
import { useSaleDetail } from "../_logic/hooks/useSaleDetail";
import { useSaleMutations } from "../_logic/hooks/useSaleMutations";
import { getTicketSettings } from "../../settings/_logic/services/getTicketSettings";
import type { TicketSettingsDto } from "../../settings/_logic/types/api";
import { PrintableTicket } from "./PrintableTicket";
import { SaleStatusBadge } from "./SaleStatusBadge";
import { SalePaymentStatusBadge } from "./SalePaymentStatusBadge";
import { SaleItemsTable } from "./SaleItemsTable";
import { CancelSaleModal } from "./CancelSaleModal";
import { FullReturnModal } from "./FullReturnModal";
import { SaleReturnsSection } from "./SaleReturnsSection";
import { SaleWaybillSection } from "./SaleWaybillSection";
import { SalePaymentsSection } from "./SalePaymentsSection";
import { SaleInvoicesSection } from "../../billing/_blocks/SaleInvoicesSection";
import { EmptyState } from "../../../_components/molecules/EmptyState/EmptyState";
import { TaxBreakdownRows } from "../../../_components/molecules/TaxBreakdownRows/TaxBreakdownRows";
import { Spinner } from "../../../_components/atoms/Spinner/Spinner";
import { Icon } from "../../../_components/atoms/Icon/Icon";
import { formatMxCurrency } from "../../../_lib/formatMxCurrency";
import { fmtDateTimeLong } from "../../../_lib/formatDate";

function fmt(n: number) { return formatMxCurrency(n); }

function fmtDate(d: Date) {
  return fmtDateTimeLong(d);
}

// Editar venta oculto en UI a pedido del negocio; ruta/permiso/endpoint siguen activos.
const SALE_EDIT_UI_ENABLED = false;

interface SaleDetailPageProps {
  id: string;
}

export function SaleDetailPage({ id }: SaleDetailPageProps) {
  const { can, branchId: userBranchId } = useCurrentUser();
  const { hq } = useHeadquarters();
  const { sale, isLoading, error, refresh } = useSaleDetail(id);
  const { isSaving, cancel } = useSaleMutations((updated) => {
    refresh();
  });
  const searchParams = useSearchParams();

  const [showCancel, setShowCancel] = useState(false);
  const [showFullReturn, setShowFullReturn] = useState(false);
  const [ticketSettings, setTicketSettings] = useState<TicketSettingsDto | null>(null);
  const [showCreditLimitBanner, setShowCreditLimitBanner] = useState(
    searchParams.get("creditLimitExceeded") === "1"
  );

  useEffect(() => {
    getTicketSettings()
      .then(setTicketSettings)
      .catch(() => setTicketSettings(null)); // degrade gracefully — print still works without logo/header/footer
  }, []);

  const canCancel = can("sales:cancel");
  const canEditCompleted = can("sales:edit_completed");
  const canReturn = can("returns:create");
  const isBypass = can("branches:access_all");

  // Edit guard: must have permission AND (be in HQ branch OR have bypass)
  const isInHq = isBypass === true || (hq !== null && userBranchId === hq.id);
  const canEdit = canEditCompleted === true && isInHq;

  // Derived after sale is loaded — compute inside render after null check
  function hasRemainingItems(s: NonNullable<typeof sale>) {
    return s.items.some((item) => item.quantity > (s.returnedQuantityBySaleItem[item.id] ?? 0));
  }

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error || !sale) {
    return (
      <div>
        <EmptyState
          icon="warning"
          title="No se encontró la venta"
          description={error?.message ?? "La venta no existe o no tienes acceso."}
          action={
            <Link href="/sales" className="text-primary hover:underline text-body-sm">
              Volver a ventas
            </Link>
          }
        />
      </div>
    );
  }

  const folioLabel = sale.folioPrefix
    ? `${sale.folioPrefix}-${sale.folioNumber}`
    : String(sale.folioNumber);

  return (
    <div className="flex flex-col gap-lg px-gutter py-lg mx-auto w-full max-w-4xl">
      {showCreditLimitBanner && (
        <div className="flex items-center justify-between gap-3 rounded-md bg-error/10 text-error px-4 py-2 text-body-sm">
          <span>Se ha excedido el límite de crédito establecido para este cliente.</span>
          <button
            type="button"
            onClick={() => setShowCreditLimitBanner(false)}
            className="text-error hover:opacity-70"
            aria-label="Cerrar aviso"
          >
            <Icon name="close" size={18} />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Link href="/sales" className="text-on-surface-variant hover:text-on-surface">
              <Icon name="arrow_back" size={20} />
            </Link>
            <h1 className="text-headline-sm font-semibold text-on-surface font-mono">
              Folio {folioLabel}
            </h1>
            <SaleStatusBadge status={sale.status} />
            <SalePaymentStatusBadge status={sale.paymentStatus} isCredit={sale.isCredit} />
          </div>
          <p className="text-body-sm text-on-surface-variant pl-9">
            {fmtDate(sale.createdAt)}
          </p>
        </div>

        <div className="flex gap-2">
          <Link
            href={`/sales/${sale.id}/ticket`}
            className="rounded-full border border-outline px-4 py-2 text-body-sm font-medium hover:bg-surface-container transition-colors"
          >
            Ver Ticket
          </Link>
          {canReturn === true && sale.status === "completed" && hasRemainingItems(sale) && (
            <button
              type="button"
              onClick={() => setShowFullReturn(true)}
              className="rounded-full border border-error text-error px-4 py-2 text-body-sm font-medium hover:bg-error/5 transition-colors"
            >
              Devolución Total
            </button>
          )}
          {canCancel === true && sale.status !== "cancelled" && sale.status !== "returned_total" && (
            <button
              type="button"
              onClick={() => setShowCancel(true)}
              className="rounded-full border border-error text-error px-4 py-2 text-body-sm font-medium hover:bg-error/5 transition-colors"
            >
              Cancelar venta
            </button>
          )}
          {SALE_EDIT_UI_ENABLED && canEdit && sale.status !== "cancelled" && sale.status !== "returned_total" && (
            <Link
              href={`/sales/${sale.id}/edit`}
              className="rounded-full bg-tertiary text-on-tertiary px-4 py-2 text-body-sm font-medium hover:bg-tertiary/90 transition-colors"
            >
              Editar venta
            </Link>
          )}
        </div>
      </div>

      {/* Metadata */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 bg-surface-container-low rounded-lg p-4">
        <div>
          <p className="text-label-sm text-on-surface-variant">Cliente</p>
          <p className="text-body-sm text-on-surface">{sale.customerName ?? "—"}</p>
        </div>
        <div>
          <p className="text-label-sm text-on-surface-variant">Sucursal</p>
          <p className="text-body-sm text-on-surface">{sale.branchName ?? "—"}</p>
        </div>
        <div>
          <p className="text-label-sm text-on-surface-variant">Cajero</p>
          <p className="text-body-sm text-on-surface">{sale.cashierName ?? sale.cashierId.slice(0, 8)}</p>
        </div>
        <div>
          <p className="text-label-sm text-on-surface-variant">Método de pago</p>
          <p className="text-body-sm text-on-surface">{sale.paymentMethodName ?? "—"}</p>
        </div>
      </div>

      {/* Items */}
      <div className="bg-surface-container-low rounded-lg border border-outline-variant overflow-hidden">
        <div className="px-4 py-3 border-b border-outline-variant">
          <h2 className="text-title-sm font-semibold text-on-surface">Artículos</h2>
        </div>
        <SaleItemsTable
          items={sale.items}
          returnedQuantityBySaleItem={sale.returnedQuantityBySaleItem}
        />
      </div>

      {/* Returns section */}
      <SaleReturnsSection
        saleId={sale.id}
        saleStatus={sale.status}
        saleItems={sale.items}
        returnedQuantityBySaleItem={sale.returnedQuantityBySaleItem}
      />

      {/* Invoices section */}
      <SaleInvoicesSection
        saleId={sale.id}
        saleStatus={sale.status}
        saleFolioLabel={folioLabel}
      />

      {/* Waybill (Carta Porte) section */}
      <SaleWaybillSection
        saleId={sale.id}
        saleStatus={sale.status}
        customerId={sale.customerId}
      />

      {/* Payments section — only for credit sales */}
      {sale.isCredit && (
        <SalePaymentsSection
          saleId={sale.id}
          sale={sale}
          onPaymentMutated={refresh}
        />
      )}

      {/* Totals */}
      <div className="flex justify-end">
        <div className="space-y-2 min-w-[240px]" data-testid="sale-totals">
          <div className="flex justify-between text-body-sm">
            <span className="text-on-surface-variant">Subtotal</span>
            <span className="tabular-nums">{fmt(sale.subtotal)}</span>
          </div>
          <TaxBreakdownRows
            ivaTotal={sale.items.reduce((s, i) => s + i.lineIva, 0)}
            iepsTotal={sale.items.reduce((s, i) => s + i.lineIeps, 0)}
            format={fmt}
            variant="sale"
          />
          <div className="flex justify-between text-title-sm font-semibold border-t border-outline-variant pt-2">
            <span>Total</span>
            <span className="tabular-nums">{fmt(sale.total)}</span>
          </div>
        </div>
      </div>

      {/* Cancellation / edit info */}
      {sale.status === "cancelled" && (
        <div className="bg-error-container text-on-error-container rounded-md p-4 text-body-sm">
          <p className="font-medium mb-1">Venta cancelada el {fmtDate(sale.cancelledAt!)}</p>
          {sale.cancellationReason && (
            <p>Motivo: {sale.cancellationReason}</p>
          )}
        </div>
      )}

      {showCancel && (
        <CancelSaleModal
          sale={sale}
          isSaving={isSaving}
          onConfirm={async (reason) => {
            await cancel(sale.id, reason);
            setShowCancel(false);
          }}
          onClose={() => setShowCancel(false)}
        />
      )}

      {showFullReturn && (
        <FullReturnModal
          saleId={sale.id}
          onSuccess={() => {
            setShowFullReturn(false);
            refresh();
          }}
          onClose={() => setShowFullReturn(false)}
        />
      )}

      <PrintableTicket sale={sale} ticketSettings={ticketSettings} />
    </div>
  );
}
