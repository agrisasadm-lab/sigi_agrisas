"use client";

import { useState, useCallback } from "react";
import { createProduct, updateProduct, softDeleteProduct } from "../services/products";
import {
  ProductCodeAlreadyInUseError,
  ProductDepartmentInvalidError,
} from "../errors";
import type { CreateProductBody, UpdateProductBody } from "../types/api";
import type { Product, CreatedProduct } from "../types/domain";

interface UseProductMutationsResult {
  isSaving: boolean;
  mutationError: string | null;
  clearError: () => void;
  createOne: (body: CreateProductBody) => Promise<CreatedProduct | null>;
  updateOne: (id: string, body: UpdateProductBody) => Promise<Product | null>;
  softDeleteOne: (id: string) => Promise<boolean>;
  reactivateOne: (id: string) => Promise<Product | null>;
}

export function useProductMutations(): UseProductMutationsResult {
  const [isSaving, setIsSaving] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);

  const clearError = useCallback(() => setMutationError(null), []);

  const createOne = useCallback(async (body: CreateProductBody): Promise<CreatedProduct | null> => {
    setIsSaving(true);
    setMutationError(null);
    try {
      return await createProduct({ body });
    } catch (err) {
      if (err instanceof ProductCodeAlreadyInUseError || err instanceof ProductDepartmentInvalidError) {
        throw err;
      }
      setMutationError((err as Error).message ?? "Error al crear producto.");
      return null;
    } finally {
      setIsSaving(false);
    }
  }, []);

  const updateOne = useCallback(async (id: string, body: UpdateProductBody): Promise<Product | null> => {
    if (Object.keys(body).length === 0) return null;
    setIsSaving(true);
    setMutationError(null);
    try {
      return await updateProduct({ id, body });
    } catch (err) {
      if (err instanceof ProductDepartmentInvalidError) {
        throw err;
      }
      setMutationError((err as Error).message ?? "Error al actualizar producto.");
      return null;
    } finally {
      setIsSaving(false);
    }
  }, []);

  const softDeleteOne = useCallback(async (id: string): Promise<boolean> => {
    setIsSaving(true);
    setMutationError(null);
    try {
      await softDeleteProduct({ id });
      return true;
    } catch (err) {
      setMutationError((err as Error).message ?? "Error al desactivar producto.");
      return false;
    } finally {
      setIsSaving(false);
    }
  }, []);

  const reactivateOne = useCallback(
    async (id: string): Promise<Product | null> => updateOne(id, { isActive: true }),
    [updateOne],
  );

  return { isSaving, mutationError, clearError, createOne, updateOne, softDeleteOne, reactivateOne };
}
