export interface ExpensePhotoStoragePort {
  upload(expenseId: string, buffer: Buffer, mime: string, ext: string): Promise<string>;
  delete(url: string): Promise<void>;
}
