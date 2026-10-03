import { randomUUID } from "crypto";
import {
  ExpenseRepository,
  FindAllExpensesOptions,
  CreateExpenseData,
  UpdateExpenseData,
  HistoryFilters,
  HistoryPagination,
  HistoryResult,
} from "@/modules/expenses/application/ports/ExpenseRepository";
import { Expense } from "@/modules/expenses/domain/entities/Expense";
import { ExpenseNotFoundError } from "@/modules/expenses/domain/errors/ExpenseNotFoundError";

function matches(e: Expense, opts: { includeInactive?: boolean; branchId?: string; concept?: string; from?: Date; to?: Date }): boolean {
  if (!opts.includeInactive && !e.isActive) return false;
  if (opts.branchId && e.branchId !== opts.branchId) return false;
  if (opts.concept && !e.concept.toLowerCase().includes(opts.concept.toLowerCase())) return false;
  if (opts.from && e.expenseDate < opts.from) return false;
  if (opts.to && e.expenseDate > opts.to) return false;
  return true;
}

export class InMemoryExpenseRepository implements ExpenseRepository {
  private store: Map<string, Expense> = new Map();

  seed(items: Expense[]): void {
    for (const e of items) this.store.set(e.id, e);
  }

  async findAll({ page, pageSize, includeInactive, branchId, concept, from, to }: FindAllExpensesOptions): Promise<{ items: Expense[]; total: number }> {
    const all = [...this.store.values()].filter((e) => matches(e, { includeInactive, branchId, concept, from, to }));
    const skip = (page - 1) * pageSize;
    return { items: all.slice(skip, skip + pageSize), total: all.length };
  }

  async findById(id: string): Promise<Expense | null> {
    return this.store.get(id) ?? null;
  }

  async create(data: CreateExpenseData): Promise<Expense> {
    const now = new Date();
    const e = Expense.create(randomUUID(), {
      branchId: data.branchId,
      branchName: null,
      concept: data.concept,
      amount: data.amount.toString(),
      notes: data.notes ?? null,
      photoUrl: null,
      expenseDate: data.expenseDate,
      creatorId: data.creatorId,
      creatorName: null,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
    this.store.set(e.id, e);
    return e;
  }

  async update(id: string, data: UpdateExpenseData): Promise<Expense> {
    const existing = this.store.get(id);
    if (!existing) throw new ExpenseNotFoundError();
    const updated = Expense.create(id, {
      branchId: existing.branchId,
      branchName: existing.branchName,
      concept: data.concept ?? existing.concept,
      amount: data.amount !== undefined ? data.amount.toString() : existing.amount,
      notes: data.notes !== undefined ? data.notes : existing.notes,
      photoUrl: existing.photoUrl,
      expenseDate: data.expenseDate ?? existing.expenseDate,
      creatorId: existing.creatorId,
      creatorName: existing.creatorName,
      isActive: existing.isActive,
      createdAt: existing.createdAt,
      updatedAt: new Date(),
    });
    this.store.set(id, updated);
    return updated;
  }

  async updatePhotoUrl(id: string, photoUrl: string | null): Promise<Expense> {
    const existing = this.store.get(id);
    if (!existing) throw new ExpenseNotFoundError();
    const updated = Expense.create(id, {
      branchId: existing.branchId,
      branchName: existing.branchName,
      concept: existing.concept,
      amount: existing.amount,
      notes: existing.notes,
      photoUrl,
      expenseDate: existing.expenseDate,
      creatorId: existing.creatorId,
      creatorName: existing.creatorName,
      isActive: existing.isActive,
      createdAt: existing.createdAt,
      updatedAt: new Date(),
    });
    this.store.set(id, updated);
    return updated;
  }

  async softDelete(id: string): Promise<void> {
    const existing = this.store.get(id);
    if (!existing) throw new ExpenseNotFoundError();
    this.store.set(
      id,
      Expense.create(id, {
        branchId: existing.branchId,
        branchName: existing.branchName,
        concept: existing.concept,
        amount: existing.amount,
        notes: existing.notes,
        photoUrl: existing.photoUrl,
        expenseDate: existing.expenseDate,
        creatorId: existing.creatorId,
        creatorName: existing.creatorName,
        isActive: false,
        createdAt: existing.createdAt,
        updatedAt: new Date(),
      })
    );
  }

  async findHistory(filters: HistoryFilters, pagination?: HistoryPagination): Promise<HistoryResult> {
    const all = [...this.store.values()]
      .filter((e) => matches(e, filters))
      .sort((a, b) => b.expenseDate.getTime() - a.expenseDate.getTime());
    const totalAmount = all.reduce((sum, e) => sum + Number(e.amount), 0);
    const items = pagination ? all.slice((pagination.page - 1) * pagination.pageSize, pagination.page * pagination.pageSize) : all;
    return { items, total: all.length, totalAmount: totalAmount.toFixed(4) };
  }
}
