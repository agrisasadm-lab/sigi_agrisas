"use client";

import Link from "next/link";
import { SaleStatusBadge } from "./SaleStatusBadge";
import { SalePaymentStatusBadge } from "./SalePaymentStatusBadge";
import { Skeleton } from "../../../_components/atoms/Skeleton/Skeleton";
import { Table, THead, TBody, Tr, Th, Td } from "../../../_components/molecules/DataTable/DataTable";
import type { SaleSummary } from "../_logic/types/domain";
import { useTableKeyboard } from "../../../_hooks/useTableKeyboard";
import { formatMxCurrency } from "../../../_lib/formatMxCurrency";
import { fmtDateTimeShort } from "../../../_lib/formatDate";

function fmt(n: number) { return formatMxCurrency(n); }

function fmtDate(d: Date) {
  return fmtDateTimeShort(d);
}

interface SalesTableProps {
  items: SaleSummary[];
  isLoading: boolean;
  onEnter?: (item: SaleSummary) => void;
}

export function SalesTable({ items, isLoading, onEnter }: SalesTableProps) {
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
        Sin ventas registradas
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
            <Th>Cobro</Th>
            <Th>Cliente</Th>
            <Th>Cajero</Th>
            <Th>Sucursal</Th>
            <Th align="right">Total</Th>
            <Th>Fecha</Th>
          </Tr>
        </THead>
        <TBody>
          {items.map((sale, idx) => {
            const folioLabel = sale.folioPrefix
              ? `${sale.folioPrefix}-${sale.folioNumber}`
              : String(sale.folioNumber);
            return (
              <Tr
                key={sale.id}
                {...getRowProps(idx)}
                className="border-b border-outline-variant/40 focus:bg-surface-container focus:outline-none cursor-default"
              >
                <Td>
                  <Link
                    href={`/sales/${sale.id}`}
                    className="font-mono text-primary hover:text-primary/80 underline"
                  >
                    {folioLabel}
                  </Link>
                </Td>
                <Td>
                  <SaleStatusBadge status={sale.status} />
                </Td>
                <Td>
                  <SalePaymentStatusBadge status={sale.paymentStatus} isCredit={sale.isCredit} />
                </Td>
                <Td className="max-w-[160px] truncate text-on-surface-variant">
                  {sale.customerName ?? "—"}
                </Td>
                <Td className="max-w-[140px] truncate text-on-surface-variant">
                  {sale.cashierName ?? sale.cashierId.slice(0, 8)}
                </Td>
                <Td className="max-w-[140px] truncate text-on-surface-variant">
                  {sale.branchName ?? "—"}
                </Td>
                <Td align="right" className="font-medium">
                  {fmt(sale.total)}
                </Td>
                <Td className="text-on-surface-variant tabular-nums">
                  {fmtDate(sale.createdAt)}
                </Td>
              </Tr>
            );
          })}
        </TBody>
      </Table>
    </div>
  );
}
