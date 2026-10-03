import { InMemoryExpenseRepository } from "@/modules/expenses/infrastructure/repositories/InMemoryExpenseRepository";
import { CreateExpenseUseCase } from "@/modules/expenses/application/use-cases/CreateExpenseUseCase";
import { GetExpenseUseCase } from "@/modules/expenses/application/use-cases/GetExpenseUseCase";
import { ListExpensesUseCase } from "@/modules/expenses/application/use-cases/ListExpensesUseCase";
import { UpdateExpenseUseCase } from "@/modules/expenses/application/use-cases/UpdateExpenseUseCase";
import { SoftDeleteExpenseUseCase } from "@/modules/expenses/application/use-cases/SoftDeleteExpenseUseCase";
import { Expense } from "@/modules/expenses/domain/entities/Expense";
import { ExpenseNotFoundError } from "@/modules/expenses/domain/errors/ExpenseNotFoundError";
import { ExpenseInvalidAmountError } from "@/modules/expenses/domain/errors/ExpenseInvalidAmountError";

const BRANCH_A = "branch-a";
const BRANCH_B = "branch-b";
const CREATOR = "creator-1";

function makeExpense(id: string, overrides: Partial<Parameters<typeof Expense.create>[1]> = {}): Expense {
  const now = new Date();
  return Expense.create(id, {
    branchId: BRANCH_A,
    branchName: "Sucursal A",
    concept: "Papelería",
    amount: "150.0000",
    notes: null,
    photoUrl: null,
    expenseDate: now,
    creatorId: CREATOR,
    creatorName: "Operador",
    isActive: true,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  });
}

describe("CreateExpenseUseCase", () => {
  it("creates an expense with valid data", async () => {
    const repo = new InMemoryExpenseRepository();
    const result = await new CreateExpenseUseCase(repo).execute({
      branchId: BRANCH_A,
      concept: "Gasolina",
      amount: 500,
      expenseDate: new Date("2026-09-01"),
      creatorId: CREATOR,
    });
    expect(result.concept).toBe("Gasolina");
    expect(result.isActive).toBe(true);
  });

  it("throws ExpenseInvalidAmountError when amount <= 0", async () => {
    const repo = new InMemoryExpenseRepository();
    await expect(
      new CreateExpenseUseCase(repo).execute({
        branchId: BRANCH_A,
        concept: "Gasolina",
        amount: 0,
        expenseDate: new Date(),
        creatorId: CREATOR,
      })
    ).rejects.toThrow(ExpenseInvalidAmountError);
  });
});

describe("GetExpenseUseCase", () => {
  it("returns expense by id", async () => {
    const repo = new InMemoryExpenseRepository();
    repo.seed([makeExpense("1")]);
    expect((await new GetExpenseUseCase(repo).execute("1")).concept).toBe("Papelería");
  });

  it("throws ExpenseNotFoundError when not found", async () => {
    await expect(new GetExpenseUseCase(new InMemoryExpenseRepository()).execute("ghost")).rejects.toThrow(ExpenseNotFoundError);
  });
});

describe("ListExpensesUseCase", () => {
  it("returns only active by default", async () => {
    const repo = new InMemoryExpenseRepository();
    repo.seed([makeExpense("1", { isActive: true }), makeExpense("2", { isActive: false })]);
    const result = await new ListExpensesUseCase(repo).execute({ page: 1, pageSize: 20, includeInactive: false });
    expect(result.items).toHaveLength(1);
  });

  it("includes inactive when requested", async () => {
    const repo = new InMemoryExpenseRepository();
    repo.seed([makeExpense("1", { isActive: true }), makeExpense("2", { isActive: false })]);
    const result = await new ListExpensesUseCase(repo).execute({ page: 1, pageSize: 20, includeInactive: true });
    expect(result.items).toHaveLength(2);
  });

  it("filters by branchId", async () => {
    const repo = new InMemoryExpenseRepository();
    repo.seed([makeExpense("1", { branchId: BRANCH_A }), makeExpense("2", { branchId: BRANCH_B })]);
    const result = await new ListExpensesUseCase(repo).execute({ page: 1, pageSize: 20, includeInactive: false, branchId: BRANCH_B });
    expect(result.items).toHaveLength(1);
    expect(result.items[0].branchId).toBe(BRANCH_B);
  });

  it("filters by concept substring, case-insensitive", async () => {
    const repo = new InMemoryExpenseRepository();
    repo.seed([makeExpense("1", { concept: "Papelería" }), makeExpense("2", { concept: "Gasolina" })]);
    const result = await new ListExpensesUseCase(repo).execute({ page: 1, pageSize: 20, includeInactive: false, concept: "papel" });
    expect(result.items).toHaveLength(1);
    expect(result.items[0].concept).toBe("Papelería");
  });
});

describe("UpdateExpenseUseCase", () => {
  it("updates only the provided fields (diff-only)", async () => {
    const repo = new InMemoryExpenseRepository();
    const created = await new CreateExpenseUseCase(repo).execute({
      branchId: BRANCH_A,
      concept: "Gasolina",
      amount: 500,
      expenseDate: new Date("2026-09-01"),
      creatorId: CREATOR,
    });
    const result = await new UpdateExpenseUseCase(repo).execute({ id: created.id, concept: "Diesel" });
    expect(result.concept).toBe("Diesel");
    expect(result.amount).toBe("500");
  });

  it("throws ExpenseInvalidAmountError when amount <= 0", async () => {
    const repo = new InMemoryExpenseRepository();
    const created = await new CreateExpenseUseCase(repo).execute({
      branchId: BRANCH_A,
      concept: "Gasolina",
      amount: 500,
      expenseDate: new Date(),
      creatorId: CREATOR,
    });
    await expect(new UpdateExpenseUseCase(repo).execute({ id: created.id, amount: -10 })).rejects.toThrow(ExpenseInvalidAmountError);
  });

  it("throws ExpenseNotFoundError for unknown id", async () => {
    await expect(new UpdateExpenseUseCase(new InMemoryExpenseRepository()).execute({ id: "ghost", concept: "X" })).rejects.toThrow(
      ExpenseNotFoundError
    );
  });
});

describe("SoftDeleteExpenseUseCase", () => {
  it("marks expense as inactive", async () => {
    const repo = new InMemoryExpenseRepository();
    const created = await new CreateExpenseUseCase(repo).execute({
      branchId: BRANCH_A,
      concept: "Gasolina",
      amount: 500,
      expenseDate: new Date(),
      creatorId: CREATOR,
    });
    await new SoftDeleteExpenseUseCase(repo).execute(created.id);
    expect((await new GetExpenseUseCase(repo).execute(created.id)).isActive).toBe(false);
  });

  it("throws ExpenseNotFoundError for unknown id", async () => {
    await expect(new SoftDeleteExpenseUseCase(new InMemoryExpenseRepository()).execute("ghost")).rejects.toThrow(ExpenseNotFoundError);
  });

  it("throws ExpenseNotFoundError when already inactive (not idempotent)", async () => {
    const repo = new InMemoryExpenseRepository();
    repo.seed([makeExpense("1", { isActive: false })]);
    await expect(new SoftDeleteExpenseUseCase(repo).execute("1")).rejects.toThrow(ExpenseNotFoundError);
  });
});
