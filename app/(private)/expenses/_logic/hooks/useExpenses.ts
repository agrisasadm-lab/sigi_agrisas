"use client";

import { useState, useEffect, useCallback } from "react";
import { listExpenses } from "../services/listExpenses";
import type { Expense, ExpenseFilters } from "../types/domain";

interface UseExpensesResult {
  items: Expense[];
  total: number;
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useExpenses({
  page,
  pageSize,
  ...filters
}: ExpenseFilters & { page: number; pageSize: number }): UseExpensesResult {
  const [items, setItems] = useState<Expense[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const { branchId, concept, from, to, includeInactive } = filters;

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    listExpenses({ page, pageSize, branchId, concept, from, to, includeInactive })
      .then((data) => {
        if (!cancelled) {
          setItems(data.items);
          setTotal(data.total);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message ?? "Error al cargar");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [page, pageSize, branchId, concept, from, to, includeInactive, tick]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  return { items, total, isLoading, error, refresh };
}
