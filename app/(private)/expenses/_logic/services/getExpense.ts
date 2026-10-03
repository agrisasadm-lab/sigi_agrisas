import { authFetch, NetworkError, UnauthenticatedError, ForbiddenError } from "../../../../_lib/authFetch";
import type { ExpenseApiDto } from "../types/api";
import type { Expense } from "../types/domain";
import { ExpenseNotFoundError } from "../errors";
import { toExpense } from "./listExpenses";

export async function getExpense(
  { id }: { id: string },
  fetchImpl = authFetch
): Promise<Expense> {
  let res: Response;
  try {
    res = await fetchImpl(`/api/v1/admin/expenses/${id}`);
  } catch (err) {
    if (err instanceof NetworkError || err instanceof UnauthenticatedError || err instanceof ForbiddenError) throw err;
    throw new NetworkError();
  }
  if (res.status === 404) throw new ExpenseNotFoundError();
  if (!res.ok) throw new NetworkError();
  const data = (await res.json()) as ExpenseApiDto;
  return toExpense(data);
}
