"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "../../../_components/atoms/Button/Button";
import { Icon } from "../../../_components/atoms/Icon/Icon";
import { IconButton } from "../../../_components/atoms/IconButton/IconButton";
import { Spinner } from "../../../_components/atoms/Spinner/Spinner";
import { formatMxCurrency } from "../_logic/lib/formatMxCurrency";
import type { ProductDto, ProductPriceDto, DosificationOptionDto } from "../_logic/types/api";

const QUANTITY_DRAFT_PATTERN = /^\d*\.?\d{0,3}$/;

interface PriceTierPickerProps {
  product: ProductDto;
  prices: ProductPriceDto[];
  dosifications?: DosificationOptionDto[];
  isLoading: boolean;
  initialQuantity?: number;
  initialDiscountPct?: number;
  onConfirm: (price: ProductPriceDto, quantity: number, discountPct: number) => void;
  onConfirmDosification?: (dosification: DosificationOptionDto, quantity: number) => void;
  onClose: () => void;
}

type Selection = { kind: "price"; id: string } | { kind: "dosification"; id: string };

export function PriceTierPicker({
  product,
  prices,
  dosifications = [],
  isLoading,
  initialQuantity = 1,
  initialDiscountPct = 0,
  onConfirm,
  onConfirmDosification,
  onClose,
}: PriceTierPickerProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const quantityInputRef = useRef<HTMLInputElement>(null);
  const defaultPrice = prices.find((p) => p.isDefault) ?? prices[0] ?? null;
  const [selection, setSelection] = useState<Selection | null>(
    defaultPrice ? { kind: "price", id: defaultPrice.id } : null
  );
  const [quantity, setQuantity] = useState(initialQuantity);
  const [quantityDraft, setQuantityDraft] = useState(String(initialQuantity));
  const [discountPct, setDiscountPct] = useState(initialDiscountPct);

  const selectedPrice = selection?.kind === "price" ? prices.find((p) => p.id === selection.id) ?? null : null;
  const selectedDosification =
    selection?.kind === "dosification" ? dosifications.find((d) => d.id === selection.id) ?? null : null;

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handleCancel = (e: Event) => {
      e.preventDefault();
      onClose();
    };
    dialog.addEventListener("cancel", handleCancel);
    return () => dialog.removeEventListener("cancel", handleCancel);
  }, [onClose]);

  // Auto-focus quantity input when prices load
  useEffect(() => {
    if (!isLoading && prices.length > 0) {
      quantityInputRef.current?.focus();
    }
  }, [isLoading, prices.length]);

  function handleConfirm() {
    if (quantity <= 0) return;
    if (selectedDosification) {
      onConfirmDosification?.(selectedDosification, quantity);
      return;
    }
    if (!selectedPrice) return;
    onConfirm(selectedPrice, quantity, discountPct);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleConfirm();
    }
  }

  return (
    <dialog
      ref={dialogRef}
      onKeyDown={handleKeyDown}
      className="w-full max-w-md rounded-lg bg-surface p-6 shadow-xl backdrop:bg-black/40 open:flex open:flex-col"
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-title-md font-semibold text-on-surface">{product.name}</h2>
          <p className="text-label-sm text-on-surface-variant font-mono">{product.code}</p>
        </div>
        <IconButton icon="close" iconSize={18} ariaLabel="Cerrar" onClick={onClose} />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-6">
          <Spinner size="md" />
        </div>
      ) : prices.length === 0 && dosifications.length === 0 ? (
        <p className="text-body-sm text-on-surface-variant py-4">
          Este producto no tiene precios configurados.
        </p>
      ) : (
        <>
          {prices.length > 0 && (
            <>
              <p className="text-label-md text-on-surface-variant mb-2">Selecciona un precio</p>
              <div className="space-y-2 mb-4">
                {prices.map((price) => (
                  <Button
                    key={price.id}
                    type="button"
                    variant="outlined"
                    onClick={() => setSelection({ kind: "price", id: price.id })}
                    className={`w-full justify-between rounded px-4 py-3 text-left font-normal ${
                      selection?.kind === "price" && selection.id === price.id
                        ? "border-primary bg-primary-container text-on-primary-container hover:bg-primary-container"
                        : "border-outline-variant bg-surface-container-low hover:bg-surface-container"
                    }`}
                  >
                    <div>
                      <p className="text-body-sm font-medium">{price.name}</p>
                      {price.minQuantity > 1 && (
                        <p className="text-label-sm text-on-surface-variant">Mín. {price.minQuantity} uds.</p>
                      )}
                    </div>
                    <span className="text-body-md font-semibold tabular-nums">
                      {formatMxCurrency(price.price)}
                    </span>
                  </Button>
                ))}
              </div>
            </>
          )}

          {dosifications.length > 0 && (
            <>
              <p className="text-label-md text-on-surface-variant mb-2">Dosificaciones</p>
              <div className="space-y-2 mb-4">
                {dosifications.map((dosification) => {
                  const disabled = dosification.requiresDefaultPrice || dosification.computedUnitPrice === null;
                  const isSelected = selection?.kind === "dosification" && selection.id === dosification.id;
                  return (
                    <Button
                      key={dosification.id}
                      type="button"
                      variant="outlined"
                      disabled={disabled}
                      onClick={() => setSelection({ kind: "dosification", id: dosification.id })}
                      className={`w-full justify-between rounded px-4 py-3 text-left font-normal ${
                        disabled
                          ? "border-outline-variant bg-surface-container-low hover:bg-surface-container-low"
                          : isSelected
                          ? "border-primary bg-primary-container text-on-primary-container hover:bg-primary-container"
                          : "border-outline-variant bg-surface-container-low hover:bg-surface-container"
                      }`}
                    >
                      <div>
                        <p className="text-body-sm font-medium">{dosification.name}</p>
                        {disabled && (
                          <p className="text-label-sm text-error">Requiere precio default</p>
                        )}
                      </div>
                      {dosification.computedUnitPrice !== null && (
                        <span className="text-body-md font-semibold tabular-nums">
                          {formatMxCurrency(dosification.computedUnitPrice)}
                        </span>
                      )}
                    </Button>
                  );
                })}
              </div>
            </>
          )}

          <div className="flex gap-3 mb-4">
            <div className="flex-1">
              <label className="text-label-sm text-on-surface-variant mb-1 block">Cantidad</label>
              <input
                ref={quantityInputRef}
                type="text"
                inputMode="decimal"
                value={quantityDraft}
                onBlur={() => {
                  const v = parseFloat(quantityDraft);
                  if (isNaN(v) || v <= 0) {
                    setQuantityDraft(String(quantity));
                  } else {
                    setQuantityDraft(String(v));
                  }
                }}
                onChange={(e) => {
                  const raw = e.target.value;
                  if (!QUANTITY_DRAFT_PATTERN.test(raw)) return;
                  setQuantityDraft(raw);
                  const v = parseFloat(raw);
                  if (!isNaN(v) && v > 0) setQuantity(v);
                }}
                className="w-full rounded border border-outline px-3 py-2 text-body-sm tabular-nums focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className={`flex-1 ${selectedDosification ? "invisible" : ""}`}>
              <label className="text-label-sm text-on-surface-variant mb-1 block">Descuento %</label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={discountPct}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  if (!isNaN(v)) setDiscountPct(Math.max(0, Math.min(100, v)));
                }}
                className="w-full rounded border border-outline px-3 py-2 text-body-sm tabular-nums focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <div className="flex gap-3">
            <Button type="button" variant="outlined" onClick={onClose} className="flex-1">
              Cancelar
            </Button>
            <Button
              type="button"
              variant="filled"
              onClick={handleConfirm}
              disabled={(!selectedPrice && !selectedDosification) || quantity <= 0}
              className="flex-1"
            >
              Añadir al carrito
            </Button>
          </div>
        </>
      )}
    </dialog>
  );
}
