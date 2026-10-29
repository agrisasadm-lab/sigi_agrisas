"use client";

import { useState, useMemo, useEffect } from "react";
import { useCurrentUser } from "../../../../_hooks/useCurrentUser";
import { useBranchesOptions } from "../../../../_hooks/useBranchesOptions";
import { useKardex } from "../_logic/hooks/useKardex";
import { KardexFilters } from "./KardexFilters";
import { KardexHeaderCards } from "./KardexHeaderCards";
import { KardexTabs, KardexTab } from "./KardexTabs";
import { KardexTable } from "./KardexTable";
import { InlineFilterInput } from "./InlineFilterInput";
import { RebuildArticleButton } from "./RebuildArticleButton";
import { ExportButtons } from "./ExportButtons";
import { MOVEMENT_TYPE_LABELS } from "../_logic/lib/movementTypeLabels";
import { PageShell } from "../../../../_components/organisms/PageShell";
import { Spinner } from "../../../../_components/atoms/Spinner/Spinner";
import { EmptyState } from "../../../../_components/molecules/EmptyState/EmptyState";
import type { ProductOptionDto } from "../_logic/types/api";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function firstDayOfMonthIso(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

interface KardexPageProps {
  initialProductId?: string;
  initialBranchId?: string;
}

export function KardexPage({ initialProductId, initialBranchId }: KardexPageProps) {
  const { can, branchId: userBranchId } = useCurrentUser();
  const canRead = can("inventory:kardex_read");
  const canWrite = can("inventory:write");
  const isBypass = can("branches:access_all");
  const { options: branches, isLoading: branchesLoading } = useBranchesOptions();

  const [productId, setProductId] = useState(initialProductId ?? "");
  const [selectedProduct, setSelectedProduct] = useState<ProductOptionDto | null>(null);
  const [branchId, setBranchId] = useState(initialBranchId ?? "");
  const productSearchBranchId = isBypass === true ? (branchId || undefined) : (userBranchId ?? undefined);
  const [from, setFrom] = useState(firstDayOfMonthIso());
  const [to, setTo] = useState(todayIso());
  const [tab, setTab] = useState<KardexTab>("kardex");
  const [inlineFilter, setInlineFilter] = useState("");

  const { report, isLoading, error, fetchReport, isExporting, exportXlsx, exportPdf, isRebuilding, rebuildError, rebuildResult, rebuild } =
    useKardex();

  useEffect(() => {
    if (initialProductId && (initialBranchId || isBypass === false)) {
      fetchReport({ productId: initialProductId, branchId: initialBranchId || undefined, from, to });
    }
    // Only runs once on mount with the deep-link params from `/inventory`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredMovements = useMemo(() => {
    if (!report) return [];
    const q = inlineFilter.trim().toLowerCase();
    if (!q) return report.movements;
    return report.movements.filter((m) => {
      const label = (MOVEMENT_TYPE_LABELS[m.movementType] ?? m.movementType).toLowerCase();
      return (
        label.includes(q) ||
        (m.folioCode ?? "").toLowerCase().includes(q) ||
        m.status.toLowerCase().includes(q)
      );
    });
  }, [report, inlineFilter]);

  function handleSubmit() {
    if (!productId) return;
    fetchReport({ productId, branchId: branchId || undefined, from, to });
  }

  if (canRead === "loading") {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (canRead === false) {
    return <EmptyState icon="lock" title="Sin acceso" description="No tienes permiso para ver el kardex de inventario." />;
  }

  return (
    <PageShell
      title="Kardex de Inventario"
      description="Historial de movimientos por artículo."
      backHref="/inventory"
    >
      <div className="flex flex-col gap-6">
      <KardexFilters
        productId={productId}
        onProductChange={(id, product) => { setProductId(id); setSelectedProduct(product); }}
        branchId={branchId}
        onBranchIdChange={setBranchId}
        productSearchBranchId={productSearchBranchId}
        branches={branches}
        showAllBranchesOption={isBypass === true}
        from={from}
        onFromChange={setFrom}
        to={to}
        onToChange={setTo}
        onSubmit={handleSubmit}
        isSubmitDisabled={!productId || branchesLoading}
      />

      {error && (
        <div className="bg-error-container/20 rounded-md px-4 py-3 text-body-sm text-error">{error.message}</div>
      )}

      {isLoading ? (
        <div className="flex h-40 items-center justify-center">
          <Spinner size="lg" />
        </div>
      ) : !report ? (
        <EmptyState
          icon="inventory_2"
          title="Consulta un artículo"
          description="Elige una clave, un almacén y un rango de fechas, luego presiona “Mostrar información”."
        />
      ) : (
        <KardexTabs tab={tab} onTabChange={setTab}>
          <div className="space-y-4">
            <KardexHeaderCards
              existenciaTotal={report.header.existenciaTotal}
              existenciaAlmacen={report.header.existenciaAlmacen}
              saldoAnterior={report.header.saldoAnterior}
              saldoFinal={report.header.saldoFinal}
            />

            <div className="flex flex-wrap items-center justify-between gap-3">
              <InlineFilterInput value={inlineFilter} onChange={setInlineFilter} />
              <div className="flex items-center gap-2">
                {canWrite === true && branchId && (
                  <RebuildArticleButton disabled={false} isRebuilding={isRebuilding} onRebuild={rebuild} />
                )}
                <ExportButtons
                  disabled={report.movements.length === 0}
                  isExporting={isExporting}
                  onExportXlsx={exportXlsx}
                  onExportPdf={exportPdf}
                />
              </div>
            </div>

            {rebuildError && (
              <div className="bg-error-container/20 rounded-md px-4 py-3 text-body-sm text-error">
                {rebuildError.message}
              </div>
            )}
            {rebuildResult && (
              <div className="bg-tertiary-container/30 rounded-md px-4 py-3 text-body-sm text-on-surface">
                Saldo reconstruido: {rebuildResult.previousQuantity} → {rebuildResult.newQuantity}
              </div>
            )}

            {report.movements.length === 0 ? (
              <EmptyState
                icon="inventory_2"
                title="Sin movimientos"
                description="No hay movimientos para el artículo y rango seleccionados."
              />
            ) : (
              <div className="bg-surface-container-low rounded-lg border border-outline-variant overflow-hidden">
                <KardexTable movements={filteredMovements} />
              </div>
            )}
          </div>
        </KardexTabs>
      )}

      {selectedProduct && (
        <p className="sr-only">Producto seleccionado: {selectedProduct.code}</p>
      )}
      </div>
    </PageShell>
  );
}
