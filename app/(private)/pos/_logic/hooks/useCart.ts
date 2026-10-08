"use client";

import { useReducer, useCallback, useRef } from "react";
import { computeTotalsClient } from "../lib/computeTotalsClient";
import type { CartLine, CartState } from "../types/domain";
import type { ProductDto, ProductPriceDto, DosificationOptionDto } from "../types/api";

type CartAction =
  | { type: "ADD_LINE"; product: ProductDto; price: ProductPriceDto; quantity: number; discountPct: number; surchargePct: number }
  | { type: "ADD_DOSIFICATION_LINE"; product: ProductDto; dosification: DosificationOptionDto; quantity: number }
  | { type: "UPDATE_QUANTITY"; lineId: string; quantity: number; surchargePct: number }
  | { type: "UPDATE_DISCOUNT"; lineId: string; discountPct: number; surchargePct: number }
  | { type: "UPDATE_DISCOUNT_AMOUNT"; lineId: string; discountAmount: number; surchargePct: number }
  | { type: "CHANGE_TIER"; lineId: string; price: ProductPriceDto; surchargePct: number }
  | { type: "REMOVE_LINE"; lineId: string; surchargePct: number }
  | { type: "CLEAR" };

function recompute(
  lines: Omit<CartLine, "lineSubtotal" | "lineIva" | "lineIeps" | "lineTotal">[],
  surchargePct: number
): CartLine[] {
  const totals = computeTotalsClient(
    lines.map((l) => ({
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      discountPct: l.discountPct,
      discountAmount: l.discountAmount,
      ivaRate: l.ivaRate,
      iepsRate: l.iepsRate,
      isDosificationLine: !!l.dosificationId,
    })),
    surchargePct
  );
  return lines.map((l, i) => ({
    ...l,
    lineSubtotal: totals.lines[i].lineSubtotal,
    lineIva: totals.lines[i].lineIva,
    lineIeps: totals.lines[i].lineIeps,
    lineTotal: totals.lines[i].lineTotal,
  }));
}

function buildState(
  lines: Omit<CartLine, "lineSubtotal" | "lineIva" | "lineIeps" | "lineTotal">[],
  surchargePct: number
): CartState {
  const recomputed = recompute(lines, surchargePct);
  const totals = computeTotalsClient(
    recomputed.map((l) => ({
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      discountPct: l.discountPct,
      discountAmount: l.discountAmount,
      ivaRate: l.ivaRate,
      iepsRate: l.iepsRate,
      isDosificationLine: !!l.dosificationId,
    })),
    surchargePct
  );
  return { lines: recomputed, totals: { subtotal: totals.subtotal, ivaTotal: totals.ivaTotal, iepsTotal: totals.iepsTotal, taxTotal: totals.taxTotal, total: totals.total } };
}

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case "ADD_LINE": {
      const existing = state.lines.find(
        (l) => l.productId === action.product.id && l.productPriceId === action.price.id
      );
      if (existing) {
        const updated = state.lines.map((l) =>
          l.id === existing.id ? { ...l, quantity: l.quantity + action.quantity } : l
        );
        return buildState(updated, action.surchargePct);
      }
      const newLine = {
        id: crypto.randomUUID(),
        productId: action.product.id,
        productCode: action.product.code,
        productName: action.product.name,
        productPriceId: action.price.id,
        priceName: action.price.name,
        unitPrice: action.price.price,
        ivaRate: action.product.ivaRate ?? 0,
        iepsRate: action.product.iepsRate ?? 0,
        quantity: action.quantity,
        discountType: "pct" as const,
        discountPct: action.discountPct,
        discountAmount: 0,
      };
      return buildState([...state.lines, newLine], action.surchargePct);
    }
    case "ADD_DOSIFICATION_LINE": {
      const existing = state.lines.find(
        (l) => l.productId === action.product.id && l.dosificationId === action.dosification.id
      );
      if (existing) {
        const updated = state.lines.map((l) =>
          l.id === existing.id ? { ...l, quantity: l.quantity + action.quantity } : l
        );
        return buildState(updated, 0);
      }
      const newLine = {
        id: crypto.randomUUID(),
        productId: action.product.id,
        productCode: action.product.code,
        productName: action.product.name,
        dosificationId: action.dosification.id,
        priceName: action.dosification.name,
        unitPrice: action.dosification.computedUnitPrice ?? 0,
        ivaRate: action.product.ivaRate ?? 0,
        iepsRate: action.product.iepsRate ?? 0,
        quantity: action.quantity,
        discountType: "pct" as const,
        discountPct: 0,
        discountAmount: 0,
      };
      return buildState([...state.lines, newLine], 0);
    }
    case "UPDATE_QUANTITY": {
      if (action.quantity <= 0) return state;
      const updated = state.lines.map((l) =>
        l.id === action.lineId ? { ...l, quantity: action.quantity } : l
      );
      return buildState(updated, action.surchargePct);
    }
    case "UPDATE_DISCOUNT": {
      const discount = Math.max(0, Math.min(100, action.discountPct));
      const updated = state.lines.map((l) =>
        l.id === action.lineId
          ? { ...l, discountType: "pct" as const, discountPct: discount, discountAmount: 0 }
          : l
      );
      return buildState(updated, action.surchargePct);
    }
    case "UPDATE_DISCOUNT_AMOUNT": {
      const amount = Math.max(0, Math.min(100, action.discountAmount));
      const updated = state.lines.map((l) =>
        l.id === action.lineId
          ? { ...l, discountType: "amount" as const, discountAmount: amount, discountPct: 0 }
          : l
      );
      return buildState(updated, action.surchargePct);
    }
    case "CHANGE_TIER": {
      const updated = state.lines.map((l) =>
        l.id === action.lineId
          ? { ...l, productPriceId: action.price.id, priceName: action.price.name, unitPrice: action.price.price }
          : l
      );
      return buildState(updated, action.surchargePct);
    }
    case "REMOVE_LINE": {
      const updated = state.lines.filter((l) => l.id !== action.lineId);
      return buildState(updated, action.surchargePct);
    }
    case "CLEAR":
      return buildState([], 0);
    default:
      return state;
  }
}

const EMPTY_STATE: CartState = buildState([], 0);

/**
 * @param surchargePct Currently configured `dosificationSurchargePct` (from `usePricingSettingsOptions`),
 * applied as a live preview to fractional-quantity normal-price lines — read fresh on every dispatch via
 * a ref, never baked into stored `unitPrice`, so repeated quantity edits never compound the surcharge.
 */
export function useCart(surchargePct = 0) {
  const [state, dispatch] = useReducer(cartReducer, EMPTY_STATE);
  const surchargePctRef = useRef(surchargePct);
  surchargePctRef.current = surchargePct;

  const addLine = useCallback(
    (product: ProductDto, price: ProductPriceDto, quantity: number, discountPct = 0) => {
      dispatch({ type: "ADD_LINE", product, price, quantity, discountPct, surchargePct: surchargePctRef.current });
    },
    []
  );

  const addLineFromDosification = useCallback(
    (product: ProductDto, dosification: DosificationOptionDto, quantity: number) => {
      dispatch({ type: "ADD_DOSIFICATION_LINE", product, dosification, quantity });
    },
    []
  );

  const updateQuantity = useCallback((lineId: string, quantity: number) => {
    dispatch({ type: "UPDATE_QUANTITY", lineId, quantity, surchargePct: surchargePctRef.current });
  }, []);

  const updateDiscountPct = useCallback((lineId: string, discountPct: number) => {
    dispatch({ type: "UPDATE_DISCOUNT", lineId, discountPct, surchargePct: surchargePctRef.current });
  }, []);

  const updateDiscountAmount = useCallback((lineId: string, discountAmount: number) => {
    dispatch({ type: "UPDATE_DISCOUNT_AMOUNT", lineId, discountAmount, surchargePct: surchargePctRef.current });
  }, []);

  const changeTier = useCallback((lineId: string, price: ProductPriceDto) => {
    dispatch({ type: "CHANGE_TIER", lineId, price, surchargePct: surchargePctRef.current });
  }, []);

  const removeLine = useCallback((lineId: string) => {
    dispatch({ type: "REMOVE_LINE", lineId, surchargePct: surchargePctRef.current });
  }, []);

  const clear = useCallback(() => {
    dispatch({ type: "CLEAR" });
  }, []);

  return {
    lines: state.lines,
    totals: state.totals,
    addLine,
    addLineFromDosification,
    updateQuantity,
    updateDiscountPct,
    updateDiscountAmount,
    changeTier,
    removeLine,
    clear,
  };
}
