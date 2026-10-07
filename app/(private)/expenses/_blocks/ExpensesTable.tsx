"use client";

import { Icon } from "../../../_components/atoms/Icon/Icon";
import { Button } from "../../../_components/atoms/Button/Button";
import { Skeleton } from "../../../_components/atoms/Skeleton/Skeleton";
import { Table, THead, TBody, Tr, Th, Td } from "../../../_components/molecules/DataTable/DataTable";
import { CatalogStatusBadge } from "../../catalogs/_blocks/CatalogStatusBadge";
import { useTableKeyboard } from "../../../_hooks/useTableKeyboard";
import type { Expense } from "../_logic/types/domain";
import { formatMxCurrency } from "../../../_lib/formatMxCurrency";
import { fmtDateShort } from "../../../_lib/formatDate";

function fmtAmount(n: string): string {
  return formatMxCurrency(Number(n));
}
function fmtDate(iso: string): string {
  return fmtDateShort(new Date(iso));
}

interface ExpensesTableProps {
  items: Expense[];
  canWrite: boolean;
  showBranch: boolean;
  isLoading?: boolean;
  onEdit: (item: Expense) => void;
  onSoftDelete: (id: string) => void;
}

export function ExpensesTable({ items, canWrite, showBranch, isLoading, onEdit, onSoftDelete }: ExpensesTableProps) {
  const noop = () => {};
  const { getRowProps } = useTableKeyboard(items, canWrite ? onEdit : noop);

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
            <Th>Concepto</Th>
            <Th>Fecha</Th>
            {showBranch && <Th>Sucursal</Th>}
            <Th>Registrado por</Th>
            <Th align="right">Monto</Th>
            <Th>Estado</Th>
            {canWrite && <Th align="right">Acciones</Th>}
          </Tr>
        </THead>
        <TBody>
          {items.map((item, idx) => (
            <Tr key={item.id} {...getRowProps(idx)} className="focus:bg-surface-container focus:outline-none">
              <Td className="text-on-surface">
                <div className="flex items-center gap-2">
                  {item.photoUrl && <Icon name="receipt_long" size={16} className="text-on-surface-variant" />}
                  {item.concept}
                </div>
              </Td>
              <Td className="text-on-surface-variant tabular-nums">{fmtDate(item.expenseDate)}</Td>
              {showBranch && <Td className="text-on-surface-variant">{item.branchName ?? "—"}</Td>}
              <Td className="max-w-[160px] truncate text-on-surface-variant">{item.creatorName ?? "—"}</Td>
              <Td align="right" className="font-medium">{fmtAmount(item.amount)}</Td>
              <Td>
                <CatalogStatusBadge isActive={item.isActive} />
              </Td>
              {canWrite && (
                <Td align="right">
                  {item.isActive && (
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="text"
                        size="sm"
                        icon="edit"
                        onClick={() => onEdit(item)}
                        aria-label="Editar"
                        title="Editar"
                      />
                      <Button
                        variant="text"
                        size="sm"
                        icon="delete"
                        onClick={() => onSoftDelete(item.id)}
                        aria-label="Desactivar"
                        title="Desactivar"
                        className="text-error hover:bg-error-container"
                      />
                    </div>
                  )}
                </Td>
              )}
            </Tr>
          ))}
        </TBody>
      </Table>
    </div>
  );
}
