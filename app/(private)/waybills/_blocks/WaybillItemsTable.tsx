import { Skeleton } from "../../../_components/atoms/Skeleton/Skeleton";
import { Table, THead, TBody, Tr, Th, Td } from "../../../_components/molecules/DataTable/DataTable";
import type { WaybillItem } from "../_logic/types/domain";
import type { WaybillType } from "../_logic/types/api";

interface WaybillItemsTableProps {
  items: WaybillItem[];
  type?: WaybillType;
  isLoading?: boolean;
}

export function WaybillItemsTable({ items, type = "carta_porte", isLoading }: WaybillItemsTableProps) {
  const isSimple = type === "simple";

  if (isLoading) {
    return (
      <div className="p-4 space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} height={36} width="100%" />
        ))}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <THead>
          <Tr hoverable={false}>
            <Th>Código</Th>
            <Th>Producto</Th>
            {!isSimple && <Th>Clave SAT transporte</Th>}
            {!isSimple && <Th>Unidad SAT</Th>}
            <Th align="right">Cant.</Th>
            {!isSimple && <Th align="right">Peso (kg)</Th>}
            {!isSimple && <Th>Peligroso</Th>}
          </Tr>
        </THead>
        <TBody>
          {items.map((item) => (
            <Tr key={item.id} className="border-b border-outline-variant/40 hover:bg-surface-container-low/50 transition-colors">
              <Td className="font-mono text-label-sm text-on-surface-variant">
                {item.productCodeSnapshot ?? "—"}
              </Td>
              <Td className="text-on-surface">{item.productNameSnapshot}</Td>
              {!isSimple && (
                <Td className="font-mono text-label-sm text-on-surface-variant">{item.satBienesTranspCode}</Td>
              )}
              {!isSimple && <Td className="text-on-surface-variant">{item.satUnitCode}</Td>}
              <Td align="right">{item.quantity}</Td>
              {!isSimple && <Td align="right">{item.weightKg}</Td>}
              {!isSimple && (
                <Td className="text-on-surface-variant">
                  {item.isHazardousMaterial ? `Sí (${item.hazardousMaterialCode ?? "—"})` : "No"}
                </Td>
              )}
            </Tr>
          ))}
        </TBody>
      </Table>
    </div>
  );
}
