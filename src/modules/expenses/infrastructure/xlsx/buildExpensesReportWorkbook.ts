import * as XLSX from "xlsx";
import { ExpensesReportDto } from "../../application/dto/ExpenseReportDto";

const HEADER = ["Fecha", "Concepto", "Sucursal", "Registrado por", "Monto", "Notas", "Estado"];

/** Construye el workbook del reporte de gastos — un renglón por gasto, con totales al final. */
export function buildExpensesReportWorkbook(data: ExpensesReportDto): Buffer {
  const rows: (string | number)[][] = [HEADER];

  for (const item of data.items) {
    rows.push([
      item.expenseDate,
      item.concept,
      item.branchName ?? "",
      item.creatorName ?? "",
      item.amount,
      item.notes ?? "",
      item.isActive ? "Activo" : "Inactivo",
    ]);
  }

  rows.push([]);
  rows.push(["Total registros", data.totals.rowCount]);
  rows.push(["Monto total", data.totals.totalAmount]);

  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Reporte de gastos");

  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
