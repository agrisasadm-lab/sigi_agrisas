"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { IconButton } from "../../../_components/atoms/IconButton/IconButton";
import { Spinner } from "../../../_components/atoms/Spinner/Spinner";
import { Icon } from "../../../_components/atoms/Icon/Icon";
import { Table, THead, TBody, Tr, Th, Td } from "../../../_components/molecules/DataTable/DataTable";
import { useTableKeyboard } from "../../../_hooks/useTableKeyboard";
import type { ProductDto } from "../_logic/types/api";

interface ProductCatalogTableProps {
  items: ProductDto[];
  total: number;
  page: number;
  pageSize: number;
  isLoading: boolean;
  error: Error | null;
  onAddProduct: (product: ProductDto) => void;
  onPageChange: (page: number) => void;
}

export function ProductCatalogTable({
  items,
  total,
  page,
  pageSize,
  isLoading,
  error,
  onAddProduct,
  onPageChange,
}: ProductCatalogTableProps) {
  const totalPages = Math.ceil(total / pageSize);
  const [focusTarget, setFocusTarget] = useState<"first" | "last" | null>(null);
  const pageThrottleRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (pageThrottleRef.current) clearTimeout(pageThrottleRef.current); }, []);

  const onPageDown = useCallback(() => {
    if (page >= totalPages || pageThrottleRef.current) return;
    setFocusTarget("first");
    onPageChange(page + 1);
    pageThrottleRef.current = setTimeout(() => { pageThrottleRef.current = null; }, 150);
  }, [page, totalPages, onPageChange]);

  const onPageUp = useCallback(() => {
    if (page <= 1 || pageThrottleRef.current) return;
    setFocusTarget("last");
    onPageChange(page - 1);
    pageThrottleRef.current = setTimeout(() => { pageThrottleRef.current = null; }, 150);
  }, [page, onPageChange]);

  const { getRowProps, rowRefs, setFocusedIndex } = useTableKeyboard(items, onAddProduct, {
    onPageDown,
    onPageUp,
  });

  useEffect(() => {
    if (!focusTarget || items.length === 0) return;
    if (focusTarget === "first") {
      setFocusedIndex(0);
      rowRefs.current[0]?.focus();
    } else {
      const last = items.length - 1;
      setFocusedIndex(last);
      rowRefs.current[last]?.focus();
    }
    setFocusTarget(null);
  }, [items, focusTarget, setFocusedIndex, rowRefs]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-8 text-center text-body-sm text-error">
        Error al cargar productos. Intenta de nuevo.
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="py-8 text-center text-body-sm text-on-surface-variant">
        Sin productos
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <div className="overflow-x-auto">
        <Table className="text-left text-body-md">
          <THead>
            <Tr hoverable={false}>
              <Th className="py-2 text-label-lg font-medium normal-case tracking-normal text-on-surface-variant">Código</Th>
              <Th className="py-2 text-label-lg font-medium normal-case tracking-normal text-on-surface-variant">Nombre</Th>
              <Th className="py-2 text-label-lg font-medium normal-case tracking-normal text-on-surface-variant hidden md:table-cell">Departamento</Th>
              <Th align="right" className="py-2 text-label-lg font-medium normal-case tracking-normal text-on-surface-variant">Existencias</Th>
              <Th align="right" className="py-2 text-label-lg font-medium normal-case tracking-normal text-on-surface-variant">Acción</Th>
            </Tr>
          </THead>
          <TBody>
            {items.map((product, idx) => (
              <Tr
                key={product.id}
                {...getRowProps(idx)}
                onClick={() => onAddProduct(product)}
                className="focus:bg-surface-container focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary cursor-pointer"
              >
                <Td className="py-2 font-mono text-label-lg text-on-surface-variant">{product.code}</Td>
                <Td className="py-2 text-body-sm font-medium">{product.name}</Td>
                <Td className="py-2 text-body-sm text-on-surface-variant hidden md:table-cell">
                  {product.departmentName ?? "—"}
                </Td>
                <Td
                  align="right"
                  className={`py-2 text-body-sm ${
                    product.stock !== null && product.stock <= 0 ? "text-error font-medium" : "text-on-surface-variant"
                  }`}
                >
                  {product.stock ?? "—"}
                </Td>
                <Td align="right" className="py-2">
                  <span className="inline-flex items-center gap-1 text-label-sm text-primary font-medium">
                    <Icon name="add" size={14} />
                    Añadir
                  </span>
                </Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-3 py-2 border-t border-outline-variant">
          <span className="text-label-sm text-on-surface-variant">
            {total} productos
          </span>
          <div className="flex items-center gap-1">
            <IconButton
              icon="chevron_left"
              iconSize={18}
              ariaLabel="Página anterior"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
              className="rounded-sm p-1 disabled:opacity-40 hover:bg-surface-container"
            />
            <span className="text-label-sm tabular-nums">{page} / {totalPages}</span>
            <IconButton
              icon="chevron_right"
              iconSize={18}
              ariaLabel="Página siguiente"
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
              className="rounded-sm p-1 disabled:opacity-40 hover:bg-surface-container"
            />
          </div>
        </div>
      )}
    </div>
  );
}
