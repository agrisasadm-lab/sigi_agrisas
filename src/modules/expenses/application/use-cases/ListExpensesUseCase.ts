import { ExpenseRepository } from "@/modules/expenses/application/ports/ExpenseRepository";
import { ExpenseDto, toExpenseDto } from "@/modules/expenses/application/dto/ExpenseDto";

export interface ListExpensesRequest {
  page: number;
  pageSize: number;
  includeInactive: boolean;
  branchId?: string;
  concept?: string;
  from?: Date;
  to?: Date;
}

export interface ListExpensesResponse {
  items: ExpenseDto[];
  total: number;
  page: number;
  pageSize: number;
}

export class ListExpensesUseCase {
  constructor(private readonly repo: ExpenseRepository) {}
  async execute(req: ListExpensesRequest): Promise<ListExpensesResponse> {
    const { items, total } = await this.repo.findAll(req);
    return { items: items.map(toExpenseDto), total, page: req.page, pageSize: req.pageSize };
  }
}
