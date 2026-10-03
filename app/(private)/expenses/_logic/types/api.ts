export interface ExpenseApiDto {
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
  createdAt: string;
  updatedAt: string;
}

export interface ListExpensesResponse {
  items: ExpenseApiDto[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CreateExpenseBody {
  branchId: string;
  concept: string;
  amount: number;
  notes?: string | null;
  expenseDate: string;
}

export interface UpdateExpenseBody {
  concept?: string;
  amount?: number;
  notes?: string | null;
  expenseDate?: string;
}

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
