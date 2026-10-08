/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, waitFor, act } from "@testing-library/react";

jest.mock("next/link", () => {
  const Link = ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  );
  Link.displayName = "Link";
  return Link;
});
jest.mock("../../../../../../../../app/(private)/sales/_logic/hooks/useSaleDetail");
jest.mock("../../../../../../../../app/(private)/settings/_logic/services/getTicketSettings", () => ({
  getTicketSettings: jest.fn().mockResolvedValue({ logoUrl: null, footerText: null, paperWidth: "80mm" }),
}));

import { useSaleDetail } from "../../../../../../../../app/(private)/sales/_logic/hooks/useSaleDetail";
import { getTicketSettings } from "../../../../../../../../app/(private)/settings/_logic/services/getTicketSettings";
import { TicketPreviewPage } from "../../../../../../../../app/(private)/sales/[id]/ticket/_blocks/TicketPreviewPage";
import type { SaleDetail } from "../../../../../../../../app/(private)/sales/_logic/types/domain";

const mockUseSaleDetail = useSaleDetail as jest.MockedFunction<typeof useSaleDetail>;

async function renderPage(id = "sale-1") {
  let result: ReturnType<typeof render>;
  await act(async () => {
    result = render(<TicketPreviewPage id={id} />);
  });
  return result!;
}

function makeSale(overrides: Partial<SaleDetail> = {}): SaleDetail {
  return {
    id: "sale-1",
    branchId: "branch-1",
    cashierId: "user-1",
    cashierName: "Cajero Test",
    folioId: "folio-1",
    folioCode: "A-42",
    folioNumber: 42,
    folioPrefix: "A",
    paymentMethodId: "pm-1",
    paymentMethodName: "Efectivo",
    status: "completed",
    subtotal: 86.2069,
    taxTotal: 13.7931,
    total: 100,
    paidAmount: 100,
    paymentStatus: "paid",
    isCredit: false,
    customerName: "Cliente Test",
    branchName: "Sucursal Norte",
    items: [
      {
        id: "item-1",
        productId: "product-1",
        productCodeSnapshot: "SKU-1",
        productNameSnapshot: "Producto 1",
        productPriceId: "price-1",
        priceNameSnapshot: "Default",
        quantity: 1,
        unitPrice: 100,
        discountPct: 0,
        discountAmount: 0,
        ivaRate: 0.16,
        iepsRate: 0,
        lineSubtotal: 86.2069,
        lineIva: 13.7931,
        lineIeps: 0,
        lineTotal: 100,
      },
    ],
    notes: null,
    cancellationReason: null,
    cancelledAt: null,
    editedAt: null,
    createdAt: new Date("2026-05-30T10:00:00Z"),
    updatedAt: new Date("2026-05-30T10:00:00Z"),
    returnedQuantityBySaleItem: {},
    ...overrides,
  };
}

describe("TicketPreviewPage", () => {
  beforeEach(() => jest.clearAllMocks());

  it("muestra IVA e IEPS siempre visibles, aunque IEPS sea $0", async () => {
    mockUseSaleDetail.mockReturnValue({ sale: makeSale(), isLoading: false, error: null, refresh: jest.fn() });
    await renderPage();

    // "IVA"/"IEPS" aparecen tanto en la vista Stitch como en el PrintableTicket
    // (montado oculto, hidden print:block) que también las muestra siempre.
    expect(screen.getAllByText("IVA").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("IEPS").length).toBeGreaterThanOrEqual(1);
  });

  it("muestra los botones Imprimir Ticket y Enviar por Correo", async () => {
    mockUseSaleDetail.mockReturnValue({ sale: makeSale(), isLoading: false, error: null, refresh: jest.fn() });
    await renderPage();

    expect(screen.getByRole("button", { name: /imprimir ticket/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /enviar por correo/i })).toBeInTheDocument();
  });

  it("muestra un estado vacío cuando la venta no existe", async () => {
    mockUseSaleDetail.mockReturnValue({ sale: null, isLoading: false, error: new Error("not found"), refresh: jest.fn() });
    await renderPage();

    expect(screen.getByText(/no se encontró la venta/i)).toBeInTheDocument();
  });

  it("etiqueta el vendedor como 'Vendedor' y no como 'Cajero'", async () => {
    mockUseSaleDetail.mockReturnValue({ sale: makeSale(), isLoading: false, error: null, refresh: jest.fn() });
    await renderPage();

    expect(screen.getAllByText(/Vendedor:/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText(/Cajero:/i)).not.toBeInTheDocument();
  });

  it("usa la etiqueta 'Folio' en lugar de 'Orden'", async () => {
    mockUseSaleDetail.mockReturnValue({ sale: makeSale(), isLoading: false, error: null, refresh: jest.fn() });
    await renderPage();

    expect(screen.getAllByText(/Folio:/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText(/Orden:/i)).not.toBeInTheDocument();
  });

  it("usa una caja de logo apaisada (140x86px) consistente con la proporción del asset real", async () => {
    jest
      .mocked(getTicketSettings)
      .mockResolvedValueOnce({
        logoUrl: "https://x.test/logo.png",
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
      });
    mockUseSaleDetail.mockReturnValue({ sale: makeSale(), isLoading: false, error: null, refresh: jest.fn() });
    const { container } = await renderPage();

    await waitFor(() => {
      const previewLogo = Array.from(container.querySelectorAll('img[alt="Logo"]')).find((el) =>
        el.className.includes("w-[140px]")
      );
      expect(previewLogo).toBeDefined();
      expect(previewLogo!.className).toContain("h-[86px]");
      expect(previewLogo!.className).toContain("object-contain");
      expect(previewLogo!.className).toContain("mb-2");
    });
  });

  it("usa el logo embebido /logo.png como fallback cuando no hay logoUrl", async () => {
    mockUseSaleDetail.mockReturnValue({ sale: makeSale(), isLoading: false, error: null, refresh: jest.fn() });
    const { container } = await renderPage();

    await waitFor(() => {
      const previewLogo = Array.from(container.querySelectorAll('img[alt="Logo"]')).find((el) =>
        el.className.includes("w-[140px]")
      );
      expect(previewLogo).toBeDefined();
      expect(previewLogo!.getAttribute("src")).toBe("/logo.png");
    });
  });

  it("la tarjeta del ticket no contiene iconos material-symbols-outlined", async () => {
    mockUseSaleDetail.mockReturnValue({ sale: makeSale(), isLoading: false, error: null, refresh: jest.fn() });
    const { container } = await renderPage();

    await waitFor(() => {
      const previewLogo = Array.from(container.querySelectorAll('img[alt="Logo"]')).find((el) =>
        el.className.includes("w-[140px]")
      );
      expect(previewLogo).toBeDefined();
    });

    const ticketCard = container.querySelector("img[alt='Logo']")?.closest(".bg-surface-container-lowest");
    expect(ticketCard).not.toBeNull();
    expect(ticketCard!.querySelectorAll(".material-symbols-outlined").length).toBe(0);
    expect(container.querySelector(".material-symbols-outlined")?.textContent).not.toBe("agriculture");
    expect(container.querySelector(".material-symbols-outlined")?.textContent).not.toBe("credit_card");
  });

  it("muestra sección cliente (RFC, nombre, dirección) cuando la venta tiene cliente, y CONTADO al ser en efectivo", async () => {
    mockUseSaleDetail.mockReturnValue({
      sale: makeSale({
        customerId: "c1",
        customerName: "Cliente Test",
        customerRfc: "XAXX010101000",
        customerAddress: "Av. Central 123, Oaxaca",
        customerCreditDays: 30,
      }),
      isLoading: false,
      error: null,
      refresh: jest.fn(),
    });
    await renderPage();

    expect(screen.getAllByText(/RFC: XAXX010101000/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Nombre: Cliente Test/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Dirección: Av. Central 123, Oaxaca/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("CONTADO").length).toBeGreaterThanOrEqual(1);
  });

  it("muestra los días de crédito del cliente cuando la venta es a crédito", async () => {
    mockUseSaleDetail.mockReturnValue({
      sale: makeSale({
        isCredit: true,
        customerId: "c1",
        customerName: "Cliente Test",
        customerRfc: "XAXX010101000",
        customerAddress: "Av. Central 123, Oaxaca",
        customerCreditDays: 30,
      }),
      isLoading: false,
      error: null,
      refresh: jest.fn(),
    });
    await renderPage();

    expect(screen.getAllByText("Crédito a 30 días").length).toBeGreaterThanOrEqual(1);
  });

  it("muestra CONTADO en una venta en efectivo de mostrador, sin cliente asociado", async () => {
    mockUseSaleDetail.mockReturnValue({
      sale: makeSale({ customerId: null, customerName: null, customerRfc: null, customerAddress: null, customerCreditDays: null }),
      isLoading: false,
      error: null,
      refresh: jest.fn(),
    });
    await renderPage();

    expect(screen.getAllByText("CONTADO").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText("Cliente")).not.toBeInTheDocument();
  });

  it("muestra razón social y RFC del emisor cuando settings los trae", async () => {
    jest.mocked(getTicketSettings).mockResolvedValueOnce({
      logoUrl: null,
      footerText: null,
      paperWidth: "80mm",
      businessName: "Agrisas S.A. de C.V.",
      businessRfc: "AGR010101AB1",
      businessAddress: null,
      businessPhone: null,
      businessEmail: null,
      businessTaxRegime: null,
      businessZipCode: null,
      legendText: null,
    });
    mockUseSaleDetail.mockReturnValue({ sale: makeSale(), isLoading: false, error: null, refresh: jest.fn() });
    await renderPage();

    await waitFor(() => {
      expect(screen.getAllByText("Agrisas S.A. de C.V.").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("RFC: AGR010101AB1").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("no renderiza texto de encabezado ni fallback 'Centro Agrícola Integral'", async () => {
    mockUseSaleDetail.mockReturnValue({ sale: makeSale(), isLoading: false, error: null, refresh: jest.fn() });
    await renderPage();

    expect(screen.queryByText(/centro agrícola integral/i)).not.toBeInTheDocument();
    expect(screen.queryByText("Encabezado")).not.toBeInTheDocument();
  });

  it("no renderiza ningún párrafo de footer cuando footerText es null (sin fallback hardcodeado)", async () => {
    jest.mocked(getTicketSettings).mockResolvedValueOnce({
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
    });
    mockUseSaleDetail.mockReturnValue({ sale: makeSale(), isLoading: false, error: null, refresh: jest.fn() });
    await renderPage();

    await waitFor(() => {
      expect(screen.queryByText(/gracias por su compra/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/agricultura sana/i)).not.toBeInTheDocument();
    });
  });

  it("renderiza exactamente el footerText configurado cuando está presente", async () => {
    jest.mocked(getTicketSettings).mockResolvedValueOnce({
      logoUrl: null,
      footerText: "Vuelva pronto",
      paperWidth: "80mm",
      businessName: null,
      businessRfc: null,
      businessAddress: null,
      businessPhone: null,
      businessEmail: null,
      businessTaxRegime: null,
      businessZipCode: null,
      legendText: null,
    });
    mockUseSaleDetail.mockReturnValue({ sale: makeSale(), isLoading: false, error: null, refresh: jest.fn() });
    await renderPage();

    await waitFor(() => {
      expect(screen.getAllByText("Vuelva pronto").length).toBeGreaterThanOrEqual(1);
      expect(screen.queryByText(/gracias por su compra/i)).not.toBeInTheDocument();
    });
  });

  it("muestra 'Total a pagar' como etiqueta del total de la venta", async () => {
    mockUseSaleDetail.mockReturnValue({ sale: makeSale(), isLoading: false, error: null, refresh: jest.fn() });
    await renderPage();

    expect(screen.getAllByText("Total a pagar").length).toBeGreaterThanOrEqual(1);
    // No hay etiqueta "Total" standalone junto al importe (el "Total" restante es la columna de la tabla de artículos)
    const totalLabels = screen.getAllByText("Total", { exact: true }).filter((el) => el.textContent === "Total");
    expect(totalLabels.some((el) => el.nextElementSibling?.textContent === "$100.00")).toBe(false);
  });
});

describe("TicketPreviewPage — gutter global de 10px izq/top/der vía layout (sales-screens-padding)", () => {
  beforeEach(() => jest.clearAllMocks());

  it("el contenedor raíz NO duplica el padding top en el estado normal", async () => {
    mockUseSaleDetail.mockReturnValue({ sale: makeSale(), isLoading: false, error: null, refresh: jest.fn() });
    const { container } = await renderPage();
    expect(container.firstElementChild!.className).not.toContain("pt-2.5");
  });

  it("el contenedor raíz NO duplica el padding en el estado de carga", async () => {
    mockUseSaleDetail.mockReturnValue({ sale: null, isLoading: true, error: null, refresh: jest.fn() });
    const { container } = await renderPage();
    expect(container.firstElementChild!.className).not.toContain("pt-2.5");
  });
});
