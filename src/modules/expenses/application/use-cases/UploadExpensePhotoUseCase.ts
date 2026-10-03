import type { ExpenseRepository } from "@/modules/expenses/application/ports/ExpenseRepository";
import type { ExpensePhotoStoragePort } from "@/modules/expenses/application/ports/ExpensePhotoStoragePort";
import { ExpenseNotFoundError } from "@/modules/expenses/domain/errors/ExpenseNotFoundError";

const ALLOWED_MIMES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const MAX_BYTES = 2 * 1024 * 1024; // 2 MB

export class InvalidExpensePhotoFormatError extends Error {
  constructor() {
    super("Invalid image format");
    this.name = "InvalidExpensePhotoFormatError";
  }
}

export class ExpensePhotoTooLargeError extends Error {
  readonly maxBytes = MAX_BYTES;
  constructor() {
    super("Image too large");
    this.name = "ExpensePhotoTooLargeError";
  }
}

export interface UploadExpensePhotoInput {
  expenseId: string;
  buffer: Buffer;
  mime: string;
  sizeBytes: number;
}

export class UploadExpensePhotoUseCase {
  constructor(
    private readonly repo: ExpenseRepository,
    private readonly storage: ExpensePhotoStoragePort
  ) {}

  async execute({ expenseId, buffer, mime, sizeBytes }: UploadExpensePhotoInput): Promise<string> {
    const ext = ALLOWED_MIMES[mime];
    if (!ext) throw new InvalidExpensePhotoFormatError();
    if (sizeBytes > MAX_BYTES) throw new ExpensePhotoTooLargeError();

    const expense = await this.repo.findById(expenseId);
    if (!expense) throw new ExpenseNotFoundError();

    if (expense.photoUrl) {
      await this.storage.delete(expense.photoUrl).catch(() => {});
    }

    const url = await this.storage.upload(expenseId, buffer, mime, ext);
    await this.repo.updatePhotoUrl(expenseId, url);
    return url;
  }
}
