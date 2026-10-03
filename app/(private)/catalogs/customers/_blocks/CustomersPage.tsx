"use client";

import { useState, useCallback } from "react";
import { useCurrentUser } from "../../../../_hooks/useCurrentUser";
import { useDebounce } from "../../../../_hooks/useDebounce";
import { useBranchesOptions } from "../../../../_hooks/useBranchesOptions";
import { useHeadquarters } from "../../../../_hooks/useHeadquarters";
import { useCustomers } from "../_logic/hooks/useCustomers";
import { useCustomerMutations } from "../_logic/hooks/useCustomerMutations";
import { CustomersTable } from "./CustomersTable";
import { CustomerEditModal } from "./CustomerEditModal";
import { PageShell } from "../../../../_components/organisms/PageShell";
import { CatalogToolbar } from "../../_blocks/CatalogToolbar";
import { CatalogPagination } from "../../_blocks/CatalogPagination";
import { CatalogEmpty } from "../../_blocks/CatalogEmpty";
import { CatalogError } from "../../_blocks/CatalogError";
import { ConfirmDialog } from "../../../../_components/molecules/ConfirmDialog/ConfirmDialog";
import { Skeleton } from "../../../../_components/atoms/Skeleton/Skeleton";
import { Select } from "../../../../_components/atoms/Select/Select";
import { EmptyState } from "../../../../_components/molecules/EmptyState/EmptyState";
import { CustomerCodeAlreadyInUseError, CustomerRfcAlreadyInUseError } from "../_logic/errors";
import type { Customer } from "../_logic/types/domain";
import type { CreateCustomerBody, UpdateCustomerBody } from "../_logic/types/api";

type ModalMode = "create" | "edit";

interface ModalState {
  mode: ModalMode;
  entity: Customer | null;
}

export function CustomersPage() {
  const { can, branchId: ownBranchId } = useCurrentUser();
  const isBypass = can("branches:access_all");
  const { options: branchOptions } = useBranchesOptions();
  const { hq } = useHeadquarters();
  const [branchFilter, setBranchFilter] = useState("");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebounce(searchInput, 300);
  const trimmedSearch = debouncedSearch.trim();
  const effectiveSearch = trimmedSearch.length >= 2 ? trimmedSearch : undefined;
  const [includeInactive, setIncludeInactive] = useState(false);
  const [modalState, setModalState] = useState<ModalState | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [rfcError, setRfcError] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const { items, total, isLoading, error, refresh } = useCustomers({
    page,
    pageSize,
    search: effectiveSearch,
    includeInactive,
    branchId: isBypass ? branchFilter || undefined : undefined,
  });
  const { isSaving, createOne, updateOne, softDeleteOne, reactivateOne, clearError } = useCustomerMutations();

  const canRead = can("customers:read");
  const canWrite = can("customers:write");

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }, []);

  const handleSearchChange = useCallback((value: string) => {
    setSearchInput(value);
    setPage(1);
  }, []);

  const handleCreate = useCallback(() => {
    clearError();
    setCodeError(null);
    setRfcError(null);
    setMutationError(null);
    setModalState({ mode: "create", entity: null });
  }, [clearError]);

  const handleEdit = useCallback(
    (entity: Customer) => {
      clearError();
      setCodeError(null);
      setRfcError(null);
      setMutationError(null);
      setModalState({ mode: "edit", entity });
    },
    [clearError],
  );

  const handleCloseModal = useCallback(() => {
    setModalState(null);
    setCodeError(null);
    setRfcError(null);
    setMutationError(null);
  }, []);

  const handleSave = useCallback(
    async (data: CreateCustomerBody | UpdateCustomerBody) => {
      if (!modalState) return;
      setCodeError(null);
      setRfcError(null);
      try {
        if (modalState.mode === "create") {
          const result = await createOne(data as CreateCustomerBody);
          if (result !== null) {
            refresh();
            setModalState(null);
            showToast("Cliente creado.");
          }
        } else {
          if (!modalState.entity) return;
          const result = await updateOne(modalState.entity.id, data as UpdateCustomerBody);
          if (result !== null) {
            refresh();
            setModalState(null);
            showToast("Cliente actualizado.");
          }
        }
      } catch (err) {
        if (err instanceof CustomerCodeAlreadyInUseError) {
          setCodeError("Este código ya está en uso.");
        } else if (err instanceof CustomerRfcAlreadyInUseError) {
          setRfcError("Este RFC ya está en uso por otro cliente.");
        } else {
          setMutationError((err as Error).message ?? "Error al guardar cliente.");
        }
      }
    },
    [modalState, createOne, updateOne, refresh, showToast],
  );

  const handleSoftDelete = useCallback(
    async (id: string) => {
      const ok = await softDeleteOne(id);
      if (ok) {
        setConfirmDeleteId(null);
        refresh();
        showToast("Cliente desactivado.");
      }
    },
    [softDeleteOne, refresh, showToast],
  );

  const handleReactivate = useCallback(
    async (id: string) => {
      try {
        const result = await reactivateOne(id);
        if (result !== null) {
          refresh();
          showToast("Cliente reactivado.");
        }
      } catch {
        // RFC duplicado en reactivar es muy improbable; ignorar y dejar que mutationError del hook lo registre.
      }
    },
    [reactivateOne, refresh, showToast],
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
          title="Sin acceso a este catálogo"
          description="No tienes permisos para ver los clientes. Contacta a un administrador."
        />
      </div>
    );
  }

  const filtered = trimmedSearch.length === 1;

  return (
    <>
      <PageShell
        title="Clientes"
        description="Gestiona los clientes, sus datos fiscales y crédito"
        toolbar={
          <div className="flex flex-col gap-3">
            {isBypass === true && (
              <div className="flex items-center gap-2">
                <label htmlFor="customers-branch-filter" className="text-label-lg text-on-surface-variant">Sucursal</label>
                <Select
                  id="customers-branch-filter"
                  value={branchFilter}
                  onChange={(e) => { setBranchFilter(e.target.value); setPage(1); }}
                  className="w-auto"
                >
                  <option value="">Todas las sucursales</option>
                  {branchOptions.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </Select>
              </div>
            )}
            <CatalogToolbar
              canWrite={canWrite === true}
              onCreate={handleCreate}
              searchValue={searchInput}
              onSearchChange={handleSearchChange}
              includeInactive={includeInactive}
              onIncludeInactiveChange={(val) => {
                setIncludeInactive(val);
                setPage(1);
              }}
              searchPlaceholder="Buscar por nombre, razón social o RFC..."
              searchScope="server"
              createButtonLabel="Nuevo cliente"
            />
          </div>
        }
      >
        {error ? (
          <CatalogError onRetry={refresh} />
        ) : items.length === 0 && !isLoading ? (
          <CatalogEmpty
            canWrite={canWrite === true}
            onCreate={handleCreate}
            filtered={trimmedSearch.length >= 2}
            onClearFilters={() => setSearchInput("")}
          />
        ) : (
          <CustomersTable
            items={items}
            canWrite={canWrite === true}
            isLoading={isLoading}
            onEdit={handleEdit}
            onSoftDelete={(id) => setConfirmDeleteId(id)}
            onReactivate={handleReactivate}
            onEnter={canWrite === true ? handleEdit : undefined}
            isBypass={isBypass === true}
            branches={branchOptions}
          />
        )}

        <CatalogPagination
          page={page}
          pageSize={pageSize}
          total={total}
          count={items.length}
          onPageChange={setPage}
          onPageSizeChange={(ps) => {
            setPageSize(ps);
            setPage(1);
          }}
        />
      </PageShell>

      {filtered && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 rounded-md bg-surface-container-high text-label-lg text-on-surface-variant shadow-md z-40">
          Mínimo 2 caracteres para buscar.
        </div>
      )}

      <CustomerEditModal
        open={modalState !== null}
        mode={modalState?.mode ?? "create"}
        entity={modalState?.entity ?? null}
        isSaving={isSaving}
        codeError={codeError}
        rfcError={rfcError}
        mutationError={mutationError}
        onSave={handleSave}
        onClose={handleCloseModal}
        branches={branchOptions}
        isBypass={isBypass === true}
        ownBranchId={ownBranchId}
        headquartersId={hq?.id ?? null}
      />

      <ConfirmDialog
        open={confirmDeleteId !== null}
        title="Desactivar cliente"
        description="Esta acción marcará el cliente como inactivo. Podrá reactivarse posteriormente."
        confirmLabel="Desactivar"
        cancelLabel="Cancelar"
        onConfirm={() => {
          if (confirmDeleteId) handleSoftDelete(confirmDeleteId);
        }}
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
