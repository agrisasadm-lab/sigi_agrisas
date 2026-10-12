"use client";

import { useState } from "react";
import { Button } from "../../../_components/atoms/Button/Button";
import { Table, THead, TBody, Tr, Th } from "../../../_components/molecules/DataTable/DataTable";
import { ProductCatalogPanel } from "../../pos/_blocks/ProductCatalogPanel";
import { WaybillLineRow } from "./WaybillLineRow";
import type { WaybillLineState } from "../_logic/hooks/useCreateWaybillForm";
import type { ProductDto } from "../../pos/_logic/types/api";
import type { WaybillType } from "../_logic/types/api";

interface WaybillItemsFormProps {
  type: WaybillType;
  lines: WaybillLineState[];
  addLine: (line: Omit<WaybillLineState, "_key" | "error">) => void;
  updateLine: (key: string, patch: Partial<WaybillLineState>) => void;
  removeLine: (key: string) => void;
  lockProductAndQuantity?: boolean;
}

export function WaybillItemsForm({
  type,
  lines,
  addLine,
  updateLine,
  removeLine,
  lockProductAndQuantity,
}: WaybillItemsFormProps) {
  const [showCatalog, setShowCatalog] = useState(false);
  const isSimple = type === "simple";

  function handleAddProduct(product: ProductDto) {
    addLine({
      productId: product.id,
      description: product.name,
      satBienesTranspCode: "",
      satUnitCode: "",
      quantity: 1,
      weightKg: 0,
      isHazardousMaterial: false,
      hazardousMaterialCode: "",
    });
    setShowCatalog(false);
  }

  function handleAddFreeLine() {
    addLine({
      productId: null,
      description: "",
      satBienesTranspCode: "",
      satUnitCode: "",
      quantity: 1,
      weightKg: 0,
      isHazardousMaterial: false,
      hazardousMaterialCode: "",
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-label-md font-semibold text-on-surface">
          Mercancías <span className="text-error">*</span>
        </h3>
        {!lockProductAndQuantity && (
          <div className="flex gap-2">
            <Button type="button" variant="outlined" onClick={() => setShowCatalog((v) => !v)} className="px-3 py-1 text-label-sm hover:bg-surface-container">
              + Catálogo
            </Button>
            {!isSimple && (
              <Button type="button" variant="outlined" onClick={handleAddFreeLine} className="px-3 py-1 text-label-sm hover:bg-surface-container">
                + Línea libre
              </Button>
            )}
          </div>
        )}
      </div>

      {showCatalog && !lockProductAndQuantity && (
        <div className="border border-outline-variant rounded-md overflow-hidden mb-4">
          <ProductCatalogPanel onAddProduct={handleAddProduct} />
        </div>
      )}

      {lines.length > 0 ? (
        <div className="overflow-x-auto border border-outline-variant rounded-md">
          <Table>
            <THead>
              <Tr hoverable={false}>
                <Th className="px-2 py-2">Descripción</Th>
                {!isSimple && <Th className="px-2 py-2 w-32">Clave SAT</Th>}
                {!isSimple && <Th className="px-2 py-2 w-24">Unidad</Th>}
                <Th align="right" className="px-2 py-2 w-20">Cant.</Th>
                {!isSimple && <Th align="right" className="px-2 py-2 w-24">Peso (kg)</Th>}
                {!isSimple && <Th className="px-2 py-2 w-24">Peligroso</Th>}
                <Th className="px-2 py-2" />
              </Tr>
            </THead>
            <TBody>
              {lines.map((line) => (
                <WaybillLineRow
                  key={line._key}
                  type={type}
                  line={line}
                  onUpdate={(patch) => updateLine(line._key, patch)}
                  onRemove={() => removeLine(line._key)}
                  lockProductAndQuantity={lockProductAndQuantity}
                />
              ))}
            </TBody>
          </Table>
        </div>
      ) : (
        <p className="text-body-sm text-on-surface-variant py-4 text-center border border-outline-variant border-dashed rounded-md">
          {isSimple ? "Sin mercancías. Agrega del catálogo." : "Sin mercancías. Agrega del catálogo o como línea libre."}
        </p>
      )}
    </div>
  );
}
