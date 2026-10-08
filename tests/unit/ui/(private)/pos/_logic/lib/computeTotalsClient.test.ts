import { computeTotalsClient } from "../../../../../../../app/(private)/pos/_logic/lib/computeTotalsClient";

describe("computeTotalsClient", () => {
  it("línea simple sin impuestos ni descuento", () => {
    const result = computeTotalsClient([
      { quantity: 2, unitPrice: 100, discountPct: 0, ivaRate: 0, iepsRate: 0 },
    ]);
    expect(result.lines[0].lineSubtotal).toBe(200);
    expect(result.lines[0].lineIva).toBe(0);
    expect(result.lines[0].lineIeps).toBe(0);
    expect(result.lines[0].lineTotal).toBe(200);
    expect(result.subtotal).toBe(200);
    expect(result.taxTotal).toBe(0);
    expect(result.total).toBe(200);
  });

  it("línea con descuento del 10%", () => {
    const result = computeTotalsClient([
      { quantity: 1, unitPrice: 100, discountPct: 10, ivaRate: 0, iepsRate: 0 },
    ]);
    expect(result.lines[0].lineSubtotal).toBe(90);
    expect(result.total).toBe(90);
  });

  it("línea con IVA 16% (extraído del precio final)", () => {
    const result = computeTotalsClient([
      { quantity: 1, unitPrice: 100, discountPct: 0, ivaRate: 0.16, iepsRate: 0 },
    ]);
    expect(result.lines[0].lineSubtotal).toBe(86.2069);
    expect(result.lines[0].lineIva).toBe(13.7931);
    expect(result.lines[0].lineIeps).toBe(0);
    expect(result.lines[0].lineTotal).toBe(100);
    expect(result.subtotal).toBe(86.2069);
    expect(result.taxTotal).toBe(13.7931);
    expect(result.total).toBe(100);
  });

  it("línea con IVA + IEPS (extraídos simultáneamente)", () => {
    const result = computeTotalsClient([
      { quantity: 1, unitPrice: 100, discountPct: 0, ivaRate: 0.16, iepsRate: 0.08 },
    ]);
    expect(result.lines[0].lineIva).toBe(12.9032);
    expect(result.lines[0].lineIeps).toBe(6.4516);
    expect(result.lines[0].lineTotal).toBe(100);
    expect(result.taxTotal).toBe(19.3548);
    expect(result.total).toBe(100);
  });

  it("null rates se tratan como 0 a través del caller (ivaRate=0, iepsRate=0)", () => {
    const result = computeTotalsClient([
      { quantity: 1, unitPrice: 50, discountPct: 0, ivaRate: 0, iepsRate: 0 },
    ]);
    expect(result.lines[0].lineIva).toBe(0);
    expect(result.lines[0].lineIeps).toBe(0);
  });

  it("multi-línea calcula subtotales individuales y suma global", () => {
    const result = computeTotalsClient([
      { quantity: 2, unitPrice: 100, discountPct: 0, ivaRate: 0.16, iepsRate: 0 },
      { quantity: 3, unitPrice: 50,  discountPct: 0, ivaRate: 0.16, iepsRate: 0 },
    ]);
    expect(result.lines[0].lineSubtotal).toBe(172.4138);
    expect(result.lines[1].lineSubtotal).toBe(129.3103);
    expect(result.subtotal).toBe(301.7241);
    expect(result.taxTotal).toBe(48.2758);
    expect(result.total).toBe(350);
  });

  it("banker's rounding .12345 → redondea a par (a 4 decimales)", () => {
    // 1 * 0.12345 with discount 0 and no taxes
    // lineSubtotal = 0.1234 (4 decimales, banker's round: .12345 → .1234 because 4 is even)
    const result = computeTotalsClient([
      { quantity: 1, unitPrice: 0.12345, discountPct: 0, ivaRate: 0, iepsRate: 0 },
    ]);
    // 0.12345 × 1 × 1 = 0.12345 → banker's round 4 dec → .1234 (4 is even)
    expect(result.lines[0].lineSubtotal).toBe(0.1234);
  });

  it("carrito vacío devuelve totales en cero", () => {
    const result = computeTotalsClient([]);
    expect(result.subtotal).toBe(0);
    expect(result.taxTotal).toBe(0);
    expect(result.total).toBe(0);
    expect(result.lines).toHaveLength(0);
  });

  describe("descuento por monto fijo (discountAmount)", () => {
    it("resta el monto fijo antes de impuestos", () => {
      const result = computeTotalsClient([
        { quantity: 1, unitPrice: 500, discountPct: 0, discountAmount: 100, ivaRate: 0, iepsRate: 0 },
      ]);
      expect(result.lines[0].lineTotal).toBe(400);
    });

    it("combinado con IVA: resta antes de extraer el impuesto", () => {
      const result = computeTotalsClient([
        { quantity: 1, unitPrice: 116, discountPct: 0, discountAmount: 16, ivaRate: 0.16, iepsRate: 0 },
      ]);
      expect(result.lines[0].lineTotal).toBe(100);
      expect(result.lines[0].lineSubtotal).toBe(86.2069);
    });

    it("se clampa a 0 cuando el monto excede el bruto de la línea, nunca negativo", () => {
      const result = computeTotalsClient([
        { quantity: 1, unitPrice: 80, discountPct: 0, discountAmount: 100, ivaRate: 0, iepsRate: 0 },
      ]);
      expect(result.lines[0].lineTotal).toBe(0);
    });

    it("ausente (undefined) se trata como 0 — no cambia el comportamiento del % existente", () => {
      const result = computeTotalsClient([
        { quantity: 1, unitPrice: 100, discountPct: 10, ivaRate: 0, iepsRate: 0 },
      ]);
      expect(result.lines[0].lineTotal).toBe(90);
    });
  });

  describe("recargo por cantidad fraccionaria (surchargePct)", () => {
    it("aplica el recargo a una línea normal con quantity fraccionaria", () => {
      const result = computeTotalsClient(
        [{ quantity: 0.5, unitPrice: 100, discountPct: 0, ivaRate: 0, iepsRate: 0 }],
        5
      );
      expect(result.lines[0].lineTotal).toBe(52.5); // 0.5 * (100 * 1.05)
    });

    it("no aplica recargo cuando quantity es entera", () => {
      const result = computeTotalsClient(
        [{ quantity: 2, unitPrice: 100, discountPct: 0, ivaRate: 0, iepsRate: 0 }],
        5
      );
      expect(result.lines[0].lineTotal).toBe(200);
    });

    it("no aplica recargo a una línea de dosificación aunque quantity sea fraccionaria", () => {
      const result = computeTotalsClient(
        [{ quantity: 1.5, unitPrice: 26.25, discountPct: 0, ivaRate: 0, iepsRate: 0, isDosificationLine: true }],
        5
      );
      expect(result.lines[0].lineTotal).toBe(39.375); // 1.5 * 26.25, sin recargo adicional
    });

    it("surchargePct=0 (default) no cambia el resultado de una línea fraccionaria", () => {
      const result = computeTotalsClient([
        { quantity: 0.5, unitPrice: 100, discountPct: 0, ivaRate: 0, iepsRate: 0 },
      ]);
      expect(result.lines[0].lineTotal).toBe(50);
    });
  });
});
