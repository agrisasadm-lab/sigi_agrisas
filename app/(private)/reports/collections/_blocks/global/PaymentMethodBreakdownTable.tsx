"use client";

import type { CashCutPaymentMethodBreakdownDto } from "../../_logic/global/types/api";
import { formatMxCurrency } from "../../../../../_lib/formatMxCurrency";
import { Table, THead, TBody, Tr, Th, Td } from "../../../../../_components/molecules/DataTable/DataTable";

function money(v: string): string {
  return formatMxCurrency(Number(v));
}

export function PaymentMethodBreakdownTable({ rows }: { rows: CashCutPaymentMethodBreakdownDto[] }) {
  return (
    <div className="space-y-2">
      <h3 className="text-title-sm font-medium text-on-surface">Desglose por forma de pago</h3>
      <div className="overflow-x-auto rounded-lg border border-outline-variant bg-surface-container-low">
        <Table>
          <THead>
            <Tr hoverable={false}>
              <Th>Forma de pago</Th>
              <Th align="right">Conteo</Th>
              <Th align="right">Total</Th>
            </Tr>
          </THead>
          <TBody>
            {rows.length === 0 ? (
              <Tr hoverable={false}>
                <Td colSpan={3} className="py-4 text-center text-on-surface-variant">Sin datos</Td>
              </Tr>
            ) : (
              rows.map((r) => (
                <Tr key={r.paymentMethodId} hoverable={false} className="border-b border-outline-variant/40">
                  <Td>{r.label}</Td>
                  <Td align="right" className="text-on-surface-variant">{r.count}</Td>
                  <Td align="right" className="font-medium">{money(r.total)}</Td>
                </Tr>
              ))
            )}
          </TBody>
        </Table>
      </div>
    </div>
  );
}
