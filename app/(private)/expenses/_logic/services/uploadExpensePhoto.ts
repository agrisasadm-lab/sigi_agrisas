import { authFetch } from "../../../../_lib/authFetch";
import { ExpensePhotoTooLargeError, ExpensePhotoInvalidFormatError } from "../errors";

export async function uploadExpensePhoto(
  expenseId: string,
  file: File,
  fetchImpl: typeof authFetch = authFetch
): Promise<string> {
  const body = new FormData();
  body.append("file", file);

  const res = await fetchImpl(`/api/v1/admin/expenses/${expenseId}/photo`, {
    method: "POST",
    body,
  });

  if (res.status === 413) throw new ExpensePhotoTooLargeError();
  if (res.status === 400) {
    const data = await res.json().catch(() => ({}));
    if ((data as { error?: string }).error === "Invalid image format") throw new ExpensePhotoInvalidFormatError();
    throw new Error((data as { error?: string }).error ?? "Upload failed");
  }

  const { photoUrl } = (await res.json()) as { photoUrl: string };
  return photoUrl;
}
