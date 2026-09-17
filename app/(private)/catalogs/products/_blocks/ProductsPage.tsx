"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCurrentUser } from "../../../../_hooks/useCurrentUser";
import { useDebounce } from "../../../../_hooks/useDebounce";
import { useProducts } from "../_logic/hooks/useProducts";
import { useProductMutations } from "../_logic/hooks/useProductMutations";
import { useDepartmentsOptions } from "../../../../_hooks/useDepartmentsOptions";
import { useProvidersOptions } from "../../../../_hooks/useProvidersOptions";
import { useInventoryScopeMode } from "../../../../_hooks/useInventoryScopeMode";
import { ProductsTable } from "./ProductsTable";
import { ProductEditModal } from "./ProductEditModal";
import { PageShell } from "../../../../_components/organisms/PageShell";
import { CatalogToolbar } from "../../_blocks/CatalogToolbar";
import { CatalogPagination } from "../../_blocks/CatalogPagination";
import { CatalogEmpty } from "../../_blocks/CatalogEmpty";
import { CatalogError } from "../../_blocks/CatalogError";
import { ConfirmDialog } from "../../../../_components/molecules/ConfirmDialog/ConfirmDialog";
import { Skeleton } from "../../../../_components/atoms/Skeleton/Skeleton";
import { Icon } from "../../../../_components/atoms/Icon/Icon";
import { EmptyState } from "../../../../_components/molecules/EmptyState/EmptyState";
import { ProductCodeAlreadyInUseError, ProductDepartmentInvalidError } from "../_logic/errors";
import { uploadProductImage } from "../_logic/services/uploadProductImage";
import type { Product } from "../_logic/types/domain";
import type { CreateProductBody, UpdateProductBody } from "../_logic/types/api";

type ModalMode = "create" | "edit";

interface ModalState {
  mode: ModalMode;
  entity: Product | null;
}

interface CreateSuccess {
  productId: string;
  productCode: string;
  productName: string;
}

export function ProductsPage() {
  const router = useRouter();
  const { can } = useCurrentUser();
  const { mode: inventoryScopeMode } = useInventoryScopeMode();

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebounce(searchInput, 300);
  const trimmedSearch = debouncedSearch.trim();
  const effectiveSearch = trimmedSearch.length >= 2 ? trimmedSearch : undefined;
  const [departmentId, setDepartmentId] = useState<string | undefined>(undefined);
  const [providerId, setProviderId] = useState<string | undefined>(undefined);
  const [includeInactive, setIncludeInactive] = useState(false);
  const [modalState, setModalState] = useState<ModalState | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [deptError, setDeptError] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [imageUploadWarning, setImageUploadWarning] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<CreateSuccess | null>(null);

  const { items, total, isLoading, error, refresh } = useProducts({
    page,
    pageSize,
    search: effectiveSearch,
    departmentId,
    providerId,
    includeInactive,
  });

  const { isSaving, createOne, updateOne, softDeleteOne, reactivateOne, clearError } = useProductMutations();
  const { options: deptOptions, isLoading: deptLoading } = useDepartmentsOptions(providerId);
  const { options: providerOptions, isLoading: providerLoading } = useProvidersOptions();

  const canRead = can("products:read");
  const canWrite = can("products:write");
  const canWriteInventory = can("inventory:write");

  const handleSearchChange = useCallback((val: string) => {
    setSearchInput(val);
    setPage(1);
  }, []);

  const handleDepartmentChange = useCallback((val: string) => {
    setDepartmentId(val || undefined);
    setPage(1);
  }, []);

  const handleProviderChange = useCallback((val: string) => {
    setProviderId(val || undefined);
    setDepartmentId(undefined);
    setPage(1);
  }, []);

  const handleIncludeInactiveChange = useCallback((val: boolean) => {
    setIncludeInactive(val);
    setPage(1);
  }, []);

  const handleCreate = useCallback(() => {
    setCodeError(null);
    setDeptError(null);
    setMutationError(null);
    setImageUploadWarning(null);
    setCreateSuccess(null);
    clearError();
    setModalState({ mode: "create", entity: null });
  }, [clearError]);

  const handleEdit = useCallback((entity: Product) => {
    setCodeError(null);
    setDeptError(null);
    setMutationError(null);
    setImageUploadWarning(null);
    setCreateSuccess(null);
    clearError();
    setModalState({ mode: "edit", entity });
  }, [clearError]);

  const handleManage = useCallback((entity: Product) => {
    router.push(`/catalogs/products/${entity.id}`);
  }, [router]);

  const handleSave = useCallback(async (data: CreateProductBody | UpdateProductBody, stagedImage?: File | null) => {
    setCodeError(null);
    setDeptError(null);
    setMutationError(null);
    setImageUploadWarning(null);
    try {
      if (modalState?.mode === "create") {
        const product = await createOne(data as CreateProductBody);
        if (product && inventoryScopeMode === "branch") {
          setCreateSuccess({ productId: product.id, productCode: product.code, productName: product.name });
        }
        if (product && stagedImage) {
          try {
            await uploadProductImage(product.id, stagedImage);
          } catch {
            setImageUploadWarning("Producto creado pero la imagen no pudo subirse.");
            refresh();
            return;
          }
        }
      } else if (modalState?.entity) {
        await updateOne(modalState.entity.id, data as UpdateProductBody);
      }
      setModalState(null);
      refresh();
    } catch (err) {
      if (err instanceof ProductCodeAlreadyInUseError) {
        setCodeError("Este código ya está en uso.");
      } else if (err instanceof ProductDepartmentInvalidError) {
        setDeptError("El departamento no existe o está inactivo.");
      } else {
        setMutationError((err as Error).message ?? "Error al guardar.");
      }
    }
  }, [modalState, createOne, updateOne, refresh, inventoryScopeMode]);

  const handleConfirmDelete = useCallback(async () => {
    if (!confirmDeleteId) return;
    const ok = await softDeleteOne(confirmDeleteId);
    if (ok) {
      setConfirmDeleteId(null);
      refresh();
    }
  }, [confirmDeleteId, softDeleteOne, refresh]);

  const handleReactivate = useCallback(async (entity: Product) => {
    await reactivateOne(entity.id);
    refresh();
  }, [reactivateOne, refresh]);

  if (canRead === false) {
    return (
      <EmptyState
        icon="lock"
        title="Sin acceso"
        description="No tienes permiso para ver el catálogo de productos."
      />
    );
  }

  const toolbar = (
    <div className="flex flex-col gap-3">
      <CatalogToolbar
        canWrite={canWrite === true}
        onCreate={handleCreate}
        searchValue={searchInput}
        onSearchChange={handleSearchChange}
        includeInactive={includeInactive}
        onIncludeInactiveChange={handleIncludeInactiveChange}
        searchPlaceholder="Buscar productos..."
        searchScope="server"
        createButtonLabel="Nuevo producto"
      />
      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={providerId ?? ""}
          onChange={(e) => handleProviderChange(e.target.value)}
          disabled={providerLoading}
          className="rounded-md border border-outline-variant bg-surface-container-lowest text-body-md text-on-surface px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="">Todos los proveedores</option>
          {providerOptions.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <select
          value={departmentId ?? ""}
          onChange={(e) => handleDepartmentChange(e.target.value)}
          disabled={deptLoading}
          className="rounded-md border border-outline-variant bg-surface-container-lowest text-body-md text-on-surface px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="">Todos los departamentos</option>
          {deptOptions.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
      </div>
    </div>
  );

  return (
    <>
      <PageShell
        title="Productos"
        description="Gestiona el catálogo de productos, precios y dosificaciones."
        toolbar={toolbar}
      >
        {inventoryScopeMode === "branch" && (
          <div className="px-6 pt-4">
            <p className="text-body-sm text-on-surface-variant">
              Inventario por sucursal activo: los productos deben asignarse a cada sucursal desde Inventario para poder venderse ahí.
            </p>
          </div>
        )}
        {createSuccess && (
          <div className="mx-6 mt-4 flex items-center justify-between gap-3 rounded-md bg-primary-container px-4 py-3 text-label-lg text-on-primary-container">
            <span>
              <strong>{createSuccess.productCode}</strong> — {createSuccess.productName} creado.
              {canWriteInventory === true && (
                <>
                  {" "}
                  <Link href="/inventory" className="underline font-medium">
                    Asignar a sucursal
                  </Link>
                </>
              )}
            </span>
            <button type="button" onClick={() => setCreateSuccess(null)} className="shrink-0 p-1 rounded hover:bg-black/10" title="Descartar">
              <Icon name="close" size={16} />
            </button>
          </div>
        )}
        {isLoading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-md" />
            ))}
          </div>
        ) : error ? (
          <CatalogError onRetry={refresh} />
        ) : total === 0 ? (
          <CatalogEmpty canWrite={canWrite === true} onCreate={canWrite === true ? () => { setCreateSuccess(null); setModalState({ mode: "create", entity: null }); } : undefined} />
        ) : (
          <>
            <ProductsTable
              items={items}
              canWrite={canWrite === true}
              onEdit={handleEdit}
              onManage={handleManage}
              onDelete={(entity) => setConfirmDeleteId(entity.id)}
              onReactivate={handleReactivate}
              onEnter={handleManage}
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
      </PageShell>

      {modalState && (
        <ProductEditModal
          open
          mode={modalState.mode}
          entity={modalState.entity}
          isSaving={isSaving}
          codeError={codeError}
          deptError={deptError}
          mutationError={mutationError}
          imageUploadWarning={imageUploadWarning}
          deptOptions={deptOptions}
          onSave={handleSave}
          onClose={() => { setModalState(null); setImageUploadWarning(null); }}
        />
      )}

      <ConfirmDialog
        open={!!confirmDeleteId}
        title="¿Desactivar este producto?"
        description="El producto quedará inactivo. Puedes reactivarlo más tarde."
        confirmLabel="Desactivar"
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </>
  );
}
