import { NextRequest } from "next/server";
import { requirePermission } from "@/modules/rbac/infrastructure/http/requirePermission";
import { expensesController } from "@/modules/expenses/infrastructure/di/container";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requirePermission(req, "expenses:write");
  if (guard) return guard;
  return expensesController.uploadPhoto(req, params.id);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requirePermission(req, "expenses:write");
  if (guard) return guard;
  return expensesController.deletePhoto(req, params.id);
}
