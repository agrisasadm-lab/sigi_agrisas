"use client";

import { useState, useCallback } from "react";
import { useCurrentUser } from "../../../_hooks/useCurrentUser";
import { useDebounce } from "../../../_hooks/useDebounce";
import { useBranchesOptions } from "../../../_hooks/useBranchesOptions";
import { useExpenses } from "../_logic/hooks/useExpenses";
import { useExpenseMutations } from "../_logic/hooks/useExpenseMutations";
import { ExpensesTable } from "./ExpensesTable";
import { ExpensesToolbar } from "./ExpensesToolbar";
import { ExpenseEditModal } from "./ExpenseEditModal";
import { PageShell } from "../../../_components/organisms/PageShell";
import { CatalogPagination } from "../../catalogs/_blocks/CatalogPagination";
import { ConfirmDialog } from "../../../_components/molecules/ConfirmDialog/ConfirmDialog";
import { Skeleton } from "../../../_components/atoms/Skeleton/Skeleton";
import { EmptyState } from "../../../_components/molecules/EmptyState/EmptyState";
import type { Expense } from "../_logic/types/domain";
import type { CreateExpenseBody, UpdateExpenseBody } from "../_logic/types/api";

type ModalMode = "create" | "edit";
interface ModalState {
  mode: ModalMode;
  entity: Expense | null;
}

const CONCEPT_MIN_LENGTH = 2;

export function ExpensesPage() {
  const { can } = useCurrentUser();
  const isBypass = can("branches:access_all");
  const { options: branchOptions } = useBranchesOptions();
  const branches = branchOptions.map((b) => ({ id: b.id, name: b.name }));

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [conceptInput, setConceptInput] = useState("");
  const debouncedConcept = useDebounce(conceptInput, 300);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [branchId, setBranchId] = useState("");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [modalState, setModalState] = useState<ModalState | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const dateRangeError = from && to && from > to ? "La fecha “desde” no puede ser posterior a “hasta”." : null;
  const effectiveConcept = debouncedConcept.length >= CONCEPT_MIN_LENGTH ? debouncedConcept : undefined;

  const { items, total, isLoading, error, refresh } = useExpenses({
    page,
    pageSize,
    includeInactive,
    concept: effectiveConcept,
    from: dateRangeError ? undefined : from || undefined,
    to: dateRangeError ? undefined : to || undefined,
    branchId: branchId || undefined,
  });
  const { isSaving, mutationError, createOne, updateOne, softDeleteOne, clearError } = useExpenseMutations();

  const canRead = can("expenses:read");
  const canWrite = can("expenses:write");

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }, []);

  const handleCreate = useCallback(() => {
    clearError();
    setModalState({ mode: "create", entity: null });
  }, [clearError]);

  const handleEdit = useCallback(
    (entity: Expense) => {
      clearError();
      setModalState({ mode: "edit", entity });
    },
    [clearError]
  );

  const handleCloseModal = useCallback(() => {
    setModalState(null);
    clearError();
  }, [clearError]);

  const handleSave = useCallback(
    async (data: CreateExpenseBody | UpdateExpenseBody, photoFile?: File | null) => {
      if (!modalState) return;
      if (modalState.mode === "create") {
        const { expense, photoError } = await createOne(data as CreateExpenseBody, photoFile);
        if (expense !== null) {
          refresh();
          setModalState(null);
          showToast(photoError ? `Gasto creado. ${photoError}` : "Gasto creado.");
        }
      } else {
        if (!modalState.entity) return;
        const result = await updateOne(modalState.entity.id, data as UpdateExpenseBody);
        if (result !== null) {
          refresh();
          setModalState(null);
          showToast("Gasto actualizado.");
        }
      }
    },
    [modalState, createOne, updateOne, refresh, showToast]
  );

  const handleSoftDelete = useCallback(
    async (id: string) => {
      const ok = await softDeleteOne(id);
      if (ok) {
        setConfirmDeleteId(null);
        refresh();
        showToast("Gasto desactivado.");
      }
    },
    [softDeleteOne, refresh, showToast]
  );

  if (canRead === "loading") {
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        <Skeleton height={48} width="40%" />
        <Skeleton height={44} className="w-full" />
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} height={56} className="w-full" />
        ))}
      </div>
    );
  }

  if (canRead === false) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <EmptyState
          icon="lock"
          title="Sin acceso a este módulo"
          description="No tienes permisos para ver los gastos. Contacta a un administrador."
        />
      </div>
    );
  }

  return (
    <>
      <PageShell
        title="Gastos"
        description="Registra y consulta los gastos operativos de tu sucursal"
        toolbar={
          <ExpensesToolbar
            canWrite={canWrite === true}
            onCreate={handleCreate}
            concept={conceptInput}
            onConceptChange={(v) => { setConceptInput(v); setPage(1); }}
            from={from}
            onFromChange={(v) => { setFrom(v); setPage(1); }}
            to={to}
            onToChange={(v) => { setTo(v); setPage(1); }}
            dateRangeError={dateRangeError}
            includeInactive={includeInactive}
            onIncludeInactiveChange={(v) => { setIncludeInactive(v); setPage(1); }}
            branchId={branchId}
            onBranchIdChange={(v) => { setBranchId(v); setPage(1); }}
            branches={branches}
            showBranchFilter={isBypass === true}
          />
        }
      >
        {error ? (
          <div className="flex items-center justify-center h-64">
            <EmptyState icon="warning" title="Error al cargar gastos" description={error} />
          </div>
        ) : items.length === 0 && !isLoading ? (
          <div className="flex items-center justify-center h-64">
            <EmptyState
              icon="trending_down"
              title="Sin gastos registrados"
              description="Aún no hay gastos que coincidan con los filtros seleccionados."
            />
          </div>
        ) : (
          <ExpensesTable
            items={items}
            canWrite={canWrite === true}
            showBranch={isBypass === true}
            isLoading={isLoading}
            onEdit={handleEdit}
            onSoftDelete={(id) => setConfirmDeleteId(id)}
          />
        )}

        <CatalogPagination
          page={page}
          pageSize={pageSize}
          total={total}
          count={items.length}
          onPageChange={setPage}
          onPageSizeChange={(ps) => { setPageSize(ps); setPage(1); }}
        />
      </PageShell>

      <ExpenseEditModal
        open={modalState !== null}
        mode={modalState?.mode ?? "create"}
        entity={modalState?.entity ?? null}
        isSaving={isSaving}
        mutationError={mutationError}
        onSave={handleSave}
        onClose={handleCloseModal}
      />

      <ConfirmDialog
        open={confirmDeleteId !== null}
        title="Desactivar gasto"
        description="Esta acción marcará el gasto como inactivo. No podrá reactivarse desde el panel."
        confirmLabel="Desactivar"
        cancelLabel="Cancelar"
        onConfirm={() => { if (confirmDeleteId) handleSoftDelete(confirmDeleteId); }}
        onCancel={() => setConfirmDeleteId(null)}
      />

      {toast && (
        <div className="fixed bottom-6 right-6 px-4 py-3 rounded-md bg-surface-container-high text-on-surface text-body-md shadow-lg z-50">
          {toast}
        </div>
      )}
    </>
  );
}
