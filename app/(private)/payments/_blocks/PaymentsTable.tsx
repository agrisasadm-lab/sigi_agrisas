"use client";

import Link from "next/link";
import { PaymentStatusBadge } from "./PaymentStatusBadge";
import { Skeleton } from "../../../_components/atoms/Skeleton/Skeleton";
import { Table, THead, TBody, Tr, Th, Td } from "../../../_components/molecules/DataTable/DataTable";
import type { Payment } from "../_logic/types/domain";
import { useTableKeyboard } from "../../../_hooks/useTableKeyboard";
import { formatMxCurrency } from "../../../_lib/formatMxCurrency";
import { fmtDateTimeShort } from "../../../_lib/formatDate";

function fmt(n: number) { return formatMxCurrency(n); }
function fmtDate(d: Date) {
  return fmtDateTimeShort(d);
}

interface PaymentsTableProps {
  items: Payment[];
  isLoading: boolean;
  showBranch: boolean;
  onEnter?: (item: Payment) => void;
}

export function PaymentsTable({ items, isLoading, showBranch, onEnter }: PaymentsTableProps) {
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

  if (items.length === 0) return null;

  return (
    <div className="overflow-x-auto">
      <Table>
        <THead>
          <Tr hoverable={false}>
            <Th>Folio recibo</Th>
            <Th>Folio venta</Th>
            <Th>Cliente</Th>
            <Th>Cobrador</Th>
            <Th>Método</Th>
            {showBranch && <Th>Sucursal</Th>}
            <Th align="right">Monto</Th>
            <Th align="right">Monto total</Th>
            <Th align="right">Saldo pendiente</Th>
            <Th>Fecha</Th>
            <Th>Estado</Th>
            <Th>Acción</Th>
          </Tr>
        </THead>
        <TBody>
          {items.map((p, idx) => {
            const folioLabel = p.folioPrefix
              ? `${p.folioPrefix}${p.folioNumber}`
              : String(p.folioNumber);
            return (
              <Tr
                key={p.id}
                {...getRowProps(idx)}
                className="border-b border-outline-variant/40 focus:bg-surface-container focus:outline-none cursor-default"
              >
                <Td className="font-mono text-on-surface-variant">{folioLabel}</Td>
                <Td>
                  {p.saleFolioCode ? (
                    <Link href={`/sales/${p.saleId}`} className="text-primary hover:underline">
                      {p.saleFolioCode}
                    </Link>
                  ) : "—"}
                </Td>
                <Td className="max-w-[140px] truncate text-on-surface-variant">
                  {p.customerName ?? "—"}
                </Td>
                <Td className="max-w-[140px] truncate text-on-surface-variant">
                  {p.userName ?? "—"}
                </Td>
                <Td className="text-on-surface-variant">{p.paymentMethodName ?? "—"}</Td>
                {showBranch && (
                  <Td className="text-on-surface-variant">{p.branchName ?? "—"}</Td>
                )}
                <Td align="right" className="font-medium">{fmt(p.amount)}</Td>
                <Td align="right" className="text-on-surface-variant">{fmt(p.saleTotal)}</Td>
                <Td align="right" className="text-on-surface-variant">{fmt(p.saleDueAmount)}</Td>
                <Td className="text-on-surface-variant tabular-nums">{fmtDate(p.createdAt)}</Td>
                <Td>
                  <PaymentStatusBadge status={p.status} salePaymentStatus={p.salePaymentStatus} />
                </Td>
                <Td>
                  <Link
                    href={`/payments/${p.id}`}
                    className="text-label-sm text-primary hover:underline"
                  >
                    Ver
                  </Link>
                </Td>
              </Tr>
            );
          })}
        </TBody>
      </Table>
    </div>
  );
}
