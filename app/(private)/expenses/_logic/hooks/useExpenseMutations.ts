"use client";

import { useState, useCallback } from "react";
import { createExpense } from "../services/createExpense";
import { updateExpense } from "../services/updateExpense";
import { softDeleteExpense } from "../services/softDeleteExpense";
import { uploadExpensePhoto } from "../services/uploadExpensePhoto";
import type { CreateExpenseBody, UpdateExpenseBody } from "../types/api";
import type { Expense } from "../types/domain";

interface CreateResult {
  expense: Expense | null;
  photoError: string | null;
}

interface UseExpenseMutationsResult {
  isSaving: boolean;
  mutationError: string | null;
  clearError: () => void;
  createOne: (body: CreateExpenseBody, photoFile?: File | null) => Promise<CreateResult>;
  updateOne: (id: string, body: UpdateExpenseBody) => Promise<Expense | null>;
  softDeleteOne: (id: string) => Promise<boolean>;
}

export function useExpenseMutations(): UseExpenseMutationsResult {
  const [isSaving, setIsSaving] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);

  const clearError = useCallback(() => setMutationError(null), []);

  const createOne = useCallback(async (body: CreateExpenseBody, photoFile?: File | null): Promise<CreateResult> => {
    setIsSaving(true);
    setMutationError(null);
    try {
      const expense = await createExpense({ body });
      if (!photoFile) return { expense, photoError: null };

      try {
        const photoUrl = await uploadExpensePhoto(expense.id, photoFile);
        return { expense: { ...expense, photoUrl }, photoError: null };
      } catch (photoErr) {
        return {
          expense,
          photoError: (photoErr as Error).message ?? "El gasto se creó, pero la fotografía no se pudo guardar.",
        };
      }
    } catch (err) {
      setMutationError((err as Error).message ?? "Error al crear");
      return { expense: null, photoError: null };
    } finally {
      setIsSaving(false);
    }
  }, []);

  const updateOne = useCallback(async (id: string, body: UpdateExpenseBody): Promise<Expense | null> => {
    setIsSaving(true);
    setMutationError(null);
    try {
      return await updateExpense({ id, body });
    } catch (err) {
      setMutationError((err as Error).message ?? "Error al actualizar");
      return null;
    } finally {
      setIsSaving(false);
    }
  }, []);

  const softDeleteOne = useCallback(async (id: string): Promise<boolean> => {
    setIsSaving(true);
    setMutationError(null);
    try {
      await softDeleteExpense({ id });
      return true;
    } catch (err) {
      setMutationError((err as Error).message ?? "Error al desactivar");
      return false;
    } finally {
      setIsSaving(false);
    }
  }, []);

  return { isSaving, mutationError, clearError, createOne, updateOne, softDeleteOne };
}
