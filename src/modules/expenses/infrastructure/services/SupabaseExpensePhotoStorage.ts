import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import type { ExpensePhotoStoragePort } from "../../application/ports/ExpensePhotoStoragePort";

const BUCKET = "expense-photos";

export class SupabaseExpensePhotoStorage implements ExpensePhotoStoragePort {
  private client: SupabaseClient | null = null;

  private getClient(): SupabaseClient {
    if (this.client) return this.client;
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be defined");
    this.client = createClient(url, key);
    return this.client;
  }

  async upload(expenseId: string, buffer: Buffer, mime: string, ext: string): Promise<string> {
    const supabase = this.getClient();
    const key = `expenses/${expenseId}/${randomUUID()}.${ext}`;
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(key, buffer, { contentType: mime, upsert: false });
    if (error) throw new Error(`Storage upload failed: ${error.message}`);
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(key);
    return data.publicUrl;
  }

  async delete(url: string): Promise<void> {
    const supabase = this.getClient();
    const marker = `/${BUCKET}/`;
    const idx = url.indexOf(marker);
    if (idx === -1) return;
    const key = url.slice(idx + marker.length);
    await supabase.storage.from(BUCKET).remove([key]);
  }
}
