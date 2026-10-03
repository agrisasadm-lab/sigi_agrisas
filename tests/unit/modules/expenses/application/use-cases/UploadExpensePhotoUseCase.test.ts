import { InMemoryExpenseRepository } from "@/modules/expenses/infrastructure/repositories/InMemoryExpenseRepository";
import { InMemoryExpensePhotoStorage } from "@/modules/expenses/infrastructure/services/InMemoryExpensePhotoStorage";
import { CreateExpenseUseCase } from "@/modules/expenses/application/use-cases/CreateExpenseUseCase";
import {
  UploadExpensePhotoUseCase,
  InvalidExpensePhotoFormatError,
  ExpensePhotoTooLargeError,
} from "@/modules/expenses/application/use-cases/UploadExpensePhotoUseCase";
import { DeleteExpensePhotoUseCase } from "@/modules/expenses/application/use-cases/DeleteExpensePhotoUseCase";
import { ExpenseNotFoundError } from "@/modules/expenses/domain/errors/ExpenseNotFoundError";

async function createExpense(repo: InMemoryExpenseRepository) {
  return new CreateExpenseUseCase(repo).execute({
    branchId: "branch-a",
    concept: "Gasolina",
    amount: 500,
    expenseDate: new Date(),
    creatorId: "creator-1",
  });
}

describe("UploadExpensePhotoUseCase", () => {
  it("uploads a valid image and persists photoUrl", async () => {
    const repo = new InMemoryExpenseRepository();
    const storage = new InMemoryExpensePhotoStorage();
    const created = await createExpense(repo);

    const url = await new UploadExpensePhotoUseCase(repo, storage).execute({
      expenseId: created.id,
      buffer: Buffer.from("fake-image"),
      mime: "image/png",
      sizeBytes: 1024,
    });

    expect(url).toContain("expenses/");
    const updated = await repo.findById(created.id);
    expect(updated?.photoUrl).toBe(url);
  });

  it("throws InvalidExpensePhotoFormatError for unsupported MIME", async () => {
    const repo = new InMemoryExpenseRepository();
    const storage = new InMemoryExpensePhotoStorage();
    const created = await createExpense(repo);

    await expect(
      new UploadExpensePhotoUseCase(repo, storage).execute({
        expenseId: created.id,
        buffer: Buffer.from("x"),
        mime: "application/pdf",
        sizeBytes: 100,
      })
    ).rejects.toThrow(InvalidExpensePhotoFormatError);
  });

  it("throws ExpensePhotoTooLargeError when exceeding 2MB", async () => {
    const repo = new InMemoryExpenseRepository();
    const storage = new InMemoryExpensePhotoStorage();
    const created = await createExpense(repo);

    await expect(
      new UploadExpensePhotoUseCase(repo, storage).execute({
        expenseId: created.id,
        buffer: Buffer.from("x"),
        mime: "image/png",
        sizeBytes: 2 * 1024 * 1024 + 1,
      })
    ).rejects.toThrow(ExpensePhotoTooLargeError);
  });

  it("throws ExpenseNotFoundError for unknown expense", async () => {
    const repo = new InMemoryExpenseRepository();
    const storage = new InMemoryExpensePhotoStorage();
    await expect(
      new UploadExpensePhotoUseCase(repo, storage).execute({
        expenseId: "ghost",
        buffer: Buffer.from("x"),
        mime: "image/png",
        sizeBytes: 100,
      })
    ).rejects.toThrow(ExpenseNotFoundError);
  });

  it("deletes the previous photo when replacing it", async () => {
    const repo = new InMemoryExpenseRepository();
    const storage = new InMemoryExpensePhotoStorage();
    const created = await createExpense(repo);

    const firstUrl = await new UploadExpensePhotoUseCase(repo, storage).execute({
      expenseId: created.id,
      buffer: Buffer.from("first"),
      mime: "image/png",
      sizeBytes: 100,
    });
    expect(storage.has(firstUrl)).toBe(true);

    const secondUrl = await new UploadExpensePhotoUseCase(repo, storage).execute({
      expenseId: created.id,
      buffer: Buffer.from("second"),
      mime: "image/jpeg",
      sizeBytes: 100,
    });

    expect(storage.has(firstUrl)).toBe(false);
    expect(storage.has(secondUrl)).toBe(true);
  });
});

describe("DeleteExpensePhotoUseCase", () => {
  it("is idempotent when there is no photo", async () => {
    const repo = new InMemoryExpenseRepository();
    const storage = new InMemoryExpensePhotoStorage();
    const created = await createExpense(repo);

    await expect(new DeleteExpensePhotoUseCase(repo, storage).execute(created.id)).resolves.toBeUndefined();
  });

  it("removes an existing photo", async () => {
    const repo = new InMemoryExpenseRepository();
    const storage = new InMemoryExpensePhotoStorage();
    const created = await createExpense(repo);
    const url = await new UploadExpensePhotoUseCase(repo, storage).execute({
      expenseId: created.id,
      buffer: Buffer.from("x"),
      mime: "image/png",
      sizeBytes: 100,
    });

    await new DeleteExpensePhotoUseCase(repo, storage).execute(created.id);

    expect(storage.has(url)).toBe(false);
    const updated = await repo.findById(created.id);
    expect(updated?.photoUrl).toBeNull();
  });

  it("throws ExpenseNotFoundError for unknown expense", async () => {
    const repo = new InMemoryExpenseRepository();
    const storage = new InMemoryExpensePhotoStorage();
    await expect(new DeleteExpensePhotoUseCase(repo, storage).execute("ghost")).rejects.toThrow(ExpenseNotFoundError);
  });
});
