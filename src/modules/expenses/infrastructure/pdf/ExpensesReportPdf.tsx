import React from "react";
import { Document, Page, Text, View } from "@react-pdf/renderer";
import { ExpensesReportDto } from "../../application/dto/ExpenseReportDto";
import { styles } from "./pdfStyles";
import { PdfLogo } from "@/shared/infrastructure/pdf/PdfLogo";
import type { PdfIssuer } from "@/shared/infrastructure/pdf/pdfIssuer";

interface Props {
  data: ExpensesReportDto;
  issuer: PdfIssuer;
}

function formatDateTime(iso: string): string {
  return iso.substring(0, 16).replace("T", " ");
}

export function ExpensesReportPdf({ data, issuer }: Props) {
  const { generatedAt, generatedBy, filters, items, totals } = data;

  const activeFilters: string[] = [];
  if (filters.concept) activeFilters.push(`Concepto: ${filters.concept}`);
  if (filters.from) activeFilters.push(`Desde: ${filters.from}`);
  if (filters.to) activeFilters.push(`Hasta: ${filters.to}`);
  if (filters.branchId) activeFilters.push(`Sucursal: ${filters.branchId}`);
  if (filters.includeInactive) activeFilters.push("Incluye inactivos");

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View style={styles.issuerRow}>
            <PdfLogo logoUrl={issuer.logoUrl} size={24} />
            <View style={styles.issuerBlock}>
              {issuer.businessName && <Text style={styles.issuerName}>{issuer.businessName}</Text>}
              {issuer.businessAddress && <Text style={styles.issuerMeta}>{issuer.businessAddress}</Text>}
              {issuer.businessRfc && <Text style={styles.issuerMeta}>RFC: {issuer.businessRfc}</Text>}
            </View>
          </View>
          <Text style={styles.title}>Reporte de Gastos</Text>
        </View>
        <Text style={styles.subtitle}>
          Generado: {formatDateTime(generatedAt)} · Por: {generatedBy.email}
        </Text>

        {activeFilters.length > 0 && (
          <View style={styles.filtersSection}>
            <Text style={styles.filtersTitle}>Filtros aplicados:</Text>
            <View style={styles.filterChips}>
              {activeFilters.map((f, i) => (
                <View key={i} style={styles.chip}>
                  <Text>{f}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {items.length === 0 ? (
          <Text style={styles.emptyMsg}>Sin datos para los filtros aplicados</Text>
        ) : (
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.colFecha, styles.headerCol]}>Fecha</Text>
              <Text style={[styles.colConcepto, styles.headerCol]}>Concepto</Text>
              <Text style={[styles.colSucursal, styles.headerCol]}>Sucursal</Text>
              <Text style={[styles.colRegistrado, styles.headerCol]}>Registrado por</Text>
              <Text style={[styles.colMonto, styles.headerCol]}>Monto</Text>
              <Text style={[styles.colEstado, styles.headerCol]}>Estado</Text>
            </View>
            {items.map((item, idx) => (
              <View key={item.id} style={[styles.tableRow, ...(idx % 2 === 0 ? [styles.tableRowEven] : [])]}>
                <Text style={styles.colFecha}>{item.expenseDate}</Text>
                <Text style={styles.colConcepto}>{item.concept}</Text>
                <Text style={styles.colSucursal}>{item.branchName ?? "—"}</Text>
                <Text style={styles.colRegistrado}>{item.creatorName ?? "—"}</Text>
                <Text style={styles.colMonto}>${item.amount}</Text>
                <Text style={styles.colEstado}>{item.isActive ? "Activo" : "Inactivo"}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.totalsSection}>
          <Text style={styles.totalsTitle}>Totales</Text>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>Total registros:</Text>
            <Text style={styles.totalsValue}>{totals.rowCount}</Text>
          </View>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>Monto total:</Text>
            <Text style={styles.totalsValue}>${totals.totalAmount}</Text>
          </View>
        </View>

        <Text
          style={styles.footer}
          render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`}
          fixed
        />
      </Page>
    </Document>
  );
}
