"use client";

import { Table, THead, TBody, Tr, Th, Td } from "../../../../../_components/molecules/DataTable";
import type { CashCutRowDto } from "../../_logic/global/types/api";
import { formatMxCurrency } from "../../../../../_lib/formatMxCurrency";

function money(v: string): string {
  return formatMxCurrency(Number(v));
}
function pct(v: string): string {
  return `${(Number(v) * 100).toFixed(0)}%`;
}
function dateOnly(iso: string): string {
  return iso;
}
function dateTime(iso: string): string {
  return new Date(iso).toLocaleString("es-MX", { timeZone: "UTC" });
}

export function CollectionsRowsTable({ rows }: { rows: CashCutRowDto[] }) {
  return (
    <div className="space-y-2">
      <h3 className="text-title-sm font-medium text-on-surface">Cobranza del periodo</h3>
      <div className="overflow-x-auto rounded-lg border border-outline-variant bg-surface-container-low">
        <Table>
          <THead>
            <tr>
              <Th>Cte</Th>
              <Th>Docto</Th>
              <Th>Factura</Th>
              <Th>Nombre del cliente</Th>
              <Th>Fec-Fact</Th>
              <Th align="right">Días</Th>
              <Th align="right">Importe</Th>
              <Th>Fp</Th>
              <Th>Referencia</Th>
              <Th>F. Cobro</Th>
              <Th align="right">I.V.A.</Th>
              <Th align="right">Tasa%</Th>
            </tr>
          </THead>
          <TBody>
            {rows.length === 0 ? (
              <tr>
                <Td colSpan={12} className="text-center text-on-surface-variant">
                  Sin cobranza en el periodo
                </Td>
              </tr>
            ) : (
              rows.map((r) => (
                <Tr key={r.paymentId}>
                  <Td>{r.customerCode}</Td>
                  <Td>{r.docto}</Td>
                  <Td>{r.factura}</Td>
                  <Td>{r.customerName}</Td>
                  <Td>{dateOnly(r.facturaDate)}</Td>
                  <Td align="right">{r.days}</Td>
                  <Td align="right">{money(r.amount)}</Td>
                  <Td>{r.paymentMethodName}</Td>
                  <Td>{r.reference ?? ""}</Td>
                  <Td>{dateTime(r.collectedAt)}</Td>
                  <Td align="right">{money(r.ivaAmount)}</Td>
                  <Td align="right">{pct(r.taxRatePct)}</Td>
                </Tr>
              ))
            )}
          </TBody>
        </Table>
      </div>
    </div>
  );
}
