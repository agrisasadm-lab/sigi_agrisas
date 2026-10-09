"use client";

import { useState, useEffect, useCallback } from "react";
import { listSales } from "../services";
import type { SaleSummary } from "../types/domain";

interface UseSalesListParams {
  page?: number;
  pageSize?: number;
  branchId?: string;
  status?: string[];
  from?: string;
  to?: string;
  search?: string;
}

interface UseSalesListResult {
  items: SaleSummary[];
  total: number;
  isLoading: boolean;
  error: Error | null;
  refresh: () => void;
}

export function useSalesList(params: UseSalesListParams): UseSalesListResult {
  const [items, setItems] = useState<SaleSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [tick, setTick] = useState(0);

  const { page = 1, pageSize = 20, branchId, status, from, to, search } = params;

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    setError(null);

    listSales({ page, pageSize, branchId, status, from, to, search, signal: controller.signal })
      .then((result) => {
        setItems(result.items);
        setTotal(result.total);
        setIsLoading(false);
      })
      .catch((err: Error) => {
        if (err.name === "AbortError") return;
        setError(err);
        setIsLoading(false);
      });

    return () => controller.abort();
  }, [page, pageSize, branchId, status, from, to, search, tick]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  return { items, total, isLoading, error, refresh };
}
