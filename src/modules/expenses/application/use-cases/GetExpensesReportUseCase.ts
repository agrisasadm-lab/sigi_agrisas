import { ExpenseRepository, HistoryFilters, HistoryResult } from "@/modules/expenses/application/ports/ExpenseRepository";

const PDF_ROW_LIMIT = 10_000;

export interface ExpensesReportInput {
  filters: HistoryFilters;
  page: number;
  pageSize: number;
  forPdf: boolean;
}

export interface ExpensesReportResult extends HistoryResult {
  tooLarge: boolean;
  page: number;
  pageSize: number;
}

export class GetExpensesReportUseCase {
  constructor(private readonly repo: ExpenseRepository) {}

  async execute(input: ExpensesReportInput): Promise<ExpensesReportResult> {
    if (input.forPdf) {
      const result = await this.repo.findHistory(input.filters);
      const tooLarge = result.total > PDF_ROW_LIMIT;
      return { ...result, tooLarge, page: 1, pageSize: result.total };
    }

    const result = await this.repo.findHistory(input.filters, {
      page: input.page,
      pageSize: input.pageSize,
    });
    return { ...result, tooLarge: false, page: input.page, pageSize: input.pageSize };
  }
}
