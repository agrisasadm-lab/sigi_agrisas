import type { ExpenseRepository } from "@/modules/expenses/application/ports/ExpenseRepository";
import type { ExpensePhotoStoragePort } from "@/modules/expenses/application/ports/ExpensePhotoStoragePort";
import { ExpenseNotFoundError } from "@/modules/expenses/domain/errors/ExpenseNotFoundError";

export class DeleteExpensePhotoUseCase {
  constructor(
    private readonly repo: ExpenseRepository,
    private readonly storage: ExpensePhotoStoragePort
  ) {}

  async execute(expenseId: string): Promise<void> {
    const expense = await this.repo.findById(expenseId);
    if (!expense) throw new ExpenseNotFoundError();

    if (expense.photoUrl) {
      await this.storage.delete(expense.photoUrl).catch(() => {});
      await this.repo.updatePhotoUrl(expenseId, null);
    }
    // idempotent: if already null, nothing to do
  }
}
