import { StyleSheet } from "@react-pdf/renderer";
import { simpleListPdfStyles } from "@/shared/infrastructure/pdf/simpleListPdfStyles";
import { PDF_COLORS } from "@/shared/infrastructure/pdf/pdfTheme";

export const styles = StyleSheet.create({
  ...simpleListPdfStyles,
  issuerRow: { flexDirection: "row", gap: 6, alignItems: "flex-start", marginBottom: 4 },
  issuerBlock: { flexDirection: "column", gap: 1 },
  issuerName: { fontSize: 11, fontFamily: "Helvetica-Bold" },
  issuerMeta: { fontSize: 7, color: PDF_COLORS.onSurfaceVariant },
  filtersSection: { marginBottom: 8 },
  filtersTitle: { fontSize: 8, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  filterChips: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  chip: {
    borderWidth: 0.5,
    borderColor: PDF_COLORS.outlineVariant,
    borderRadius: 3,
    paddingVertical: 2,
    paddingHorizontal: 6,
    fontSize: 7,
  },
  colFecha: { width: "12%", fontSize: 7 },
  colConcepto: { width: "28%", fontSize: 7 },
  colSucursal: { width: "16%", fontSize: 7 },
  colRegistrado: { width: "16%", fontSize: 7 },
  colMonto: { width: "12%", fontSize: 7, textAlign: "right" },
  colEstado: { width: "10%", fontSize: 7 },
  headerCol: { color: "white", fontWeight: "bold", fontSize: 7 },
  totalsSection: { marginTop: 12, alignItems: "flex-end" },
  totalsTitle: { fontSize: 9, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  totalsRow: { flexDirection: "row", gap: 8 },
  totalsLabel: { fontSize: 8, color: PDF_COLORS.onSurfaceVariant },
  totalsValue: { fontSize: 8, fontFamily: "Helvetica-Bold" },
});
