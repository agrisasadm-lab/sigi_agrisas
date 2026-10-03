import { ExpenseRepository } from "@/modules/expenses/application/ports/ExpenseRepository";
import { ExpenseDto, toExpenseDto } from "@/modules/expenses/application/dto/ExpenseDto";
import { ExpenseNotFoundError } from "@/modules/expenses/domain/errors/ExpenseNotFoundError";

export class GetExpenseUseCase {
  constructor(private readonly repo: ExpenseRepository) {}
  async execute(id: string): Promise<ExpenseDto> {
    const e = await this.repo.findById(id);
    if (!e) throw new ExpenseNotFoundError();
    return toExpenseDto(e);
  }
}
