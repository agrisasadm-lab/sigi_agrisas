"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCurrentUser } from "../../../_hooks/useCurrentUser";
import { useQuoteDetail } from "../_logic/hooks/useQuoteDetail";
import { useQuoteMutations } from "../_logic/hooks/useQuoteMutations";
import { useCart } from "../../pos/_logic/hooks/useCart";
import { isFractionalQuantity } from "../../pos/_logic/lib/computeTotalsClient";
import { useFoliosOptions } from "../../../_hooks/useFoliosOptions";
import { usePricingSettingsOptions } from "../../../_hooks/usePricingSettingsOptions";
import { getProductPrices } from "../../pos/_logic/services/getProductPrices";
import { ProductCatalogPanel } from "../../pos/_blocks/ProductCatalogPanel";
import { QuoteEmitPanel } from "./QuoteEmitPanel";
import { PriceTierPicker } from "../../pos/_blocks/PriceTierPicker";
import { CustomerQuickAddModal } from "../../pos/_blocks/CustomerQuickAddModal";
import { EmptyState } from "../../../_components/molecules/EmptyState/EmptyState";
import { Spinner } from "../../../_components/atoms/Spinner/Spinner";
import { QuoteNotEditableError } from "../_logic/errors";
import type { ProductDto, ProductPriceDto, CustomerDto } from "../../pos/_logic/types/api";
import type { UpdateQuoteBody } from "../_logic/types/api";

type Modal = "pricePicker" | "quickAdd" | null;
interface PricePicker {
  product: ProductDto;
  prices: ProductPriceDto[];
  isLoading: boolean;
  lineId?: string;
}

interface QuoteEditPageProps {
  id: string;
}

export function QuoteEditPage({ id }: QuoteEditPageProps) {
  const router = useRouter();
  const { can } = useCurrentUser();
  const canWrite = can("quotes:write");

  const { quote, isLoading, error } = useQuoteDetail(id);
  const { isSaving, update } = useQuoteMutations();
  const { options: folios, isLoading: foliosLoading } = useFoliosOptions({ scope: "POS", branchId: quote?.branchId ?? null });
  const { dosificationSurchargePct } = usePricingSettingsOptions();
  const { lines, totals, addLine, updateQuantity, updateDiscountPct, changeTier, removeLine, clear } = useCart(dosificationSurchargePct);

  const [initialized, setInitialized] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [notes, setNotes] = useState("");
  const [modal, setModal] = useState<Modal>(null);
  const [pricePicker, setPricePicker] = useState<PricePicker | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (quote && !initialized) {
      setSelectedCustomerId(quote.customerId ?? "");
      setExpiresAt(quote.expiresAt ? quote.expiresAt.toISOString().split("T")[0] : "");
      setNotes(quote.notes ?? "");
      clear();
      for (const item of quote.items) {
        const fakeProduct: ProductDto = {
          id: item.productId,
          code: item.productCodeSnapshot,
          name: item.productNameSnapshot,
          ivaRate: item.ivaRate,
          iepsRate: item.iepsRate,
          isActive: true,
          departmentId: "",
          createdAt: new Date(),
          updatedAt: new Date(),
          stock: null,
        };
        // item.unitPrice is the persisted snapshot, already surcharged for fractional-quantity
        // lines; useCart/computeTotalsClient re-applies dosificationSurchargePct on top of
        // whatever base price they receive, so revert it here to avoid double-charging.
        const basePrice = isFractionalQuantity(item.quantity)
          ? item.unitPrice / (1 + dosificationSurchargePct / 100)
          : item.unitPrice;
        const fakePrice: ProductPriceDto = {
          id: item.productPriceId,
          branchId: quote.branchId,
          name: item.priceNameSnapshot,
          price: basePrice,
          minQuantity: 1,
          discountPct: 0,
          isDefault: false,
          productId: item.productId,
        };
        addLine(fakeProduct, fakePrice, item.quantity, item.discountPct);
      }
      setInitialized(true);
    }
  }, [quote, initialized, clear, addLine, dosificationSurchargePct]);

  // Redirect if non-draft
  useEffect(() => {
    if (quote && quote.status !== "draft") {
      setToast(`La cotización no puede editarse (estado: ${quote.status}). Redirigiendo...`);
      setTimeout(() => router.push(`/quotes/${id}`), 2000);
    }
  }, [quote, id, router]);

  async function handleAddProduct(product: ProductDto) {
    const prices = await getProductPrices(product.id, quote?.branchId ?? null);
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
    getProductPrices(line.productId, quote?.branchId ?? null).then((prices) => {
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
    const body: UpdateQuoteBody = {
      customerId: selectedCustomerId || null,
      expiresAt: expiresAt ? `${expiresAt}T23:59:59Z` : null,
      notes: notes.trim() || null,
      items: lines.map((l) => ({
        productId: l.productId,
        // QuoteEditPage never renders dosification options (PriceTierPicker without `dosifications` prop).
        productPriceId: l.productPriceId!,
        quantity: l.quantity,
        discountPctOverride: l.discountPct > 0 ? l.discountPct : undefined,
      })),
    };
    try {
      await update(id, body, () => { router.push(`/quotes/${id}`); });
    } catch (err) {
      if (err instanceof QuoteNotEditableError) {
        setToast(`La cotización cambió de estado (${err.status}). Redirigiendo...`);
        setTimeout(() => router.push(`/quotes/${id}`), 2000);
      } else {
        setToast((err as Error).message);
      }
    }
  }

  if (isLoading || canWrite === "loading") {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (canWrite === false) {
    return (
      <EmptyState
        icon="block"
        title="Sin acceso"
        description="No tienes permiso para editar cotizaciones."
      />
    );
  }

  if (error || !quote) {
    return (
      <EmptyState
        icon="warning"
        title="No se encontró la cotización"
        description={error?.message ?? "La cotización no existe."}
      />
    );
  }

  const cotFolios = folios;

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      <div className="px-4 py-3 border-b border-outline-variant">
        <h1 className="text-title-lg font-semibold text-on-surface">Editar cotización</h1>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 border-r border-outline-variant overflow-hidden flex flex-col">
          <ProductCatalogPanel
            branchId={quote.branchId}
            onAddProduct={handleAddProduct}
          />
        </div>

        <div className="w-96 shrink-0 flex flex-col overflow-hidden">
          <QuoteEmitPanel
            mode="edit"
            lines={lines}
            totals={totals}
            folios={cotFolios}
            branches={[{ id: quote.branchId, name: quote.branchName ?? "Sucursal" }]}
            selectedFolioId={quote.folioId}
            selectedBranchId={quote.branchId}
            selectedCustomerId={selectedCustomerId}
            expiresAt={expiresAt}
            notes={notes}
            isLoadingOptions={foliosLoading}
            isSubmitting={isSaving}
            canSubmitCreate={true}
            onFolioChange={() => {}}
            onBranchChange={() => {}}
            onCustomerChange={(id) => setSelectedCustomerId(id)}
            onExpiresAtChange={setExpiresAt}
            onNotesChange={setNotes}
            onOpenQuickAdd={() => setModal("quickAdd")}
            onUpdateQuantity={updateQuantity}
            onUpdateDiscount={updateDiscountPct}
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
        />
      )}

      {toast && (
        <div className="fixed bottom-4 right-4 z-50 bg-error-container text-on-error-container rounded-md px-4 py-3 text-body-sm shadow-lg max-w-sm">
          {toast}
        </div>
      )}
    </div>
  );
}
