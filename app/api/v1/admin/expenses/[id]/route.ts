import { NextRequest } from "next/server";
import { requirePermission } from "@/modules/rbac/infrastructure/http/requirePermission";
import { expensesController } from "@/modules/expenses/infrastructure/di/container";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requirePermission(req, "expenses:read");
  if (guard) return guard;
  return expensesController.getById(req, params.id);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requirePermission(req, "expenses:write");
  if (guard) return guard;
  return expensesController.update(req, params.id);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requirePermission(req, "expenses:write");
  if (guard) return guard;
  return expensesController.softDelete(req, params.id);
}
