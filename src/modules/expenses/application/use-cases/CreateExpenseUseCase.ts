import { ExpenseRepository, CreateExpenseData } from "@/modules/expenses/application/ports/ExpenseRepository";
import { ExpenseDto, toExpenseDto } from "@/modules/expenses/application/dto/ExpenseDto";
import { ExpenseInvalidAmountError } from "@/modules/expenses/domain/errors/ExpenseInvalidAmountError";

export class CreateExpenseUseCase {
  constructor(private readonly repo: ExpenseRepository) {}

  async execute(data: CreateExpenseData): Promise<ExpenseDto> {
    if (data.amount <= 0) throw new ExpenseInvalidAmountError();
    return toExpenseDto(await this.repo.create(data));
  }
}
