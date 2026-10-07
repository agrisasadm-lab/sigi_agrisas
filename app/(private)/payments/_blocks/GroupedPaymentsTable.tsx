"use client";

import { useState, Fragment, ReactNode } from "react";
import { Icon } from "../../../_components/atoms/Icon/Icon";
import { Skeleton } from "../../../_components/atoms/Skeleton/Skeleton";
import type { PaymentGroup, GroupablePayment } from "../_logic/lib/groupPaymentsBySale";
import { formatMxCurrency } from "../../../_lib/formatMxCurrency";

function fmt(n: number) { return formatMxCurrency(n); }

interface GroupedPaymentsTableProps<T extends GroupablePayment> {
  groups: PaymentGroup<T>[];
  isLoading: boolean;
  columnCount: number;
  headerRow: ReactNode;
  renderPaymentRow: (payment: T) => ReactNode;
}

export function GroupedPaymentsTable<T extends GroupablePayment>({
  groups,
  isLoading,
  columnCount,
  headerRow,
  renderPaymentRow,
}: GroupedPaymentsTableProps<T>) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  if (isLoading) {
    return (
      <div className="p-4 space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} height={44} width="100%" />
        ))}
      </div>
    );
  }

  if (groups.length === 0) return null;

  function toggle(saleId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(saleId)) next.delete(saleId);
      else next.add(saleId);
      return next;
    });
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-body-sm">
        <thead>{headerRow}</thead>
        <tbody>
          {groups.map((group) => {
            const isOpen = expanded.has(group.saleId);
            return (
              <Fragment key={group.saleId}>
                <tr
                  className="border-b border-outline-variant bg-surface-container-low/60 cursor-pointer hover:bg-surface-container-low transition-colors"
                  onClick={() => toggle(group.saleId)}
                >
                  <td colSpan={columnCount} className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Icon
                        name="chevron_right"
                        size={18}
                        className={isOpen ? "rotate-90 transition-transform" : "transition-transform"}
                      />
                      <span className="font-mono text-on-surface">{group.saleFolioCode || "—"}</span>
                      <span className="text-on-surface-variant max-w-[200px] truncate">{group.customerName || "—"}</span>
                      <span className="text-label-sm text-on-surface-variant ml-auto">
                        {group.payments.length} abono{group.payments.length !== 1 ? "s" : ""}
                      </span>
                      <span className="tabular-nums font-medium">
                        Monto total: {fmt(group.saleTotal)}
                      </span>
                      <span className="tabular-nums font-medium">
                        Saldo: {fmt(group.saleDueAmount)}
                      </span>
                    </div>
                  </td>
                </tr>
                {isOpen && group.payments.map((payment) => renderPaymentRow(payment))}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
