"use client";

import { useState } from "react";
import { Icon } from "../../../_components/atoms/Icon/Icon";
import { useCurrentUser } from "../../../_hooks/useCurrentUser";
import { useDebounce } from "../../../_hooks/useDebounce";
import { usePaymentMethodsOptions } from "../../../_hooks/usePaymentMethodsOptions";
import { useBranchesOptions } from "../../../_hooks/useBranchesOptions";
import { useProductSearch } from "../_logic/hooks/useProductSearch";
import { useCreatePurchaseForm } from "../_logic/hooks/useCreatePurchaseForm";
import { buildSatApplyResult } from "../_logic/lib/satInvoiceMapping";
import type { ParsedSatInvoice } from "../_logic/lib/satXmlParser";
import { ProviderPicker } from "./ProviderPicker";
import { ProviderQuickAddModal } from "./ProviderQuickAddModal";
import { PurchaseLineRow } from "./PurchaseLineRow";
import { SatInvoiceUploader } from "./SatInvoiceUploader";
import { Combobox } from "../../../_components/molecules/Combobox/Combobox";
import { Spinner } from "../../../_components/atoms/Spinner/Spinner";
import { EmptyState } from "../../../_components/molecules/EmptyState/EmptyState";
import {
  ProviderNotFoundOrInactiveError,
  ProductNotFoundOrInactiveError,
  PurchaseItemsEmptyError,
  SatUuidAlreadyExistsError,
  PurchaseValidationError,
} from "../_logic/errors";

const MX = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 2 });
function fmt(n: number) { return MX.format(n); }
function toDateInput(iso: string): string { return iso.slice(0, 10); }

export function CreatePurchasePage() {
  const { can, branchId: userBranchId } = useCurrentUser();
  const canCreate = can("purchases:create");
  const isBypass = can("branches:access_all");

  const { options: branches } = useBranchesOptions();
  const { options: paymentMethods, isLoading: pmLoading } = usePaymentMethodsOptions();

  const [selectedBranchId, setSelectedBranchId] = useState("");
  const branchId = isBypass === true ? selectedBranchId : (userBranchId ?? "");

  const isCreditByPaymentMethod = (id: string) => paymentMethods.find((pm) => pm.id === id)?.isCredit ?? false;

  const form = useCreatePurchaseForm(branchId, isCreditByPaymentMethod);
  const [showProviderQuickAdd, setShowProviderQuickAdd] = useState(false);

  const [productQuery, setProductQuery] = useState("");
  const debouncedProductQuery = useDebounce(productQuery, 300);
  const { items: productOptions, isLoading: isLoadingProducts } = useProductSearch({ search: debouncedProductQuery, branchId: branchId || undefined });
  const productComboOptions = productOptions.map((p) => ({ value: p.id, label: `${p.code} · ${p.name}` }));

  const [satApplying, setSatApplying] = useState(false);
  const [satWarnings, setSatWarnings] = useState<string[]>([]);
  const [satUnmatched, setSatUnmatched] = useState<ParsedSatInvoice["conceptos"]>([]);
  const [satApplied, setSatApplied] = useState(false);
  const [satError, setSatError] = useState<string | null>(null);

  async function handleSatParsed(parsed: ParsedSatInvoice, fileName: string) {
    setSatApplying(true);
    setSatError(null);
    setSatWarnings([]);
    setSatUnmatched([]);
    setSatApplied(false);
    try {
      const result = await buildSatApplyResult(parsed, paymentMethods, fileName);
      form.applySatResult(result);
      setSatWarnings(result.warnings);
      setSatUnmatched(result.unmatched);
      if (result.warnings.length === 0 && result.unmatched.length === 0) setSatApplied(true);
    } catch {
      setSatError("No se pudo procesar la factura. Revisa tu conexión e inténtalo de nuevo.");
    } finally {
      setSatApplying(false);
    }
  }

  function handleAddProduct(productId: string) {
    const product = productOptions.find((p) => p.id === productId);
    if (product) form.addLine(product);
  }

  if (canCreate === "loading") {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (canCreate === false) {
    return (
      <EmptyState
        icon="block"
        title="Sin acceso"
        description="No tienes permiso para registrar compras."
      />
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-headline-lg font-semibold text-on-surface">Nueva compra</h1>
        <p className="text-body-md text-on-surface-variant mt-1">Registra una compra a un proveedor</p>
      </div>

      <SatInvoiceUploader onParsed={handleSatParsed} disabled={satApplying || pmLoading} />

      {satApplying && (
        <div className="flex items-center gap-2 rounded-md border border-outline-variant bg-surface-container-low px-4 py-3">
          <Spinner size="sm" />
          <span className="text-body-sm text-on-surface-variant">Buscando productos que coincidan con la factura...</span>
        </div>
      )}

      {satError && (
        <p className="rounded-md border border-error/30 bg-error-container/40 px-4 py-3 text-body-sm text-on-error-container">{satError}</p>
      )}

      {form.satMetadata.xmlFileName && (
        <div className="rounded-md border border-outline-variant bg-surface-container-low p-4 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Icon name="verified" className="text-primary shrink-0" />
              <span className="text-body-sm font-medium text-on-surface truncate">Factura {form.satMetadata.xmlFileName}</span>
            </div>
            <button
              type="button"
              onClick={() => {
                form.clearSat();
                setSatWarnings([]);
                setSatUnmatched([]);
                setSatApplied(false);
              }}
              className="text-label-sm text-primary hover:underline shrink-0"
            >
              Quitar
            </button>
          </div>
          {form.satMetadata.satUuid && (
            <p className="text-label-sm text-on-surface-variant">UUID: {form.satMetadata.satUuid}</p>
          )}
          {form.satMetadata.supplierInvoiceNumber && (
            <p className="text-label-sm text-on-surface-variant">Folio fiscal: {form.satMetadata.supplierInvoiceNumber}</p>
          )}
          {satApplied && (
            <p className="text-label-sm text-tertiary">Factura aplicada: proveedor y productos prellenados. Revisa cantidades y costos.</p>
          )}
        </div>
      )}

      {satWarnings.length > 0 && (
        <div className="rounded-md border border-warning/40 bg-warning-container/40 p-4 space-y-1">
          <p className="text-label-sm font-medium text-on-surface">Avisos de la factura</p>
          {satWarnings.map((w, i) => (
            <p key={i} className="text-body-sm text-on-surface-variant">• {w}</p>
          ))}
        </div>
      )}

      {satUnmatched.length > 0 && (
        <div className="rounded-md border border-outline-variant bg-surface-container-low p-4 space-y-1">
          <p className="text-label-sm font-medium text-on-surface">
            {satUnmatched.length} concepto{satUnmatched.length > 1 ? "s" : ""} sin producto equivalente
          </p>
          {satUnmatched.map((c, i) => (
            <p key={i} className="text-body-sm text-on-surface-variant">
              • {c.descripcion || c.claveProdServ} ({c.cantidad} × {fmt(c.valorUnitario)})
            </p>
          ))}
          <p className="text-label-sm text-on-surface-variant mt-1">Agrégalos manualmente con el buscador de productos.</p>
        </div>
      )}

      <div className="bg-surface-container-low rounded-lg border border-outline-variant p-4 space-y-4">
        <ProviderPicker
          value={form.providerId}
          onChange={form.setProvider}
          onOpenQuickAdd={() => setShowProviderQuickAdd(true)}
        />

        {form.newProvider && (
          <p className="rounded border border-primary/30 bg-primary-container/30 px-3 py-2 text-body-sm text-on-primary-container">
            Proveedor de la factura: <span className="font-medium">{form.newProvider.name}</span> (RFC {form.newProvider.rfc}). Se creará al registrar la compra.
          </p>
        )}

        {isBypass === true && (
          <div>
            <label className="text-label-sm text-on-surface-variant mb-1 block">Sucursal</label>
            <select
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              className="w-full rounded border border-outline px-3 py-2 text-body-sm bg-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            >
              <option value="">Selecciona una sucursal</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="text-label-sm text-on-surface-variant mb-1 block">Forma de pago</label>
          <select
            value={form.paymentMethodId}
            onChange={(e) => form.setPaymentMethodId(e.target.value)}
            disabled={pmLoading}
            className="w-full rounded border border-outline px-3 py-2 text-body-sm bg-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          >
            <option value="">Selecciona una forma de pago</option>
            {paymentMethods.map((pm) => (
              <option key={pm.id} value={pm.id}>{pm.name}{pm.isCredit ? " (crédito)" : ""}</option>
            ))}
          </select>
          {form.isCredit && (
            <p className="mt-1 text-label-sm text-tertiary">
              Compra a crédito: quedará pendiente de pago; podrás registrar abonos desde el detalle.
            </p>
          )}
        </div>

        <div>
          <label className="text-label-sm text-on-surface-variant mb-1 block">Fecha de compra</label>
          <input
            type="date"
            value={form.satMetadata.purchasedAt ? toDateInput(form.satMetadata.purchasedAt) : ""}
            onChange={(e) => {
              if (e.target.value) {
                form.setSatMetadata({ purchasedAt: new Date(`${e.target.value}T00:00:00`).toISOString() });
              }
            }}
            className="w-full rounded border border-outline px-3 py-2 text-body-sm bg-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          />
          <p className="mt-1 text-label-sm text-on-surface-variant">
            {form.satMetadata.invoiceDate ? "La fecha de la factura se usó como fecha por defecto; puedes cambiarla." : "Si no la indicas, se usa hoy."}
          </p>
        </div>
      </div>

      <div className="bg-surface-container-low rounded-lg border border-outline-variant p-4 space-y-3">
        <label className="text-label-sm text-on-surface-variant mb-1 block">Agregar producto</label>
        {branchId ? (
          <Combobox
            value=""
            onChange={handleAddProduct}
            onSearch={setProductQuery}
            options={productComboOptions}
            isLoading={isLoadingProducts}
            placeholder="Buscar por código o nombre..."
          />
        ) : (
          <>
            <Combobox
              value=""
              onChange={() => {}}
              onSearch={() => {}}
              options={[]}
              disabled
              placeholder="Selecciona una sucursal para buscar productos"
            />
            <p className="text-label-sm text-on-surface-variant">Selecciona una sucursal para buscar productos.</p>
          </>
        )}

        {form.lines.length === 0 ? (
          <p className="py-6 text-center text-body-sm text-on-surface-variant">
            Aún no hay productos agregados
          </p>
        ) : (
          <div>
            {form.lines.map((line) => (
              <PurchaseLineRow
                key={line.id}
                line={line}
                onUpdateQuantity={form.updateQuantity}
                onUpdateUnitCost={form.updateUnitCost}
                onUpdateDiscount={form.updateDiscount}
                onUpdateLot={form.updateLot}
                onUpdateExpiration={form.updateExpiration}
                onUpdateManufactureDate={form.updateManufactureDate}
                onRemove={form.removeLine}
              />
            ))}
          </div>
        )}
      </div>

      <div className="bg-surface-container-low rounded-lg border border-outline-variant p-4 space-y-4">
        <div>
          <label className="text-label-sm text-on-surface-variant mb-1 block">Notas (opcional)</label>
          <textarea
            value={form.notes}
            onChange={(e) => form.setNotes(e.target.value.slice(0, 1000))}
            rows={2}
            maxLength={1000}
            className="w-full rounded border border-outline px-3 py-2 text-body-sm bg-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary resize-none"
          />
        </div>

        <div className="space-y-1 border-t border-outline-variant pt-3">
          <div className="flex justify-between text-body-sm text-on-surface-variant">
            <span>Subtotal</span>
            <span className="tabular-nums">{fmt(form.totals.subtotal)}</span>
          </div>
          {form.totals.ivaTotal > 0 && (
            <div className="flex justify-between text-body-sm text-on-surface-variant">
              <span>IVA</span>
              <span className="tabular-nums">{fmt(form.totals.ivaTotal)}</span>
            </div>
          )}
          {form.totals.iepsTotal > 0 && (
            <div className="flex justify-between text-body-sm text-on-surface-variant">
              <span>IEPS</span>
              <span className="tabular-nums">{fmt(form.totals.iepsTotal)}</span>
            </div>
          )}
          <div className="flex justify-between text-body-md font-semibold text-on-surface border-t border-outline-variant pt-2 mt-2">
            <span>Total</span>
            <span className="tabular-nums">{fmt(form.totals.total)}</span>
          </div>
        </div>

        {form.submitError && (
          <p className="text-body-sm text-error">
            {form.submitError instanceof ProviderNotFoundOrInactiveError && "El proveedor seleccionado no existe o está inactivo."}
            {form.submitError instanceof ProductNotFoundOrInactiveError && "Uno de los productos agregados no existe o está inactivo."}
            {form.submitError instanceof PurchaseItemsEmptyError && "Agrega al menos un producto."}
            {form.submitError instanceof SatUuidAlreadyExistsError && form.submitError.message}
            {form.submitError instanceof PurchaseValidationError && form.submitError.message}
            {!(form.submitError instanceof ProviderNotFoundOrInactiveError) &&
              !(form.submitError instanceof ProductNotFoundOrInactiveError) &&
              !(form.submitError instanceof PurchaseItemsEmptyError) &&
              !(form.submitError instanceof SatUuidAlreadyExistsError) &&
              !(form.submitError instanceof PurchaseValidationError) &&
              "Error al registrar la compra. Inténtalo de nuevo."}
          </p>
        )}

        <button
          type="button"
          onClick={() => form.submit()}
          disabled={!form.canSubmit}
          className="w-full rounded-full bg-primary py-3 text-body-md font-medium text-on-primary hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {form.isSubmitting && <Spinner size="sm" />}
          Registrar compra
        </button>
      </div>

      {showProviderQuickAdd && (
        <ProviderQuickAddModal
          onCreated={(provider) => {
            form.setProvider(provider.id, provider);
            setShowProviderQuickAdd(false);
          }}
          onClose={() => setShowProviderQuickAdd(false)}
        />
      )}
    </div>
  );
}
