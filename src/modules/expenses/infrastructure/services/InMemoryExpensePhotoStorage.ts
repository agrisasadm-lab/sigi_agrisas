import type { ExpensePhotoStoragePort } from "../../application/ports/ExpensePhotoStoragePort";

export class InMemoryExpensePhotoStorage implements ExpensePhotoStoragePort {
  private objects = new Map<string, { buffer: Buffer; mime: string }>();
  private counter = 0;

  async upload(expenseId: string, buffer: Buffer, mime: string, ext: string): Promise<string> {
    const key = `expenses/${expenseId}/${++this.counter}.${ext}`;
    this.objects.set(key, { buffer, mime });
    return `https://storage.test/${key}`;
  }

  async delete(url: string): Promise<void> {
    const marker = "https://storage.test/";
    if (!url.startsWith(marker)) return;
    const key = url.slice(marker.length);
    this.objects.delete(key);
  }

  has(url: string): boolean {
    const marker = "https://storage.test/";
    return this.objects.has(url.slice(marker.length));
  }

  clear(): void {
    this.objects.clear();
    this.counter = 0;
  }
}
