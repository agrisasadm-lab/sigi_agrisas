import { Expense } from "@/modules/expenses/domain/entities/Expense";

export interface ExpenseDto {
  id: string;
  branchId: string;
  branchName: string | null;
  concept: string;
  amount: string;
  notes: string | null;
  photoUrl: string | null;
  expenseDate: string;
  creatorId: string;
  creatorName: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export function toExpenseDto(e: Expense): ExpenseDto {
  return {
    id: e.id,
    branchId: e.branchId,
    branchName: e.branchName,
    concept: e.concept,
    amount: e.amount,
    notes: e.notes,
    photoUrl: e.photoUrl,
    expenseDate: e.expenseDate.toISOString().substring(0, 10),
    creatorId: e.creatorId,
    creatorName: e.creatorName,
    isActive: e.isActive,
    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
  };
}
