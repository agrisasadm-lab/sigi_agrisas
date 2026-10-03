import { Expense } from "@/modules/expenses/domain/entities/Expense";

export interface FindAllExpensesOptions {
  page: number;
  pageSize: number;
  includeInactive: boolean;
  branchId?: string;
  concept?: string;
  from?: Date;
  to?: Date;
}

export interface CreateExpenseData {
  branchId: string;
  concept: string;
  amount: number;
  notes?: string | null;
  expenseDate: Date;
  creatorId: string;
}

export interface UpdateExpenseData {
  concept?: string;
  amount?: number;
  notes?: string | null;
  expenseDate?: Date;
}

export interface HistoryFilters {
  branchId?: string;
  concept?: string;
  from?: Date;
  to?: Date;
  includeInactive?: boolean;
}

export interface HistoryPagination {
  page: number;
  pageSize: number;
}

export interface HistoryResult {
  items: Expense[];
  total: number;
  totalAmount: string;
}

export interface ExpenseRepository {
  findAll(opts: FindAllExpensesOptions): Promise<{ items: Expense[]; total: number }>;
  findById(id: string): Promise<Expense | null>;
  create(data: CreateExpenseData): Promise<Expense>;
  update(id: string, data: UpdateExpenseData): Promise<Expense>;
  updatePhotoUrl(id: string, photoUrl: string | null): Promise<Expense>;
  softDelete(id: string): Promise<void>;
  findHistory(filters: HistoryFilters, pagination?: HistoryPagination): Promise<HistoryResult>;
}
