import * as XLSX from "xlsx";
import {
  SalesCutReportResponseDto,
  SalesCutBreakdownRowDto,
  SalesCutProductBreakdownRowDto,
} from "../../application/dto/SalesCutReportResponseDto";

const BREAKDOWN_HEADER = ["Concepto", "Tickets", "Subtotal", "Impuestos", "Total"];
const PRODUCT_HEADER = ["Concepto", "Tickets", "Piezas", "Subtotal", "Impuestos", "Total"];
const TICKET_HEADER = ["Ticket", "Cliente", "Importe", "Forma de pago"];

function breakdownSheet(rows: SalesCutBreakdownRowDto[]): XLSX.WorkSheet {
  const data: (string | number)[][] = [BREAKDOWN_HEADER];
  for (const r of rows) data.push([r.label, r.ticketCount, r.subtotal, r.taxTotal, r.total]);
  return XLSX.utils.aoa_to_sheet(data);
}

function productSheet(rows: SalesCutProductBreakdownRowDto[]): XLSX.WorkSheet {
  const data: (string | number)[][] = [PRODUCT_HEADER];
  for (const r of rows) data.push([r.label, r.ticketCount, r.quantitySold, r.subtotal, r.taxTotal, r.total]);
  return XLSX.utils.aoa_to_sheet(data);
}

/** Construye el workbook del corte de ventas — una hoja por desglose más el detalle de tickets. */
export function buildSalesCutWorkbook(data: SalesCutReportResponseDto): Buffer {
  const workbook = XLSX.utils.book_new();

  const totalsRows: (string | number)[][] = [
    ["Ventas", data.totals.grossSales],
    ["Tickets", data.totals.ticketCount],
    ["Subtotal", data.totals.subtotal],
    ["IVA", data.totals.ivaTotal],
    ["IEPS", data.totals.iepsTotal],
    ["Canceladas (conteo)", data.cancelled.count],
    ["Canceladas (total)", data.cancelled.total],
    [],
    ["Neto de caja"],
    ["Ventas", data.cash.grossSales],
    ["+ Abonos cobrados", data.cash.paymentsReceived],
    ["- Devoluciones", data.cash.returnsRefunded],
    ["- Gastos", data.cash.expensesTotal],
    ["= Neto", data.cash.netCash],
  ];
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(totalsRows), "Totales");

  XLSX.utils.book_append_sheet(workbook, breakdownSheet(data.byPaymentMethod), "Por Metodo");
  XLSX.utils.book_append_sheet(workbook, breakdownSheet(data.byDay), "Por Dia");
  XLSX.utils.book_append_sheet(workbook, breakdownSheet(data.byCashier), "Por Cajero");
  XLSX.utils.book_append_sheet(workbook, breakdownSheet(data.byBranch), "Por Sucursal");
  XLSX.utils.book_append_sheet(workbook, breakdownSheet(data.byDepartment), "Por Departamento");
  XLSX.utils.book_append_sheet(workbook, productSheet(data.byProduct), "Por Producto");

  const ticketRows: (string | number)[][] = [TICKET_HEADER];
  for (const r of data.salesList) {
    ticketRows.push([r.folioCode, r.customerName ?? "", r.total, r.paymentMethodName]);
  }
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(ticketRows), "Detalle Tickets");

  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
