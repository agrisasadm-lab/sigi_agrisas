"use client";

import { useState, useEffect, useCallback } from "react";
import { listPrices, createPrice, updatePrice, deletePrice } from "../services/prices";
import { DuplicatePriceNameError, DuplicateDefaultPriceError } from "../errors";
import { ForbiddenError } from "../../../../../_lib/authFetch";
import type { CreatePriceBody, UpdatePriceBody } from "../types/api";
import type { ProductPrice } from "../types/domain";

interface UseProductPricesResult {
  prices: ProductPrice[];
  isLoading: boolean;
  error: string | null;
  isSaving: boolean;
  saveError: string | null;
  clearSaveError: () => void;
  refresh: () => void;
  createOne: (body: CreatePriceBody) => Promise<ProductPrice | null>;
  updateOne: (priceId: string, body: UpdatePriceBody) => Promise<ProductPrice | null>;
  deleteOne: (priceId: string) => Promise<boolean>;
}

export function useProductPrices(productId: string, branchId: string | null = null): UseProductPricesResult {
  const [prices, setPrices] = useState<ProductPrice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    listPrices({ productId, branchId }, undefined, controller.signal)
      .then((data) => {
        if (!cancelled) setPrices(data);
      })
      .catch((err: Error) => {
        if (cancelled || err.name === "AbortError") return;
        setError(err.message ?? "Error al cargar precios.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [productId, branchId, tick]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);
  const clearSaveError = useCallback(() => setSaveError(null), []);

  const createOne = useCallback(async (body: CreatePriceBody): Promise<ProductPrice | null> => {
    setIsSaving(true);
    setSaveError(null);
    try {
      const result = await createPrice({ productId, body });
      refresh();
      return result;
    } catch (err) {
      if (err instanceof DuplicatePriceNameError || err instanceof DuplicateDefaultPriceError) throw err;
      if (err instanceof ForbiddenError && err.required === "branches:access_all") {
        setSaveError("No puedes crear precios para otra sucursal.");
        return null;
      }
      setSaveError((err as Error).message ?? "Error al guardar precio.");
      return null;
    } finally {
      setIsSaving(false);
    }
  }, [productId, refresh]);

  const updateOne = useCallback(async (priceId: string, body: UpdatePriceBody): Promise<ProductPrice | null> => {
    if (Object.keys(body).length === 0) return null;
    setIsSaving(true);
    setSaveError(null);
    try {
      const result = await updatePrice({ productId, priceId, body });
      refresh();
      return result;
    } catch (err) {
      if (err instanceof DuplicatePriceNameError || err instanceof DuplicateDefaultPriceError) throw err;
      if (err instanceof ForbiddenError && err.required === "branches:access_all") {
        setSaveError("No puedes crear precios para otra sucursal.");
        return null;
      }
      setSaveError((err as Error).message ?? "Error al actualizar precio.");
      return null;
    } finally {
      setIsSaving(false);
    }
  }, [productId, refresh]);

  const deleteOne = useCallback(async (priceId: string): Promise<boolean> => {
    setIsSaving(true);
    setSaveError(null);
    try {
      await deletePrice({ productId, priceId });
      refresh();
      return true;
    } catch (err) {
      setSaveError((err as Error).message ?? "Error al eliminar precio.");
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [productId, refresh]);

  return { prices, isLoading, error, isSaving, saveError, clearSaveError, refresh, createOne, updateOne, deleteOne };
}
