import { prisma } from "@/shared/infrastructure/prisma/client";
import { PrismaFolioRepository } from "@/modules/folios/infrastructure/repositories/PrismaFolioRepository";
import { ListFoliosUseCase } from "@/modules/folios/application/use-cases/ListFoliosUseCase";
import { GetFolioUseCase } from "@/modules/folios/application/use-cases/GetFolioUseCase";
import { CreateFolioUseCase } from "@/modules/folios/application/use-cases/CreateFolioUseCase";
import { UpdateFolioUseCase } from "@/modules/folios/application/use-cases/UpdateFolioUseCase";
import { SoftDeleteFolioUseCase } from "@/modules/folios/application/use-cases/SoftDeleteFolioUseCase";
import { AuditFolioSequenceUseCase } from "@/modules/folios/application/use-cases/AuditFolioSequenceUseCase";
import { FoliosController } from "@/modules/folios/infrastructure/http/FoliosController";
import { rbacContainer } from "@/modules/rbac/infrastructure/di/container";

const repo = new PrismaFolioRepository(prisma);

export const foliosController = new FoliosController(
  new ListFoliosUseCase(repo),
  new GetFolioUseCase(repo),
  new CreateFolioUseCase(repo),
  new UpdateFolioUseCase(repo),
  new SoftDeleteFolioUseCase(repo),
  new AuditFolioSequenceUseCase(repo),
  rbacContainer.authorizationService
);
