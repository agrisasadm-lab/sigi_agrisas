import { NextRequest } from "next/server";
import { requirePermission } from "@/modules/rbac/infrastructure/http/requirePermission";
import { expensesController } from "@/modules/expenses/infrastructure/di/container";

export async function GET(req: NextRequest) {
  const guard = await requirePermission(req, "expenses:read");
  if (guard) return guard;
  return expensesController.list(req);
}

export async function POST(req: NextRequest) {
  const guard = await requirePermission(req, "expenses:write");
  if (guard) return guard;
  return expensesController.create(req);
}
