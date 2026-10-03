import { authFetch, NetworkError, UnauthenticatedError, ForbiddenError } from "../../../../_lib/authFetch";
import type { CreateExpenseBody, ExpenseApiDto } from "../types/api";
import type { Expense } from "../types/domain";
import { ExpenseInvalidAmountError } from "../errors";
import { toExpense } from "./listExpenses";

export async function createExpense(
  { body }: { body: CreateExpenseBody },
  fetchImpl = authFetch
): Promise<Expense> {
  let res: Response;
  try {
    res = await fetchImpl("/api/v1/admin/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (err) {
    if (err instanceof NetworkError || err instanceof UnauthenticatedError || err instanceof ForbiddenError) throw err;
    throw new NetworkError();
  }
  if (res.status === 400) {
    const data = await res.json().catch(() => ({})) as { error?: string };
    if (data.error?.includes("amount")) throw new ExpenseInvalidAmountError();
    throw new Error(data.error ?? "Error al crear el gasto.");
  }
  if (!res.ok) throw new NetworkError();
  const data = (await res.json()) as ExpenseApiDto;
  return toExpense(data);
}
