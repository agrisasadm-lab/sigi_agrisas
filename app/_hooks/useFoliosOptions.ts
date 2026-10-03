"use client";

import { useState, useEffect, useCallback } from "react";
import { authFetch } from "../_lib/authFetch";

export type FolioScope = "POS" | "INVENTORY" | "OPERATIONS";

export interface FolioOption {
  id: string;
  code: string;
  name: string;
  prefix?: string | null;
  scope: FolioScope;
  currentNumber: number;
  isActive: boolean;
  /** Consecutivo de la sucursal pedida (`branchId`). `null` sin `branchId` o si el folio no es branch-scoped. */
  branchCurrentNumber: number | null;
  /** Siguiente `folioCode` que emitiría esa sucursal. `null` en los mismos casos que `branchCurrentNumber`. */
  nextFolioCode: string | null;
}

interface CacheEntry {
  options: FolioOption[];
  expiresAt: number;
  promise?: Promise<FolioOption[]>;
}

const CACHE_TTL_MS = 60_000;
const cache: Map<string, CacheEntry> = new Map();

function cacheKey(scope: FolioScope | undefined, branchId: string | null | undefined): string {
  return `${scope ?? "_all"}|${branchId ?? "_"}`;
}

async function fetchFolios(scope: FolioScope | undefined, branchId: string | null | undefined): Promise<FolioOption[]> {
  const key = cacheKey(scope, branchId);
  const entry = cache.get(key);
  if (entry && Date.now() < entry.expiresAt) return entry.options;
  if (entry?.promise) return entry.promise;

  const params = new URLSearchParams({ pageSize: "100", includeInactive: "false" });
  if (scope) params.set("scope", scope);
  if (branchId) params.set("branchId", branchId);
  const url = `/api/v1/admin/folios?${params.toString()}`;

  const promise = authFetch(url)
    .then((res) => res.json())
    .then((body: { items: Array<Record<string, unknown>> }) => {
      const options: FolioOption[] = body.items.map((f) => ({
        id: f.id as string,
        code: f.code as string,
        name: f.name as string,
        prefix: f.prefix as string | null | undefined,
        scope: f.scope as FolioScope,
        currentNumber: f.currentNumber as number,
        isActive: f.isActive as boolean,
        branchCurrentNumber: (f.branchCurrentNumber as number | null | undefined) ?? null,
        nextFolioCode: (f.nextFolioCode as string | null | undefined) ?? null,
      }));
      cache.set(key, { options, expiresAt: Date.now() + CACHE_TTL_MS });
      return options;
    })
    .catch(() => {
      cache.delete(key);
      return [] as FolioOption[];
    });

  cache.set(key, { options: [], expiresAt: 0, promise });
  return promise;
}

interface UseFoliosOptionsResult {
  options: FolioOption[];
  isLoading: boolean;
  refresh: () => void;
}

export interface UseFoliosOptionsArgs {
  scope?: FolioScope;
  /** Cuando está presente, cada opción incluye `branchCurrentNumber`/`nextFolioCode` para esta sucursal. */
  branchId?: string | null;
}

export function useFoliosOptions(args?: UseFoliosOptionsArgs): UseFoliosOptionsResult {
  const scope = args?.scope;
  const branchId = args?.branchId;
  const [options, setOptions] = useState<FolioOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(() => {
    let cancelled = false;
    setIsLoading(true);
    fetchFolios(scope, branchId).then((opts) => {
      if (!cancelled) {
        setOptions(opts);
        setIsLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [scope, branchId]);

  useEffect(() => {
    return load();
  }, [load]);

  const refresh = useCallback(() => {
    cache.delete(cacheKey(scope, branchId));
    load();
  }, [load, scope, branchId]);

  return { options, isLoading, refresh };
}
