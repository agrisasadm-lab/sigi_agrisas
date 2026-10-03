import type { Metadata } from "next";
import { ExpensesPage } from "./_blocks/ExpensesPage";

export const metadata: Metadata = {
  title: "Gastos · Agrisas",
};

export default function Page() {
  return <ExpensesPage />;
}
