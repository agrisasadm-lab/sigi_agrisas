import { Table, THead, TBody, Tr, Th, Td } from "../../../../_components/molecules/DataTable/DataTable";
import { MOVEMENT_TYPE_LABELS } from "../_logic/lib/movementTypeLabels";
import type { KardexMovementDto } from "../_logic/types/api";

interface KardexTableProps {
  movements: KardexMovementDto[];
}

function formatDateTime(iso: string): string {
  return iso.substring(0, 16).replace("T", " ");
}

function folioLabel(code: string | null, number: number | null): string {
  if (!code) return "—";
  return number !== null ? `${code}${number}` : code;
}

export function KardexTable({ movements }: KardexTableProps) {
  return (
    <div className="overflow-x-auto">
      <Table className="text-left text-body-sm">
        <THead>
          <Tr hoverable={false} className="text-label-md text-on-surface-variant normal-case tracking-normal">
            <Th className="px-3 py-2 font-medium normal-case tracking-normal">Fecha</Th>
            <Th className="px-3 py-2 font-medium normal-case tracking-normal">Movimiento</Th>
            <Th className="px-3 py-2 font-medium normal-case tracking-normal">Folio</Th>
            <Th align="right" className="px-3 py-2 font-medium normal-case tracking-normal">Entrada</Th>
            <Th align="right" className="px-3 py-2 font-medium normal-case tracking-normal">Salida</Th>
            <Th align="right" className="px-3 py-2 font-medium normal-case tracking-normal">Saldo</Th>
            <Th align="right" className="px-3 py-2 font-medium normal-case tracking-normal">Costo</Th>
            <Th align="right" className="px-3 py-2 font-medium normal-case tracking-normal">Venta</Th>
            <Th className="px-3 py-2 font-medium normal-case tracking-normal">Status</Th>
            <Th className="px-3 py-2 font-medium normal-case tracking-normal">Concepto</Th>
          </Tr>
        </THead>
        <TBody>
          {movements.map((m, idx) => (
            <Tr key={idx} hoverable={false} className="border-b border-outline-variant">
              <Td className="px-3 py-2 font-mono">{formatDateTime(m.movementAt)}</Td>
              <Td className="px-3 py-2">{MOVEMENT_TYPE_LABELS[m.movementType] ?? m.movementType}</Td>
              <Td className="px-3 py-2 font-mono">{folioLabel(m.folioCode, m.folioNumber)}</Td>
              <Td align="right" className="px-3 py-2">{m.entrada || ""}</Td>
              <Td align="right" className="px-3 py-2">{m.salida || ""}</Td>
              <Td align="right" className="px-3 py-2 font-medium">{m.saldo}</Td>
              <Td align="right" className="px-3 py-2 text-on-surface-variant">{m.unitCost ?? "—"}</Td>
              <Td align="right" className="px-3 py-2 text-on-surface-variant">{m.unitPrice ?? "—"}</Td>
              <Td className="px-3 py-2">{m.status}</Td>
              <Td className="px-3 py-2 text-on-surface-variant">{m.notes ?? "—"}</Td>
            </Tr>
          ))}
        </TBody>
      </Table>
    </div>
  );
}
