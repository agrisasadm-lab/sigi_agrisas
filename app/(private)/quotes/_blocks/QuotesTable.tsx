"use client";

import Link from "next/link";
import { QuoteStatusBadge } from "./QuoteStatusBadge";
import { Skeleton } from "../../../_components/atoms/Skeleton/Skeleton";
import { Table, THead, TBody, Tr, Th, Td } from "../../../_components/molecules/DataTable/DataTable";
import { cn } from "../../../_lib/cn";
import type { Quote } from "../_logic/types/domain";
import { useTableKeyboard } from "../../../_hooks/useTableKeyboard";
import { formatMxCurrency } from "../../../_lib/formatMxCurrency";
import { fmtDateShort } from "../../../_lib/formatDate";

function fmt(n: number) { return formatMxCurrency(n); }
function fmtDate(d: Date | null | undefined) {
  if (!d) return "—";
  return fmtDateShort(d);
}

interface QuotesTableProps {
  items: Quote[];
  isLoading: boolean;
  showBranch: boolean;
  onEnter?: (item: Quote) => void;
}

export function QuotesTable({ items, isLoading, showBranch, onEnter }: QuotesTableProps) {
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
        Sin cotizaciones registradas
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <THead>
          <Tr hoverable={false}>
            <Th>Folio</Th>
            <Th>Estado</Th>
            <Th>Cliente</Th>
            <Th>Vendedor</Th>
            {showBranch && <Th>Sucursal</Th>}
            <Th align="right">Total</Th>
            <Th>Vencimiento</Th>
            <Th>Fecha</Th>
          </Tr>
        </THead>
        <TBody>
          {items.map((q, idx) => {
            const folioLabel = q.folioPrefix
              ? `${q.folioPrefix}-${q.folioNumber}`
              : String(q.folioNumber);
            return (
              <Tr
                key={q.id}
                {...getRowProps(idx)}
                className={cn(
                  "border-b border-outline-variant/40 focus:bg-surface-container focus:outline-none cursor-default",
                  q.isExpired && "bg-error-container/10",
                )}
              >
                <Td>
                  <Link
                    href={`/quotes/${q.id}`}
                    className="font-mono text-primary hover:text-primary/80 underline"
                  >
                    {folioLabel}
                  </Link>
                </Td>
                <Td>
                  <div className="flex flex-col gap-1">
                    <QuoteStatusBadge status={q.status as "draft" | "authorized" | "converted" | "cancelled"} isExpired={q.isExpired} />
                    {q.status === "converted" && q.convertedSaleId && (
                      <Link
                        href={`/sales/${q.convertedSaleId}`}
                        className="text-label-sm text-primary hover:text-primary/80 underline"
                      >
                        Ver venta
                      </Link>
                    )}
                  </div>
                </Td>
                <Td className="max-w-[160px] truncate text-on-surface-variant">
                  {q.customerName ?? "—"}
                </Td>
                <Td className="max-w-[140px] truncate text-on-surface-variant">
                  {q.creatorName ?? q.creatorId?.slice(0, 8) ?? "—"}
                </Td>
                {showBranch && (
                  <Td className="max-w-[140px] truncate text-on-surface-variant">
                    {q.branchName ?? "—"}
                  </Td>
                )}
                <Td align="right" className="font-medium">
                  {fmt(q.total)}
                </Td>
                <Td className="text-on-surface-variant tabular-nums">
                  {q.isExpired ? (
                    <span className="text-error font-medium">{fmtDate(q.expiresAt)}</span>
                  ) : (
                    fmtDate(q.expiresAt)
                  )}
                </Td>
                <Td className="text-on-surface-variant tabular-nums">
                  {fmtDate(q.createdAt)}
                </Td>
              </Tr>
            );
          })}
        </TBody>
      </Table>
    </div>
  );
}
