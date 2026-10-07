"use client";

import Link from "next/link";
import { Icon } from "../../../_components/atoms/Icon/Icon";
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
      <table className="w-full text-left text-body-md">
        <thead>
          <tr className="border-b border-outline-variant text-label-lg text-on-surface-variant">
            <th className="px-4 py-3 font-medium">Código</th>
            <th className="px-4 py-3 font-medium">Producto</th>
            <th className="px-4 py-3 font-medium text-right">Cantidad</th>
            <th className="px-4 py-3 font-medium text-right">Reservado</th>
            <th className="px-4 py-3 font-medium text-right">Disponible</th>
            <th className="px-4 py-3 font-medium text-right">P. reorden</th>
            <th className="px-4 py-3 font-medium">Caducidad</th>
            {showActions && <th className="px-4 py-3 font-medium">Acciones</th>}
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => {
            const available = item.quantity - item.reservedQuantity;
            const isLow = item.quantity < item.reorderPoint;
            return (
              <tr
                key={item.id}
                {...getRowProps(idx)}
                className={`border-b border-outline-variant focus:outline-none transition-colors cursor-default ${isLow ? "bg-error-container/20 hover:bg-error-container/30 focus:bg-error-container/30" : "hover:bg-surface-container-low focus:bg-surface-container"}`}
              >
                <td className="px-4 py-3 font-mono text-label-lg">
                  <div className="flex items-center gap-2">
                    {isLow && <Icon name="warning" size={14} className="text-error flex-shrink-0" />}
                    {item.productCode}
                  </div>
                </td>
                <td className="px-4 py-3">{item.productName}</td>
                <td className="px-4 py-3 text-right font-medium">{item.quantity}</td>
                <td className="px-4 py-3 text-right text-on-surface-variant">{item.reservedQuantity}</td>
                <td className={`px-4 py-3 text-right font-medium ${available <= 0 ? "text-error" : ""}`}>{available}</td>
                <td className="px-4 py-3 text-right text-on-surface-variant">{item.reorderPoint}</td>
                <td className="px-4 py-3">
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
                </td>
                {showActions && (
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {canWrite && (
                        <>
                          <button type="button" onClick={() => onAdjust(item)} className="inline-flex items-center gap-1 px-2 py-1 rounded text-label-sm text-primary hover:bg-primary/10 transition-colors" title="Ajustar stock">
                            <Icon name="tune" size={14} />Ajustar
                          </button>
                          <button type="button" onClick={() => onEdit(item)} className="p-1 rounded hover:bg-surface-container text-on-surface-variant" title="Editar registro">
                            <Icon name="edit" size={14} />
                          </button>
                          <button type="button" onClick={() => onRemove(item)} className="p-1 rounded hover:bg-error/10 text-error" title="Quitar de sucursal">
                            <Icon name="remove_circle" size={14} />
                          </button>
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
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
