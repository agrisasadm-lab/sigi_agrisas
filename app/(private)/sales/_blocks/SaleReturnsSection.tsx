"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCurrentUser } from "../../../_hooks/useCurrentUser";
import { useSaleReturns } from "../../returns/_logic/hooks/useSaleReturns";
import { ReturnStatusBadge } from "../../returns/_blocks/ReturnStatusBadge";
import { Skeleton } from "../../../_components/atoms/Skeleton/Skeleton";
import type { SaleItem } from "../_logic/types/domain";
import { formatMxCurrency } from "../../../_lib/formatMxCurrency";
import { fmtDateShort } from "../../../_lib/formatDate";

function fmt(n: number) { return formatMxCurrency(n); }
function fmtDate(d: Date) {
  return fmtDateShort(d);
}

interface SaleReturnsSectionProps {
  saleId: string;
  saleStatus: "completed" | "cancelled" | "edited" | "returned_total";
  saleItems: SaleItem[];
  returnedQuantityBySaleItem: Record<string, number>;
}

export function SaleReturnsSection({
  saleId,
  saleStatus,
  saleItems,
  returnedQuantityBySaleItem,
}: SaleReturnsSectionProps) {
  const router = useRouter();
  const { can } = useCurrentUser();
  const canCreate = can("returns:create");
  const { returns, isLoading } = useSaleReturns(saleId);

  const hasAvailableLines = saleItems.some(
    (i) => (i.quantity - (returnedQuantityBySaleItem[i.id] ?? 0)) > 0
  );

  const showCta =
    saleStatus === "completed" &&
    canCreate === true &&
    hasAvailableLines;

  if (!isLoading && returns.length === 0 && !showCta) return null;

  return (
    <div className="bg-surface-container-low rounded-lg border border-outline-variant overflow-hidden">
      <div className="px-4 py-3 border-b border-outline-variant flex items-center justify-between gap-4">
        <h2 className="text-title-sm font-semibold text-on-surface">
          Devoluciones {!isLoading && returns.length > 0 ? `(${returns.length})` : ""}
        </h2>
        {showCta && (
          <button
            type="button"
            onClick={() => router.push(`/sales/${saleId}/returns/new`)}
            className="rounded-full bg-primary text-on-primary px-4 py-1.5 text-label-md font-medium hover:bg-primary/90 transition-colors"
          >
            + Registrar devolución
          </button>
        )}
      </div>

      <div className="p-4">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} height={48} width="100%" />
            ))}
          </div>
        ) : returns.length === 0 ? (
          <p className="text-body-sm text-on-surface-variant">
            Aún no hay devoluciones registradas.
          </p>
        ) : (
          <div className="space-y-2">
            {returns.map((ret) => (
              <div
                key={ret.id}
                className="flex items-center justify-between gap-4 p-3 bg-surface rounded-md border border-outline-variant/40 hover:bg-surface-container-low transition-colors cursor-pointer"
                onClick={() => router.push(`/returns/${ret.id}`)}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="font-mono text-label-sm text-on-surface-variant flex-shrink-0">
                    #{ret.id.slice(-6).toUpperCase()}
                  </span>
                  <ReturnStatusBadge status={ret.status} />
                  <span className="text-body-sm text-on-surface-variant truncate max-w-[200px]">
                    {ret.reason}
                  </span>
                </div>
                <div className="flex items-center gap-4 flex-shrink-0">
                  <span className="text-body-sm text-on-surface-variant tabular-nums">
                    {fmtDate(ret.returnedAt)}
                  </span>
                  <span className="text-body-sm font-medium tabular-nums">
                    {fmt(ret.refundTotal)}
                  </span>
                  <Link
                    href={`/returns/${ret.id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="text-label-sm text-primary hover:underline"
                  >
                    Ver
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
