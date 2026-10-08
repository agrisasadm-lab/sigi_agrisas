import { SaleTotalsCalculator } from "@/modules/pos/domain/services/SaleTotalsCalculator";
import { totalsVectors } from "../../../../../fixtures/totals-vectors";

describe("SaleTotalsCalculator", () => {
  it("calcula totales para una línea simple sin impuestos", () => {
    const r = SaleTotalsCalculator.computeTotals([
      { quantity: 1, unitPrice: 100 },
    ]);
    expect(r.lines[0].lineSubtotal).toBe(100);
    expect(r.lines[0].lineTax).toBe(0);
    expect(r.lines[0].lineTotal).toBe(100);
    expect(r.subtotal).toBe(100);
    expect(r.taxTotal).toBe(0);
    expect(r.total).toBe(100);
  });

  it("extrae IVA al 16% del precio final (tax-inclusive)", () => {
    const r = SaleTotalsCalculator.computeTotals([
      { quantity: 2, unitPrice: 100, ivaRate: 0.16 },
    ]);
    expect(r.lines[0].lineSubtotal).toBe(172.4138);
    expect(r.lines[0].lineIva).toBe(27.5862);
    expect(r.lines[0].lineTax).toBe(27.5862);
    expect(r.lines[0].lineTotal).toBe(200);
    expect(r.total).toBe(200);
  });

  it("aplica descuento porcentual antes de impuestos", () => {
    const r = SaleTotalsCalculator.computeTotals([
      { quantity: 1, unitPrice: 100, discountPct: 10 },
    ]);
    expect(r.lines[0].lineSubtotal).toBe(90);
    expect(r.lines[0].lineTotal).toBe(90);
  });

  it("extrae IVA + IEPS simultáneamente de la misma base (no en cascada)", () => {
    const r = SaleTotalsCalculator.computeTotals([
      { quantity: 1, unitPrice: 100, ivaRate: 0.16, iepsRate: 0.08 },
    ]);
    expect(r.lines[0].lineSubtotal).toBe(80.6452);
    expect(r.lines[0].lineIva).toBe(12.9032);
    expect(r.lines[0].lineIeps).toBe(6.4516);
    expect(r.lines[0].lineTax).toBe(19.3548);
    expect(r.lines[0].lineTotal).toBe(100);
  });

  it("trata null como 0 para tasas e descuento", () => {
    const r = SaleTotalsCalculator.computeTotals([
      { quantity: 1, unitPrice: 100, ivaRate: null, iepsRate: null, discountPct: null },
    ]);
    expect(r.lines[0].lineTax).toBe(0);
    expect(r.lines[0].lineTotal).toBe(100);
  });

  it("agrega totales multilínea", () => {
    const r = SaleTotalsCalculator.computeTotals([
      { quantity: 1, unitPrice: 100, ivaRate: 0.16 },
      { quantity: 2, unitPrice: 50 },
    ]);
    expect(r.subtotal).toBe(186.2069);
    expect(r.taxTotal).toBe(13.7931);
    expect(r.total).toBe(200);
  });

  it("rechaza quantity <= 0", () => {
    expect(() =>
      SaleTotalsCalculator.computeTotals([{ quantity: 0, unitPrice: 100 }])
    ).toThrow(/quantity must be > 0/);
  });

  it("rechaza unitPrice < 0", () => {
    expect(() =>
      SaleTotalsCalculator.computeTotals([{ quantity: 1, unitPrice: -1 }])
    ).toThrow(/unitPrice must be >= 0/);
  });

  it("rechaza discountPct fuera de [0, 100]", () => {
    expect(() =>
      SaleTotalsCalculator.computeTotals([{ quantity: 1, unitPrice: 100, discountPct: 101 }])
    ).toThrow(/discountPct must be between 0 and 100/);
  });

  it("rechaza ivaRate fuera de [0, 1]", () => {
    expect(() =>
      SaleTotalsCalculator.computeTotals([{ quantity: 1, unitPrice: 100, ivaRate: 1.5 }])
    ).toThrow(/ivaRate must be between 0 and 1/);
  });

  it("aplica descuento por monto fijo antes de impuestos", () => {
    const r = SaleTotalsCalculator.computeTotals([
      { quantity: 1, unitPrice: 116, discountAmount: 16, ivaRate: 0.16 },
    ]);
    expect(r.lines[0].lineTotal).toBe(100);
    expect(r.lines[0].lineSubtotal).toBeCloseTo(86.2069, 4);
  });

  it("descuento por monto que excede el bruto de la línea se clampa a 0", () => {
    const r = SaleTotalsCalculator.computeTotals([
      { quantity: 1, unitPrice: 80, discountAmount: 100 },
    ]);
    expect(r.lines[0].lineTotal).toBe(0);
  });

  it("rechaza discountPct y discountAmount ambos > 0 en la misma línea", () => {
    expect(() =>
      SaleTotalsCalculator.computeTotals([
        { quantity: 1, unitPrice: 100, discountPct: 10, discountAmount: 10 },
      ])
    ).toThrow(/mutually exclusive/);
  });

  it("rechaza discountAmount fuera de [0, 100]", () => {
    expect(() =>
      SaleTotalsCalculator.computeTotals([{ quantity: 1, unitPrice: 100, discountAmount: 150 }])
    ).toThrow(/discountAmount must be between 0 and 100/);
  });

  it("isTaxable=false produce lineIva=0 e lineIeps=0 aunque las tasas sean > 0", () => {
    const r = SaleTotalsCalculator.computeTotals([
      { quantity: 1, unitPrice: 100, ivaRate: 0.16, iepsRate: 0.08, isTaxable: false },
    ]);
    expect(r.lines[0].lineIva).toBe(0);
    expect(r.lines[0].lineIeps).toBe(0);
    expect(r.lines[0].lineTax).toBe(0);
    expect(r.lines[0].lineSubtotal).toBe(100);
    expect(r.lines[0].lineTotal).toBe(100);
  });

  describe("fixtures compartidos (tests/fixtures/totals-vectors.ts)", () => {
    it.each(totalsVectors.map((f, i) => [`fixture #${i + 1}`, f]))(
      "%s: produce totales consistentes (total = subtotal + taxTotal)",
      (_label, lines) => {
        const r = SaleTotalsCalculator.computeTotals(lines as never);
        expect(r.lines).toHaveLength(lines.length);
        const sumLineSubtotals = r.lines.reduce((acc, l) => acc + l.lineSubtotal, 0);
        const sumLineTax = r.lines.reduce((acc, l) => acc + l.lineTax, 0);
        expect(r.subtotal).toBeCloseTo(sumLineSubtotals, 4);
        expect(r.taxTotal).toBeCloseTo(sumLineTax, 4);
        expect(r.total).toBeCloseTo(r.subtotal + r.taxTotal, 4);
      }
    );
  });
});
