import { ExpenseRepository, UpdateExpenseData } from "@/modules/expenses/application/ports/ExpenseRepository";
import { ExpenseDto, toExpenseDto } from "@/modules/expenses/application/dto/ExpenseDto";
import { ExpenseInvalidAmountError } from "@/modules/expenses/domain/errors/ExpenseInvalidAmountError";

export interface UpdateExpenseRequest extends UpdateExpenseData {
  id: string;
}

export class UpdateExpenseUseCase {
  constructor(private readonly repo: ExpenseRepository) {}

  async execute(req: UpdateExpenseRequest): Promise<ExpenseDto> {
    const { id, ...data } = req;
    if (data.amount !== undefined && data.amount <= 0) throw new ExpenseInvalidAmountError();
    return toExpenseDto(await this.repo.update(id, data));
  }
}
