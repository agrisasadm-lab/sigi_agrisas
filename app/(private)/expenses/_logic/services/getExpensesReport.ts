import { authFetch, NetworkError, UnauthenticatedError, ForbiddenError } from "../../../../_lib/authFetch";
import type { ExpensesReportDto } from "../types/api";
import type { ExpenseFilters } from "../types/domain";
import { ReportTooLargeError } from "../errors";

function buildParams(format: "json" | "pdf" | "xlsx", filters: ExpenseFilters, extra?: { page?: number; pageSize?: number }): URLSearchParams {
  const params = new URLSearchParams({ format });
  if (extra?.page) params.set("page", String(extra.page));
  if (extra?.pageSize) params.set("pageSize", String(extra.pageSize));
  if (filters.branchId) params.set("branchId", filters.branchId);
  if (filters.concept) params.set("concept", filters.concept);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.includeInactive) params.set("includeInactive", "true");
  return params;
}

async function handleTooLarge(res: Response): Promise<void> {
  if (res.status === 409) {
    const data = (await res.json()) as { error: string };
    if (data.error === "ReportTooLarge") throw new ReportTooLargeError();
  }
}

export async function getExpensesReport(
  filters: ExpenseFilters & { page?: number; pageSize?: number; signal?: AbortSignal },
  fetchImpl = authFetch
): Promise<ExpensesReportDto> {
  const { page, pageSize, signal, ...rest } = filters;
  const params = buildParams("json", rest, { page, pageSize });

  let res: Response;
  try {
    res = await fetchImpl(`/api/v1/admin/expenses/report?${params.toString()}`, { signal });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") throw err;
    if (err instanceof NetworkError || err instanceof UnauthenticatedError || err instanceof ForbiddenError) throw err;
    throw new NetworkError();
  }

  await handleTooLarge(res);
  if (!res.ok) throw new NetworkError();
  return res.json() as Promise<ExpensesReportDto>;
}

export async function downloadExpensesReportPdf(filters: ExpenseFilters, fetchImpl = authFetch): Promise<Blob> {
  const params = buildParams("pdf", filters);
  let res: Response;
  try {
    res = await fetchImpl(`/api/v1/admin/expenses/report?${params.toString()}`);
  } catch (err) {
    if (err instanceof NetworkError || err instanceof UnauthenticatedError || err instanceof ForbiddenError) throw err;
    throw new NetworkError();
  }
  await handleTooLarge(res);
  if (!res.ok) throw new NetworkError();
  return res.blob();
}

export async function downloadExpensesReportXlsx(filters: ExpenseFilters, fetchImpl = authFetch): Promise<Blob> {
  const params = buildParams("xlsx", filters);
  let res: Response;
  try {
    res = await fetchImpl(`/api/v1/admin/expenses/report?${params.toString()}`);
  } catch (err) {
    if (err instanceof NetworkError || err instanceof UnauthenticatedError || err instanceof ForbiddenError) throw err;
    throw new NetworkError();
  }
  await handleTooLarge(res);
  if (!res.ok) throw new NetworkError();
  return res.blob();
}
