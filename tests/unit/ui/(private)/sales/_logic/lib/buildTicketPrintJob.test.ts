import { buildTicketPrintJob } from "../../../../../../../app/(private)/sales/_logic/lib/buildTicketPrintJob";
import type { SaleDetail } from "../../../../../../../app/(private)/sales/_logic/types/domain";
import type { TicketSettingsDto } from "../../../../../../../app/(private)/settings/_logic/types/api";

const ORIGIN = "http://localhost:3000";

const sale: SaleDetail = {
  id: "sale-1",
  branchId: "b1",
  branchName: "Matriz",
  customerId: "c1",
  customerName: "Cliente Uno",
  customerRfc: "XAXX010101000",
  customerAddress: "Av. Central 123, Oaxaca",
  customerCreditDays: 30,
  cashierId: "u1",
  cashierName: "Admin",
  folioId: "f1",
  folioCode: "TK-42",
  folioNumber: 42,
  folioPrefix: "TK",
  paymentMethodId: "pm1",
  paymentMethodName: "Efectivo",
  status: "completed",
  subtotal: 100,
  taxTotal: 16,
  total: 116,
  paidAmount: 116,
  paymentStatus: "paid",
  isCredit: false,
  createdAt: new Date("2026-08-02T10:00:00Z"),
  updatedAt: new Date("2026-08-02T10:00:00Z"),
  items: [
    {
      id: "item-1",
      productId: "p1",
      productCodeSnapshot: "PK1",
      productNameSnapshot: "PACKHARD 1 L",
      productPriceId: "price-1",
      priceNameSnapshot: "Precio Publico",
      quantity: 1,
      unitPrice: 100,
      discountPct: 0,
      discountAmount: 0,
      ivaRate: 0.16,
      iepsRate: 0,
      lineSubtotal: 100,
      lineIva: 16,
      lineIeps: 0,
      lineTotal: 116,
    },
  ],
  returnedQuantityBySaleItem: {},
};

const defaultSettings: TicketSettingsDto = {
  logoUrl: null,
  footerText: null,
  paperWidth: "80mm",
  businessName: null,
  businessRfc: null,
  businessAddress: null,
  businessPhone: null,
  businessEmail: null,
  businessTaxRegime: null,
  businessZipCode: null,
  legendText: null,
};

describe("buildTicketPrintJob", () => {
  it("includes the customer section when the sale has a customer (parity with PrintableTicket)", () => {
    const job = buildTicketPrintJob(sale, defaultSettings, ORIGIN);
    expect(job.customer).toEqual({ rfc: "XAXX010101000", name: "Cliente Uno", address: "Av. Central 123, Oaxaca" });
  });

  it("omits the customer section for walk-in sales, but still includes conditionsLine", () => {
    const walkIn: SaleDetail = { ...sale, customerId: null, customerName: null, customerRfc: null, customerAddress: null, customerCreditDays: null };
    const job = buildTicketPrintJob(walkIn, defaultSettings, ORIGIN);
    expect(job.customer).toBeNull();
    expect(job.conditionsLine).toBe("CONTADO");
  });

  it("resolves conditionsLine to credit days for a credit sale", () => {
    const creditSale: SaleDetail = { ...sale, isCredit: true, customerCreditDays: 30 };
    const job = buildTicketPrintJob(creditSale, defaultSettings, ORIGIN);
    expect(job.conditionsLine).toBe("Crédito a 30 días");
  });

  it("resolves conditionsLine to CONTADO for a cash sale with a customer", () => {
    const job = buildTicketPrintJob(sale, defaultSettings, ORIGIN);
    expect(job.conditionsLine).toBe("CONTADO");
  });

  it("always includes IVA and IEPS as separate totals, even when IEPS is zero", () => {
    const job = buildTicketPrintJob(sale, defaultSettings, ORIGIN);
    expect(job.totals.iva).toBe(16);
    expect(job.totals.ieps).toBe(0);
    expect(job.totals.subtotal).toBe(100);
    expect(job.totals.total).toBe(116);
  });

  it("falls back to the embedded logo resolved against origin when logoUrl is null", () => {
    const job = buildTicketPrintJob(sale, defaultSettings, ORIGIN);
    expect(job.logoUrl).toBe("http://localhost:3000/logo.png");
  });

  it("uses the configured logoUrl as-is when it's already an absolute URL", () => {
    const settings: TicketSettingsDto = { ...defaultSettings, logoUrl: "https://cdn.test/logo.png" };
    const job = buildTicketPrintJob(sale, settings, ORIGIN);
    expect(job.logoUrl).toBe("https://cdn.test/logo.png");
  });

  it("omits footer/legend when null, mirrors business fields 1:1 from settings", () => {
    const settings: TicketSettingsDto = { ...defaultSettings, businessName: "Agrisas", footerText: "Gracias", legendText: null };
    const job = buildTicketPrintJob(sale, settings, ORIGIN);
    expect(job.business.name).toBe("Agrisas");
    expect(job.footerText).toBe("Gracias");
    expect(job.legendText).toBeNull();
  });

  it("degrades gracefully with ticketSettings: null (settings fetch failure)", () => {
    const job = buildTicketPrintJob(sale, null, ORIGIN);
    expect(job.paperWidth).toBe("80mm");
    expect(job.logoUrl).toBe("http://localhost:3000/logo.png");
    expect(job.business).toEqual({ name: null, rfc: null, address: null, phone: null, taxRegime: null });
  });

  it("maps every sale item preserving name/quantity/unitPrice/lineTotal", () => {
    const job = buildTicketPrintJob(sale, defaultSettings, ORIGIN);
    expect(job.items).toEqual([{ name: "PACKHARD 1 L", quantity: 1, unitPrice: 100, lineTotal: 116 }]);
  });
});
