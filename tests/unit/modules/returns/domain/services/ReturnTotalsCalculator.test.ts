import { ReturnTotalsCalculator } from "@/modules/returns/domain/services/ReturnTotalsCalculator";
import { SaleTotalsCalculator } from "@/modules/pos/domain/services/SaleTotalsCalculator";
import { QuoteTotalsCalculator } from "@/modules/quotes/domain/services/QuoteTotalsCalculator";
import { PurchaseTotalsCalculator } from "@/modules/purchases/domain/services/PurchaseTotalsCalculator";
import { totalsVectors, discountAmountVectors } from "../../../../../fixtures/totals-vectors";

describe("ReturnTotalsCalculator", () => {
  it("computes a single line with no taxes", () => {
    const r = ReturnTotalsCalculator.computeTotals([{ quantity: 2, unitPrice: 50 }]);
    expect(r.subtotal).toBe(100);
    expect(r.taxTotal).toBe(0);
    expect(r.total).toBe(100);
    expect(r.lines[0].lineSubtotal).toBe(100);
  });

  it("extracts IVA from the tax-inclusive final price", () => {
    const r = ReturnTotalsCalculator.computeTotals([{ quantity: 1, unitPrice: 100, ivaRate: 0.16 }]);
    expect(r.lines[0].lineIva).toBe(13.7931);
    expect(r.lines[0].lineIeps).toBe(0);
    expect(r.lines[0].lineTax).toBe(13.7931);
    expect(r.lines[0].lineTotal).toBe(100);
  });

  it("applies discount before extracting tax", () => {
    const r = ReturnTotalsCalculator.computeTotals([
      { quantity: 1, unitPrice: 100, discountPct: 10, ivaRate: 0.16 },
    ]);
    expect(r.lines[0].lineSubtotal).toBe(77.5862);
    expect(r.lines[0].lineIva).toBe(12.4138);
    expect(r.lines[0].lineTotal).toBe(90);
  });

  it("extracts IEPS and IVA simultaneously from the same base (not cascaded)", () => {
    const r = ReturnTotalsCalculator.computeTotals([
      { quantity: 1, unitPrice: 100, ivaRate: 0.16, iepsRate: 0.08 },
    ]);
    expect(r.lines[0].lineIva).toBe(12.9032);
    expect(r.lines[0].lineIeps).toBe(6.4516);
    expect(r.lines[0].lineTax).toBe(19.3548);
    expect(r.lines[0].lineTotal).toBe(100);
  });

  it("treats null rates as 0", () => {
    const r = ReturnTotalsCalculator.computeTotals([
      { quantity: 1, unitPrice: 100, ivaRate: null, iepsRate: null },
    ]);
    expect(r.lines[0].lineIva).toBe(0);
    expect(r.lines[0].lineIeps).toBe(0);
    expect(r.total).toBe(100);
  });

  it("aggregates multi-line totals", () => {
    const r = ReturnTotalsCalculator.computeTotals([
      { quantity: 1, unitPrice: 100, ivaRate: 0.16 },
      { quantity: 2, unitPrice: 50 },
    ]);
    expect(r.subtotal).toBe(186.2069);
    expect(r.taxTotal).toBe(13.7931);
    expect(r.total).toBe(200);
  });

  it("applies banker's rounding to limit float artifacts", () => {
    const r = ReturnTotalsCalculator.computeTotals([{ quantity: 3, unitPrice: 33.333, ivaRate: 0.16 }]);
    expect(r.lines[0].lineTotal).toBe(99.999);
    expect(r.lines[0].lineSubtotal).toBe(86.206);
    expect(typeof r.lines[0].lineIva).toBe("number");
  });

  it("throws on quantity <= 0", () => {
    expect(() =>
      ReturnTotalsCalculator.computeTotals([{ quantity: 0, unitPrice: 10 }])
    ).toThrow("quantity must be > 0");
    expect(() =>
      ReturnTotalsCalculator.computeTotals([{ quantity: -1, unitPrice: 10 }])
    ).toThrow("quantity must be > 0");
  });

  it("throws on unitPrice < 0", () => {
    expect(() =>
      ReturnTotalsCalculator.computeTotals([{ quantity: 1, unitPrice: -1 }])
    ).toThrow("unitPrice must be >= 0");
  });

  it("throws on discountPct out of range", () => {
    expect(() =>
      ReturnTotalsCalculator.computeTotals([{ quantity: 1, unitPrice: 10, discountPct: 101 }])
    ).toThrow("discountPct must be between 0 and 100");
  });

  it("applies flat-amount discount before extracting tax (refund of a discounted line)", () => {
    const r = ReturnTotalsCalculator.computeTotals([{ quantity: 1, unitPrice: 500, discountAmount: 100 }]);
    expect(r.lines[0].lineTotal).toBe(400);
  });

  describe("equivalence with Sale/QuoteTotalsCalculator on discountAmount vectors (excluded from Purchase comparison — see fixtures)", () => {
    discountAmountVectors.forEach((vector, i) => {
      it(`discountAmount vector ${i + 1}`, () => {
        const returnResult = ReturnTotalsCalculator.computeTotals(vector as Parameters<typeof ReturnTotalsCalculator.computeTotals>[0]);
        const saleResult = SaleTotalsCalculator.computeTotals(vector as Parameters<typeof SaleTotalsCalculator.computeTotals>[0]);
        const quoteResult = QuoteTotalsCalculator.computeTotals(vector as Parameters<typeof QuoteTotalsCalculator.computeTotals>[0]);

        expect(returnResult).toEqual(saleResult);
        expect(returnResult).toEqual(quoteResult);
      });
    });
  });

  describe("equivalence with SaleTotalsCalculator, QuoteTotalsCalculator and PurchaseTotalsCalculator", () => {
    totalsVectors.forEach((vector, i) => {
      it(`vector ${i + 1}`, () => {
        const returnResult = ReturnTotalsCalculator.computeTotals(vector as Parameters<typeof ReturnTotalsCalculator.computeTotals>[0]);
        const saleResult = SaleTotalsCalculator.computeTotals(vector as Parameters<typeof SaleTotalsCalculator.computeTotals>[0]);
        const quoteResult = QuoteTotalsCalculator.computeTotals(vector as Parameters<typeof QuoteTotalsCalculator.computeTotals>[0]);
        const purchaseVector = vector.map(({ unitPrice, ...rest }) => ({ ...rest, unitCost: unitPrice }));
        const purchaseResult = PurchaseTotalsCalculator.computeTotals(purchaseVector);

        expect(returnResult.subtotal).toBe(saleResult.subtotal);
        expect(returnResult.taxTotal).toBe(saleResult.taxTotal);
        expect(returnResult.total).toBe(saleResult.total);

        expect(returnResult.subtotal).toBe(quoteResult.subtotal);
        expect(returnResult.taxTotal).toBe(quoteResult.taxTotal);
        expect(returnResult.total).toBe(quoteResult.total);

        expect(purchaseResult.subtotal).toBe(saleResult.subtotal);
        expect(purchaseResult.taxTotal).toBe(saleResult.taxTotal);
        expect(purchaseResult.total).toBe(saleResult.total);

        returnResult.lines.forEach((line, j) => {
          expect(line.lineSubtotal).toBe(saleResult.lines[j].lineSubtotal);
          expect(line.lineTax).toBe(saleResult.lines[j].lineTax);
          expect(line.lineTotal).toBe(saleResult.lines[j].lineTotal);
        });

        purchaseResult.lines.forEach((line, j) => {
          expect(line.lineSubtotal).toBe(saleResult.lines[j].lineSubtotal);
          expect(line.lineTax).toBe(saleResult.lines[j].lineTax);
          expect(line.lineTotal).toBe(saleResult.lines[j].lineTotal);
        });
      });
    });
  });
});
