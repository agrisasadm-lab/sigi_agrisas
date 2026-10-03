import { NextRequest } from "next/server";
import { requirePermission } from "@/modules/rbac/infrastructure/http/requirePermission";
import { expensesController } from "@/modules/expenses/infrastructure/di/container";

export async function GET(req: NextRequest) {
  const guard = await requirePermission(req, "expenses:report_read");
  if (guard) return guard;
  return expensesController.report(req);
}
