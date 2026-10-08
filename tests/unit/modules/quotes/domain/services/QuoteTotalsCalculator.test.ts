import { QuoteTotalsCalculator } from "@/modules/quotes/domain/services/QuoteTotalsCalculator";
import { SaleTotalsCalculator } from "@/modules/pos/domain/services/SaleTotalsCalculator";
import { totalsVectors } from "../../../../../fixtures/totals-vectors";

describe("QuoteTotalsCalculator", () => {
  it("extrae IVA al 16% del precio final (tax-inclusive)", () => {
    const r = QuoteTotalsCalculator.computeTotals([
      { quantity: 2, unitPrice: 100, ivaRate: 0.16 },
    ]);
    expect(r.lines[0]).toEqual({
      lineSubtotal: 172.4138,
      lineIva: 27.5862,
      lineIeps: 0,
      lineTax: 27.5862,
      lineTotal: 200,
    });
    expect(r.subtotal).toBe(172.4138);
    expect(r.taxTotal).toBe(27.5862);
    expect(r.total).toBe(200);
  });

  it("aplica descuento por línea", () => {
    const r = QuoteTotalsCalculator.computeTotals([
      { quantity: 1, unitPrice: 100, discountPct: 10 },
    ]);
    expect(r.lines[0].lineSubtotal).toBe(90);
    expect(r.lines[0].lineTotal).toBe(90);
  });

  it("combina IVA y IEPS (extraídos simultáneamente, no en cascada)", () => {
    const r = QuoteTotalsCalculator.computeTotals([
      { quantity: 1, unitPrice: 100, ivaRate: 0.16, iepsRate: 0.08 },
    ]);
    expect(r.lines[0].lineIva).toBe(12.9032);
    expect(r.lines[0].lineIeps).toBe(6.4516);
    expect(r.lines[0].lineTax).toBe(19.3548);
    expect(r.lines[0].lineTotal).toBe(100);
  });

  it("trata null e indefinido como 0", () => {
    const r = QuoteTotalsCalculator.computeTotals([
      { quantity: 1, unitPrice: 100, ivaRate: null, iepsRate: null },
    ]);
    expect(r.lines[0].lineTax).toBe(0);
    expect(r.lines[0].lineTotal).toBe(100);
  });

  it("agrega múltiples líneas correctamente", () => {
    const r = QuoteTotalsCalculator.computeTotals([
      { quantity: 1, unitPrice: 100, ivaRate: 0.16 },
      { quantity: 2, unitPrice: 50 },
    ]);
    expect(r.subtotal).toBe(186.2069);
    expect(r.taxTotal).toBe(13.7931);
    expect(r.total).toBe(200);
  });

  it("rechaza quantity <= 0", () => {
    expect(() =>
      QuoteTotalsCalculator.computeTotals([{ quantity: 0, unitPrice: 100 }])
    ).toThrow();
  });

  it("rechaza unitPrice < 0", () => {
    expect(() =>
      QuoteTotalsCalculator.computeTotals([{ quantity: 1, unitPrice: -1 }])
    ).toThrow();
  });

  it("rechaza discountPct fuera de [0, 100]", () => {
    expect(() =>
      QuoteTotalsCalculator.computeTotals([
        { quantity: 1, unitPrice: 100, discountPct: 150 },
      ])
    ).toThrow();
  });

  it("rechaza ivaRate fuera de [0, 1]", () => {
    expect(() =>
      QuoteTotalsCalculator.computeTotals([
        { quantity: 1, unitPrice: 100, ivaRate: 1.5 },
      ])
    ).toThrow();
  });

  it("rechaza iepsRate fuera de [0, 1]", () => {
    expect(() =>
      QuoteTotalsCalculator.computeTotals([
        { quantity: 1, unitPrice: 100, iepsRate: 2 },
      ])
    ).toThrow();
  });

  it("aplica descuento por monto fijo antes de impuestos", () => {
    const r = QuoteTotalsCalculator.computeTotals([
      { quantity: 1, unitPrice: 500, discountAmount: 100 },
    ]);
    expect(r.lines[0].lineTotal).toBe(400);
  });

  it("rechaza discountPct y discountAmount ambos > 0 en la misma línea", () => {
    expect(() =>
      QuoteTotalsCalculator.computeTotals([
        { quantity: 1, unitPrice: 100, discountPct: 10, discountAmount: 10 },
      ])
    ).toThrow();
  });

  it("isTaxable=false produce lineIva=0 e lineIeps=0 aunque las tasas sean > 0", () => {
    const r = QuoteTotalsCalculator.computeTotals([
      { quantity: 1, unitPrice: 100, ivaRate: 0.16, iepsRate: 0.08, isTaxable: false },
    ]);
    expect(r.lines[0].lineIva).toBe(0);
    expect(r.lines[0].lineIeps).toBe(0);
    expect(r.lines[0].lineTax).toBe(0);
    expect(r.lines[0].lineSubtotal).toBe(100);
    expect(r.lines[0].lineTotal).toBe(100);
  });

  describe("equivalencia con SaleTotalsCalculator", () => {
    it.each(totalsVectors.map((f, i) => [`fixture #${i + 1}`, f]))(
      "%s: QuoteTotalsCalculator === SaleTotalsCalculator",
      (_label, lines) => {
        const quoteResult = QuoteTotalsCalculator.computeTotals(lines as never);
        const saleResult = SaleTotalsCalculator.computeTotals(lines as never);
        expect(quoteResult).toEqual(saleResult);
      }
    );
  });
});
