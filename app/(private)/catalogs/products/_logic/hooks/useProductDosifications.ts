"use client";

import { useState, useEffect, useCallback } from "react";
import {
  listDosifications,
  createDosification,
  updateDosification,
  softDeleteDosification,
} from "../services/dosifications";
import { DuplicateDosificationNameError } from "../errors";
import type { CreateDosificationBody, UpdateDosificationBody } from "../types/api";
import type { ProductDosification } from "../types/domain";

interface UseProductDosificationsResult {
  dosifications: ProductDosification[];
  isLoading: boolean;
  error: string | null;
  isSaving: boolean;
  saveError: string | null;
  clearSaveError: () => void;
  refresh: () => void;
  createOne: (body: CreateDosificationBody) => Promise<ProductDosification | null>;
  updateOne: (dosificationId: string, body: UpdateDosificationBody) => Promise<ProductDosification | null>;
  softDeleteOne: (dosificationId: string) => Promise<boolean>;
  reactivateOne: (dosificationId: string) => Promise<ProductDosification | null>;
}

/** `branchId` fija la sucursal cuyo precio default alimenta `computedUnitPrice`. */
export function useProductDosifications(productId: string, branchId: string | null = null): UseProductDosificationsResult {
  const [dosifications, setDosifications] = useState<ProductDosification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!branchId) {
      setDosifications([]);
      setIsLoading(false);
      setError(null);
      return;
    }
    const controller = new AbortController();
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    listDosifications({ productId, branchId }, undefined, controller.signal)
      .then((data) => {
        if (!cancelled) setDosifications(data);
      })
      .catch((err: Error) => {
        if (cancelled || err.name === "AbortError") return;
        setError(err.message ?? "Error al cargar dosificaciones.");
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

  const createOne = useCallback(async (body: CreateDosificationBody): Promise<ProductDosification | null> => {
    setIsSaving(true);
    setSaveError(null);
    try {
      const result = await createDosification({ productId, branchId: branchId!, body });
      refresh();
      return result;
    } catch (err) {
      if (err instanceof DuplicateDosificationNameError) throw err;
      setSaveError((err as Error).message ?? "Error al crear dosificación.");
      return null;
    } finally {
      setIsSaving(false);
    }
  }, [productId, branchId, refresh]);

  const updateOne = useCallback(async (dosificationId: string, body: UpdateDosificationBody): Promise<ProductDosification | null> => {
    if (Object.keys(body).length === 0) return null;
    setIsSaving(true);
    setSaveError(null);
    try {
      const result = await updateDosification({ productId, dosificationId, branchId: branchId!, body });
      refresh();
      return result;
    } catch (err) {
      if (err instanceof DuplicateDosificationNameError) throw err;
      setSaveError((err as Error).message ?? "Error al actualizar dosificación.");
      return null;
    } finally {
      setIsSaving(false);
    }
  }, [productId, branchId, refresh]);

  const softDeleteOne = useCallback(async (dosificationId: string): Promise<boolean> => {
    setIsSaving(true);
    setSaveError(null);
    try {
      await softDeleteDosification({ productId, dosificationId });
      refresh();
      return true;
    } catch (err) {
      setSaveError((err as Error).message ?? "Error al eliminar dosificación.");
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [productId, branchId, refresh]);

  const reactivateOne = useCallback(
    async (dosificationId: string): Promise<ProductDosification | null> =>
      updateOne(dosificationId, { isActive: true }),
    [updateOne],
  );

  return {
    dosifications,
    isLoading,
    error,
    isSaving,
    saveError,
    clearSaveError,
    refresh,
    createOne,
    updateOne,
    softDeleteOne,
    reactivateOne,
  };
}
