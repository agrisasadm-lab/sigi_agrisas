"use client";

import { IconButton } from "../../../../_components/atoms/IconButton/IconButton";
import { Skeleton } from "../../../../_components/atoms/Skeleton/Skeleton";
import { Table, THead, TBody, Tr, Th, Td } from "../../../../_components/molecules/DataTable/DataTable";
import { CatalogStatusBadge } from "../../_blocks/CatalogStatusBadge";
import type { Customer } from "../_logic/types/domain";
import { useTableKeyboard } from "../../../../_hooks/useTableKeyboard";
import { formatMxCurrency } from "../../../../_lib/formatMxCurrency";

function formatCurrency(value: number): string {
  return formatMxCurrency(value);
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
      <Table>
        <THead>
          <Tr hoverable={false}>
            <Th>Código</Th>
            <Th>Nombre</Th>
            <Th>RFC</Th>
            <Th>Límite de crédito</Th>
            <Th>Saldo inicial</Th>
            <Th>Saldo actual</Th>
            <Th>Plazo (días)</Th>
            <Th>Estado</Th>
            {isBypass && <Th>Sucursales</Th>}
            {canWrite && <Th align="right">Acciones</Th>}
          </Tr>
        </THead>
        <TBody>
          {items.map((item, idx) => (
            <Tr
              key={item.id}
              {...getRowProps(idx)}
              className="focus:bg-surface-container focus:outline-none cursor-default"
            >
              <Td className="font-mono text-on-surface">{item.code}</Td>
              <Td className="text-on-surface max-w-[220px]">
                <div className="truncate" title={item.name}>{item.name}</div>
                {item.legalName && (
                  <div className="text-label-sm text-on-surface-variant truncate" title={item.legalName}>
                    {item.legalName}
                  </div>
                )}
              </Td>
              <Td className="font-mono text-on-surface-variant">{item.rfc ?? "—"}</Td>
              <Td className="text-on-surface-variant">
                {item.creditLimit !== null ? formatCurrency(item.creditLimit) : <span>—</span>}
              </Td>
              <Td className="text-on-surface-variant">{formatCurrency(item.initialBalance)}</Td>
              <Td className="text-on-surface-variant">{formatCurrency(item.currentBalance)}</Td>
              <Td className="text-on-surface-variant">{item.creditDays}</Td>
              <Td>
                <CatalogStatusBadge isActive={item.isActive} />
              </Td>
              {isBypass && (
                <Td className="text-on-surface-variant max-w-[200px] truncate" title={item.branchIds.map(branchName).join(", ")}>
                  {item.branchIds.map(branchName).join(", ")}
                </Td>
              )}
              {canWrite && (
                <Td align="right">
                  <div className="flex items-center justify-end gap-1">
                    {item.isActive ? (
                      <>
                        <IconButton
                          icon="edit"
                          iconSize={18}
                          ariaLabel="Editar"
                          title="Editar"
                          variant="ghost"
                          onClick={() => onEdit(item)}
                          className="rounded p-2 hover:text-primary"
                        />
                        <IconButton
                          icon="delete"
                          iconSize={18}
                          ariaLabel="Desactivar"
                          title="Desactivar"
                          variant="ghost"
                          onClick={() => onSoftDelete(item.id)}
                          className="rounded p-2 hover:bg-error-container hover:text-error"
                        />
                      </>
                    ) : (
                      <IconButton
                        icon="restore"
                        iconSize={18}
                        ariaLabel="Reactivar"
                        title="Reactivar"
                        variant="ghost"
                        onClick={() => onReactivate(item.id)}
                        className="rounded p-2 hover:bg-tertiary-container hover:text-on-tertiary-container"
                      />
                    )}
                  </div>
                </Td>
              )}
            </Tr>
          ))}
        </TBody>
      </Table>
    </div>
  );
}
