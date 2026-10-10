"use client";

import { IconButton } from "../../../../_components/atoms/IconButton/IconButton";
import { Skeleton } from "../../../../_components/atoms/Skeleton/Skeleton";
import { Table, THead, TBody, Tr, Th, Td } from "../../../../_components/molecules/DataTable/DataTable";
import { CatalogStatusBadge } from "../../_blocks/CatalogStatusBadge";
import type { Branch } from "../_logic/types/domain";
import { useTableKeyboard } from "../../../../_hooks/useTableKeyboard";

interface BranchesTableProps {
  items: Branch[];
  canWrite: boolean;
  isLoading?: boolean;
  onEdit: (item: Branch) => void;
  onSoftDelete: (id: string) => void;
  onReactivate: (id: string) => void;
  onEnter?: (item: Branch) => void;
}

export function BranchesTable({
  items,
  canWrite,
  isLoading,
  onEdit,
  onSoftDelete,
  onReactivate,
  onEnter,
}: BranchesTableProps) {
  const noop = () => {};
  const { getRowProps } = useTableKeyboard(items, onEnter ?? noop);

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
            <Th>Dirección</Th>
            <Th>Teléfono</Th>
            <Th>Email</Th>
            <Th>Estado</Th>
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
              <Td className="text-on-surface">{item.name}</Td>
              <Td className="text-on-surface-variant">
                {item.address ? (
                  <span title={item.address}>
                    {item.address.length > 40
                      ? item.address.slice(0, 40) + "…"
                      : item.address}
                  </span>
                ) : (
                  <span>—</span>
                )}
              </Td>
              <Td className="text-on-surface-variant">
                {item.phone ?? <span>—</span>}
              </Td>
              <Td className="text-on-surface-variant">
                {item.email ?? <span>—</span>}
              </Td>
              <Td>
                <CatalogStatusBadge isActive={item.isActive} />
              </Td>
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
