import { resolveEffectivePrices } from "@/modules/products/domain/services/resolveEffectivePrices";

interface Row {
  branchId: string | null;
  name: string;
  price: number;
}

const ZARIOZ = "branch-zarioz";
const HUAJUAPAN = "branch-huajuapan";

describe("resolveEffectivePrices", () => {
  it("sin overrides de la sucursal retorna todos los precios base", () => {
    const rows: Row[] = [
      { branchId: null, name: "Precio Publico", price: 100 },
      { branchId: null, name: "Precio Subdis 10%", price: 90 },
    ];

    const effective = resolveEffectivePrices(rows, HUAJUAPAN);

    expect(effective).toEqual(rows);
  });

  it("con un override que cubre sólo un name, retorna ÚNICAMENTE ese override — no completa con los demás base", () => {
    const rows: Row[] = [
      { branchId: null, name: "Precio Publico", price: 3666.65 },
      { branchId: null, name: "Precio Subdis 10%", price: 3300 },
      { branchId: null, name: "Precio Distri 15%", price: 3116.65 },
      { branchId: ZARIOZ, name: "Precio Publico", price: 699.35 },
    ];

    const effective = resolveEffectivePrices(rows, ZARIOZ);

    expect(effective).toHaveLength(1);
    expect(effective[0]).toEqual({ branchId: ZARIOZ, name: "Precio Publico", price: 699.35 });
  });

  it("con varios overrides de la sucursal retorna únicamente esos, sin ningún base", () => {
    const rows: Row[] = [
      { branchId: null, name: "Precio Publico", price: 100 },
      { branchId: null, name: "Precio Subdis 10%", price: 90 },
      { branchId: ZARIOZ, name: "Precio Publico", price: 80 },
      { branchId: ZARIOZ, name: "Precio Subdis 10%", price: 70 },
    ];

    const effective = resolveEffectivePrices(rows, ZARIOZ);

    expect(effective).toHaveLength(2);
    expect(effective.every((p) => p.branchId === ZARIOZ)).toBe(true);
  });

  it("ignora filas de otras sucursales tanto en el conteo de overrides como en el resultado", () => {
    const rows: Row[] = [
      { branchId: null, name: "Precio Publico", price: 100 },
      { branchId: HUAJUAPAN, name: "Precio Publico", price: 50 },
    ];

    const effective = resolveEffectivePrices(rows, ZARIOZ);

    expect(effective).toEqual([{ branchId: null, name: "Precio Publico", price: 100 }]);
  });
});
