import { toSaleDto, toSaleItemDto } from "@/modules/pos/application/mappers/toSaleDto";
import { SaleItem } from "@/modules/pos/domain/entities/SaleItem";
import { Sale } from "@/modules/pos/domain/entities/Sale";

function buildItem(overrides: Partial<Parameters<typeof SaleItem.create>[0]> = {}) {
  return SaleItem.create({
    id: "item-1",
    saleId: "sale-1",
    productId: "product-1",
    productPriceId: "price-1",
    dosificationId: null,
    numPartsSnapshot: null,
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

describe("toSaleDto", () => {
  it("propaga paymentMethodName desde los joined fields", () => {
    const sale = Sale.create({
      id: "sale-1",
      folioId: "folio-1",
      folioNumber: 1,
      folioCode: "TK-000001",
      branchId: "branch-1",
      customerId: null,
      cashierId: "cashier-1",
      paymentMethodId: "pm-1",
      quoteId: null,
      status: "completed",
      paidAmount: 100,
      paymentStatus: "paid",
      subtotal: 100,
      taxTotal: 0,
      total: 100,
      notes: null,
      completedAt: new Date(),
      cancelledAt: null,
      cancellationReason: null,
      editedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      items: [],
    });

    const dto = toSaleDto(sale, {
      branchName: "Matriz",
      customerName: null,
      customerRfc: null,
      customerAddress: null,
      customerCreditDays: null,
      cashierName: "Admin",
      paymentMethodCode: "EFECTIVO",
      paymentMethodName: "Efectivo",
      paymentMethodIsCredit: false,
    });

    expect(dto.paymentMethodCode).toBe("EFECTIVO");
    expect(dto.paymentMethodName).toBe("Efectivo");
  });

  it("propaga customerAddress y customerCreditDays desde los joined fields", () => {
    const sale = Sale.create({
      id: "sale-2",
      folioId: "folio-1",
      folioNumber: 2,
      folioCode: "TK-000002",
      branchId: "branch-1",
      customerId: "cust-1",
      cashierId: "cashier-1",
      paymentMethodId: "pm-1",
      quoteId: null,
      status: "completed",
      paidAmount: 0,
      paymentStatus: "pending",
      subtotal: 100,
      taxTotal: 16,
      total: 116,
      notes: null,
      completedAt: new Date(),
      cancelledAt: null,
      cancellationReason: null,
      editedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      items: [],
    });

    const dto = toSaleDto(sale, {
      branchName: "Matriz",
      customerName: "Cliente Uno",
      customerRfc: "XAXX010101000",
      customerAddress: "Av. Central 123, Oaxaca",
      customerCreditDays: 30,
      cashierName: "Admin",
      paymentMethodCode: "CREDITO",
      paymentMethodName: "Crédito",
      paymentMethodIsCredit: true,
    });

    expect(dto.customerRfc).toBe("XAXX010101000");
    expect(dto.customerAddress).toBe("Av. Central 123, Oaxaca");
    expect(dto.customerCreditDays).toBe(30);
  });
});

describe("toSaleItemDto", () => {
  it("derives lineIva and lineIeps from lineSubtotal and rates", () => {
    const dto = toSaleItemDto(buildItem());

    expect(dto.lineIva).toBe(32);
    expect(dto.lineIeps).toBe(16);
    expect(dto.lineTax).toBe(48);
  });

  it("resolves satProductCode from the productId map (parity with billing's live join)", () => {
    const dto = toSaleItemDto(buildItem(), { "product-1": "10171500" });
    expect(dto.satProductCode).toBe("10171500");
  });

  it("defaults satProductCode to null when the product has no SAT code or the map is omitted", () => {
    expect(toSaleItemDto(buildItem()).satProductCode).toBeNull();
    expect(toSaleItemDto(buildItem(), { "product-1": null }).satProductCode).toBeNull();
    expect(toSaleItemDto(buildItem(), { "other-product": "10171500" }).satProductCode).toBeNull();
  });

  it("defaults to 0 when ivaRate/iepsRate are null", () => {
    const dto = toSaleItemDto(
      buildItem({ ivaRate: null, iepsRate: null, lineTax: 0, lineTotal: 200 })
    );

    expect(dto.lineIva).toBe(0);
    expect(dto.lineIeps).toBe(0);
  });

  it("rounds to 4 decimals", () => {
    const dto = toSaleItemDto(
      buildItem({ lineSubtotal: 33.333, ivaRate: 0.16, iepsRate: 0 })
    );

    expect(dto.lineIva).toBe(5.3333);
    expect(dto.lineIeps).toBe(0);
  });

  it("uses banker's rounding (half-to-even), matching the persisted lineTax at the exact .5 tie", () => {
    // 100.0002 * 0.25 = 25.00005 exactly at the 4th-decimal tie: half-up would
    // give 25.0001, half-to-even gives 25.0000 — must match lineTax's rounding.
    const dto = toSaleItemDto(
      buildItem({ lineSubtotal: 100.0002, ivaRate: 0, iepsRate: 0.25, lineTax: 25, lineTotal: 125.0002 })
    );

    expect(dto.lineIeps).toBe(25);
    expect(dto.lineIva + dto.lineIeps).toBe(dto.lineTax);
  });
});
