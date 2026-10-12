"use client";

import { useRouter } from "next/navigation";
import { WaybillStatusBadge } from "./WaybillStatusBadge";
import { WaybillTypeBadge } from "./WaybillTypeBadge";
import { Button } from "../../../_components/atoms/Button/Button";
import { Table, THead, TBody, Tr, Th, Td } from "../../../_components/molecules/DataTable/DataTable";
import { Skeleton } from "../../../_components/atoms/Skeleton/Skeleton";
import type { WaybillSummary } from "../_logic/types/domain";
import { useTableKeyboard } from "../../../_hooks/useTableKeyboard";
import { fmtDateShort } from "../../../_lib/formatDate";

function fmtDate(d: Date) {
  return fmtDateShort(d);
}

interface WaybillsTableProps {
  items: WaybillSummary[];
  isLoading: boolean;
  branchNameById: Record<string, string>;
  onEnter?: (item: WaybillSummary) => void;
}

export function WaybillsTable({ items, isLoading, branchNameById, onEnter }: WaybillsTableProps) {
  const router = useRouter();
  const noop = () => {};
  const { getRowProps } = useTableKeyboard(items, onEnter ?? noop);

  if (isLoading) {
    return (
      <div className="p-4 space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} height={40} width="100%" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="py-8 text-center text-body-sm text-on-surface-variant">
        Sin traspasos registrados
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <THead>
          <Tr hoverable={false}>
            <Th>Folio</Th>
            <Th>Tipo</Th>
            <Th>Origen</Th>
            <Th>Destino</Th>
            <Th>Estado</Th>
            <Th>Fecha</Th>
            <Th>Acciones</Th>
          </Tr>
        </THead>
        <TBody>
          {items.map((w, idx) => (
            <Tr
              key={w.id}
              {...getRowProps(idx)}
              className="border-b border-outline-variant/40 focus:bg-surface-container focus:outline-none cursor-default"
            >
              <Td className="font-mono text-on-surface">{w.folioCode}</Td>
              <Td>
                <WaybillTypeBadge type={w.type} />
              </Td>
              <Td className="text-on-surface-variant truncate max-w-[140px]">
                {branchNameById[w.originBranchId] ?? w.originBranchId.slice(0, 8)}
              </Td>
              <Td className="text-on-surface-variant truncate max-w-[140px]">
                {w.type === "carta_porte"
                  ? w.destinationCustomerName ?? "Cliente"
                  : w.destinationBranchId
                    ? branchNameById[w.destinationBranchId] ?? w.destinationBranchId.slice(0, 8)
                    : "—"}
              </Td>
              <Td>
                <WaybillStatusBadge status={w.status} />
              </Td>
              <Td className="text-on-surface-variant tabular-nums">{fmtDate(w.createdAt)}</Td>
              <Td>
                <Button
                  type="button"
                  variant="text"
                  onClick={() => router.push(`/waybills/${w.id}`)}
                  className="px-0 py-0 text-label-sm text-primary hover:bg-transparent hover:text-primary/80"
                >
                  Ver
                </Button>
              </Td>
            </Tr>
          ))}
        </TBody>
      </Table>
    </div>
  );
}
