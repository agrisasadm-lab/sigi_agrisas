"use client";

import Link from "next/link";
import { Icon } from "../../../../_components/atoms/Icon/Icon";
import { Button } from "../../../../_components/atoms/Button/Button";
import { ProductImage } from "../../../../_components/atoms/ProductImage/ProductImage";
import { Table, THead, TBody, Tr, Th, Td } from "../../../../_components/molecules/DataTable/DataTable";
import { CatalogStatusBadge } from "../../_blocks/CatalogStatusBadge";
import type { Product } from "../_logic/types/domain";
import { useTableKeyboard } from "../../../../_hooks/useTableKeyboard";

function formatTaxRate(rate: number | null): string {
  if (rate === null) return "—";
  return `${(rate * 100).toFixed(0)}%`;
}

interface ProductsTableProps {
  items: Product[];
  canWrite: boolean;
  onEdit: (entity: Product) => void;
  onManage: (entity: Product) => void;
  onDelete: (entity: Product) => void;
  onReactivate: (entity: Product) => void;
  onEnter?: (item: Product) => void;
}

export function ProductsTable({
  items,
  canWrite,
  onEdit,
  onManage,
  onDelete,
  onReactivate,
  onEnter,
}: ProductsTableProps) {
  const noop = () => {};
  const { getRowProps } = useTableKeyboard(items, onEnter ?? noop);

  return (
    <div className="overflow-x-auto">
      <Table className="text-left">
        <THead>
          <Tr hoverable={false}>
            <Th className="w-12"></Th>
            <Th>Código</Th>
            <Th>Nombre</Th>
            <Th>Departamento</Th>
            <Th>Proveedor</Th>
            <Th>Tasa</Th>
            <Th>Unidad</Th>
            <Th align="right">IVA</Th>
            <Th align="right">IEPS</Th>
            <Th>Sujeto a impuestos</Th>
            <Th>Estado</Th>
            <Th>Acciones</Th>
          </Tr>
        </THead>
        <TBody>
          {items.map((item, idx) => (
            <Tr
              key={item.id}
              {...getRowProps(idx)}
              className="focus:bg-surface-container focus:outline-none cursor-default"
            >
              <Td className="px-2 py-2">
                <ProductImage src={item.imageUrl ?? null} alt={item.name} size={40} />
              </Td>
              <Td className="font-mono text-label-lg">{item.code}</Td>
              <Td>{item.name}</Td>
              <Td className="text-on-surface-variant">{item.departmentName}</Td>
              <Td className="text-on-surface-variant">{item.providerName ?? "—"}</Td>
              <Td className="font-mono text-on-surface-variant text-label-sm">{item.taxRateCode ?? "—"}</Td>
              <Td className="text-on-surface-variant">{item.unitDescription ?? item.unit}</Td>
              <Td align="right">{formatTaxRate(item.ivaRate)}</Td>
              <Td align="right">{formatTaxRate(item.iepsRate)}</Td>
              <Td>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-label-sm font-medium ${item.isTaxable ? "bg-tertiary-container text-on-tertiary-container" : "bg-surface-container-high text-on-surface-variant"}`}>
                  {item.isTaxable ? "Sí" : "No"}
                </span>
              </Td>
              <Td>
                <CatalogStatusBadge isActive={item.isActive} />
              </Td>
              <Td>
                <div className="flex items-center gap-2">
                  <Link
                    href={`/catalogs/products/${item.id}`}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded text-label-sm text-primary hover:bg-primary/10 transition-colors"
                  >
                    <Icon name="open_in_new" size={14} />
                    Gestionar
                  </Link>
                  {canWrite && (
                    <>
                      <Button
                        type="button"
                        variant="text"
                        size="sm"
                        icon="edit"
                        onClick={() => onEdit(item)}
                        title="Editar"
                        aria-label="Editar"
                        className="px-2 py-1 text-on-surface-variant hover:bg-surface-container"
                      />
                      {item.isActive ? (
                        <Button
                          type="button"
                          variant="text"
                          size="sm"
                          icon="block"
                          onClick={() => onDelete(item)}
                          title="Desactivar"
                          aria-label="Desactivar"
                          className="px-2 py-1 text-error hover:bg-error/10"
                        />
                      ) : (
                        <Button
                          type="button"
                          variant="text"
                          size="sm"
                          icon="check_circle"
                          onClick={() => onReactivate(item)}
                          title="Reactivar"
                          className="px-2 py-1 hover:bg-primary/10"
                        >
                          Reactivar
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </Td>
            </Tr>
          ))}
        </TBody>
      </Table>
    </div>
  );
}
