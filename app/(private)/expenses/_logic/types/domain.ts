export interface Expense {
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

export interface ExpenseFilters {
  branchId?: string;
  concept?: string;
  from?: string;
  to?: string;
  includeInactive?: boolean;
}
