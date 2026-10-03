"use client";

import { useState, useEffect, useCallback } from "react";
import { searchProducts } from "../services/searchProducts";
import type { ProductDto } from "../types/api";

interface UseProductSearchParams {
  search: string;
  branchId?: string;
  page?: number;
  pageSize?: number;
}

interface UseProductSearchResult {
  items: ProductDto[];
  total: number;
  isLoading: boolean;
  error: Error | null;
  refresh: () => void;
}

export function useProductSearch({
  search,
  branchId,
  page = 1,
  pageSize = 20,
}: UseProductSearchParams): UseProductSearchResult {
  const [items, setItems] = useState<ProductDto[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!branchId) {
      setItems([]);
      setTotal(0);
      setIsLoading(false);
      setError(null);
      return;
    }

    const controller = new AbortController();
    setIsLoading(true);
    setError(null);

    searchProducts({ search, branchId, page, pageSize, signal: controller.signal })
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
  }, [search, branchId, page, pageSize, tick]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  return { items, total, isLoading, error, refresh };
}
