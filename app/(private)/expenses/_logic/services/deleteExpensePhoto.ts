import { authFetch } from "../../../../_lib/authFetch";

export async function deleteExpensePhoto(
  expenseId: string,
  fetchImpl: typeof authFetch = authFetch
): Promise<void> {
  const res = await fetchImpl(`/api/v1/admin/expenses/${expenseId}/photo`, { method: "DELETE" });
  if (!res.ok && res.status !== 204) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error ?? "Error al eliminar la fotografía.");
  }
}
