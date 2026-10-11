"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ReturnStatusBadge } from "./ReturnStatusBadge";
import { Button } from "../../../_components/atoms/Button/Button";
import { Skeleton } from "../../../_components/atoms/Skeleton/Skeleton";
import { Table, THead, TBody, Tr, Th, Td } from "../../../_components/molecules/DataTable/DataTable";
import type { Return } from "../_logic/types/domain";
import { useTableKeyboard } from "../../../_hooks/useTableKeyboard";
import { formatMxCurrency } from "../../../_lib/formatMxCurrency";
import { fmtDateShort } from "../../../_lib/formatDate";

function fmt(n: number) { return formatMxCurrency(n); }

function fmtDate(d: Date) {
  return fmtDateShort(d);
}

function initials(name: string) {
  return name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

interface ReturnsTableProps {
  items: Return[];
  isLoading: boolean;
  showBranch: boolean;
  onEnter?: (item: Return) => void;
}

export function ReturnsTable({ items, isLoading, showBranch, onEnter }: ReturnsTableProps) {
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
        Sin devoluciones registradas
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <THead>
          <Tr hoverable={false}>
            <Th>Folio venta</Th>
            <Th>Cliente</Th>
            {showBranch && <Th>Sucursal</Th>}
            <Th>Devuelto por</Th>
            <Th align="right">Reembolso</Th>
            <Th>Fecha</Th>
            <Th>Estado</Th>
            <Th>Acción</Th>
          </Tr>
        </THead>
        <TBody>
          {items.map((ret, idx) => {
            const folioLabel = ret.salefolioCode
              ? `${ret.salefolioCode}-${ret.salefolioNumber}`
              : ret.salefolioNumber
              ? String(ret.salefolioNumber)
              : ret.saleId.slice(0, 8);
            const customerName = ret.customerName ?? "—";
            return (
              <Tr
                key={ret.id}
                {...getRowProps(idx)}
                className="border-b border-outline-variant/40 focus:bg-surface-container focus:outline-none cursor-default"
              >
                <Td>
                  <Link
                    href={`/sales/${ret.saleId}`}
                    className="font-mono text-primary hover:text-primary/80 underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {folioLabel}
                  </Link>
                </Td>
                <Td>
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-full bg-secondary-container text-on-secondary-container text-label-sm font-semibold flex items-center justify-center flex-shrink-0">
                      {customerName !== "—" ? initials(customerName) : "?"}
                    </span>
                    <div className="min-w-0">
                      <p className="text-on-surface truncate max-w-[120px]">{customerName}</p>
                      {ret.customerRfc && (
                        <p className="text-label-sm text-on-surface-variant truncate">{ret.customerRfc}</p>
                      )}
                    </div>
                  </div>
                </Td>
                {showBranch && (
                  <Td className="text-on-surface-variant truncate max-w-[120px]">
                    {ret.branchName ?? "—"}
                  </Td>
                )}
                <Td className="text-on-surface-variant truncate max-w-[120px]">
                  {ret.creatorName ?? ret.creatorId.slice(0, 8)}
                </Td>
                <Td align="right" className="font-medium">
                  {fmt(ret.refundTotal)}
                </Td>
                <Td className="text-on-surface-variant tabular-nums">
                  {fmtDate(ret.returnedAt)}
                </Td>
                <Td>
                  <ReturnStatusBadge status={ret.status} />
                </Td>
                <Td>
                  <Button
                    type="button"
                    variant="text"
                    onClick={() => router.push(`/returns/${ret.id}`)}
                    className="rounded-none p-0 text-label-sm hover:bg-transparent hover:text-primary/80"
                  >
                    Ver
                  </Button>
                </Td>
              </Tr>
            );
          })}
        </TBody>
      </Table>
    </div>
  );
}
