"use client";

import { RefObject } from "react";
import { Spinner } from "../../../_components/atoms/Spinner/Spinner";
import { CartLinesList } from "./CartLinesList";
import { CartTotals } from "./CartTotals";
import { CustomerPicker } from "./CustomerPicker";
import { canSubmitCart } from "../_logic/lib/canSubmitCart";
import type { CartLine, CartTotals as CartTotalsType } from "../_logic/types/domain";
import type { FolioOption, PaymentMethodOption, CustomerDto, ProductPriceDto } from "../_logic/types/api";

type PosMode = "sale" | "quote";

const tomorrow = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0];
};
const maxDate = () => {
  const d = new Date();
  d.setDate(d.getDate() + 180);
  return d.toISOString().split("T")[0];
};

interface CartPanelProps {
  lines: CartLine[];
  totals: CartTotalsType;
  folios: FolioOption[];
  paymentMethods: PaymentMethodOption[];
  selectedBranchId: string;
  selectedFolioId: string;
  selectedPaymentMethodId: string;
  selectedCustomerId: string;
  notes: string;
  isLoadingOptions: boolean;
  isSubmitting: boolean;
  canCreate: boolean | "loading";
  isOnline: boolean;
  offlineEnabled: boolean;
  ownerBranchId: string | null;
  mode?: PosMode;
  expiresAt?: string;
  onFolioChange: (id: string) => void;
  onPaymentMethodChange: (id: string) => void;
  onCustomerChange: (id: string, customer: CustomerDto | null) => void;
  onNotesChange: (notes: string) => void;
  onExpiresAtChange?: (v: string) => void;
  onOpenQuickAdd: () => void;
  onUpdateQuantity: (id: string, qty: number) => void;
  onUpdateDiscount: (id: string, pct: number) => void;
  onChangeTier: (id: string) => void;
  onRemoveLine: (id: string) => void;
  onSubmit: () => void;
  containerRef?: RefObject<HTMLDivElement>;
}

export function CartPanel({
  lines,
  totals,
  folios,
  paymentMethods,
  selectedBranchId,
  selectedFolioId,
  selectedPaymentMethodId,
  selectedCustomerId,
  notes,
  isLoadingOptions,
  isSubmitting,
  canCreate,
  isOnline,
  offlineEnabled,
  ownerBranchId,
  mode = "sale",
  expiresAt = "",
  onFolioChange,
  onPaymentMethodChange,
  onCustomerChange,
  onNotesChange,
  onExpiresAtChange,
  onOpenQuickAdd,
  onUpdateQuantity,
  onUpdateDiscount,
  onChangeTier,
  onRemoveLine,
  onSubmit,
  containerRef,
}: CartPanelProps) {
  const isQuoteMode = mode === "quote";

  const canSubmit = canSubmitCart({
    canCreate,
    linesCount: lines.length,
    selectedBranchId,
    selectedFolioId,
    selectedPaymentMethodId,
    isQuoteMode,
    isSubmitting,
    isOnline,
    offlineEnabled,
    ownerBranchId,
  });

  return (
    <div ref={containerRef} className="flex flex-col h-full" tabIndex={-1}>
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        <CustomerPicker
          value={selectedCustomerId}
          onChange={onCustomerChange}
          onOpenQuickAdd={onOpenQuickAdd}
          branchId={selectedBranchId}
        />

        <div>
          <label className="text-label-sm text-on-surface-variant mb-1 block">Folio *</label>
          {isLoadingOptions ? (
            <Spinner size="sm" />
          ) : (
            <select
              value={selectedFolioId}
              onChange={(e) => onFolioChange(e.target.value)}
              className="w-full rounded border border-outline px-3 py-2 text-body-sm bg-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            >
              <option value="">— Selecciona folio —</option>
              {folios.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nextFolioCode ?? `${f.prefix ?? ""}${String(f.currentNumber + 1).padStart(6, "0")}`} ({f.name})
                </option>
              ))}
            </select>
          )}
        </div>

        {!isQuoteMode && (
          <div>
            <label className="text-label-sm text-on-surface-variant mb-1 block">Método de pago *</label>
            {isLoadingOptions ? (
              <Spinner size="sm" />
            ) : (
              <select
                value={selectedPaymentMethodId}
                onChange={(e) => onPaymentMethodChange(e.target.value)}
                className="w-full rounded border border-outline px-3 py-2 text-body-sm bg-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              >
                <option value="">— Selecciona método de pago —</option>
                {paymentMethods.map((pm) => (
                  <option key={pm.id} value={pm.id}>{pm.name}</option>
                ))}
              </select>
            )}
          </div>
        )}

        {isQuoteMode && (
          <div>
            <label className="text-label-sm text-on-surface-variant mb-1 block">
              Vencimiento <span className="text-on-surface-variant/60">(opcional)</span>
            </label>
            <input
              type="date"
              value={expiresAt}
              min={tomorrow()}
              max={maxDate()}
              onChange={(e) => onExpiresAtChange?.(e.target.value)}
              className="w-full rounded border border-outline px-3 py-2 text-body-sm bg-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>
        )}

        <div>
          <label className="text-label-sm text-on-surface-variant mb-1 block">Notas</label>
          <textarea
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
            maxLength={1000}
            rows={2}
            placeholder={isQuoteMode ? "Notas opcionales de la cotización..." : "Notas opcionales de la venta..."}
            className="w-full rounded border border-outline px-3 py-2 text-body-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary resize-none"
          />
        </div>

        <div>
          <h3 className="text-label-sm font-medium text-on-surface-variant mb-2">
            Carrito ({lines.length} {lines.length === 1 ? "artículo" : "artículos"})
          </h3>
          <CartLinesList
            lines={lines}
            onUpdateQuantity={onUpdateQuantity}
            onUpdateDiscount={onUpdateDiscount}
            onChangeTier={onChangeTier}
            onRemove={onRemoveLine}
          />
        </div>
      </div>

      <div className="border-t border-outline-variant px-4 py-4 space-y-3 bg-surface">
        <CartTotals totals={totals} />
        <button
          type="button"
          onClick={onSubmit}
          disabled={!canSubmit}
          aria-keyshortcuts="Control+Enter"
          className={[
            "w-full rounded-full py-3 text-body-md font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2",
            isQuoteMode
              ? "bg-secondary-container text-on-secondary-container hover:bg-secondary-container/80"
              : "bg-primary text-on-primary hover:bg-primary/90",
          ].join(" ")}
        >
          {isSubmitting && <Spinner size="sm" />}
          {isQuoteMode ? "Crear cotización" : "Finalizar venta"}
        </button>
      </div>
    </div>
  );
}
