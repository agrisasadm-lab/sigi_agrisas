"use client";

import { useMemo, useState } from "react";
import { CustomerPicker } from "../../pos/_blocks/CustomerPicker";
import { CustomerQuickAddModal } from "../../pos/_blocks/CustomerQuickAddModal";
import { ProductCatalogPanel } from "../../pos/_blocks/ProductCatalogPanel";
import { PriceTierPicker } from "../../pos/_blocks/PriceTierPicker";
import { getProductPrices } from "../../pos/_logic/services/getProductPrices";
import { PartialInvoiceLineRow } from "./PartialInvoiceLineRow";
import { InvoicePreviewModal } from "./InvoicePreviewModal";
import { usePartialInvoiceForm } from "../_logic/hooks/usePartialInvoiceForm";
import { useEmitterFiscalSettings } from "../_logic/hooks/useEmitterFiscalSettings";
import { buildInvoicePreview } from "../_logic/lib/buildInvoicePreview";
import { ReceiverFiscalDataIncompleteError, FacturamaStampError } from "../_logic/errors";
import { Button } from "../../../_components/atoms/Button/Button";
import { IconButton } from "../../../_components/atoms/IconButton/IconButton";
import { Select } from "../../../_components/atoms/Select/Select";
import { Table, THead, TBody, Tr, Th } from "../../../_components/molecules/DataTable/DataTable";
import { SAT_PAYMENT_FORMS, SAT_PAYMENT_METHODS } from "@/shared/domain/catalogs/satPaymentCatalogs";
import type { CustomerDto } from "../../pos/_logic/types/api";
import type { ProductDto, ProductPriceDto } from "../../pos/_logic/types/api";
import { formatMxCurrency } from "../../../_lib/formatMxCurrency";

interface PricePickerState {
  product: ProductDto;
  prices: ProductPriceDto[];
  isLoading: boolean;
  lineKey: string;
}

const PAYMENT_FORMS = SAT_PAYMENT_FORMS.map((e) => ({ value: e.code, label: `${e.code} - ${e.description}` }));
const PAYMENT_METHODS = SAT_PAYMENT_METHODS.map((e) => ({ value: e.code, label: `${e.code} - ${e.description}` }));

interface PartialInvoiceFormProps {
  branchId?: string | null;
}

export function PartialInvoiceForm({ branchId }: PartialInvoiceFormProps) {
  const effectiveBranchId = branchId ?? null;

  const {
    customer, setCustomer, fiscalMissingFields,
    lines, addLine, updateLine, removeLine,
    paymentForm, setPaymentForm, paymentMethod, setPaymentMethod,
    totals, isSubmitting, error, clearError, submit,
  } = usePartialInvoiceForm();

  const [customerId, setCustomerId] = useState("");
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [showCatalog, setShowCatalog] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [pricePicker, setPricePicker] = useState<PricePickerState | null>(null);

  const canPreview = lines.length > 0 && !!customer && fiscalMissingFields.length === 0;
  const emitterFiscal = useEmitterFiscalSettings();

  const previewData = useMemo(() => {
    if (!customer) return null;
    return buildInvoicePreview({
      issuer: { name: emitterFiscal.legalName, ...emitterFiscal },
      receiver: customer,
      lines: lines.map((l) => ({
        description: l.description,
        productCode: l.productCode,
        satProductCode: l.satProductCode || null,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        discountPct: l.discountPct,
        ivaRate: l.ivaRate,
        iepsRate: l.iepsRate,
      })),
      paymentForm,
      paymentMethod,
    });
  }, [customer, lines, paymentForm, paymentMethod, emitterFiscal]);

  async function handleConfirmStamp() {
    setShowPreview(false);
    await submit(effectiveBranchId);
  }

  function handleCustomerSelect(id: string, dto: CustomerDto | null) {
    setCustomerId(id);
    if (!dto || !id) { setCustomer(null); return; }
    setCustomer({
      rfc: dto.rfc ?? "",
      name: dto.name,
      cfdiUse: dto.cfdiUse ?? "",
      fiscalRegime: dto.taxRegime ?? "",
      taxZipCode: dto.taxZipCode ?? "",
    });
  }

  async function handleAddProduct(product: ProductDto) {
    const prices = await getProductPrices(product.id, effectiveBranchId);
    const defaultPrice = prices.find((p) => p.isDefault) ?? prices[0] ?? null;
    addLine({
      productId: product.id,
      productCode: product.code,
      description: product.name,
      satProductCode: product.satProductCode ?? "",
      satUnitCode: "",
      unit: "H87",
      quantity: 1,
      unitPrice: defaultPrice?.price ?? 0,
      priceId: defaultPrice?.id ?? null,
      priceName: defaultPrice?.name ?? null,
      discountPct: 0,
      ivaRate: product.ivaRate ?? 0.16,
      iepsRate: product.iepsRate ?? 0,
    });
    setShowCatalog(false);
  }

  function handleChangeTier(lineKey: string) {
    const line = lines.find((l) => l._key === lineKey);
    if (!line || !line.productId) return;
    const fakeProduct: ProductDto = {
      id: line.productId,
      code: line.productCode,
      name: line.description,
      ivaRate: line.ivaRate,
      iepsRate: line.iepsRate,
      isActive: true,
      departmentId: "",
      createdAt: new Date(),
      updatedAt: new Date(),
      stock: null,
    };
    setPricePicker({ product: fakeProduct, prices: [], isLoading: true, lineKey });
    getProductPrices(line.productId, effectiveBranchId).then((prices) => {
      setPricePicker((prev) => (prev ? { ...prev, prices, isLoading: false } : null));
    });
  }

  function handlePriceConfirm(price: ProductPriceDto) {
    if (!pricePicker) return;
    updateLine(pricePicker.lineKey, { unitPrice: price.price, priceId: price.id, priceName: price.name });
    setPricePicker(null);
  }

  function handleAddFreeLine() {
    addLine({
      productId: null,
      productCode: `LIB-${Date.now()}`,
      description: "",
      satProductCode: "",
      satUnitCode: "",
      unit: "H87",
      quantity: 1,
      unitPrice: 0,
      discountPct: 0,
      ivaRate: 0.16,
      iepsRate: 0,
    });
  }

  function renderError() {
    if (!error) return null;
    const msg = error instanceof ReceiverFiscalDataIncompleteError
      ? `Datos fiscales incompletos: ${error.missingFields.join(", ")}`
      : error instanceof FacturamaStampError
      ? `Error Facturama: ${error.detail}`
      : error.message;
    return (
      <div className="rounded bg-error-container/30 border border-error/30 px-4 py-3 text-body-sm text-error flex items-start justify-between gap-2">
        <span>{msg}</span>
        <IconButton icon="close" iconSize={16} ariaLabel="Cerrar" onClick={clearError} className="flex-shrink-0 hover:bg-transparent hover:opacity-70" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Nota importante */}
      <div className="rounded-md bg-tertiary-container/30 border border-tertiary/30 px-4 py-3 flex items-start gap-2">
        <span className="text-tertiary text-lg flex-shrink-0">ℹ</span>
        <p className="text-body-sm text-on-surface-variant">
          <strong>La factura parcial no afecta inventario.</strong> Esta modalidad genera un CFDI fiscal independiente sin vincular a ninguna venta del sistema.
        </p>
      </div>

      {/* Cliente */}
      <div>
        <label className="block text-label-md text-on-surface mb-1">
          Receptor <span className="text-error">*</span>
        </label>
        <CustomerPicker
          value={customerId}
          onChange={handleCustomerSelect}
          onOpenQuickAdd={() => setShowQuickAdd(true)}
        />
        {fiscalMissingFields.length > 0 && customer && (
          <div className="mt-2 rounded bg-warning-container/30 border border-warning/30 px-3 py-2 text-label-sm text-on-surface-variant">
            Datos fiscales faltantes:{" "}
            <strong>{fiscalMissingFields.join(", ")}</strong>. Edita el cliente en el catálogo.
          </div>
        )}
        {customer && fiscalMissingFields.length === 0 && (
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4 text-label-sm text-on-surface-variant">
            <span>RFC: <strong className="font-mono text-on-surface">{customer.rfc}</strong></span>
            <span>CFDI: <strong className="text-on-surface">{customer.cfdiUse}</strong></span>
            <span>Régimen: <strong className="text-on-surface">{customer.fiscalRegime}</strong></span>
            <span>CP: <strong className="text-on-surface">{customer.taxZipCode}</strong></span>
          </div>
        )}
      </div>

      {/* Líneas */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-label-md font-semibold text-on-surface">Conceptos <span className="text-error">*</span></h3>
          <div className="flex gap-2">
            <Button type="button" variant="outlined" onClick={() => setShowCatalog((v) => !v)} className="px-3 py-1 text-label-sm hover:bg-surface-container">
              + Catálogo
            </Button>
            <Button type="button" variant="outlined" onClick={handleAddFreeLine} className="px-3 py-1 text-label-sm hover:bg-surface-container">
              + Línea libre
            </Button>
          </div>
        </div>

        {showCatalog && (
          <div className="border border-outline-variant rounded-md overflow-hidden mb-4">
            <ProductCatalogPanel onAddProduct={handleAddProduct} branchId={effectiveBranchId ?? undefined} />
          </div>
        )}

        {lines.length > 0 ? (
          <div className="overflow-x-auto border border-outline-variant rounded-md">
            <Table style={{ tableLayout: "fixed" }}>
              <THead>
                <Tr hoverable={false}>
                  <Th className="px-2 py-2">Descripción</Th>
                  <Th align="right" className="px-2 py-2 w-20">Cant.</Th>
                  <Th align="right" className="px-2 py-2 w-28">Precio</Th>
                  <Th align="right" className="px-2 py-2 w-20">Desc.%</Th>
                  <Th align="right" className="px-2 py-2 w-20">IVA%</Th>
                  <Th align="right" className="px-2 py-2 w-20">IEPS%</Th>
                  <Th align="right" className="px-2 py-2">Total</Th>
                  <Th className="px-2 py-2" />
                </Tr>
              </THead>
              <TBody>
                {lines.map((line, idx) => (
                  <PartialInvoiceLineRow
                    key={line._key}
                    line={line}
                    lineTotal={totals.lines[idx]?.lineTotal ?? 0}
                    onUpdate={(patch) => updateLine(line._key, patch)}
                    onRemove={() => removeLine(line._key)}
                    onChangePriceTier={line.productId ? () => handleChangeTier(line._key) : undefined}
                  />
                ))}
              </TBody>
            </Table>
          </div>
        ) : (
          <p className="text-body-sm text-on-surface-variant py-4 text-center border border-outline-variant border-dashed rounded-md">
            Sin conceptos. Agrega del catálogo o como línea libre.
          </p>
        )}
      </div>

      {/* Pago */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="partial-payment-form" className="block text-label-md text-on-surface mb-1">Forma de pago</label>
          <Select id="partial-payment-form" value={paymentForm} onChange={(e) => setPaymentForm(e.target.value)}>
            {PAYMENT_FORMS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </Select>
        </div>
        <div>
          <label htmlFor="partial-payment-method" className="block text-label-md text-on-surface mb-1">Método de pago</label>
          <Select id="partial-payment-method" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
            {PAYMENT_METHODS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </Select>
        </div>
      </div>

      {renderError()}

      {/* Totales + submit */}
      <div className="border-t border-outline-variant pt-4 flex flex-col sm:flex-row items-end justify-between gap-4">
        <div className="space-y-1 text-body-sm">
          <div className="flex justify-between gap-8">
            <span className="text-on-surface-variant">Subtotal</span>
            <span className="tabular-nums">{formatMxCurrency(totals.subtotal)}</span>
          </div>
          <div className="flex justify-between gap-8">
            <span className="text-on-surface-variant">Impuestos</span>
            <span className="tabular-nums">{formatMxCurrency(totals.taxTotal)}</span>
          </div>
          <div className="flex justify-between gap-8 font-semibold text-title-sm">
            <span>Total</span>
            <span className="tabular-nums">{formatMxCurrency(totals.total)}</span>
          </div>
        </div>
        <div className="flex gap-3">
          <Button
            type="button"
            variant="outlined"
            onClick={() => setShowPreview(true)}
            disabled={!canPreview}
            className="px-6 py-2.5 text-label-lg hover:bg-surface-container"
          >
            Vista previa
          </Button>
          <Button
            type="button"
            variant="filled"
            onClick={() => submit(effectiveBranchId)}
            disabled={lines.length === 0 || !customer || fiscalMissingFields.length > 0}
            loading={isSubmitting}
            className="bg-secondary px-6 py-2.5 text-label-lg text-on-secondary hover:bg-secondary/90"
          >
            Emitir factura parcial
          </Button>
        </div>
      </div>

      <InvoicePreviewModal
        open={showPreview}
        onClose={() => setShowPreview(false)}
        data={previewData}
        onConfirmStamp={handleConfirmStamp}
        isSubmitting={isSubmitting}
      />

      {pricePicker && (
        <PriceTierPicker
          product={pricePicker.product}
          prices={pricePicker.prices}
          isLoading={pricePicker.isLoading}
          initialQuantity={lines.find((l) => l._key === pricePicker.lineKey)?.quantity}
          initialDiscountPct={lines.find((l) => l._key === pricePicker.lineKey)?.discountPct}
          onConfirm={handlePriceConfirm}
          onClose={() => setPricePicker(null)}
        />
      )}

      {showQuickAdd && (
        <CustomerQuickAddModal
          onClose={() => setShowQuickAdd(false)}
          onCreated={(dto) => {
            setCustomerId(dto.id);
            setCustomer({
              rfc: dto.rfc ?? "",
              name: dto.name,
              cfdiUse: dto.cfdiUse ?? "",
              fiscalRegime: dto.taxRegime ?? "",
              taxZipCode: dto.taxZipCode ?? "",
            });
            setShowQuickAdd(false);
          }}
        />
      )}
    </div>
  );
}
