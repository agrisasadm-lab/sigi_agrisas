"use client";

import { IconButton } from "../../../../_components/atoms/IconButton/IconButton";
import { Skeleton } from "../../../../_components/atoms/Skeleton/Skeleton";
import { Table, THead, TBody, Tr, Th, Td } from "../../../../_components/molecules/DataTable/DataTable";
import { CatalogStatusBadge } from "../../_blocks/CatalogStatusBadge";
import type { Folio } from "../_logic/types/domain";
import { SCOPE_LABEL } from "../_logic/scopeLabels";
import { useTableKeyboard } from "../../../../_hooks/useTableKeyboard";

interface FoliosTableProps {
  items: Folio[];
  canWrite: boolean;
  isLoading?: boolean;
  onEdit: (item: Folio) => void;
  onSoftDelete: (id: string) => void;
  onReactivate: (id: string) => void;
  onAudit: (id: string) => void;
  onEnter?: (item: Folio) => void;
}

export function FoliosTable({
  items,
  canWrite,
  isLoading,
  onEdit,
  onSoftDelete,
  onReactivate,
  onAudit,
  onEnter,
}: FoliosTableProps) {
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
            <Th>Prefijo</Th>
            <Th>Ámbito</Th>
            <Th>Número actual</Th>
            <Th>Estado</Th>
            <Th align="right">Acciones</Th>
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
              <Td className="text-on-surface-variant font-mono">
                {item.prefix ?? <span>—</span>}
              </Td>
              <Td>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-label-sm font-medium bg-secondary-container text-on-secondary-container">
                  {SCOPE_LABEL[item.scope] ?? item.scope}
                </span>
              </Td>
              <Td className="text-on-surface tabular-nums">{item.currentNumber}</Td>
              <Td>
                <CatalogStatusBadge isActive={item.isActive} />
              </Td>
              <Td align="right">
                <div className="flex items-center justify-end gap-1">
                  <IconButton
                    icon="policy"
                    iconSize={18}
                    ariaLabel="Auditar secuencia"
                    title="Auditar secuencia"
                    variant="ghost"
                    onClick={() => onAudit(item.id)}
                    className="rounded p-2 hover:text-secondary"
                  />
                  {canWrite && (
                    <>
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
