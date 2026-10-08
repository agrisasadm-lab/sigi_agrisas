import { Quote } from "@/modules/quotes/domain/entities/Quote";
import { QuoteItem } from "@/modules/quotes/domain/entities/QuoteItem";

function makeQuote(overrides: Partial<Parameters<typeof Quote.create>[0]> = {}) {
  const now = new Date("2026-06-01T00:00:00Z");
  return Quote.create({
    id: "q1",
    folioId: "f1",
    folioNumber: 1,
    folioCode: "COT-1",
    branchId: "b1",
    customerId: "c1",
    creatorId: "u1",
    status: "draft",
    subtotal: 100,
    taxTotal: 16,
    total: 116,
    notes: null,
    expiresAt: null,
    authorizedAt: null,
    authorizedBy: null,
    cancelledAt: null,
    cancellationReason: null,
    convertedAt: null,
    convertedSaleId: null,
    createdAt: now,
    updatedAt: now,
    items: [],
    ...overrides,
  });
}

describe("Quote entity", () => {
  it("se construye con todos los props expuestos como readonly", () => {
    const q = makeQuote();
    expect(q.id).toBe("q1");
    expect(q.status).toBe("draft");
    expect(q.subtotal).toBe(100);
    expect(q.taxTotal).toBe(16);
    expect(q.total).toBe(116);
    expect(q.convertedSaleId).toBeNull();
    expect(q.authorizedAt).toBeNull();
    expect(q.cancelledAt).toBeNull();
    expect(q.items).toEqual([]);
  });

  it("acepta items snapshot", () => {
    const item = QuoteItem.create({
      id: "qi1",
      quoteId: "q1",
      productId: "p1",
      productPriceId: "pp1",
      productCodeSnapshot: "PROD",
      productNameSnapshot: "Producto",
      priceNameSnapshot: "Menudeo",
      quantity: 2,
      unitPrice: 50,
      discountPct: null,
      discountAmount: 0,
      ivaRate: 0.16,
      iepsRate: null,
      lineSubtotal: 100,
      lineTax: 16,
      lineTotal: 116,
    });
    const q = makeQuote({ items: [item] });
    expect(q.items).toHaveLength(1);
    expect(q.items[0].productCodeSnapshot).toBe("PROD");
  });

  it("acepta productPriceId null en items (precio borrado del catálogo)", () => {
    const item = QuoteItem.create({
      id: "qi1",
      quoteId: "q1",
      productId: "p1",
      productPriceId: null,
      productCodeSnapshot: "PROD",
      productNameSnapshot: "Producto",
      priceNameSnapshot: "Menudeo",
      quantity: 1,
      unitPrice: 100,
      discountPct: null,
      discountAmount: 0,
      ivaRate: null,
      iepsRate: null,
      lineSubtotal: 100,
      lineTax: 0,
      lineTotal: 100,
    });
    expect(item.productPriceId).toBeNull();
  });
});

describe("Quote.isExpiredNow", () => {
  const ref = new Date("2026-06-15T12:00:00Z");
  const past = new Date("2020-01-01T00:00:00Z");
  const future = new Date("2099-12-31T23:59:59Z");

  it("draft sin expiresAt → false", () => {
    const q = makeQuote({ status: "draft", expiresAt: null });
    expect(q.isExpiredNow(ref)).toBe(false);
  });

  it("draft con expiresAt futuro → false", () => {
    const q = makeQuote({ status: "draft", expiresAt: future });
    expect(q.isExpiredNow(ref)).toBe(false);
  });

  it("draft con expiresAt pasado → false (sólo authorized cuenta como vencida)", () => {
    const q = makeQuote({ status: "draft", expiresAt: past });
    expect(q.isExpiredNow(ref)).toBe(false);
  });

  it("authorized con expiresAt futuro → false", () => {
    const q = makeQuote({ status: "authorized", expiresAt: future });
    expect(q.isExpiredNow(ref)).toBe(false);
  });

  it("authorized con expiresAt pasado → true", () => {
    const q = makeQuote({ status: "authorized", expiresAt: past });
    expect(q.isExpiredNow(ref)).toBe(true);
  });

  it("authorized sin expiresAt → false", () => {
    const q = makeQuote({ status: "authorized", expiresAt: null });
    expect(q.isExpiredNow(ref)).toBe(false);
  });

  it("status='expired' persistido → true incondicional", () => {
    const q = makeQuote({ status: "expired", expiresAt: null });
    expect(q.isExpiredNow(ref)).toBe(true);
  });

  it("converted con expiresAt pasado → false (terminal, ya no cuenta como vencida)", () => {
    const q = makeQuote({ status: "converted", expiresAt: past, convertedSaleId: "s1" });
    expect(q.isExpiredNow(ref)).toBe(false);
  });

  it("cancelled con expiresAt pasado → false", () => {
    const q = makeQuote({ status: "cancelled", expiresAt: past });
    expect(q.isExpiredNow(ref)).toBe(false);
  });

  it("usa Date() actual por default cuando no se pasa now", () => {
    const q = makeQuote({ status: "authorized", expiresAt: past });
    expect(q.isExpiredNow()).toBe(true);
  });
});
