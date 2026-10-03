"use client";

import { useState } from "react";
import { useCurrentUser } from "../../../_hooks/useCurrentUser";
import { Spinner } from "../../../_components/atoms/Spinner/Spinner";
import { Combobox } from "../../../_components/molecules/Combobox/Combobox";
import { DownloadPdfButton } from "../../../_components/molecules/PdfDownloadButton/PdfDownloadButton";
import { useDebounce } from "../../../_hooks/useDebounce";
import { useCustomerSearch } from "../_logic/hooks/useCustomerSearch";
import { useProductSearch } from "../_logic/hooks/useProductSearch";
import type { PaymentStatus } from "../_logic/types/domain";

interface Option {
  id: string;
  name: string;
}

interface PaymentsHistoryToolbarProps {
  userId: string;
  onUserIdChange: (v: string) => void;
  cashiers: Option[];
  customerId: string;
  onCustomerIdChange: (v: string) => void;
  productId: string;
  onProductIdChange: (v: string) => void;
  paymentMethodId: string;
  onPaymentMethodIdChange: (v: string) => void;
  paymentMethods: Option[];
  status: PaymentStatus | "";
  onStatusChange: (v: PaymentStatus | "") => void;
  from: string;
  onFromChange: (v: string) => void;
  to: string;
  onToChange: (v: string) => void;
  branchId: string;
  onBranchIdChange: (v: string) => void;
  branches: { id: string; name: string }[];
  isExporting: boolean;
  onExportPdf: () => void;
  onExportXlsx: () => void;
  onReset: () => void;
}

export function PaymentsHistoryToolbar({
  userId,
  onUserIdChange,
  cashiers,
  customerId,
  onCustomerIdChange,
  productId,
  onProductIdChange,
  paymentMethodId,
  onPaymentMethodIdChange,
  paymentMethods,
  status,
  onStatusChange,
  from,
  onFromChange,
  to,
  onToChange,
  branchId,
  onBranchIdChange,
  branches,
  isExporting,
  onExportPdf,
  onExportXlsx,
  onReset,
}: PaymentsHistoryToolbarProps) {
  const { can } = useCurrentUser();
  const isBypass = can("branches:access_all");

  const [customerQuery, setCustomerQuery] = useState("");
  const debouncedCustomerQuery = useDebounce(customerQuery, 300);
  const { items: customerResults, isLoading: isLoadingCustomers } = useCustomerSearch({
    search: debouncedCustomerQuery,
    branchId: branchId || undefined,
  });
  const customerOptions = customerResults.map((c) => ({ value: c.id, label: `${c.name} · ${c.rfc}` }));

  const [productQuery, setProductQuery] = useState("");
  const debouncedProductQuery = useDebounce(productQuery, 300);
  const { items: productResults, isLoading: isLoadingProducts } = useProductSearch({ search: debouncedProductQuery });
  const productOptions = productResults.map((p) => ({ value: p.id, label: `${p.name} · ${p.code}` }));

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1">
        <label className="text-label-sm text-on-surface-variant">Cobrador</label>
        <select
          value={userId}
          onChange={(e) => onUserIdChange(e.target.value)}
          className="rounded-md border border-outline bg-surface px-3 py-2 text-body-sm text-on-surface focus:outline-none focus:border-primary w-44"
        >
          <option value="">Todos</option>
          {cashiers.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-label-sm text-on-surface-variant">Cliente</label>
        <div className="w-56">
          <Combobox
            value={customerId}
            onChange={onCustomerIdChange}
            onSearch={setCustomerQuery}
            options={customerOptions}
            isLoading={isLoadingCustomers}
            placeholder="Buscar cliente... (mín. 2)"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-label-sm text-on-surface-variant">Producto</label>
        <div className="w-56">
          <Combobox
            value={productId}
            onChange={onProductIdChange}
            onSearch={setProductQuery}
            options={productOptions}
            isLoading={isLoadingProducts}
            placeholder="Buscar producto..."
          />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-label-sm text-on-surface-variant">Método de pago</label>
        <select
          value={paymentMethodId}
          onChange={(e) => onPaymentMethodIdChange(e.target.value)}
          className="rounded-md border border-outline bg-surface px-3 py-2 text-body-sm text-on-surface focus:outline-none focus:border-primary w-44"
        >
          <option value="">Todos</option>
          {paymentMethods.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-label-sm text-on-surface-variant">Estado</label>
        <select
          value={status}
          onChange={(e) => onStatusChange(e.target.value as PaymentStatus | "")}
          className="rounded-md border border-outline bg-surface px-3 py-2 text-body-sm text-on-surface focus:outline-none focus:border-primary"
        >
          <option value="">Todos</option>
          <option value="completed">Completado</option>
          <option value="cancelled">Cancelado</option>
        </select>
      </div>

      <div className="flex items-end gap-2">
        <div className="flex flex-col gap-1">
          <label className="text-label-sm text-on-surface-variant">Desde</label>
          <input
            type="date"
            value={from}
            onChange={(e) => onFromChange(e.target.value)}
            className="rounded-md border border-outline bg-surface px-3 py-2 text-body-sm text-on-surface focus:outline-none focus:border-primary"
          />
        </div>
        <span className="text-on-surface-variant text-body-sm mb-2">—</span>
        <div className="flex flex-col gap-1">
          <label className="text-label-sm text-on-surface-variant">Hasta</label>
          <input
            type="date"
            value={to}
            onChange={(e) => onToChange(e.target.value)}
            className="rounded-md border border-outline bg-surface px-3 py-2 text-body-sm text-on-surface focus:outline-none focus:border-primary"
          />
        </div>
      </div>

      {(isBypass === true) && (
        <div className="flex flex-col gap-1">
          <label className="text-label-sm text-on-surface-variant">Sucursal</label>
          <select
            value={branchId}
            onChange={(e) => onBranchIdChange(e.target.value)}
            className="rounded-md border border-outline bg-surface px-3 py-2 text-body-sm text-on-surface focus:outline-none focus:border-primary"
          >
            <option value="">Todas</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
      )}

      <div className="flex items-end gap-2">
        <button
          type="button"
          onClick={onReset}
          className="rounded-md border border-outline px-4 py-2 text-body-sm text-on-surface hover:bg-surface-container-low transition-colors"
        >
          Limpiar
        </button>
        <DownloadPdfButton onClick={onExportPdf} loading={isExporting} />
        <button
          type="button"
          onClick={onExportXlsx}
          disabled={isExporting}
          className="rounded-md bg-secondary text-on-secondary px-4 py-2 text-body-sm font-medium hover:bg-secondary/90 transition-colors disabled:opacity-60 flex items-center gap-2"
        >
          {isExporting && <Spinner size="sm" />}
          Exportar Excel
        </button>
      </div>
    </div>
  );
}
