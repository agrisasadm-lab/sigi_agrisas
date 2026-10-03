"use client";

import { Icon } from "../../../../_components/atoms/Icon/Icon";
import { Skeleton } from "../../../../_components/atoms/Skeleton/Skeleton";
import { CatalogStatusBadge } from "../../_blocks/CatalogStatusBadge";
import type { Customer } from "../_logic/types/domain";
import { useTableKeyboard } from "../../../../_hooks/useTableKeyboard";

const MX_CURRENCY = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  minimumFractionDigits: 2,
});

function formatCurrency(value: number): string {
  return MX_CURRENCY.format(value);
}

interface CustomersTableProps {
  items: Customer[];
  canWrite: boolean;
  isLoading?: boolean;
  onEdit: (item: Customer) => void;
  onSoftDelete: (id: string) => void;
  onReactivate: (id: string) => void;
  onEnter?: (item: Customer) => void;
  /** Columna "Sucursales" sólo visible con branches:access_all. */
  isBypass?: boolean;
  branches?: Array<{ id: string; name: string }>;
}

export function CustomersTable({
  items,
  canWrite,
  isLoading,
  onEdit,
  onSoftDelete,
  onReactivate,
  onEnter,
  isBypass = false,
  branches = [],
}: CustomersTableProps) {
  const noop = () => {};
  const { getRowProps } = useTableKeyboard(items, onEnter ?? noop);
  const branchName = (id: string) => branches.find((b) => b.id === id)?.name ?? id;

  if (isLoading) {
    return (
      <div className="space-y-2 p-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} height={56} className="w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-body-md">
        <thead>
          <tr className="border-b border-outline-variant bg-surface-container">
            <th className="text-left px-4 py-3 text-label-lg text-on-surface-variant font-medium">Código</th>
            <th className="text-left px-4 py-3 text-label-lg text-on-surface-variant font-medium">Nombre</th>
            <th className="text-left px-4 py-3 text-label-lg text-on-surface-variant font-medium">RFC</th>
            <th className="text-left px-4 py-3 text-label-lg text-on-surface-variant font-medium">Límite de crédito</th>
            <th className="text-left px-4 py-3 text-label-lg text-on-surface-variant font-medium">Saldo inicial</th>
            <th className="text-left px-4 py-3 text-label-lg text-on-surface-variant font-medium">Saldo actual</th>
            <th className="text-left px-4 py-3 text-label-lg text-on-surface-variant font-medium">Plazo (días)</th>
            <th className="text-left px-4 py-3 text-label-lg text-on-surface-variant font-medium">Estado</th>
            {isBypass && (
              <th className="text-left px-4 py-3 text-label-lg text-on-surface-variant font-medium">Sucursales</th>
            )}
            {canWrite && (
              <th className="text-right px-4 py-3 text-label-lg text-on-surface-variant font-medium">Acciones</th>
            )}
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => (
            <tr
              key={item.id}
              {...getRowProps(idx)}
              className="border-b border-outline-variant last:border-0 hover:bg-surface-container-low focus:bg-surface-container focus:outline-none transition-colors cursor-default"
            >
              <td className="px-4 py-3 font-mono text-on-surface">{item.code}</td>
              <td className="px-4 py-3 text-on-surface max-w-[220px]">
                <div className="truncate" title={item.name}>{item.name}</div>
                {item.legalName && (
                  <div className="text-label-sm text-on-surface-variant truncate" title={item.legalName}>
                    {item.legalName}
                  </div>
                )}
              </td>
              <td className="px-4 py-3 font-mono text-on-surface-variant">{item.rfc ?? "—"}</td>
              <td className="px-4 py-3 text-on-surface-variant">
                {item.creditLimit !== null ? formatCurrency(item.creditLimit) : <span>—</span>}
              </td>
              <td className="px-4 py-3 text-on-surface-variant">{formatCurrency(item.initialBalance)}</td>
              <td className="px-4 py-3 text-on-surface-variant">{formatCurrency(item.currentBalance)}</td>
              <td className="px-4 py-3 text-on-surface-variant">{item.creditDays}</td>
              <td className="px-4 py-3">
                <CatalogStatusBadge isActive={item.isActive} />
              </td>
              {isBypass && (
                <td className="px-4 py-3 text-on-surface-variant max-w-[200px] truncate" title={item.branchIds.map(branchName).join(", ")}>
                  {item.branchIds.map(branchName).join(", ")}
                </td>
              )}
              {canWrite && (
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    {item.isActive ? (
                      <>
                        <button
                          type="button"
                          onClick={() => onEdit(item)}
                          title="Editar"
                          className="p-2 rounded text-on-surface-variant hover:bg-surface-container-high hover:text-primary transition-colors"
                        >
                          <Icon name="edit" size={18} />
                        </button>
                        <button
                          type="button"
                          onClick={() => onSoftDelete(item.id)}
                          title="Desactivar"
                          className="p-2 rounded text-on-surface-variant hover:bg-error-container hover:text-error transition-colors"
                        >
                          <Icon name="delete" size={18} />
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onReactivate(item.id)}
                        title="Reactivar"
                        className="p-2 rounded text-on-surface-variant hover:bg-tertiary-container hover:text-on-tertiary-container transition-colors"
                      >
                        <Icon name="restore" size={18} />
                      </button>
                    )}
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
