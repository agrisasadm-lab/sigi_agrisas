"use client";

import { Spinner } from "../../../_components/atoms/Spinner/Spinner";
import { CartLinesList } from "../../pos/_blocks/CartLinesList";
import { CartTotals } from "../../pos/_blocks/CartTotals";
import { CustomerPicker } from "../../pos/_blocks/CustomerPicker";
import type { CartLine, CartTotals as CartTotalsType } from "../../pos/_logic/types/domain";
import type { FolioOption } from "../../../_hooks/useFoliosOptions";
import type { CustomerDto } from "../../pos/_logic/types/api";

interface BranchOption {
  id: string;
  name: string;
}

interface QuoteEmitPanelProps {
  mode: "create" | "edit";
  lines: CartLine[];
  totals: CartTotalsType;
  folios: FolioOption[];
  branches: BranchOption[];
  selectedFolioId: string;
  selectedBranchId: string;
  selectedCustomerId: string;
  expiresAt: string;
  notes: string;
  isLoadingOptions: boolean;
  isSubmitting: boolean;
  canSubmitCreate: boolean | "loading";
  offlineBlocked?: boolean;
  onFolioChange: (id: string) => void;
  onBranchChange: (id: string) => void;
  onCustomerChange: (id: string, customer: CustomerDto | null) => void;
  onExpiresAtChange: (v: string) => void;
  onNotesChange: (notes: string) => void;
  onOpenQuickAdd: () => void;
  onUpdateQuantity: (id: string, qty: number) => void;
  onUpdateDiscount: (id: string, pct: number) => void;
  onUpdateDiscountAmount: (id: string, amount: number) => void;
  onChangeTier: (id: string) => void;
  onRemoveLine: (id: string) => void;
  onSubmit: () => void;
}

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

export function QuoteEmitPanel({
  mode,
  lines,
  totals,
  folios,
  branches,
  selectedFolioId,
  selectedBranchId,
  selectedCustomerId,
  expiresAt,
  notes,
  isLoadingOptions,
  isSubmitting,
  canSubmitCreate,
  offlineBlocked = false,
  onFolioChange,
  onBranchChange,
  onCustomerChange,
  onExpiresAtChange,
  onNotesChange,
  onOpenQuickAdd,
  onUpdateQuantity,
  onUpdateDiscount,
  onUpdateDiscountAmount,
  onChangeTier,
  onRemoveLine,
  onSubmit,
}: QuoteEmitPanelProps) {
  const isEdit = mode === "edit";
  const canSubmit =
    canSubmitCreate === true &&
    lines.length > 0 &&
    !!selectedFolioId &&
    !!selectedBranchId &&
    !isSubmitting &&
    !offlineBlocked;

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        <div>
          <label className="text-label-sm text-on-surface-variant mb-1 block">Sucursal *</label>
          {isLoadingOptions ? (
            <Spinner size="sm" />
          ) : (
            <select
              value={selectedBranchId}
              onChange={(e) => onBranchChange(e.target.value)}
              disabled={isEdit}
              className="w-full rounded border border-outline px-3 py-2 text-body-sm bg-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <option value="">— Selecciona sucursal —</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          )}
        </div>

        <div>
          <label className="text-label-sm text-on-surface-variant mb-1 block">Folio *</label>
          {isLoadingOptions ? (
            <Spinner size="sm" />
          ) : (
            <select
              value={selectedFolioId}
              onChange={(e) => onFolioChange(e.target.value)}
              disabled={isEdit}
              className="w-full rounded border border-outline px-3 py-2 text-body-sm bg-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <option value="">— Selecciona folio —</option>
              {folios.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nextFolioCode ?? `${f.prefix ? `${f.prefix}-` : ""}${f.currentNumber + 1}`} ({f.name})
                </option>
              ))}
            </select>
          )}
        </div>

        <CustomerPicker
          value={selectedCustomerId}
          onChange={onCustomerChange}
          onOpenQuickAdd={onOpenQuickAdd}
          branchId={selectedBranchId}
        />

        <div>
          <label className="text-label-sm text-on-surface-variant mb-1 block">
            Vencimiento <span className="text-on-surface-variant/60">(opcional)</span>
          </label>
          <input
            type="date"
            value={expiresAt}
            min={tomorrow()}
            max={maxDate()}
            onChange={(e) => onExpiresAtChange(e.target.value)}
            className="w-full rounded border border-outline px-3 py-2 text-body-sm bg-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          />
        </div>

        <div>
          <label className="text-label-sm text-on-surface-variant mb-1 block">Notas</label>
          <textarea
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
            maxLength={1000}
            rows={2}
            placeholder="Notas opcionales de la cotización..."
            className="w-full rounded border border-outline px-3 py-2 text-body-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary resize-none"
          />
        </div>

        <div>
          <h3 className="text-label-sm font-medium text-on-surface-variant mb-2">
            Artículos ({lines.length} {lines.length === 1 ? "artículo" : "artículos"})
          </h3>
          <CartLinesList
            lines={lines}
            onUpdateQuantity={onUpdateQuantity}
            onUpdateDiscount={onUpdateDiscount}
            onUpdateDiscountAmount={onUpdateDiscountAmount}
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
          className="w-full rounded-full bg-secondary-container py-3 text-body-md font-semibold text-on-secondary-container hover:bg-secondary-container/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isSubmitting && <Spinner size="sm" />}
          {isEdit ? "Guardar cambios" : "Crear cotización"}
        </button>
      </div>
    </div>
  );
}
