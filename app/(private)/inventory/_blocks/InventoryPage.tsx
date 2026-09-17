"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { useCurrentUser } from "../../../_hooks/useCurrentUser";
import { useDebounce } from "../../../_hooks/useDebounce";
import { useBranchInventory } from "../_logic/hooks/useBranchInventory";
import { useBranchesOptions } from "../../../_hooks/useBranchesOptions";
import { useInventoryScopeMode } from "../../../_hooks/useInventoryScopeMode";
import { useInventoryMutations } from "../_logic/hooks/useInventoryMutations";
import { InventoryTable } from "./InventoryTable";
import { InventoryAssignModal } from "./InventoryAssignModal";
import { StockAdjustModal } from "./StockAdjustModal";
import { InventoryEditModal } from "./InventoryEditModal";
import { CatalogPagination } from "../../catalogs/_blocks/CatalogPagination";
import { PageShell } from "../../../_components/organisms/PageShell";
import { Switch } from "../../../_components/atoms/Switch/Switch";
import { Icon } from "../../../_components/atoms/Icon/Icon";
import { Input } from "../../../_components/atoms/Input/Input";
import { Select } from "../../../_components/atoms/Select/Select";
import { Button } from "../../../_components/atoms/Button/Button";
import { CreateButton } from "../../../_components/molecules/CreateButton/CreateButton";
import { Badge } from "../../../_components/atoms/Badge/Badge";
import { EmptyState } from "../../../_components/molecules/EmptyState/EmptyState";
import { Skeleton } from "../../../_components/atoms/Skeleton/Skeleton";
import { ConfirmDialog } from "../../../_components/molecules/ConfirmDialog/ConfirmDialog";
import { OfflineBanner } from "../../../_components/molecules/OfflineBanner/OfflineBanner";
import { useOfflineSync } from "../../_blocks/OfflineSyncProvider";
import {
  InventoryAlreadyExistsError,
  InventoryTargetInvalidError,
  NegativeStockNotAllowedError,
} from "../_logic/errors";
import type { InventoryItem } from "../_logic/types/domain";

type ModalType = "assign" | "adjust" | "edit" | null;
interface ActiveModal { type: ModalType; item: InventoryItem | null; }
interface AssignSuccess { productId: string; productName: string; productCode: string; }

export function InventoryPage() {
  const { can, branchId: myBranchId } = useCurrentUser();
  const { options: branchOptions, isLoading: branchesLoading } = useBranchesOptions();
  const isBypass = can("branches:access_all");
  const { isOnline, catalogStalenessMs } = useOfflineSync();
  const { mode: inventoryScopeMode } = useInventoryScopeMode();

  const [branchId, setBranchId] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (isBypass !== true) {
      setBranchId(myBranchId ?? undefined);
    }
  }, [isBypass, myBranchId]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebounce(searchInput, 300);
  const [belowReorder, setBelowReorder] = useState(false);
  const [modal, setModal] = useState<ActiveModal>({ type: null, item: null });
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [adjustError, setAdjustError] = useState<string | null>(null);
  const [assignSuccess, setAssignSuccess] = useState<AssignSuccess | null>(null);

  const { items, total, isLoading, error, refresh } = useBranchInventory({
    branchId,
    page,
    pageSize,
    search: debouncedSearch.trim() || undefined,
    belowReorder,
  });

  const { isSaving, mutationError, clearError, assignOne, updateOne, adjustOne, removeOne } = useInventoryMutations();

  const canRead = can("inventory:read");
  const canWrite = can("inventory:write");
  const canViewKardex = can("inventory:kardex_read");
  const canWriteProducts = can("products:write");

  const handleBranchChange = (val: string) => {
    setBranchId(val || undefined);
    setPage(1);
    setSearchInput("");
    setAssignSuccess(null);
  };

  const handleSearchChange = useCallback((val: string) => {
    setSearchInput(val);
    setPage(1);
  }, []);

  const handleBelowReorderChange = useCallback((val: boolean) => {
    setBelowReorder(val);
    setPage(1);
  }, []);

  const handleAssign = useCallback(async (productId: string, quantity: number, reorderPoint: number) => {
    if (!branchId) return;
    setAssignError(null);
    try {
      const item = await assignOne(branchId, { productId, quantity, reorderPoint });
      if (item) {
        setAssignSuccess({ productId: item.productId, productName: item.productName, productCode: item.productCode });
      }
      setModal({ type: null, item: null });
      refresh();
    } catch (err) {
      if (err instanceof InventoryAlreadyExistsError) setAssignError("Este producto ya está asignado a la sucursal.");
      else if (err instanceof InventoryTargetInvalidError) setAssignError("El producto no existe o está inactivo.");
      else setAssignError((err as Error).message ?? "Error al asignar.");
    }
  }, [branchId, assignOne, refresh]);

  const handleAdjust = useCallback(async (delta: number, reason?: string) => {
    if (!branchId || !modal.item) return;
    setAdjustError(null);
    try {
      await adjustOne(branchId, modal.item.productId, { delta, reason });
      setModal({ type: null, item: null });
      refresh();
    } catch (err) {
      if (err instanceof NegativeStockNotAllowedError) setAdjustError("El ajuste dejaría el stock en negativo.");
      else setAdjustError((err as Error).message ?? "Error al ajustar.");
    }
  }, [branchId, modal.item, adjustOne, refresh]);

  const handleEdit = useCallback(async (body: { quantity?: number; reservedQuantity?: number; reorderPoint?: number }) => {
    if (!branchId || !modal.item) return;
    await updateOne(branchId, modal.item.productId, body);
    setModal({ type: null, item: null });
    refresh();
  }, [branchId, modal.item, updateOne, refresh]);

  const handleRemove = useCallback(async () => {
    if (!branchId || !confirmRemoveId) return;
    const ok = await removeOne(branchId, confirmRemoveId);
    if (ok) { setConfirmRemoveId(null); refresh(); }
  }, [branchId, confirmRemoveId, removeOne, refresh]);

  if (canRead === false) {
    return <EmptyState icon="lock" title="Sin acceso" description="No tienes permiso para ver el inventario." />;
  }

  return (
    <PageShell
      title="Inventario"
      description="Gestión de stock por sucursal."
      toolbar={
        <div className="flex flex-col gap-3">
          {inventoryScopeMode === "branch" && (
            <div>
              <Badge variant="neutral">Inventario por sucursal</Badge>
            </div>
          )}
          <div className="flex items-center gap-3 flex-wrap">
            {isBypass === true ? (
              <div className="flex items-center gap-2 min-w-[220px]">
                <label className="text-label-lg text-on-surface-variant shrink-0">Sucursal:</label>
                <Select
                  value={branchId ?? ""}
                  onChange={(e) => handleBranchChange(e.target.value)}
                  disabled={branchesLoading}
                >
                  <option value="">Selecciona una sucursal</option>
                  {branchOptions.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </Select>
              </div>
            ) : (
              branchId && (
                <div className="flex items-center gap-2">
                  <label className="text-label-lg text-on-surface-variant">Sucursal:</label>
                  <span className="text-body-md font-medium text-on-surface">
                    {branchOptions.find((b) => b.id === branchId)?.name ?? "—"}
                  </span>
                </div>
              )
            )}
            {branchId && (
              <>
                <div className="relative flex-1 min-w-[180px]">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant"><Icon name="search" size={18} /></span>
                  <Input
                    type="text"
                    value={searchInput}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    placeholder="Buscar productos..."
                    className="pl-9"
                  />
                </div>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <Switch checked={belowReorder} onChange={handleBelowReorderChange} aria-label="Solo bajo punto de reorden" />
                  <span className="text-label-lg text-on-surface-variant">Solo bajo punto de reorden</span>
                </label>
                {canWrite === true && isOnline && (
                  <CreateButton
                    label="Asignar producto"
                    onClick={() => { clearError(); setAssignError(null); setAssignSuccess(null); setModal({ type: "assign", item: null }); }}
                  />
                )}
              </>
            )}
          </div>
          {mutationError && <p className="text-label-sm text-error">{mutationError}</p>}
        </div>
      }
    >
      <div className="px-6 pt-4">
        <OfflineBanner isOnline={isOnline} catalogStalenessMs={catalogStalenessMs} />
      </div>

      {assignSuccess && (
        <div className="mx-6 mt-4 flex items-center justify-between gap-3 rounded-md bg-primary-container px-4 py-3 text-label-lg text-on-primary-container">
          <span>
            <strong>{assignSuccess.productCode}</strong> — {assignSuccess.productName} asignado a la sucursal.
            {canWriteProducts === true && (
              <>
                {" "}
                <Link href={`/catalogs/products/${assignSuccess.productId}?tab=prices`} className="underline font-medium">
                  Asignar precio de venta
                </Link>
              </>
            )}
          </span>
          <Button variant="text" size="sm" icon="close" onClick={() => setAssignSuccess(null)} className="shrink-0 p-1" aria-label="Descartar" title="Descartar" />
        </div>
      )}

      {!branchId ? (
        <div className="p-6">
          {isBypass === true ? (
            <EmptyState icon="store" title="Selecciona una sucursal" description="Elige una sucursal para ver su inventario." />
          ) : (
            <EmptyState icon="store" title="Sin sucursal asignada" description="Tu usuario no tiene una sucursal asignada. Contacta a un administrador." />
          )}
        </div>
      ) : isLoading ? (
        <div className="p-6 space-y-3">{Array.from({length:5}).map((_,i) => <Skeleton key={i} className="h-12 w-full rounded" />)}</div>
      ) : error ? (
        <div className="p-6 text-center">
          <p className="text-error text-body-md">{error}</p>
          <Button variant="text" onClick={refresh} className="mt-2">Reintentar</Button>
        </div>
      ) : total === 0 ? (
        <div className="p-6">
          <EmptyState icon="inventory_2" title="Esta sucursal no tiene productos asignados" description={canWrite === true ? "Agrega el primer producto con el botón superior." : "No hay stock registrado para esta sucursal."} />
        </div>
      ) : (
        <>
          <InventoryTable
            items={items}
            canWrite={canWrite === true && isOnline}
            canViewKardex={canViewKardex === true}
            onAdjust={(item) => { setAdjustError(null); setAssignSuccess(null); setModal({ type: "adjust", item }); }}
            onEdit={(item) => { setAssignSuccess(null); setModal({ type: "edit", item }); }}
            onRemove={(item) => setConfirmRemoveId(item.productId)}
            onEnter={canWrite === true && isOnline ? (item) => { setAdjustError(null); setAssignSuccess(null); setModal({ type: "adjust", item }); } : undefined}
          />
          <CatalogPagination
            page={page}
            pageSize={pageSize}
            total={total}
            count={items.length}
            onPageChange={setPage}
            onPageSizeChange={(ps) => { setPageSize(ps); setPage(1); }}
          />
        </>
      )}

      {modal.type === "assign" && branchId && (
        <InventoryAssignModal
          open
          branchId={branchId}
          isSaving={isSaving}
          assignError={assignError}
          onAssign={handleAssign}
          onClose={() => setModal({ type: null, item: null })}
        />
      )}

      {modal.type === "adjust" && modal.item && (
        <StockAdjustModal
          open
          item={modal.item}
          isSaving={isSaving}
          adjustError={adjustError}
          onAdjust={handleAdjust}
          onClose={() => setModal({ type: null, item: null })}
        />
      )}

      {modal.type === "edit" && modal.item && (
        <InventoryEditModal
          open
          item={modal.item}
          isSaving={isSaving}
          onSave={handleEdit}
          onClose={() => setModal({ type: null, item: null })}
        />
      )}

      <ConfirmDialog
        open={!!confirmRemoveId}
        title="¿Quitar este producto de la sucursal?"
        description="El registro de stock se eliminará permanentemente."
        confirmLabel="Quitar"
        onConfirm={handleRemove}
        onCancel={() => setConfirmRemoveId(null)}
      />
    </PageShell>
  );
}
