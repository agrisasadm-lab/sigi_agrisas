"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCurrentUser } from "../../../_hooks/useCurrentUser";
import { useHeadquarters } from "../../../_hooks/useHeadquarters";
import { useSaleDetail } from "../_logic/hooks/useSaleDetail";
import { useSaleMutations } from "../_logic/hooks/useSaleMutations";
import { useCart } from "../../pos/_logic/hooks/useCart";
import { useFoliosOptions } from "../../../_hooks/useFoliosOptions";
import { usePaymentMethodsOptions } from "../../../_hooks/usePaymentMethodsOptions";
import { usePricingSettingsOptions } from "../../../_hooks/usePricingSettingsOptions";
import { CartPanel } from "../../pos/_blocks/CartPanel";
import { ProductCatalogPanel } from "../../pos/_blocks/ProductCatalogPanel";
import { PriceTierPicker } from "../../pos/_blocks/PriceTierPicker";
import { SaleStatusBadge } from "./SaleStatusBadge";
import { EmptyState } from "../../../_components/molecules/EmptyState/EmptyState";
import { Spinner } from "../../../_components/atoms/Spinner/Spinner";
import { Icon } from "../../../_components/atoms/Icon/Icon";
import { getProductPrices } from "../../pos/_logic/services/getProductPrices";
import { getProductDosifications } from "../../pos/_logic/services/getProductDosifications";
import { formatMxCurrency } from "../../pos/_logic/lib/formatMxCurrency";
import { useOfflineSync } from "../../_blocks/OfflineSyncProvider";
import type { ProductDto, ProductPriceDto, DosificationOptionDto, CustomerDto } from "../../pos/_logic/types/api";
import type { EditSaleBody } from "../_logic/types/api";
import Link from "next/link";

type PricePicker = {
  product: ProductDto;
  prices: ProductPriceDto[];
  dosifications: DosificationOptionDto[];
  isLoading: boolean;
  lineId?: string;
};

interface EditSalePageProps {
  id: string;
}

export function EditSalePage({ id }: EditSalePageProps) {
  const router = useRouter();
  const { can, branchId: userBranchId } = useCurrentUser();
  const { hq, isLoading: hqLoading } = useHeadquarters();
  const { isOnline, offlineEnabled, ownerBranchId } = useOfflineSync();

  const canEditCompleted = can("sales:edit_completed");
  const isBypass = can("branches:access_all");

  const { sale, isLoading: saleLoading } = useSaleDetail(id);
  const { isSaving, edit, mutationError } = useSaleMutations();
  const { options: folios, isLoading: foliosLoading } = useFoliosOptions({ scope: "POS", branchId: sale?.branchId ?? null });
  const { options: paymentMethods, isLoading: pmLoading } = usePaymentMethodsOptions();
  const { dosificationSurchargePct } = usePricingSettingsOptions();

  const {
    lines,
    totals,
    addLine,
    updateQuantity,
    updateDiscountPct,
    updateDiscountAmount,
    changeTier,
    removeLine,
    clear,
    addLineFromDosification,
  } = useCart(dosificationSurchargePct);

  const [initialized, setInitialized] = useState(false);
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState<string>("");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [pricePicker, setPricePicker] = useState<PricePicker | null>(null);

  const isInHq = isBypass === true || (hq !== null && userBranchId === hq.id);

  // Guard: redirect if no permission or not in HQ (after loading)
  useEffect(() => {
    if (canEditCompleted === "loading" || hqLoading) return;
    if (canEditCompleted !== true || !isInHq) {
      router.replace(`/sales/${id}`);
    }
  }, [canEditCompleted, isInHq, hqLoading, id, router]);

  // Initialize cart from existing sale
  useEffect(() => {
    if (!sale || initialized) return;
    setSelectedPaymentMethodId(sale.paymentMethodId);
    setSelectedCustomerId(sale.customerId ?? "");
    setNotes(sale.notes ?? "");
    setInitialized(true);
  }, [sale, initialized]);

  async function handleAddProduct(product: ProductDto) {
    const [prices, dosifications] = await Promise.all([
      getProductPrices(product.id, sale?.branchId ?? null),
      getProductDosifications(product.id, sale?.branchId ?? null),
    ]);
    setPricePicker({ product, prices, dosifications, isLoading: false });
  }

  function handleChangeTier(lineId: string) {
    const line = lines.find((l) => l.id === lineId);
    if (!line) return;
    const fakeProduct: ProductDto = {
      id: line.productId,
      code: line.productCode,
      name: line.productName,
      ivaRate: line.ivaRate,
      iepsRate: line.iepsRate,
      isActive: true,
      departmentId: "",
      createdAt: new Date(),
      updatedAt: new Date(),
      stock: null,
    };
    setPricePicker({ product: fakeProduct, prices: [], dosifications: [], isLoading: true, lineId });
    Promise.all([
      getProductPrices(line.productId, sale?.branchId ?? null),
      getProductDosifications(line.productId, sale?.branchId ?? null),
    ]).then(([prices, dosifications]) => {
      setPricePicker((prev) => prev ? { ...prev, prices, dosifications, isLoading: false } : null);
    });
  }

  function handlePriceConfirm(price: ProductPriceDto, quantity: number, discountPct: number) {
    if (!pricePicker) return;
    if (pricePicker.lineId) {
      changeTier(pricePicker.lineId, price);
      updateQuantity(pricePicker.lineId, quantity);
      updateDiscountPct(pricePicker.lineId, discountPct);
    } else {
      addLine(pricePicker.product, price, quantity, discountPct);
    }
    setPricePicker(null);
  }

  function handleDosificationConfirm(dosification: DosificationOptionDto, quantity: number) {
    if (!pricePicker) return;
    addLineFromDosification(pricePicker.product, dosification, quantity);
    setPricePicker(null);
  }

  async function handleSubmit() {
    if (!sale) return;
    const body: EditSaleBody = {
      customerId: selectedCustomerId || null,
      paymentMethodId: selectedPaymentMethodId,
      notes: notes.trim() || null,
      items: lines.length > 0 ? lines.map((l) => ({
        productId: l.productId,
        ...(l.dosificationId ? { dosificationId: l.dosificationId } : { productPriceId: l.productPriceId }),
        quantity: l.quantity,
        discountPctOverride: l.discountPct > 0 ? l.discountPct : undefined,
        discountAmount: l.discountAmount > 0 ? l.discountAmount : undefined,
      })) : undefined,
    };
    const result = await edit(sale.id, body);
    if (result) {
      router.push(`/sales/${sale.id}`);
    }
  }

  if (saleLoading || hqLoading || canEditCompleted === "loading") {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!sale) {
    return (
      <div>
        <EmptyState icon="warning" title="Venta no encontrada" />
      </div>
    );
  }

  if (sale.status === "cancelled") {
    return (
      <div>
        <EmptyState
          icon="block"
          title="Venta cancelada"
          description="No se puede editar una venta cancelada."
          action={
            <Link href={`/sales/${id}`} className="text-primary hover:underline text-body-sm">
              Volver al detalle
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
    <div className="flex flex-col h-[calc(100vh-64px)]">
      {/* Edit warning band */}
      <div className="bg-tertiary-container text-on-tertiary-container px-4 py-2 text-body-sm flex items-center gap-2">
        <Icon name="edit" size={16} />
        Estás editando una venta ya emitida —
        <strong className="font-mono">folio {folioLabel}</strong>
        , total original {formatMxCurrency(sale.total)}
      </div>

      <div className="flex items-center gap-3 px-4 py-2 border-b border-outline-variant">
        <Link href={`/sales/${id}`} className="text-on-surface-variant hover:text-on-surface">
          <Icon name="arrow_back" size={20} />
        </Link>
        <h1 className="text-title-md font-semibold text-on-surface">Editar venta</h1>
        <SaleStatusBadge status={sale.status} />
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 border-r border-outline-variant overflow-hidden flex flex-col">
          <ProductCatalogPanel
            branchId={sale.branchId}
            onAddProduct={handleAddProduct}
          />
        </div>

        <div className="w-96 shrink-0 flex flex-col overflow-hidden">
          <CartPanel
            lines={lines}
            totals={totals}
            folios={folios}
            paymentMethods={paymentMethods}
            selectedBranchId={sale.branchId}
            selectedFolioId={sale.folioId}
            selectedPaymentMethodId={selectedPaymentMethodId}
            selectedCustomerId={selectedCustomerId}
            notes={notes}
            isLoadingOptions={foliosLoading || pmLoading}
            isSubmitting={isSaving}
            isOnline={isOnline}
            offlineEnabled={offlineEnabled}
            ownerBranchId={ownerBranchId}
            canCreate={canEditCompleted}
            onFolioChange={() => {}}
            onPaymentMethodChange={setSelectedPaymentMethodId}
            onCustomerChange={(customerId) => setSelectedCustomerId(customerId)}
            onNotesChange={setNotes}
            onOpenQuickAdd={() => {}}
            onUpdateQuantity={updateQuantity}
            onUpdateDiscount={updateDiscountPct}
            onUpdateDiscountAmount={updateDiscountAmount}
            onChangeTier={handleChangeTier}
            onRemoveLine={removeLine}
            onSubmit={handleSubmit}
          />
        </div>
      </div>

      {pricePicker && (
        <PriceTierPicker
          product={pricePicker.product}
          prices={pricePicker.prices}
          dosifications={pricePicker.dosifications}
          isLoading={pricePicker.isLoading}
          onConfirm={handlePriceConfirm}
          onConfirmDosification={handleDosificationConfirm}
          onClose={() => setPricePicker(null)}
        />
      )}

      {mutationError && (
        <div className="fixed bottom-4 right-4 z-50 bg-error-container text-on-error-container rounded-md px-4 py-3 text-body-sm shadow-lg max-w-sm">
          {mutationError.message}
        </div>
      )}
    </div>
  );
}
