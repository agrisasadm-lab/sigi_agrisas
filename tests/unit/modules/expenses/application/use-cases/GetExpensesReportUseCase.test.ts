import { InMemoryExpenseRepository } from "@/modules/expenses/infrastructure/repositories/InMemoryExpenseRepository";
import { CreateExpenseUseCase } from "@/modules/expenses/application/use-cases/CreateExpenseUseCase";
import { GetExpensesReportUseCase } from "@/modules/expenses/application/use-cases/GetExpensesReportUseCase";

async function seedExpenses(repo: InMemoryExpenseRepository, count: number) {
  const useCase = new CreateExpenseUseCase(repo);
  for (let i = 0; i < count; i++) {
    await useCase.execute({
      branchId: "branch-a",
      concept: `Gasto ${i}`,
      amount: 100,
      expenseDate: new Date("2026-09-01"),
      creatorId: "creator-1",
    });
  }
}

describe("GetExpensesReportUseCase", () => {
  it("returns a paginated JSON report by default", async () => {
    const repo = new InMemoryExpenseRepository();
    await seedExpenses(repo, 3);

    const result = await new GetExpensesReportUseCase(repo).execute({
      filters: {},
      page: 1,
      pageSize: 2,
      forPdf: false,
    });

    expect(result.items).toHaveLength(2);
    expect(result.total).toBe(3);
    expect(result.tooLarge).toBe(false);
    expect(result.totalAmount).toBe("300.0000");
  });

  it("returns the full dataset without pagination when forPdf is true", async () => {
    const repo = new InMemoryExpenseRepository();
    await seedExpenses(repo, 3);

    const result = await new GetExpensesReportUseCase(repo).execute({
      filters: {},
      page: 1,
      pageSize: 2,
      forPdf: true,
    });

    expect(result.items).toHaveLength(3);
    expect(result.tooLarge).toBe(false);
  });

  it("marks tooLarge when the dataset exceeds 10,000 rows", async () => {
    const repo = new InMemoryExpenseRepository();
    const findHistorySpy = jest.spyOn(repo, "findHistory").mockResolvedValue({
      items: [],
      total: 10_001,
      totalAmount: "0",
    });

    const result = await new GetExpensesReportUseCase(repo).execute({
      filters: {},
      page: 1,
      pageSize: 20,
      forPdf: true,
    });

    expect(result.tooLarge).toBe(true);
    findHistorySpy.mockRestore();
  });
});
