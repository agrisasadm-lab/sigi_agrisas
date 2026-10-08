/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import { PrintableTicket } from "../../../../../app/(private)/sales/_blocks/PrintableTicket";
import type { SaleDetail } from "../../../../../app/(private)/sales/_logic/types/domain";
import type { TicketSettingsDto } from "../../../../../app/(private)/settings/_logic/types/api";

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

describe("PrintableTicket", () => {
  it("falls back to the embedded Agrisas logo when logoUrl is null", () => {
    const settings: TicketSettingsDto = { ...defaultSettings, footerText: "Pie" };
    render(<PrintableTicket sale={sale} ticketSettings={settings} />);

    expect(screen.getByAltText("Logo")).toHaveAttribute("src", "/logo.png");
  });

  it("no longer renders a header text paragraph — business info is the first block after the logo", () => {
    const settings: TicketSettingsDto = {
      ...defaultSettings,
      businessName: "Agrisas S.A. de C.V.",
      businessRfc: "AGR010101AB1",
    };
    const { container } = render(<PrintableTicket sale={sale} ticketSettings={settings} />);

    const paragraphs = Array.from(container.querySelectorAll("p")).map((p) => p.textContent);
    expect(paragraphs).not.toContain("Encabezado");
    const logo = screen.getByAltText("Logo");
    const hr = container.querySelector("hr");
    expect(logo.nextElementSibling).toBe(hr);
  });

  it("renders the logo when logoUrl is present", () => {
    const settings: TicketSettingsDto = { ...defaultSettings, logoUrl: "https://x.test/logo.png" };
    render(<PrintableTicket sale={sale} ticketSettings={settings} />);

    expect(screen.getByAltText("Logo")).toBeInTheDocument();
  });

  it("sizes the logo to 125x77px (landscape ratio) in the print layout", () => {
    const { container } = render(<PrintableTicket sale={sale} ticketSettings={null} />);

    const printStyle = container.querySelector("style")?.textContent ?? "";
    expect(printStyle).toContain(".printable-ticket img");
    expect(printStyle).toContain("width: 125px; height: 77px;");
    expect(printStyle).toContain("object-fit: contain");
  });

  it("gives the logo an 8px bottom margin", () => {
    const { container } = render(<PrintableTicket sale={sale} ticketSettings={null} />);

    const printStyle = container.querySelector("style")?.textContent ?? "";
    expect(printStyle).toContain("margin: 0 auto 8px;");
  });

  it("declares @page size matching the default 80mm paper width and auto height when ticketSettings is null", () => {
    const { container } = render(<PrintableTicket sale={sale} ticketSettings={null} />);

    const printStyle = container.querySelector("style")?.textContent ?? "";
    // content: 85 + 30 (customer) + 8 (conditions, always) + 1*12 + 15 (safety) + 6 (feed) = 156mm; extra top = round(156*0.05) = 8mm
    // pageHeight = 156 + 8 = 164mm; topMargin = 4 + 8 = 12mm
    expect(printStyle).toContain("@page { size: 80mm 164mm; margin: 12mm 3mm 4mm 3mm; }");
  });

  it("declares @page size matching the configured 58mm paper width and auto height", () => {
    const settings: TicketSettingsDto = { ...defaultSettings, paperWidth: "58mm" };
    const { container } = render(<PrintableTicket sale={sale} ticketSettings={settings} />);

    const printStyle = container.querySelector("style")?.textContent ?? "";
    expect(printStyle).toContain("@page { size: 58mm 164mm; margin: 12mm 3mm 4mm 3mm; }");
  });

  it("declares @page height that grows with item count, and shrinks without the customer section", () => {
    const saleNoCustomer: SaleDetail = { ...sale, customerId: null, customerName: null, customerRfc: null, customerAddress: null, customerCreditDays: null };
    const { container } = render(<PrintableTicket sale={saleNoCustomer} ticketSettings={null} />);

    const printStyle = container.querySelector("style")?.textContent ?? "";
    // content: 85 (base) + 0 (no customer) + 8 (conditions, always) + 1*12 (items) + 15 (safety) + 6 (feed) = 126mm
    // extra top = round(126*0.05) = 6mm; pageHeight = 132mm; topMargin = 10mm
    expect(printStyle).toContain("@page { size: 80mm 132mm; margin: 10mm 3mm 4mm 3mm; }");
  });

  it("declares a larger @page height for tickets with more item lines", () => {
    const saleManyItems: SaleDetail = {
      ...sale,
      items: [...sale.items, { ...sale.items[0], id: "item-2" }, { ...sale.items[0], id: "item-3" }],
    };
    const { container } = render(<PrintableTicket sale={saleManyItems} ticketSettings={null} />);

    const printStyle = container.querySelector("style")?.textContent ?? "";
    // content: 85 + 30 (customer) + 8 (conditions, always) + 3*12 (items) + 15 (safety) + 6 (feed) = 180mm
    // extra top = round(180*0.05) = 9mm; pageHeight = 189mm; topMargin = 13mm
    expect(printStyle).toContain("@page { size: 80mm 189mm; margin: 13mm 3mm 4mm 3mm; }");
  });

  it("renders sale data correctly regardless of paperWidth", () => {
    const settings: TicketSettingsDto = { ...defaultSettings, paperWidth: "58mm" };
    render(<PrintableTicket sale={sale} ticketSettings={settings} />);

    expect(screen.getByText(/folio: tk-42/i)).toBeInTheDocument();
    expect(screen.getByText("PACKHARD 1 L")).toBeInTheDocument();
  });

  it("does not crash and falls back to 80mm and embedded logo when ticketSettings is null", () => {
    render(<PrintableTicket sale={sale} ticketSettings={null} />);

    expect(screen.getByText(/folio: tk-42/i)).toBeInTheDocument();
    expect(screen.getByAltText("Logo")).toHaveAttribute("src", "/logo.png");
  });

  it("shows IVA and IEPS as separate lines, always visible even when IEPS is $0", () => {
    render(<PrintableTicket sale={sale} ticketSettings={null} />);

    expect(screen.getByText("IVA")).toBeInTheDocument();
    expect(screen.getByText("IEPS")).toBeInTheDocument();
    expect(screen.queryByText("Impuestos")).not.toBeInTheDocument();
  });

  it("renders the payment method aligned to the Stitch design", () => {
    render(<PrintableTicket sale={sale} ticketSettings={null} />);

    expect(screen.getByText("Pago")).toBeInTheDocument();
    expect(screen.getByText("Efectivo")).toBeInTheDocument();
  });

  it("renders the folio at the bottom as a decorative barcode-style element", () => {
    const { container } = render(<PrintableTicket sale={sale} ticketSettings={null} />);

    const barcode = container.querySelector("[aria-hidden='true']");
    expect(barcode).not.toBeNull();
    expect(screen.getByText("TK-42")).toBeInTheDocument();
  });

  it("labels the seller as Vendedor instead of Cajero", () => {
    render(<PrintableTicket sale={sale} ticketSettings={null} />);

    expect(screen.getByText(/vendedor: admin/i)).toBeInTheDocument();
    expect(screen.queryByText(/cajero:/i)).not.toBeInTheDocument();
  });

  it("renders customer info: RFC, name and address", () => {
    render(<PrintableTicket sale={sale} ticketSettings={null} />);

    expect(screen.getByText("Cliente")).toBeInTheDocument();
    expect(screen.getByText(/RFC: XAXX010101000/i)).toBeInTheDocument();
    expect(screen.getByText(/Nombre: Cliente Uno/i)).toBeInTheDocument();
    expect(screen.getByText(/Dirección: Av. Central 123, Oaxaca/i)).toBeInTheDocument();
  });

  it("shows credit conditions with the customer's creditDays for a credit sale", () => {
    const creditSale: SaleDetail = { ...sale, isCredit: true, customerCreditDays: 30 };
    render(<PrintableTicket sale={creditSale} ticketSettings={null} />);

    expect(screen.getByText("Condiciones")).toBeInTheDocument();
    expect(screen.getByText("Crédito a 30 días")).toBeInTheDocument();
  });

  it("shows CONTADO for a cash sale", () => {
    render(<PrintableTicket sale={sale} ticketSettings={null} />);

    expect(screen.getByText("Condiciones")).toBeInTheDocument();
    expect(screen.getByText("CONTADO")).toBeInTheDocument();
  });

  it("omits the customer section but still shows conditions when the sale has no customer", () => {
    const saleNoCustomer: SaleDetail = { ...sale, customerId: null, customerName: null, customerRfc: null, customerAddress: null, customerCreditDays: null };
    render(<PrintableTicket sale={saleNoCustomer} ticketSettings={null} />);

    expect(screen.queryByText("Cliente")).not.toBeInTheDocument();
    expect(screen.getByText("Condiciones")).toBeInTheDocument();
    expect(screen.getByText("CONTADO")).toBeInTheDocument();
  });

  it("shows 'Total a pagar' label", () => {
    render(<PrintableTicket sale={sale} ticketSettings={null} />);

    expect(screen.getByText("Total a pagar")).toBeInTheDocument();
  });

  it("renders business info from ticket settings", () => {
    const settings: TicketSettingsDto = {
      ...defaultSettings,
      businessAddress: "Ocotlan de Morelos, Oaxaca. CP 71520",
      businessPhone: "951 292 80 86",
      businessEmail: null,
      businessTaxRegime: "612 Personas Físicas con Actividad Empresarial",
    };
    render(<PrintableTicket sale={sale} ticketSettings={settings} />);

    expect(screen.getByText("Ocotlan de Morelos, Oaxaca. CP 71520")).toBeInTheDocument();
    expect(screen.getByText("Tel. 951 292 80 86")).toBeInTheDocument();
    expect(screen.getByText("612 Personas Físicas con Actividad Empresarial")).toBeInTheDocument();
  });

  it("renders issuer razón social and RFC when set", () => {
    const settings: TicketSettingsDto = {
      ...defaultSettings,
      businessName: "Agrisas S.A. de C.V.",
      businessRfc: "AGR010101AB1",
    };
    render(<PrintableTicket sale={sale} ticketSettings={settings} />);

    expect(screen.getByText("Agrisas S.A. de C.V.")).toBeInTheDocument();
    expect(screen.getByText("RFC: AGR010101AB1")).toBeInTheDocument();
  });

  it("omits razón social and RFC lines when null (customer RFC section unaffected)", () => {
    render(<PrintableTicket sale={sale} ticketSettings={defaultSettings} />);

    // only the customer's "RFC: ..." line renders; no issuer razón social/RFC line
    expect(screen.getAllByText(/^RFC:/)).toHaveLength(1);
    expect(screen.getByText(/RFC: XAXX010101000/i)).toBeInTheDocument();
  });

  it("renders the legend text when set", () => {
    const settings: TicketSettingsDto = {
      ...defaultSettings,
      legendText: "Favor de revisar su mercancía. No se hacen cambios ni devoluciones. Gracias por su compra.",
    };
    render(<PrintableTicket sale={sale} ticketSettings={settings} />);

    expect(screen.getByText(/Favor de revisar su mercancía/)).toBeInTheDocument();
  });

  it("does not render legend when null", () => {
    render(<PrintableTicket sale={sale} ticketSettings={null} />);

    expect(screen.queryByText(/Favor de revisar su mercancía/)).not.toBeInTheDocument();
  });
});
