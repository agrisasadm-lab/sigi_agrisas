import { Expense } from "@/modules/expenses/domain/entities/Expense";

export interface ExpenseHistoryRowDto {
  id: string;
  expenseDate: string;
  concept: string;
  amount: string;
  notes: string | null;
  branchId: string;
  branchName: string | null;
  creatorId: string;
  creatorName: string | null;
  isActive: boolean;
  createdAt: string;
}

export function toExpenseHistoryRowDto(e: Expense): ExpenseHistoryRowDto {
  return {
    id: e.id,
    expenseDate: e.expenseDate.toISOString().substring(0, 10),
    concept: e.concept,
    amount: e.amount,
    notes: e.notes,
    branchId: e.branchId,
    branchName: e.branchName,
    creatorId: e.creatorId,
    creatorName: e.creatorName,
    isActive: e.isActive,
    createdAt: e.createdAt.toISOString(),
  };
}

export interface ExpensesReportDto {
  generatedAt: string;
  generatedBy: { userId: string; email: string };
  filters: {
    concept: string | null;
    from: string | null;
    to: string | null;
    branchId: string | null;
    includeInactive: boolean;
  };
  items: ExpenseHistoryRowDto[];
  totals: {
    rowCount: number;
    totalAmount: string;
  };
  page: number;
  pageSize: number;
  total: number;
}
