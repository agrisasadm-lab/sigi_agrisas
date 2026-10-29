"use client";

import { useState, useEffect } from "react";
import { searchProducts } from "../services/searchProducts";
import type { ProductOptionDto } from "../types/api";

export function useProductSearch(
  search: string,
  branchId?: string
): { items: ProductOptionDto[]; isLoading: boolean } {
  const [items, setItems] = useState<ProductOptionDto[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);

    searchProducts({ search, branchId, signal: controller.signal })
      .then((result) => setItems(result.items))
      .catch((err: Error) => {
        if (err.name === "AbortError") return;
        setItems([]);
      })
      .finally(() => setIsLoading(false));

    return () => controller.abort();
  }, [search, branchId]);

  return { items, isLoading };
}
