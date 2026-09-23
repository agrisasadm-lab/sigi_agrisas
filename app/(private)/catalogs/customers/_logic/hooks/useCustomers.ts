"use client";

import { useState, useEffect, useCallback } from "react";
import { listCustomers } from "../services/listCustomers";
import type { Customer } from "../types/domain";

interface UseCustomersResult {
  items: Customer[];
  total: number;
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
}

interface UseCustomersParams {
  page: number;
  pageSize: number;
  search?: string;
  includeInactive?: boolean;
  branchId?: string;
}

export function useCustomers({ page, pageSize, search, includeInactive, branchId }: UseCustomersParams): UseCustomersResult {
  const [items, setItems] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    listCustomers({ page, pageSize, search, includeInactive, branchId }, undefined, controller.signal)
      .then((data) => {
        if (cancelled) return;
        setItems(data.items);
        setTotal(data.total);
      })
      .catch((err: Error) => {
        if (cancelled) return;
        if (err.name === "AbortError") return;
        setError(err.message ?? "Error al cargar clientes.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [page, pageSize, search, includeInactive, branchId, tick]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  return { items, total, isLoading, error, refresh };
}
