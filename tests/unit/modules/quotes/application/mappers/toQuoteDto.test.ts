import { toQuoteItemDto } from "@/modules/quotes/application/mappers/toQuoteDto";
import { QuoteItem } from "@/modules/quotes/domain/entities/QuoteItem";

function buildItem(overrides: Partial<Parameters<typeof QuoteItem.create>[0]> = {}) {
  return QuoteItem.create({
    id: "item-1",
    quoteId: "quote-1",
    productId: "product-1",
    productPriceId: "price-1",
    productCodeSnapshot: "SKU-1",
    productNameSnapshot: "Product 1",
    priceNameSnapshot: "Default",
    quantity: 2,
    unitPrice: 100,
    discountPct: 0,
    discountAmount: 0,
    ivaRate: 0.16,
    iepsRate: 0.08,
    lineSubtotal: 200,
    lineTax: 48,
    lineTotal: 248,
    ...overrides,
  });
}

describe("toQuoteItemDto", () => {
  it("derives lineIva and lineIeps from lineSubtotal and rates", () => {
    const dto = toQuoteItemDto(buildItem());

    expect(dto.lineIva).toBe(32);
    expect(dto.lineIeps).toBe(16);
    expect(dto.lineTax).toBe(48);
  });

  it("defaults to 0 when ivaRate/iepsRate are null", () => {
    const dto = toQuoteItemDto(
      buildItem({ ivaRate: null, iepsRate: null, lineTax: 0, lineTotal: 200 })
    );

    expect(dto.lineIva).toBe(0);
    expect(dto.lineIeps).toBe(0);
  });

  it("uses banker's rounding (half-to-even), matching the persisted lineTax at the exact .5 tie", () => {
    const dto = toQuoteItemDto(
      buildItem({ lineSubtotal: 100.0002, ivaRate: 0, iepsRate: 0.25, lineTax: 25, lineTotal: 125.0002 })
    );

    expect(dto.lineIeps).toBe(25);
    expect(dto.lineIva + dto.lineIeps).toBe(dto.lineTax);
  });
});
