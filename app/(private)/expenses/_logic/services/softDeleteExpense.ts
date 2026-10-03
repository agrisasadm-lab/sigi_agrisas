import { authFetch, NetworkError, UnauthenticatedError, ForbiddenError } from "../../../../_lib/authFetch";
import { ExpenseNotFoundError } from "../errors";

export async function softDeleteExpense(
  { id }: { id: string },
  fetchImpl = authFetch
): Promise<void> {
  let res: Response;
  try {
    res = await fetchImpl(`/api/v1/admin/expenses/${id}`, { method: "DELETE" });
  } catch (err) {
    if (err instanceof NetworkError || err instanceof UnauthenticatedError || err instanceof ForbiddenError) throw err;
    throw new NetworkError();
  }
  if (res.status === 404) throw new ExpenseNotFoundError();
  if (res.status === 204) return;
  if (!res.ok) throw new NetworkError();
}
