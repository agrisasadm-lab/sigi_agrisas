"use client";

import type { ParsedSatInvoice, SatConcepto } from "./satXmlParser";
import type { PaymentMethodOption } from "../../../../_hooks/usePaymentMethodsOptions";
import type { NewProviderInput, ProductDto } from "../types/api";
import { searchProductsByName } from "../services/searchProductsByName";

const FORMA_PAGO_KEYWORDS: Record<string, string[]> = {
  "01": ["efectivo"],
  "02": ["cheque"],
  "03": ["transferencia", "transfer"],
  "04": ["tarjeta"],
  "28": ["tarjeta", "debito", "débito"],
  "99": [],
};

export interface PaymentMethodResolution {
  paymentMethodId: string | null;
  warning: string | null;
}

function matchByFormaPago(formaPago: string | null, paymentMethods: PaymentMethodOption[]): string | null {
  if (!formaPago) return null;
  const keywords = FORMA_PAGO_KEYWORDS[formaPago];
  if (!keywords || keywords.length === 0) return null;
  const lower = (s: string) => s.toLowerCase();
  const found = paymentMethods.find(
    (pm) => keywords.some((k) => lower(pm.name).includes(k) || lower(pm.code).includes(k))
  );
  return found?.id ?? null;
}

export function resolvePaymentMethodFromSat(
  metodoPago: string | null,
  formaPago: string | null,
  paymentMethods: PaymentMethodOption[]
): PaymentMethodResolution {
  if (metodoPago === "PPD") {
    const creditMethods = paymentMethods.filter((pm) => pm.isCredit);
    if (creditMethods.length === 1) return { paymentMethodId: creditMethods[0].id, warning: null };
    return {
      paymentMethodId: null,
      warning: "Factura a crédito (PPD) sin una única forma de pago de crédito activa en catálogo, selecciona manualmente.",
    };
  }

  const paymentMethodId = matchByFormaPago(formaPago, paymentMethods);
  if (paymentMethodId) return { paymentMethodId, warning: null };
  return {
    paymentMethodId: null,
    warning: "No se pudo determinar la forma de pago desde la factura, selecciona manualmente.",
  };
}

export interface SatMatchLine {
  product: ProductDto;
  quantity: number;
  unitCost: number;
}

export interface SatApplyResult {
  newProvider: NewProviderInput | null;
  paymentMethodId: string | null;
  lines: SatMatchLine[];
  unmatched: SatConcepto[];
  warnings: string[];
  metadata: {
    satUuid: string | null;
    supplierInvoiceNumber: string | null;
    invoiceDate: string;
    purchasedAt: string;
    xmlFileName: string;
  };
}

function round4(n: number): number {
  return Math.round((n + Number.EPSILON) * 10000) / 10000;
}

const DESCRIPCION_PREFIX_REGEX = /^\[.*?\]\s*/;

export function extractProductNameFromDescripcion(descripcion: string): string {
  return descripcion.replace(DESCRIPCION_PREFIX_REGEX, "").trim();
}

interface ConceptoResolution {
  concepto: SatConcepto;
  product: ProductDto | null;
  ambiguous: boolean;
}

async function resolveConcepto(concepto: SatConcepto): Promise<ConceptoResolution> {
  const name = extractProductNameFromDescripcion(concepto.descripcion);
  if (name.length < 2) return { concepto, product: null, ambiguous: false };

  let candidates: ProductDto[];
  try {
    candidates = await searchProductsByName(name);
  } catch {
    // best effort: sin permiso o error de red, simplemente no se auto-mapea
    return { concepto, product: null, ambiguous: false };
  }

  if (candidates.length === 1) return { concepto, product: candidates[0], ambiguous: false };
  if (candidates.length === 0) return { concepto, product: null, ambiguous: false };

  const byUnit = candidates.filter((c) => c.unit === concepto.claveUnidad);
  if (byUnit.length === 1) return { concepto, product: byUnit[0], ambiguous: false };
  return { concepto, product: null, ambiguous: true };
}

export async function buildSatApplyResult(
  parsed: ParsedSatInvoice,
  paymentMethods: PaymentMethodOption[],
  xmlFileName: string
): Promise<SatApplyResult> {
  const warnings: string[] = [];
  if (parsed.moneda && parsed.moneda.toUpperCase() !== "MXN") {
    warnings.push(`La factura está en ${parsed.moneda}; el sistema registra en MXN.`);
  }

  const resolutions = await Promise.all(parsed.conceptos.map(resolveConcepto));

  const grouped = new Map<string, { product: ProductDto; quantity: number; unitCost: number; conceptos: SatConcepto[] }>();
  const unmatched: SatConcepto[] = [];
  let hasAmbiguous = false;

  for (const { concepto, product, ambiguous } of resolutions) {
    if (!product) {
      if (ambiguous) hasAmbiguous = true;
      unmatched.push(concepto);
      continue;
    }
    const existing = grouped.get(product.id);
    if (existing) {
      existing.quantity = round4(existing.quantity + concepto.cantidad);
      existing.conceptos.push(concepto);
    } else {
      grouped.set(product.id, {
        product,
        quantity: concepto.cantidad || 1,
        unitCost: concepto.valorUnitario,
        conceptos: [concepto],
      });
    }
  }

  if (hasAmbiguous) {
    warnings.push(
      "Algunos conceptos coinciden con más de un producto del catálogo y no se pudieron desambiguar por unidad; revisa la lista de conceptos sin mapear."
    );
  }

  for (const { product, conceptos } of grouped.values()) {
    const ivaTraslado = conceptos[0]?.traslados.find((t) => t.impuesto === "002");
    const iepsTraslado = conceptos[0]?.traslados.find((t) => t.impuesto === "003");
    const ivaProducto = product.ivaRate ?? 0;
    const iepsProducto = product.iepsRate ?? 0;
    if (ivaTraslado?.tasaOCuota != null && Math.abs(ivaTraslado.tasaOCuota - ivaProducto) > 0.0001) {
      warnings.push(
        `IVA del producto "${product.code}" difiere del XML: sistema ${(ivaProducto * 100).toFixed(0)}%, XML ${(ivaTraslado.tasaOCuota * 100).toFixed(0)}%.`
      );
    }
    if (iepsTraslado?.tasaOCuota != null && Math.abs(iepsTraslado.tasaOCuota - iepsProducto) > 0.0001) {
      warnings.push(
        `IEPS del producto "${product.code}" difiere del XML: sistema ${(iepsProducto * 100).toFixed(0)}%, XML ${(iepsTraslado.tasaOCuota * 100).toFixed(0)}%.`
      );
    }
  }

  const serieFolio = [parsed.serie, parsed.folio].filter(Boolean).join("-");
  const emisorNombre = parsed.emisor.nombre ?? parsed.emisor.rfc;

  const { paymentMethodId, warning: paymentMethodWarning } = resolvePaymentMethodFromSat(
    parsed.metodoPago,
    parsed.formaPago,
    paymentMethods
  );
  if (paymentMethodWarning) warnings.push(paymentMethodWarning);

  return {
    newProvider: parsed.emisor.rfc
      ? {
          rfc: parsed.emisor.rfc,
          name: emisorNombre,
          legalName: parsed.emisor.nombre ?? null,
          taxRegime: parsed.emisor.regimenFiscal ?? null,
        }
      : null,
    paymentMethodId,
    lines: Array.from(grouped.values()).map(({ product, quantity, unitCost }) => ({
      product,
      quantity,
      unitCost,
    })),
    unmatched,
    warnings,
    metadata: {
      satUuid: parsed.uuid,
      supplierInvoiceNumber: serieFolio || null,
      invoiceDate: parsed.fecha,
      purchasedAt: parsed.fecha,
      xmlFileName,
    },
  };
}
