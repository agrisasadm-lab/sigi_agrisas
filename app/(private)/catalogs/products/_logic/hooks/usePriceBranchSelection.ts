"use client";

import { useEffect, useMemo, useState } from "react";
import { useBranchesOptions } from "../../../../../_hooks/useBranchesOptions";
import { useCurrentUser } from "../../../../../_hooks/useCurrentUser";
import { useHeadquarters } from "../../../../../_hooks/useHeadquarters";

export interface UsePriceBranchSelectionResult {
  /** Sucursales que el usuario puede elegir: todas con `branches:access_all`, sólo la propia sin él. */
  branches: Array<{ id: string; name: string }>;
  selectedBranchId: string | null;
  setSelectedBranchId: (id: string | null) => void;
  /** `true` cuando el usuario no tiene sucursal propia ni bypass: no puede administrar precios. */
  hasNoBranch: boolean;
  branchName: (id: string | null) => string | null;
}

/**
 * Selección de sucursal compartida por las pestañas Precios y Dosificaciones.
 * Los precios pertenecen a una sola sucursal y la dosificación calcula su precio
 * unitario con el default de esa misma sucursal, así que ambas deben mirar la misma.
 * Arranca en la matriz para quien tiene `branches:access_all`; en la sucursal propia
 * para el resto.
 */
export function usePriceBranchSelection(): UsePriceBranchSelectionResult {
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const { options: allBranches } = useBranchesOptions();
  const { branchId: userBranchId, can } = useCurrentUser();
  const { hq, isLoading: hqLoading } = useHeadquarters();
  const canAccessAllBranches = can("branches:access_all");

  const branches = useMemo(() => {
    if (canAccessAllBranches !== false) return allBranches;
    return allBranches.filter((b) => b.id === userBranchId);
  }, [allBranches, canAccessAllBranches, userBranchId]);

  useEffect(() => {
    if (selectedBranchId || branches.length === 0) return;
    if (canAccessAllBranches === false) {
      if (userBranchId) setSelectedBranchId(userBranchId);
      return;
    }
    if (canAccessAllBranches === true && !hqLoading) {
      const initial = (hq && branches.some((b) => b.id === hq.id) ? hq.id : branches[0]?.id) ?? null;
      setSelectedBranchId(initial);
    }
  }, [selectedBranchId, branches, canAccessAllBranches, userBranchId, hq, hqLoading]);

  return {
    branches,
    selectedBranchId,
    setSelectedBranchId,
    hasNoBranch: canAccessAllBranches === false && !userBranchId,
    branchName: (id) => (id ? allBranches.find((b) => b.id === id)?.name ?? id : null),
  };
}
