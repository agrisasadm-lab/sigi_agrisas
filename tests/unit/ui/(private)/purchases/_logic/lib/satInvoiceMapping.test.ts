import {
  buildSatApplyResult,
  extractProductNameFromDescripcion,
  resolvePaymentMethodFromSat,
} from "../../../../../../../app/(private)/purchases/_logic/lib/satInvoiceMapping";
import type { ParsedSatInvoice, SatConcepto } from "../../../../../../../app/(private)/purchases/_logic/lib/satXmlParser";
import type { ProductDto } from "../../../../../../../app/(private)/purchases/_logic/types/api";
import type { PaymentMethodOption } from "../../../../../../../app/_hooks/usePaymentMethodsOptions";
import { searchProductsByName } from "../../../../../../../app/(private)/purchases/_logic/services/searchProductsByName";

jest.mock("../../../../../../../app/(private)/purchases/_logic/services/searchProductsByName");

const mockedSearch = searchProductsByName as jest.MockedFunction<typeof searchProductsByName>;

function makeConcepto(overrides: Partial<SatConcepto> = {}): SatConcepto {
  return {
    claveProdServ: "10171600",
    noIdentificacion: "40.04.01",
    cantidad: 10,
    claveUnidad: "LTR",
    unidad: "L",
    descripcion: "[40.04.01] AMINOGREEN K",
    valorUnitario: 285.075,
    importe: 2850.75,
    traslados: [],
    ...overrides,
  };
}

function makeInvoice(conceptos: SatConcepto[]): ParsedSatInvoice {
  return {
    version: "4.0",
    serie: "A",
    folio: "15269",
    fecha: "2026-07-21T10:42:36",
    formaPago: "99",
    metodoPago: "PPD",
    moneda: "MXN",
    subTotal: null,
    total: null,
    tipoDeComprobante: "I",
    uuid: "788110F9-B247-5374-94D1-8E9FA34B8015",
    emisor: { rfc: "AME0707181W1", nombre: "AGRINOVA MEXICO", regimenFiscal: "601" },
    receptor: { rfc: "OIRI8506123Y7", nombre: "IVAN ENRIQUE OLIVERA RAMIREZ" },
    conceptos,
    trasladosComprobante: [],
  };
}

function makeProduct(overrides: Partial<ProductDto> = {}): ProductDto {
  return {
    id: "prod-amk",
    code: "AMK",
    name: "AMINOGREEN K 1LT",
    unit: "LTR",
    ivaRate: 0.16,
    iepsRate: null,
    isActive: true,
    ...overrides,
  };
}

function makePaymentMethod(overrides: Partial<PaymentMethodOption> = {}): PaymentMethodOption {
  return {
    id: "pm-efectivo",
    code: "EFE",
    name: "Efectivo",
    isActive: true,
    isCredit: false,
    ...overrides,
  };
}

const noPaymentMethods: PaymentMethodOption[] = [];

beforeEach(() => {
  mockedSearch.mockReset();
});

describe("extractProductNameFromDescripcion", () => {
  it("quita el prefijo [NoIdentificacion] cuando está presente", () => {
    expect(extractProductNameFromDescripcion("[40.04.01] AMINOGREEN K")).toBe("AMINOGREEN K");
  });

  it("devuelve la descripción tal cual cuando no hay prefijo entre corchetes", () => {
    expect(extractProductNameFromDescripcion("AMINOGREEN K")).toBe("AMINOGREEN K");
  });
});

describe("buildSatApplyResult", () => {
  it("1 candidato único por nombre genera línea con producto, cantidad y costo correctos", async () => {
    const producto = makeProduct();
    mockedSearch.mockResolvedValue([producto]);

    const result = await buildSatApplyResult(
      makeInvoice([makeConcepto({ cantidad: 128, valorUnitario: 285.075 })]),
      noPaymentMethods,
      "factura.xml"
    );

    expect(result.lines).toEqual([{ product: producto, quantity: 128, unitCost: 285.075 }]);
    expect(result.unmatched).toEqual([]);
  });

  it("dos conceptos con nombres distintos (mismo claveProdServ) generan dos líneas separadas", async () => {
    const aminogreen = makeProduct({ id: "prod-amk", name: "AMINOGREEN K 1LT" });
    const algimel = makeProduct({ id: "prod-alg", code: "ALGM500", name: "ALGIMEL 500 GR", unit: "KGM" });

    mockedSearch.mockImplementation(async (name: string) => {
      if (name === "AMINOGREEN K") return [aminogreen];
      if (name === "ALGIMEL") return [algimel];
      return [];
    });

    const result = await buildSatApplyResult(
      makeInvoice([
        makeConcepto({ descripcion: "[40.04.01] AMINOGREEN K", cantidad: 128, valorUnitario: 285.075 }),
        makeConcepto({
          descripcion: "[90.13.50] ALGIMEL",
          claveUnidad: "KGM",
          cantidad: 24,
          valorUnitario: 348.75,
        }),
      ]),
      noPaymentMethods,
      "factura.xml"
    );

    expect(result.lines).toHaveLength(2);
    expect(result.lines.map((l) => l.product.id).sort()).toEqual(["prod-alg", "prod-amk"]);
    expect(result.unmatched).toEqual([]);
  });

  it("dos conceptos que resuelven al mismo producto se agregan en una sola línea con cantidad sumada", async () => {
    const producto = makeProduct();
    mockedSearch.mockResolvedValue([producto]);

    const result = await buildSatApplyResult(
      makeInvoice([
        makeConcepto({ cantidad: 10, valorUnitario: 285.075 }),
        makeConcepto({ cantidad: 5, valorUnitario: 285.075 }),
      ]),
      noPaymentMethods,
      "factura.xml"
    );

    expect(result.lines).toEqual([{ product: producto, quantity: 15, unitCost: 285.075 }]);
  });

  it("concepto sin candidatos cae a unmatched", async () => {
    mockedSearch.mockResolvedValue([]);

    const concepto = makeConcepto({ descripcion: "[99.99.99] PRODUCTO INEXISTENTE" });
    const result = await buildSatApplyResult(makeInvoice([concepto]), noPaymentMethods, "factura.xml");

    expect(result.lines).toEqual([]);
    expect(result.unmatched).toEqual([concepto]);
  });

  it("≥2 candidatos con claveUnidad que desempata a exactamente 1 usa ese candidato", async () => {
    const bufalo20L = makeProduct({ id: "prod-buf20", code: "BUF20", name: "BUFALO 20 L", unit: "LTR" });
    const bufaloSolido = makeProduct({ id: "prod-bufso", code: "BUFSO", name: "BUFALO SOLID 5KG", unit: "KGM" });
    mockedSearch.mockResolvedValue([bufalo20L, bufaloSolido]);

    const result = await buildSatApplyResult(
      makeInvoice([makeConcepto({ descripcion: "[50.02.20] BUFALO", claveUnidad: "LTR", cantidad: 40 })]),
      noPaymentMethods,
      "factura.xml"
    );

    expect(result.lines).toEqual([{ product: bufalo20L, quantity: 40, unitCost: 285.075 }]);
    expect(result.unmatched).toEqual([]);
  });

  it("≥2 candidatos sin desempate posible cae a unmatched con warning de ambigüedad", async () => {
    const bufalo1 = makeProduct({ id: "prod-buf1", code: "BUFA1LT", name: "BUFALO 1L", unit: "LTR" });
    const bufalo2 = makeProduct({ id: "prod-buf20", code: "BUF20", name: "BUFALO 20 L", unit: "LTR" });
    mockedSearch.mockResolvedValue([bufalo1, bufalo2]);

    const concepto = makeConcepto({ descripcion: "[50.02.20] BUFALO", claveUnidad: "LTR" });
    const result = await buildSatApplyResult(makeInvoice([concepto]), noPaymentMethods, "factura.xml");

    expect(result.lines).toEqual([]);
    expect(result.unmatched).toEqual([concepto]);
    expect(result.warnings.some((w) => w.toLowerCase().includes("ambig"))).toBe(true);
  });

  it("descripción sin prefijo [...] se usa tal cual como término de búsqueda", async () => {
    const producto = makeProduct();
    mockedSearch.mockResolvedValue([producto]);

    await buildSatApplyResult(
      makeInvoice([makeConcepto({ descripcion: "AMINOGREEN K" })]),
      noPaymentMethods,
      "factura.xml"
    );

    expect(mockedSearch).toHaveBeenCalledWith("AMINOGREEN K");
  });

  it("nombre extraído con menos de 2 caracteres cae a unmatched sin llamar al servicio de búsqueda", async () => {
    const concepto = makeConcepto({ descripcion: "[40.04.01] X" });
    const result = await buildSatApplyResult(makeInvoice([concepto]), noPaymentMethods, "factura.xml");

    expect(mockedSearch).not.toHaveBeenCalled();
    expect(result.lines).toEqual([]);
    expect(result.unmatched).toEqual([concepto]);
  });
});

describe("resolvePaymentMethodFromSat", () => {
  it("PPD con exactamente 1 forma de pago de crédito activa la preselecciona sin warning", () => {
    const credito = makePaymentMethod({ id: "pm-credito", code: "CRE30", name: "Crédito 30 días", isCredit: true });
    const efectivo = makePaymentMethod();

    const result = resolvePaymentMethodFromSat("PPD", "99", [efectivo, credito]);

    expect(result).toEqual({ paymentMethodId: "pm-credito", warning: null });
  });

  it("PPD sin ninguna forma de pago de crédito en catálogo no preselecciona y avisa", () => {
    const result = resolvePaymentMethodFromSat("PPD", "99", [makePaymentMethod()]);

    expect(result.paymentMethodId).toBeNull();
    expect(result.warning).toMatch(/crédito/i);
  });

  it("PPD con 2+ formas de pago de crédito ambiguas no adivina y avisa", () => {
    const credito30 = makePaymentMethod({ id: "pm-30", code: "CRE30", name: "Crédito 30 días", isCredit: true });
    const credito60 = makePaymentMethod({ id: "pm-60", code: "CRE60", name: "Crédito 60 días", isCredit: true });

    const result = resolvePaymentMethodFromSat("PPD", "99", [credito30, credito60]);

    expect(result.paymentMethodId).toBeNull();
    expect(result.warning).toMatch(/crédito/i);
  });

  it("PUE con FormaPago matcheable mantiene el comportamiento preexistente (keyword-match)", () => {
    const transferencia = makePaymentMethod({ id: "pm-transfer", code: "TRANSF", name: "Transferencia" });

    const result = resolvePaymentMethodFromSat("PUE", "03", [makePaymentMethod(), transferencia]);

    expect(result).toEqual({ paymentMethodId: "pm-transfer", warning: null });
  });

  it("PUE sin match de FormaPago no preselecciona y avisa (antes no avisaba, es el fix)", () => {
    const result = resolvePaymentMethodFromSat("PUE", "99", [makePaymentMethod()]);

    expect(result.paymentMethodId).toBeNull();
    expect(result.warning).toMatch(/forma de pago/i);
  });

  it("MetodoPago null/ausente se trata igual que PUE, sin crash", () => {
    const transferencia = makePaymentMethod({ id: "pm-transfer", code: "TRANSF", name: "Transferencia" });

    const result = resolvePaymentMethodFromSat(null, "03", [transferencia]);

    expect(result).toEqual({ paymentMethodId: "pm-transfer", warning: null });
  });
});

describe("buildSatApplyResult — forma de pago", () => {
  it("factura PPD con forma de pago de crédito en catálogo prellena paymentMethodId sin warning de forma de pago", async () => {
    mockedSearch.mockResolvedValue([]);
    const credito = makePaymentMethod({ id: "pm-credito", code: "CRE30", name: "Crédito 30 días", isCredit: true });

    const result = await buildSatApplyResult(makeInvoice([]), [credito], "factura.xml");

    expect(result.paymentMethodId).toBe("pm-credito");
    expect(result.warnings.some((w) => /forma de pago|crédito/i.test(w))).toBe(false);
  });

  it("factura PPD sin forma de pago de crédito en catálogo deja paymentMethodId null y agrega warning (no pierde los warnings de IVA/IEPS existentes)", async () => {
    const producto = makeProduct();
    mockedSearch.mockResolvedValue([producto]);

    const result = await buildSatApplyResult(
      makeInvoice([
        makeConcepto({ traslados: [{ impuesto: "002", tipoFactor: "Tasa", tasaOCuota: 0.08, importe: 100 }] }),
      ]),
      [makePaymentMethod()],
      "factura.xml"
    );

    expect(result.paymentMethodId).toBeNull();
    expect(result.warnings.some((w) => /crédito/i.test(w))).toBe(true);
    expect(result.warnings.some((w) => /IVA/i.test(w))).toBe(true);
  });
});
