"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCurrentUser } from "../../../_hooks/useCurrentUser";
import { useCart } from "../../pos/_logic/hooks/useCart";
import { useFoliosOptions } from "../../../_hooks/useFoliosOptions";
import { useBypassBranchOptions } from "../../../_hooks/useBypassBranchOptions";
import { usePricingSettingsOptions } from "../../../_hooks/usePricingSettingsOptions";
import { useQuoteSubmission } from "../_logic/hooks/useQuoteSubmission";
import { useOfflineSync } from "../../_blocks/OfflineSyncProvider";
import { getProductPrices } from "../../pos/_logic/services/getProductPrices";
import { ProductCatalogPanel } from "../../pos/_blocks/ProductCatalogPanel";
import { QuoteEmitPanel } from "./QuoteEmitPanel";
import { PriceTierPicker } from "../../pos/_blocks/PriceTierPicker";
import { CustomerQuickAddModal } from "../../pos/_blocks/CustomerQuickAddModal";
import { QuoteQueuedModal } from "../../pos/_blocks/QuoteQueuedModal";
import { EmptyState } from "../../../_components/molecules/EmptyState/EmptyState";
import { Spinner } from "../../../_components/atoms/Spinner/Spinner";
import type { ProductDto, ProductPriceDto, CustomerDto } from "../../pos/_logic/types/api";
import type { FolioOption } from "../../../_hooks/useFoliosOptions";

type Modal = "pricePicker" | "quickAdd" | "quoteQueued" | null;

interface PricePicker {
  product: ProductDto;
  prices: ProductPriceDto[];
  isLoading: boolean;
  lineId?: string;
}

export function QuoteCreatePage() {
  const router = useRouter();
  const { can, branchId: userBranchId } = useCurrentUser();
  const canCreate = can("quotes:create");
  const isBypass = can("branches:access_all");
  const { isOnline, offlineEnabled, ownerBranchId } = useOfflineSync();

  const { dosificationSurchargePct } = usePricingSettingsOptions();
  const { lines, totals, addLine, updateQuantity, updateDiscountPct, updateDiscountAmount, changeTier, removeLine, clear } = useCart(dosificationSurchargePct);
  const { status, quote, queuedQuote, error: submitError, submit, reset: resetSubmit } = useQuoteSubmission();

  const { branches, selectedBranchId, setSelectedBranchId } = useBypassBranchOptions(isBypass, userBranchId ?? null);
  const { options: folios, isLoading: foliosLoading } = useFoliosOptions({ scope: "POS", branchId: selectedBranchId || null });
  const [selectedFolioId, setSelectedFolioId] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [notes, setNotes] = useState("");
  const [modal, setModal] = useState<Modal>(null);
  const [pricePicker, setPricePicker] = useState<PricePicker | null>(null);

  useEffect(() => {
    if (status === "succeeded" && quote) {
      router.push(`/quotes/${quote.id}`);
    }
    if (status === "queued-offline" && queuedQuote) {
      setModal("quoteQueued");
    }
  }, [status, quote, queuedQuote, router]);

  // Al cambiar de sucursal (bypass), el cliente ya seleccionado puede no pertenecer a la nueva.
  useEffect(() => {
    setSelectedCustomerId("");
  }, [selectedBranchId]);

  function handleNewQuote() {
    clear();
    resetSubmit();
    setSelectedFolioId("");
    setSelectedCustomerId("");
    setNotes("");
    setExpiresAt("");
    setModal(null);
  }

  async function handleAddProduct(product: ProductDto) {
    const prices = await getProductPrices(product.id, selectedBranchId || null);
    setPricePicker({ product, prices, isLoading: false });
    setModal("pricePicker");
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
    setPricePicker({ product: fakeProduct, prices: [], isLoading: true, lineId });
    setModal("pricePicker");
    getProductPrices(line.productId, selectedBranchId || null).then((prices) => {
      setPricePicker((prev) => prev ? { ...prev, prices, isLoading: false } : null);
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
    setModal(null);
    setPricePicker(null);
  }

  async function handleSubmit() {
    await submit({
      branchId: selectedBranchId,
      customerId: selectedCustomerId || null,
      folioId: selectedFolioId,
      lines,
      expiresAt: expiresAt ? `${expiresAt}T23:59:59Z` : null,
      notes: notes.trim() || null,
    });
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
        description="No tienes permiso para crear cotizaciones."
      />
    );
  }

  const cotFolios: FolioOption[] = folios;
  const offlineBlocked = !isOnline && (!offlineEnabled || ownerBranchId !== selectedBranchId);

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      <div className="px-4 py-3 border-b border-outline-variant">
        <h1 className="text-title-lg font-semibold text-on-surface">Nueva cotización</h1>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 border-r border-outline-variant overflow-hidden flex flex-col">
          <ProductCatalogPanel
            branchId={selectedBranchId || undefined}
            onAddProduct={handleAddProduct}
          />
        </div>

        <div className="w-96 shrink-0 flex flex-col overflow-hidden">
          <QuoteEmitPanel
            mode="create"
            lines={lines}
            totals={totals}
            folios={cotFolios}
            branches={branches}
            selectedFolioId={selectedFolioId}
            selectedBranchId={selectedBranchId}
            selectedCustomerId={selectedCustomerId}
            expiresAt={expiresAt}
            notes={notes}
            isLoadingOptions={foliosLoading}
            isSubmitting={status === "submitting"}
            canSubmitCreate={canCreate}
            offlineBlocked={offlineBlocked}
            onFolioChange={setSelectedFolioId}
            onBranchChange={setSelectedBranchId}
            onCustomerChange={(id) => setSelectedCustomerId(id)}
            onExpiresAtChange={setExpiresAt}
            onNotesChange={setNotes}
            onOpenQuickAdd={() => setModal("quickAdd")}
            onUpdateQuantity={updateQuantity}
            onUpdateDiscount={updateDiscountPct}
            onUpdateDiscountAmount={updateDiscountAmount}
            onChangeTier={handleChangeTier}
            onRemoveLine={removeLine}
            onSubmit={handleSubmit}
          />
        </div>
      </div>

      {modal === "pricePicker" && pricePicker && (
        <PriceTierPicker
          product={pricePicker.product}
          prices={pricePicker.prices}
          isLoading={pricePicker.isLoading}
          onConfirm={handlePriceConfirm}
          onClose={() => { setModal(null); setPricePicker(null); }}
        />
      )}

      {modal === "quickAdd" && (
        <CustomerQuickAddModal
          onCreated={(customer: CustomerDto) => {
            setSelectedCustomerId(customer.id);
            setModal(null);
          }}
          onClose={() => setModal(null)}
          branchId={selectedBranchId || undefined}
        />
      )}

      {modal === "quoteQueued" && queuedQuote && (
        <QuoteQueuedModal queued={queuedQuote} onNewQuote={handleNewQuote} />
      )}

      {submitError && (status === "failed" || status === "offline-disabled") && (
        <div className="fixed bottom-4 right-4 z-50 bg-error-container text-on-error-container rounded-md px-4 py-3 text-body-sm shadow-lg max-w-sm">
          {submitError.message}
        </div>
      )}
    </div>
  );
}
