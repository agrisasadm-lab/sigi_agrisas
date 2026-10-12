"use client";

import { useRouter } from "next/navigation";
import { Button } from "../../../_components/atoms/Button/Button";
import { Table, THead, TBody, Tr, Th, Td } from "../../../_components/molecules/DataTable/DataTable";
import { PurchaseStatusBadge } from "./PurchaseStatusBadge";
import { Skeleton } from "../../../_components/atoms/Skeleton/Skeleton";
import type { Purchase } from "../_logic/types/domain";
import { useTableKeyboard } from "../../../_hooks/useTableKeyboard";
import { formatMxCurrency } from "../../../_lib/formatMxCurrency";
import { fmtDateShort } from "../../../_lib/formatDate";

function fmt(n: number) { return formatMxCurrency(n); }
function fmtDate(d: Date) { return fmtDateShort(d); }

interface PurchasesTableProps {
  items: Purchase[];
  isLoading: boolean;
  showBranch: boolean;
  onEnter?: (item: Purchase) => void;
}

export function PurchasesTable({ items, isLoading, showBranch, onEnter }: PurchasesTableProps) {
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
        Sin compras registradas
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <THead>
          <Tr hoverable={false}>
            <Th>Folio</Th>
            <Th>Proveedor</Th>
            {showBranch && <Th>Sucursal</Th>}
            <Th align="right">Total</Th>
            <Th>Forma de pago</Th>
            <Th>Fecha</Th>
            <Th>Estado</Th>
            <Th>Acción</Th>
          </Tr>
        </THead>
        <TBody>
          {items.map((p, idx) => (
            <Tr
              key={p.id}
              {...getRowProps(idx)}
              className="border-b border-outline-variant/40 focus:bg-surface-container focus:outline-none cursor-default"
            >
              <Td className="font-mono text-on-surface">{p.folioCode}</Td>
              <Td>
                <p className="text-on-surface truncate max-w-[160px]">{p.providerName ?? "—"}</p>
                {p.providerRfc && <p className="text-label-sm text-on-surface-variant truncate">{p.providerRfc}</p>}
              </Td>
              {showBranch && (
                <Td className="text-on-surface-variant truncate max-w-[120px]">{p.branchName ?? "—"}</Td>
              )}
              <Td align="right" className="font-medium">{fmt(p.total)}</Td>
              <Td className="text-on-surface-variant">{p.paymentMethodCode ?? "—"}</Td>
              <Td className="text-on-surface-variant tabular-nums">{fmtDate(p.purchasedAt)}</Td>
              <Td><PurchaseStatusBadge status={p.status} /></Td>
              <Td>
                <Button
                  type="button"
                  variant="text"
                  onClick={() => router.push(`/purchases/${p.id}`)}
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
