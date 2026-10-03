import type { Metadata } from "next";
import { ExpensesReportPage } from "./_blocks/ExpensesReportPage";

export const metadata: Metadata = {
  title: "Reporte de gastos · Agrisas",
};

export default function Page() {
  return <ExpensesReportPage />;
}
