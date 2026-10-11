"use client";

import { useState } from "react";
import { ConfirmDialog } from "../../../_components/molecules/ConfirmDialog/ConfirmDialog";
import { SegmentedButton } from "../../../_components/molecules/SegmentedButton/SegmentedButton";
import { Select } from "../../../_components/atoms/Select/Select";
import { SyncStatusBadge } from "../../../_components/molecules/SyncStatusBadge/SyncStatusBadge";
import { Button } from "../../../_components/atoms/Button/Button";
import { useOfflineSync } from "../../_blocks/OfflineSyncProvider";
import { SyncQueuePanel } from "./SyncQueuePanel";
import type { BranchOption } from "../_logic/types/api";

type PosMode = "sale" | "quote";

interface PosHeaderProps {
  branches: BranchOption[];
  selectedBranchId: string;
  onBranchChange: (id: string) => void;
  cartHasItems: boolean;
  onClearCart: () => void;
  isBypass: boolean;
  mode?: PosMode;
  onModeChange?: (mode: PosMode) => void;
  canQuote?: boolean;
  onShowShortcuts?: () => void;
}

export function PosHeader({
  branches,
  selectedBranchId,
  onBranchChange,
  cartHasItems,
  onClearCart,
  isBypass,
  mode = "sale",
  onModeChange,
  canQuote = false,
  onShowShortcuts,
}: PosHeaderProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingMode, setPendingMode] = useState<PosMode | null>(null);
  const [showQueue, setShowQueue] = useState(false);
  const [fixingBranch, setFixingBranch] = useState(false);
  const [fixBranchError, setFixBranchError] = useState<string | null>(null);
  const { isOnline, syncing, pendingCount, ownerBranchId, fixWorkingBranch } = useOfflineSync();

  const showFixBranchAction =
    isBypass && isOnline && Boolean(selectedBranchId) && ownerBranchId !== selectedBranchId;

  async function handleFixWorkingBranch() {
    setFixingBranch(true);
    try {
      await fixWorkingBranch(selectedBranchId);
      setFixBranchError(null);
    } catch (err) {
      setFixBranchError((err as Error).message);
    } finally {
      setFixingBranch(false);
    }
  }

  function handleModeChange(newMode: PosMode) {
    if (newMode === mode) return;
    if (cartHasItems) {
      setPendingMode(newMode);
      setShowConfirm(true);
    } else {
      onModeChange?.(newMode);
    }
  }

  return (
    <header className="sticky top-0 z-10 bg-surface border-b border-outline-variant px-4 py-3 flex items-center gap-4">
      <h1 className="text-title-lg font-semibold text-on-surface shrink-0">Punto de Venta</h1>

      {canQuote && onModeChange && (
        <SegmentedButton
          value={mode}
          options={[
            { value: "sale", label: "Venta" },
            { value: "quote", label: "Cotización" },
          ]}
          onChange={handleModeChange}
          aria-label="Modo de operación"
        />
      )}

      <div className="flex items-center gap-2 flex-1 min-w-0">
        {(isBypass || branches.length > 1) && isOnline ? (
          <Select
            value={selectedBranchId}
            onChange={(e) => onBranchChange(e.target.value)}
            className="py-1.5"
            aria-label="Sucursal"
          >
            <option value="">— Selecciona sucursal —</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </Select>
        ) : branches.length >= 1 ? (
          <span className="text-body-sm text-on-surface-variant">
            {branches.find((b) => b.id === selectedBranchId)?.name ?? branches[0].name}
          </span>
        ) : null}
        {showFixBranchAction && (
          <Button
            type="button"
            variant="text"
            size="sm"
            icon="cloud_off"
            onClick={handleFixWorkingBranch}
            loading={fixingBranch}
            title="Fija esta sucursal como tu sucursal de trabajo offline — necesario para poder vender/cotizar sin conexión con este usuario"
          >
            Fijar sucursal offline
          </Button>
        )}
        {fixBranchError && (
          <span className="text-label-sm text-error" role="alert">
            {fixBranchError}
          </span>
        )}
        {isBypass && ownerBranchId === selectedBranchId && Boolean(selectedBranchId) && (
          <span className="text-label-sm text-on-surface-variant whitespace-nowrap">
            Sucursal offline fijada
          </span>
        )}
      </div>

      <div className="relative shrink-0">
        <Button
          type="button"
          variant="text"
          onClick={() => setShowQueue((v) => !v)}
          aria-expanded={showQueue}
          aria-label="Cola de sincronización offline"
          className="shrink-0 rounded-full p-0 hover:bg-transparent"
        >
          <SyncStatusBadge isOnline={isOnline} syncing={syncing} pendingCount={pendingCount} />
        </Button>
        {showQueue && (
          <div className="absolute right-0 top-full mt-2 w-80 max-h-96 overflow-y-auto rounded-md border border-outline-variant bg-surface p-3 shadow-lg z-20">
            <SyncQueuePanel />
          </div>
        )}
      </div>

      {cartHasItems && (
        <Button
          type="button"
          variant="text"
          onClick={() => setShowConfirm(true)}
          className="shrink-0 rounded-none px-0 py-0 text-label-sm text-error hover:bg-transparent hover:text-error/80"
        >
          Limpiar carrito
        </Button>
      )}

      <Button
        type="button"
        variant="text"
        onClick={onShowShortcuts}
        title="Atajos de teclado (?)"
        className="shrink-0 rounded-sm px-2 py-1 text-label-sm text-on-surface-variant hover:bg-transparent hover:text-on-surface"
        aria-label="Mostrar atajos de teclado"
      >
        ?
      </Button>

      <ConfirmDialog
        open={showConfirm}
        title={pendingMode ? "Cambiar modo" : "Limpiar carrito"}
        description={
          pendingMode
            ? "Se eliminarán las líneas actuales del carrito al cambiar de modo. ¿Continuar?"
            : "Se eliminarán todos los productos del carrito. ¿Continuar?"
        }
        confirmLabel={pendingMode ? "Cambiar" : "Limpiar"}
        cancelLabel="Cancelar"
        onConfirm={() => {
          onClearCart();
          if (pendingMode) onModeChange?.(pendingMode);
          setPendingMode(null);
          setShowConfirm(false);
        }}
        onCancel={() => {
          setPendingMode(null);
          setShowConfirm(false);
        }}
      />
    </header>
  );
}
