import { computeLineTotals } from "@/shared/domain/services/LineTotalsCalculator";

describe("computeLineTotals — núcleo compartido", () => {
  it("matches SaleTotalsCalculator's simple-line vector", () => {
    const result = computeLineTotals([{ quantity: 2, price: 100, ivaRate: 0.16 }], "unitPrice");
    expect(result.lines[0]).toEqual({
      lineSubtotal: 172.4138,
      lineIva: 27.5862,
      lineIeps: 0,
      lineTax: 27.5862,
      lineTotal: 200,
    });
    expect(result.subtotal).toBe(172.4138);
    expect(result.taxTotal).toBe(27.5862);
    expect(result.total).toBe(200);
  });

  it("uses the given price field label in the error message", () => {
    expect(() => computeLineTotals([{ quantity: 1, price: -1 }], "unitCost")).toThrow(
      "unitCost must be >= 0"
    );
    expect(() => computeLineTotals([{ quantity: 1, price: -1 }], "unitPrice")).toThrow(
      "unitPrice must be >= 0"
    );
  });

  it("rejects invalid quantity regardless of price field label", () => {
    expect(() => computeLineTotals([{ quantity: 0, price: 100 }], "unitPrice")).toThrow(
      "quantity must be > 0"
    );
  });

  describe("discountAmount (descuento por monto fijo)", () => {
    it("subtracts the flat amount from the gross, no tax rates", () => {
      const result = computeLineTotals([{ quantity: 1, price: 500, discountAmount: 100 }], "unitPrice");
      expect(result.lines[0]).toEqual({
        lineSubtotal: 400,
        lineIva: 0,
        lineIeps: 0,
        lineTax: 0,
        lineTotal: 400,
      });
    });

    it("subtracts the flat amount before tax extraction", () => {
      const result = computeLineTotals(
        [{ quantity: 1, price: 116, discountAmount: 16, ivaRate: 0.16 }],
        "unitPrice"
      );
      expect(result.lines[0].lineTotal).toBe(100);
      expect(result.lines[0].lineSubtotal).toBeCloseTo(86.2069, 4);
      expect(result.lines[0].lineIva).toBeCloseTo(13.7931, 4);
    });

    it("clamps to 0 when the amount exceeds the line's gross, never negative", () => {
      const result = computeLineTotals([{ quantity: 1, price: 80, discountAmount: 100 }], "unitPrice");
      expect(result.lines[0].lineTotal).toBe(0);
      expect(result.lines[0].lineSubtotal).toBe(0);
    });

    it("rejects discountPct and discountAmount both > 0 on the same line (mutually exclusive)", () => {
      expect(() =>
        computeLineTotals([{ quantity: 1, price: 100, discountPct: 10, discountAmount: 10 }], "unitPrice")
      ).toThrow("discountPct and discountAmount are mutually exclusive");
    });

    it("rejects discountAmount above 100", () => {
      expect(() => computeLineTotals([{ quantity: 1, price: 100, discountAmount: 150 }], "unitPrice")).toThrow(
        "discountAmount must be between 0 and 100"
      );
    });

    it("rejects negative discountAmount", () => {
      expect(() => computeLineTotals([{ quantity: 1, price: 100, discountAmount: -1 }], "unitPrice")).toThrow(
        "discountAmount must be between 0 and 100"
      );
    });

    it("defaults to 0 when absent — degenerates to the pre-existing percentage-only formula", () => {
      const withAmount = computeLineTotals([{ quantity: 1, price: 100, discountPct: 10 }], "unitPrice");
      const withoutAmount = computeLineTotals(
        [{ quantity: 1, price: 100, discountPct: 10, discountAmount: 0 }],
        "unitPrice"
      );
      expect(withAmount).toEqual(withoutAmount);
    });
  });
});
