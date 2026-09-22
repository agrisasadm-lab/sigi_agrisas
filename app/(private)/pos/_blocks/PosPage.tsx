"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useCurrentUser } from "../../../_hooks/useCurrentUser";
import { useCart } from "../_logic/hooks/useCart";
import { useFoliosOptions } from "../../../_hooks/useFoliosOptions";
import { useBypassBranchOptions } from "../../../_hooks/useBypassBranchOptions";
import { usePaymentMethodsOptions } from "../../../_hooks/usePaymentMethodsOptions";
import { usePricingSettingsOptions } from "../../../_hooks/usePricingSettingsOptions";
import { useSaleSubmission } from "../_logic/hooks/useSaleSubmission";
import { useQuoteSubmission } from "../_logic/hooks/useQuoteSubmission";
import { usePosKeyboard } from "../_logic/hooks/usePosKeyboard";
import { canSubmitCart } from "../_logic/lib/canSubmitCart";
import { useOfflineSync } from "../../_blocks/OfflineSyncProvider";
import { getProductPrices } from "../_logic/services/getProductPrices";
import { getProductDosifications } from "../_logic/services/getProductDosifications";
import { PosHeader } from "./PosHeader";
import { ProductCatalogPanel } from "./ProductCatalogPanel";
import { CartPanel } from "./CartPanel";
import { PriceTierPicker } from "./PriceTierPicker";
import { CustomerQuickAddModal } from "./CustomerQuickAddModal";
import { SaleConfirmedModal } from "./SaleConfirmedModal";
import { QuoteQueuedModal } from "./QuoteQueuedModal";
import { PosShortcutsOverlay } from "./PosShortcutsOverlay";
import { ConfirmDialog } from "../../../_components/molecules/ConfirmDialog/ConfirmDialog";
import { EmptyState } from "../../../_components/molecules/EmptyState/EmptyState";
import { Spinner } from "../../../_components/atoms/Spinner/Spinner";
import type { ProductDto, ProductPriceDto, DosificationOptionDto, CustomerDto } from "../_logic/types/api";

type Modal = "pricePicker" | "quickAdd" | "confirmed" | "quoteQueued" | "shortcuts" | "clearCart" | null;
type PosMode = "sale" | "quote";

interface PricePicker {
  product: ProductDto;
  prices: ProductPriceDto[];
  dosifications: DosificationOptionDto[];
  isLoading: boolean;
  lineId?: string;
}

export function PosPage() {
  const router = useRouter();
  const { can, branchId: userBranchId } = useCurrentUser();
  const canCreate = can("sales:create");
  const canQuote = can("quotes:create");
  const isBypass = can("branches:access_all");
  const { isOnline, offlineEnabled, ownerBranchId } = useOfflineSync();

  const { options: folios, isLoading: foliosLoading } = useFoliosOptions({ scope: "POS" });
  const { options: paymentMethods, isLoading: pmLoading } = usePaymentMethodsOptions();
  const { dosificationSurchargePct } = usePricingSettingsOptions();
  const {
    lines,
    totals,
    addLine,
    addLineFromDosification,
    updateQuantity,
    updateDiscountPct,
    changeTier,
    removeLine,
    clear,
  } = useCart(dosificationSurchargePct);

  const {
    status: saleStatus,
    sale,
    queuedSale,
    error: saleError,
    submit: submitSale,
    reset: resetSale,
  } = useSaleSubmission();
  const {
    status: quoteStatus,
    quote,
    queuedQuote,
    error: quoteError,
    submit: submitQuote,
    reset: resetQuote,
  } = useQuoteSubmission();

  const [mode, setMode] = useState<PosMode>(() =>
    canCreate === false && canQuote === true ? "quote" : "sale"
  );
  const { branches, selectedBranchId, setSelectedBranchId } = useBypassBranchOptions(isBypass, userBranchId ?? null);
  const [selectedFolioId, setSelectedFolioId] = useState<string>("");
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState<string>("");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [expiresAt, setExpiresAt] = useState<string>("");
  const [modal, setModal] = useState<Modal>(null);
  const [pricePicker, setPricePicker] = useState<PricePicker | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const catalogContainerRef = useRef<HTMLDivElement>(null);
  const cartContainerRef = useRef<HTMLDivElement>(null);
  const lastFocusedRef = useRef<HTMLElement | null>(null);
  const liveRegionRef = useRef<HTMLDivElement>(null);

  const isQuoteMode = mode === "quote";
  const isSubmitting = mode === "quote" ? quoteStatus === "submitting" : saleStatus === "submitting";

  const canSubmit = canSubmitCart({
    canCreate: mode === "quote" ? canQuote : canCreate,
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

  // If user only has quotes:create and not sales:create, force quote mode
  useEffect(() => {
    if (canCreate === false && canQuote === true) {
      setMode("quote");
    }
  }, [canCreate, canQuote]);

  // Prompt on unload when cart has items
  useEffect(() => {
    if (lines.length === 0) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [lines.length]);

  // Handle sale success (online or queued offline)
  useEffect(() => {
    if ((saleStatus === "succeeded" && sale) || (saleStatus === "queued-offline" && queuedSale)) {
      setModal("confirmed");
    }
  }, [saleStatus, sale, queuedSale]);

  // Handle quote success → redirect (online) or show provisional confirmation (offline)
  useEffect(() => {
    if (quoteStatus === "succeeded" && quote) {
      router.push(`/quotes/${quote.id}`);
    }
    if (quoteStatus === "queued-offline" && queuedQuote) {
      setModal("quoteQueued");
    }
  }, [quoteStatus, quote, queuedQuote, router]);

  // Restore focus when modal closes
  useEffect(() => {
    if (modal === null && lastFocusedRef.current) {
      lastFocusedRef.current.focus();
      lastFocusedRef.current = null;
    }
  }, [modal]);

  const showSegmented = canCreate === true && canQuote === true;

  usePosKeyboard({
    searchInputRef,
    catalogContainerRef,
    cartContainerRef,
    onSubmit: handleSubmit,
    onClearCart: () => { if (lines.length > 0) setModal("clearCart"); },
    onToggleMode: setMode,
    canToggleMode: showSegmented,
    canSubmit,
    isSubmitting,
    onShowShortcuts: () => { lastFocusedRef.current = document.activeElement as HTMLElement; setModal("shortcuts"); },
    liveRegionRef,
  });

  async function handleAddProduct(product: ProductDto) {
    lastFocusedRef.current = document.activeElement as HTMLElement;
    // Dosification lines are not supported by the quotes module (out of scope) — only offered in sale mode.
    const [prices, dosifications] = await Promise.all([
      getProductPrices(product.id, selectedBranchId || null),
      isQuoteMode ? Promise.resolve([]) : getProductDosifications(product.id, selectedBranchId || null),
    ]);
    setPricePicker({ product, prices, dosifications, isLoading: false });
    setModal("pricePicker");
  }

  function handleChangeTier(lineId: string) {
    lastFocusedRef.current = document.activeElement as HTMLElement;
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

  function handleDosificationConfirm(dosification: DosificationOptionDto, quantity: number) {
    if (!pricePicker) return;
    addLineFromDosification(pricePicker.product, dosification, quantity);
    setModal(null);
    setPricePicker(null);
  }

  function handleCustomerCreated(customer: CustomerDto) {
    setSelectedCustomerId(customer.id);
    setModal(null);
  }

  async function handleSubmit() {
    if (mode === "quote") {
      await submitQuote({
        branchId: selectedBranchId,
        customerId: selectedCustomerId || null,
        folioId: selectedFolioId,
        lines,
        expiresAt: expiresAt ? `${expiresAt}T23:59:59Z` : null,
        notes: notes.trim() || null,
      });
    } else {
      await submitSale({
        branchId: selectedBranchId,
        customerId: selectedCustomerId || undefined,
        folioId: selectedFolioId,
        paymentMethodId: selectedPaymentMethodId,
        lines,
        notes: notes.trim() || undefined,
      });
    }
  }

  function handleNewSale() {
    clear();
    resetSale();
    setSelectedFolioId("");
    setSelectedCustomerId("");
    setNotes("");
    setModal(null);
  }

  function handleNewQuote() {
    clear();
    resetQuote();
    setSelectedFolioId("");
    setSelectedCustomerId("");
    setNotes("");
    setExpiresAt("");
    setModal(null);
  }

  const submitError = mode === "quote" ? quoteError : saleError;

  // Access guard: user must have at least sales:create OR quotes:create
  if (canCreate === "loading" || canQuote === "loading") {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (canCreate === false && canQuote === false) {
    return (
      <div>
        <EmptyState
          icon="block"
          title="Sin acceso"
          description="No tienes permiso para emitir ventas ni cotizaciones."
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      {/* Accessible live region for screen readers */}
      <div
        ref={liveRegionRef}
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      />

      <PosHeader
        branches={branches}
        selectedBranchId={selectedBranchId}
        onBranchChange={setSelectedBranchId}
        cartHasItems={lines.length > 0}
        onClearCart={clear}
        isBypass={isBypass === true}
        mode={mode}
        onModeChange={showSegmented ? setMode : undefined}
        canQuote={showSegmented}
        onShowShortcuts={() => { lastFocusedRef.current = document.activeElement as HTMLElement; setModal("shortcuts"); }}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Left: Product catalog */}
        <div
          ref={catalogContainerRef}
          className="flex-1 border-r border-outline-variant overflow-hidden flex flex-col"
        >
          <ProductCatalogPanel
            branchId={selectedBranchId || undefined}
            onAddProduct={handleAddProduct}
            searchInputRef={searchInputRef}
          />
        </div>

        {/* Right: Cart */}
        <div className="w-96 shrink-0 flex flex-col overflow-hidden">
          <CartPanel
            lines={lines}
            totals={totals}
            folios={folios}
            paymentMethods={paymentMethods}
            selectedBranchId={selectedBranchId}
            selectedFolioId={selectedFolioId}
            selectedPaymentMethodId={selectedPaymentMethodId}
            selectedCustomerId={selectedCustomerId}
            notes={notes}
            isLoadingOptions={foliosLoading || pmLoading}
            isSubmitting={isSubmitting}
            canCreate={mode === "quote" ? canQuote : canCreate}
            isOnline={isOnline}
            offlineEnabled={offlineEnabled}
            ownerBranchId={ownerBranchId}
            mode={mode}
            expiresAt={expiresAt}
            onFolioChange={setSelectedFolioId}
            onPaymentMethodChange={setSelectedPaymentMethodId}
            onCustomerChange={(id) => setSelectedCustomerId(id)}
            onNotesChange={setNotes}
            onExpiresAtChange={setExpiresAt}
            onOpenQuickAdd={() => { lastFocusedRef.current = document.activeElement as HTMLElement; setModal("quickAdd"); }}
            onUpdateQuantity={updateQuantity}
            onUpdateDiscount={updateDiscountPct}
            onChangeTier={handleChangeTier}
            onRemoveLine={removeLine}
            onSubmit={handleSubmit}
            containerRef={cartContainerRef}
          />
        </div>
      </div>

      {modal === "pricePicker" && pricePicker && (
        <PriceTierPicker
          product={pricePicker.product}
          prices={pricePicker.prices}
          dosifications={pricePicker.dosifications}
          isLoading={pricePicker.isLoading}
          onConfirm={handlePriceConfirm}
          onConfirmDosification={handleDosificationConfirm}
          onClose={() => { setModal(null); setPricePicker(null); }}
        />
      )}

      {modal === "quickAdd" && (
        <CustomerQuickAddModal
          onCreated={handleCustomerCreated}
          onClose={() => setModal(null)}
        />
      )}

      {modal === "confirmed" && (sale || queuedSale) && (
        <SaleConfirmedModal
          sale={sale}
          queued={queuedSale}
          onNewSale={handleNewSale}
        />
      )}

      {modal === "quoteQueued" && queuedQuote && (
        <QuoteQueuedModal queued={queuedQuote} onNewQuote={handleNewQuote} />
      )}

      {modal === "shortcuts" && (
        <PosShortcutsOverlay
          canToggleMode={showSegmented}
          onClose={() => setModal(null)}
        />
      )}

      <ConfirmDialog
        open={modal === "clearCart"}
        title="¿Vaciar carrito?"
        description="Se eliminarán todos los productos. Esta acción no se puede deshacer."
        confirmLabel="Vaciar"
        cancelLabel="Cancelar"
        onConfirm={() => { clear(); setModal(null); }}
        onCancel={() => setModal(null)}
      />

      {submitError && (
        <div className="fixed bottom-4 right-4 z-50 bg-error-container text-on-error-container rounded-md px-4 py-3 text-body-sm shadow-lg max-w-sm">
          {submitError.message}
        </div>
      )}
    </div>
  );
}
