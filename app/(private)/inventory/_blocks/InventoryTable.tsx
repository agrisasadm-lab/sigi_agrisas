"use client";

import Link from "next/link";
import { Icon } from "../../../_components/atoms/Icon/Icon";
import { Button } from "../../../_components/atoms/Button/Button";
import { IconButton } from "../../../_components/atoms/IconButton/IconButton";
import { Table, THead, TBody, Tr, Th, Td } from "../../../_components/molecules/DataTable/DataTable";
import type { InventoryItem } from "../_logic/types/domain";
import { useTableKeyboard } from "../../../_hooks/useTableKeyboard";
import { ExpiryStatusBadge } from "./ExpiryStatusBadge";
import { fmtDateOnly } from "../../../_lib/formatDate";

interface InventoryTableProps {
  items: InventoryItem[];
  canWrite: boolean;
  canViewKardex?: boolean;
  onAdjust: (item: InventoryItem) => void;
  onEdit: (item: InventoryItem) => void;
  onRemove: (item: InventoryItem) => void;
  onEnter?: (item: InventoryItem) => void;
}

export function InventoryTable({ items, canWrite, canViewKardex = false, onAdjust, onEdit, onRemove, onEnter }: InventoryTableProps) {
  const noop = () => {};
  const { getRowProps } = useTableKeyboard(items, onEnter ?? noop);
  const showActions = canWrite || canViewKardex;

  return (
    <div className="overflow-x-auto">
      <Table className="text-left text-body-md">
        <THead>
          <Tr hoverable={false} className="text-label-lg text-on-surface-variant normal-case tracking-normal">
            <Th className="font-medium normal-case tracking-normal">Código</Th>
            <Th className="font-medium normal-case tracking-normal">Producto</Th>
            <Th align="right" className="font-medium normal-case tracking-normal">Cantidad</Th>
            <Th align="right" className="font-medium normal-case tracking-normal">Reservado</Th>
            <Th align="right" className="font-medium normal-case tracking-normal">Disponible</Th>
            <Th align="right" className="font-medium normal-case tracking-normal">P. reorden</Th>
            <Th className="font-medium normal-case tracking-normal">Caducidad</Th>
            {showActions && <Th className="font-medium normal-case tracking-normal">Acciones</Th>}
          </Tr>
        </THead>
        <TBody>
          {items.map((item, idx) => {
            const available = item.quantity - item.reservedQuantity;
            const isLow = item.quantity < item.reorderPoint;
            return (
              <Tr
                key={item.id}
                {...getRowProps(idx)}
                hoverable={false}
                className={`border-b border-outline-variant focus:outline-none cursor-default ${isLow ? "bg-error-container/20 hover:bg-error-container/30 focus:bg-error-container/30" : "hover:bg-surface-container-low focus:bg-surface-container"}`}
              >
                <Td className="font-mono text-label-lg">
                  <div className="flex items-center gap-2">
                    {isLow && <Icon name="warning" size={14} className="text-error flex-shrink-0" />}
                    {item.productCode}
                  </div>
                </Td>
                <Td>{item.productName}</Td>
                <Td align="right" className="font-medium">{item.quantity}</Td>
                <Td align="right" className="text-on-surface-variant">{item.reservedQuantity}</Td>
                <Td align="right" className={`font-medium ${available <= 0 ? "text-error" : ""}`}>{available}</Td>
                <Td align="right" className="text-on-surface-variant">{item.reorderPoint}</Td>
                <Td>
                  {item.expiryStatus && (
                    <div className="flex flex-col gap-0.5">
                      <ExpiryStatusBadge status={item.expiryStatus} />
                      {item.nearestExpirationDate && (
                        <span className="text-label-sm text-on-surface-variant">
                          {fmtDateOnly(item.nearestExpirationDate)}
                        </span>
                      )}
                    </div>
                  )}
                </Td>
                {showActions && (
                  <Td>
                    <div className="flex items-center gap-2">
                      {canWrite && (
                        <>
                          <Button type="button" variant="text" onClick={() => onAdjust(item)} title="Ajustar stock" className="gap-1 rounded px-2 py-1 text-label-sm hover:bg-primary/10">
                            <Icon name="tune" size={14} />Ajustar
                          </Button>
                          <IconButton icon="edit" iconSize={14} ariaLabel="Editar registro" onClick={() => onEdit(item)} title="Editar registro" className="rounded p-1 text-on-surface-variant hover:bg-surface-container" />
                          <IconButton icon="remove_circle" iconSize={14} ariaLabel="Quitar de sucursal" onClick={() => onRemove(item)} title="Quitar de sucursal" className="rounded p-1 text-error hover:bg-error/10" />
                        </>
                      )}
                      {canViewKardex && (
                        <Link
                          href={`/inventory/kardex?productId=${item.productId}&branchId=${item.branchId}`}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded text-label-sm text-on-surface-variant hover:bg-surface-container transition-colors"
                          title="Ver Kardex"
                        >
                          <Icon name="summarize" size={14} />Ver Kardex
                        </Link>
                      )}
                    </div>
                  </Td>
                )}
              </Tr>
            );
          })}
        </TBody>
      </Table>
    </div>
  );
}
