"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSaleDetail } from "../../../_logic/hooks/useSaleDetail";
import { getTicketSettings } from "../../../../settings/_logic/services/getTicketSettings";
import type { TicketSettingsDto } from "../../../../settings/_logic/types/api";
import { getBranchPrinterConfig } from "../../../_logic/services/getBranchPrinterConfig";
import { buildTicketPrintJob } from "../../../_logic/lib/buildTicketPrintJob";
import { resolveTicketConditionsLine } from "../../../_logic/lib/resolveTicketConditionsLine";
import { sendTicketPrintJob } from "../../../_logic/services/sendTicketPrintJob";
import { PrintableTicket } from "../../../_blocks/PrintableTicket";
import { SendTicketEmailModal } from "./SendTicketEmailModal";
import { EmptyState } from "../../../../../_components/molecules/EmptyState/EmptyState";
import { Spinner } from "../../../../../_components/atoms/Spinner/Spinner";
import { Icon } from "../../../../../_components/atoms/Icon/Icon";
import { formatMxCurrency } from "../../../../../_lib/formatMxCurrency";
import { fmtDateTimeLong } from "../../../../../_lib/formatDate";

function fmt(n: number) { return formatMxCurrency(n); }

function fmtDate(d: Date) {
  return fmtDateTimeLong(d);
}

interface TicketPreviewPageProps {
  id: string;
}

export function TicketPreviewPage({ id }: TicketPreviewPageProps) {
  const { sale, isLoading, error } = useSaleDetail(id);
  const [ticketSettings, setTicketSettings] = useState<TicketSettingsDto | null>(null);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [printMode, setPrintMode] = useState<"browser" | "escpos">("browser");
  const [agentUrl, setAgentUrl] = useState<string | null>(null);
  const [printFailed, setPrintFailed] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  useEffect(() => {
    getTicketSettings()
      .then(setTicketSettings)
      .catch(() => setTicketSettings(null));
  }, []);

  useEffect(() => {
    if (!sale) return;
    getBranchPrinterConfig(sale.branchId).then((config) => {
      setPrintMode(config.printMode);
      setAgentUrl(config.agentUrl);
    });
  }, [sale]);

  async function handlePrintEscPos() {
    if (!sale || !agentUrl) return;
    setIsPrinting(true);
    setPrintFailed(false);
    try {
      const job = buildTicketPrintJob(sale, ticketSettings, window.location.origin);
      await sendTicketPrintJob(agentUrl, job);
    } catch {
      setPrintFailed(true);
    } finally {
      setIsPrinting(false);
    }
  }

  function handlePrintBrowser() {
    setPrintFailed(false);
    window.print();
  }

  function handlePrintClick() {
    if (printMode === "escpos" && agentUrl) {
      void handlePrintEscPos();
    } else {
      handlePrintBrowser();
    }
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

  const folioLabel = sale.folioCode;
  const ivaTotal = sale.items.reduce((sum, item) => sum + item.lineIva, 0);
  const iepsTotal = sale.items.reduce((sum, item) => sum + item.lineIeps, 0);

  return (
    <div className="w-full max-w-lg mx-auto space-y-4 px-gutter py-lg">
      <Link
        href={`/sales/${sale.id}`}
        className="inline-flex items-center gap-2 text-on-surface-variant hover:text-on-surface text-body-sm"
      >
        <Icon name="arrow_back" size={20} />
        Volver al detalle
      </Link>

      {/* Ticket card — diseño Stitch "Ticket de Venta - Agrisas" */}
      <div className="bg-surface-container-lowest rounded-md shadow-lg border border-outline-variant overflow-hidden">
        <div
          aria-hidden="true"
          style={{
            backgroundImage:
              "radial-gradient(circle at 10px 10px, transparent 10px, var(--ticket-edge-bg, #f9f9f7) 10px)",
            backgroundSize: "20px 20px",
            backgroundPosition: "-10px -10px",
            backgroundRepeat: "repeat-x",
            height: "10px",
          }}
        />
        <div className="p-6 flex flex-col gap-6">
          {/* Brand header */}
          <div className="flex flex-col items-center text-center border-b border-outline-variant pb-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={ticketSettings?.logoUrl ?? "/logo.png"}
              alt="Logo"
              className="h-[86px] w-[140px] object-contain mb-2"
            />
            {(ticketSettings?.businessName || ticketSettings?.businessRfc || ticketSettings?.businessAddress || ticketSettings?.businessPhone || ticketSettings?.businessTaxRegime) && (
              <div className="text-body-sm text-on-surface-variant whitespace-pre-wrap">
                {ticketSettings.businessName && <p className="font-bold text-on-surface">{ticketSettings.businessName}</p>}
                {ticketSettings.businessRfc && <p>RFC: {ticketSettings.businessRfc}</p>}
                {ticketSettings.businessAddress && <p>{ticketSettings.businessAddress}</p>}
                {ticketSettings.businessPhone && <p>Tel. {ticketSettings.businessPhone}</p>}
                {ticketSettings.businessTaxRegime && <p>{ticketSettings.businessTaxRegime}</p>}
              </div>
            )}
          </div>

          {/* Transaction details */}
          <div className="grid grid-cols-2 gap-2 text-body-sm text-on-surface-variant border-b border-outline-variant pb-4">
            <div>
              <span className="font-bold text-on-surface block">Folio:</span> {folioLabel}
            </div>
            <div className="text-right">
              <span className="font-bold text-on-surface block">Fecha:</span> {fmtDate(sale.createdAt)}
            </div>
            <div className="col-span-2">
              <span className="font-bold text-on-surface">Vendedor:</span> {sale.cashierName ?? sale.cashierId.slice(0, 8)}
            </div>
            <div className="col-span-2">
              <span className="font-bold text-on-surface">Sucursal:</span> {sale.branchName ?? "—"}
            </div>
          </div>

          {/* Cliente */}
          {sale.customerId && (
            <div className="flex flex-col gap-1 text-body-sm text-on-surface-variant border-b border-outline-variant pb-4">
              <span className="font-bold text-on-surface">Cliente</span>
              <div><span className="font-bold text-on-surface">RFC:</span> {sale.customerRfc ?? "—"}</div>
              <div><span className="font-bold text-on-surface">Nombre:</span> {sale.customerName ?? "—"}</div>
              <div><span className="font-bold text-on-surface">Dirección:</span> {sale.customerAddress ?? "—"}</div>
            </div>
          )}

          {/* Condiciones de pago */}
          <div className="flex justify-between text-body-sm text-on-surface-variant border-b border-outline-variant pb-4">
            <span className="font-bold text-on-surface">Condiciones</span>
            <span>{resolveTicketConditionsLine(sale)}</span>
          </div>

          {/* Items */}
          <div className="flex flex-col gap-2 py-2">
            <div className="flex justify-between items-end border-b border-outline-variant pb-1 mb-1 text-label-sm text-on-surface-variant uppercase tracking-wider">
              <span className="w-2/3">Artículo</span>
              <span className="w-1/3 text-right">Total</span>
            </div>
            {sale.items.map((item) => (
              <div key={item.id} className="flex justify-between items-start text-body-sm">
                <div className="w-2/3 flex flex-col">
                  <span className="font-medium text-on-surface">{item.productNameSnapshot}</span>
                  <span className="text-on-surface-variant text-label-sm">
                    {item.quantity} x {fmt(item.unitPrice)}
                  </span>
                </div>
                <div className="w-1/3 text-right font-medium text-on-surface">{fmt(item.lineTotal)}</div>
              </div>
            ))}
          </div>

          {/* Financial summary — IVA e IEPS siempre visibles */}
          <div className="border-t border-outline-variant pt-4 flex flex-col gap-1 text-body-sm">
            <div className="flex justify-between text-on-surface-variant">
              <span>Subtotal</span>
              <span>{fmt(sale.subtotal)}</span>
            </div>
            <div className="flex justify-between text-on-surface-variant">
              <span>IVA</span>
              <span>{fmt(ivaTotal)}</span>
            </div>
            <div className="flex justify-between text-on-surface-variant">
              <span>IEPS</span>
              <span>{fmt(iepsTotal)}</span>
            </div>
            <div className="flex justify-between items-center mt-2 pt-2 border-t border-dashed border-outline-variant text-title-md font-bold text-primary">
              <span>Total a pagar</span>
              <span>{fmt(sale.total)}</span>
            </div>
          </div>

          {/* Payment method & footer */}
          <div className="flex flex-col gap-4 items-center mt-2 text-center border-t border-outline-variant pt-4">
            <div className="text-body-sm text-on-surface-variant flex items-center justify-center bg-surface-container-low px-4 py-2 rounded-sm">
              {sale.paymentMethodName ?? "—"}
            </div>
            {ticketSettings?.footerText && (
              <p className="text-label-lg text-primary bg-primary/10 px-4 py-2 rounded-sm whitespace-pre-wrap">
                {ticketSettings.footerText}
              </p>
            )}
            {ticketSettings?.legendText && (
              <p className="text-body-sm text-on-surface-variant whitespace-pre-wrap">{ticketSettings.legendText}</p>
            )}
            <div className="mt-1">
              <div
                aria-hidden="true"
                className="h-10 w-40 mx-auto"
                style={{
                  backgroundImage:
                    "repeating-linear-gradient(90deg, #000 0 2px, transparent 2px 5px)",
                  opacity: 0.7,
                }}
              />
              <span className="text-label-sm text-on-surface-variant mt-1 block">{folioLabel}</span>
            </div>
          </div>
        </div>
        <div
          aria-hidden="true"
          style={{
            backgroundImage:
              "radial-gradient(circle at 10px 10px, transparent 10px, var(--ticket-edge-bg, #f9f9f7) 10px)",
            backgroundSize: "20px 20px",
            backgroundPosition: "-10px -10px",
            backgroundRepeat: "repeat-x",
            height: "10px",
            transform: "rotate(180deg)",
          }}
        />
      </div>

      {/* Actions */}
      <div className="flex justify-center gap-3">
        <button
          type="button"
          onClick={handlePrintClick}
          disabled={isPrinting}
          className="bg-primary hover:opacity-90 text-on-primary text-label-lg py-2 px-6 rounded-full shadow-sm transition-all flex items-center gap-2 disabled:opacity-60"
        >
          <Icon name="print" size={18} />
          {isPrinting ? "Imprimiendo…" : "Imprimir Ticket"}
        </button>
        <button
          type="button"
          onClick={() => setShowEmailModal(true)}
          className="border border-outline text-primary hover:bg-surface-container-low text-label-lg py-2 px-6 rounded-full transition-all flex items-center gap-2"
        >
          <Icon name="mail" size={18} />
          Enviar por Correo
        </button>
      </div>

      {printFailed && (
        <div className="bg-error-container text-on-error-container rounded-md p-4 flex flex-col items-center gap-3 text-center">
          <p className="text-body-sm">No se pudo conectar con la impresora.</p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => void handlePrintEscPos()}
              className="bg-primary text-on-primary text-label-md py-1.5 px-4 rounded-full"
            >
              Reintentar
            </button>
            <button
              type="button"
              onClick={handlePrintBrowser}
              className="border border-outline text-label-md py-1.5 px-4 rounded-full"
            >
              Imprimir desde el navegador
            </button>
          </div>
        </div>
      )}

      {showEmailModal && (
        <SendTicketEmailModal saleId={sale.id} open={showEmailModal} onClose={() => setShowEmailModal(false)} />
      )}

      <PrintableTicket sale={sale} ticketSettings={ticketSettings} />
    </div>
  );
}
