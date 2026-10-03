import { authFetch, NetworkError, UnauthenticatedError, ForbiddenError } from "../../../../_lib/authFetch";
import type { ListExpensesResponse, ExpenseApiDto } from "../types/api";
import type { Expense, ExpenseFilters } from "../types/domain";

export function toExpense(dto: ExpenseApiDto): Expense {
  return {
    id: dto.id,
    branchId: dto.branchId,
    branchName: dto.branchName,
    concept: dto.concept,
    amount: dto.amount,
    notes: dto.notes,
    photoUrl: dto.photoUrl,
    expenseDate: dto.expenseDate,
    creatorId: dto.creatorId,
    creatorName: dto.creatorName,
    isActive: dto.isActive,
    createdAt: new Date(dto.createdAt),
    updatedAt: new Date(dto.updatedAt),
  };
}

export async function listExpenses(
  { page, pageSize, ...filters }: ExpenseFilters & { page: number; pageSize: number },
  fetchImpl = authFetch
): Promise<{ items: Expense[]; total: number; page: number; pageSize: number }> {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (filters.includeInactive) params.set("includeInactive", "true");
  if (filters.branchId) params.set("branchId", filters.branchId);
  if (filters.concept) params.set("concept", filters.concept);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);

  let res: Response;
  try {
    res = await fetchImpl(`/api/v1/admin/expenses?${params.toString()}`);
  } catch (err) {
    if (err instanceof NetworkError || err instanceof UnauthenticatedError || err instanceof ForbiddenError) throw err;
    throw new NetworkError();
  }
  if (!res.ok) throw new NetworkError();
  const body = (await res.json()) as ListExpensesResponse;
  return { items: body.items.map(toExpense), total: body.total, page: body.page, pageSize: body.pageSize };
}
