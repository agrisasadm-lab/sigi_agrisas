import { ExpenseRepository } from "@/modules/expenses/application/ports/ExpenseRepository";
import { ExpenseNotFoundError } from "@/modules/expenses/domain/errors/ExpenseNotFoundError";

export class SoftDeleteExpenseUseCase {
  constructor(private readonly repo: ExpenseRepository) {}
  async execute(id: string): Promise<void> {
    const existing = await this.repo.findById(id);
    if (!existing || !existing.isActive) throw new ExpenseNotFoundError();
    await this.repo.softDelete(id);
  }
}
