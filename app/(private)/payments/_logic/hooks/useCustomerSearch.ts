"use client";

import { useState, useEffect, useCallback } from "react";
import { searchCustomers } from "../services/searchCustomers";
import type { CustomerSearchResultDto } from "../types/api";

interface UseCustomerSearchParams {
  search: string;
  page?: number;
  pageSize?: number;
  branchId?: string;
}

interface UseCustomerSearchResult {
  items: CustomerSearchResultDto[];
  total: number;
  isLoading: boolean;
  error: Error | null;
  refresh: () => void;
}

export function useCustomerSearch({
  search,
  page = 1,
  pageSize = 20,
  branchId,
}: UseCustomerSearchParams): UseCustomerSearchResult {
  const [items, setItems] = useState<CustomerSearchResultDto[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    setError(null);

    searchCustomers({ search, page, pageSize, branchId, signal: controller.signal })
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
  }, [search, page, pageSize, branchId, tick]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  return { items, total, isLoading, error, refresh };
}
