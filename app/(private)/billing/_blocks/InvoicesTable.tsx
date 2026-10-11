"use client";

import Link from "next/link";
import { InvoiceStatusBadge } from "./InvoiceStatusBadge";
import { Skeleton } from "../../../_components/atoms/Skeleton/Skeleton";
import { Table, THead, TBody, Tr, Th, Td } from "../../../_components/molecules/DataTable/DataTable";
import type { Invoice } from "../_logic/types/domain";
import { formatMxCurrency } from "../../../_lib/formatMxCurrency";
import { fmtDateShort } from "../../../_lib/formatDate";

function fmt(n: number) { return formatMxCurrency(n); }
function fmtDate(d: Date) { return fmtDateShort(d); }

interface InvoicesTableProps {
  items: Invoice[];
  isLoading: boolean;
  showBranch: boolean;
}

export function InvoicesTable({ items, isLoading, showBranch }: InvoicesTableProps) {
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
        Sin facturas registradas
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <THead>
          <Tr hoverable={false}>
            <Th>Folio fiscal</Th>
            <Th>Receptor</Th>
            {showBranch && <Th>Sucursal</Th>}
            <Th align="right">Total</Th>
            <Th>Fecha</Th>
            <Th>Estado</Th>
            <Th>Acción</Th>
          </Tr>
        </THead>
        <TBody>
          {items.map((inv) => (
            <Tr key={inv.id} className="border-b border-outline-variant/40">
              <Td className="font-mono text-label-sm text-on-surface-variant truncate max-w-[160px]">
                {inv.uuid ?? "—"}
              </Td>
              <Td>
                <p className="text-on-surface">{inv.receiverName}</p>
                <p className="text-label-sm text-on-surface-variant">{inv.receiverRfc}</p>
              </Td>
              {showBranch && (
                <Td className="text-on-surface-variant">
                  {inv.branchId.slice(0, 8)}
                </Td>
              )}
              <Td align="right" className="font-medium">
                {fmt(inv.total)}
              </Td>
              <Td className="text-on-surface-variant tabular-nums">
                {fmtDate(inv.createdAt)}
              </Td>
              <Td>
                <InvoiceStatusBadge status={inv.status} />
              </Td>
              <Td>
                <Link
                  href={`/billing/${inv.id}`}
                  className="text-label-sm text-primary hover:text-primary/80 font-medium transition-colors"
                >
                  Ver
                </Link>
              </Td>
            </Tr>
          ))}
        </TBody>
      </Table>
    </div>
  );
}
