import { prisma } from "@/shared/infrastructure/prisma/client";
import { PrismaExpenseRepository } from "@/modules/expenses/infrastructure/repositories/PrismaExpenseRepository";
import { SupabaseExpensePhotoStorage } from "@/modules/expenses/infrastructure/services/SupabaseExpensePhotoStorage";
import { ListExpensesUseCase } from "@/modules/expenses/application/use-cases/ListExpensesUseCase";
import { GetExpenseUseCase } from "@/modules/expenses/application/use-cases/GetExpenseUseCase";
import { CreateExpenseUseCase } from "@/modules/expenses/application/use-cases/CreateExpenseUseCase";
import { UpdateExpenseUseCase } from "@/modules/expenses/application/use-cases/UpdateExpenseUseCase";
import { SoftDeleteExpenseUseCase } from "@/modules/expenses/application/use-cases/SoftDeleteExpenseUseCase";
import { UploadExpensePhotoUseCase } from "@/modules/expenses/application/use-cases/UploadExpensePhotoUseCase";
import { DeleteExpensePhotoUseCase } from "@/modules/expenses/application/use-cases/DeleteExpensePhotoUseCase";
import { GetExpensesReportUseCase } from "@/modules/expenses/application/use-cases/GetExpensesReportUseCase";
import { ExpensesController } from "@/modules/expenses/infrastructure/http/ExpensesController";
import { rbacContainer } from "@/modules/rbac/infrastructure/di/container";
import { PrismaTicketSettingsRepository } from "@/modules/settings/infrastructure/repositories/PrismaTicketSettingsRepository";
import { GetTicketSettingsUseCase } from "@/modules/settings/application/use-cases/GetTicketSettingsUseCase";

const expenseRepo = new PrismaExpenseRepository(prisma);
const photoStorage = new SupabaseExpensePhotoStorage();
const ticketSettingsRepo = new PrismaTicketSettingsRepository(prisma);

export const expensesController = new ExpensesController(
  new ListExpensesUseCase(expenseRepo),
  new GetExpenseUseCase(expenseRepo),
  new CreateExpenseUseCase(expenseRepo),
  new UpdateExpenseUseCase(expenseRepo),
  new SoftDeleteExpenseUseCase(expenseRepo),
  new UploadExpensePhotoUseCase(expenseRepo, photoStorage),
  new DeleteExpensePhotoUseCase(expenseRepo, photoStorage),
  new GetExpensesReportUseCase(expenseRepo),
  rbacContainer.authorizationService,
  new GetTicketSettingsUseCase(ticketSettingsRepo)
);
