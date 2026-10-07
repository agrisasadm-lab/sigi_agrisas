import { prisma } from "@/shared/infrastructure/prisma/client";
import { RolePrismaRepository } from "@/modules/rbac/infrastructure/repositories/RolePrismaRepository";
import { PermissionPrismaRepository } from "@/modules/rbac/infrastructure/repositories/PermissionPrismaRepository";
import { UserRolePrismaRepository } from "@/modules/rbac/infrastructure/repositories/UserRolePrismaRepository";
import { RolePermissionPrismaRepository } from "@/modules/rbac/infrastructure/repositories/RolePermissionPrismaRepository";
import { PrismaAuthorizationService } from "@/modules/rbac/infrastructure/services/PrismaAuthorizationService";
import { PrismaRoleAssigner } from "@/modules/rbac/infrastructure/services/PrismaRoleAssigner";
import { AssignRoleToUserUseCase } from "@/modules/rbac/application/use-cases/AssignRoleToUserUseCase";
import { RevokeRoleFromUserUseCase } from "@/modules/rbac/application/use-cases/RevokeRoleFromUserUseCase";
import { GrantPermissionToRoleUseCase } from "@/modules/rbac/application/use-cases/GrantPermissionToRoleUseCase";
import { RevokePermissionFromRoleUseCase } from "@/modules/rbac/application/use-cases/RevokePermissionFromRoleUseCase";
import { ListUserPermissionsUseCase } from "@/modules/rbac/application/use-cases/ListUserPermissionsUseCase";
import { ListRolesUseCase } from "@/modules/rbac/application/use-cases/ListRolesUseCase";
import { CreateRoleUseCase } from "@/modules/rbac/application/use-cases/CreateRoleUseCase";
import { ListPermissionsUseCase } from "@/modules/rbac/application/use-cases/ListPermissionsUseCase";
import { CheckUserPermissionUseCase } from "@/modules/rbac/application/use-cases/CheckUserPermissionUseCase";
import { RbacController } from "@/modules/rbac/infrastructure/http/RbacController";

const roleRepo = new RolePrismaRepository(prisma);
const permissionRepo = new PermissionPrismaRepository(prisma);
const userRoleRepo = new UserRolePrismaRepository(prisma);
const rolePermissionRepo = new RolePermissionPrismaRepository(prisma);

const authorizationService = new PrismaAuthorizationService(prisma, userRoleRepo);
const roleAssigner = new PrismaRoleAssigner(prisma);

const assignRoleToUser = new AssignRoleToUserUseCase(roleRepo, userRoleRepo, authorizationService);
const revokeRoleFromUser = new RevokeRoleFromUserUseCase(roleRepo, userRoleRepo, authorizationService);
const grantPermissionToRole = new GrantPermissionToRoleUseCase(roleRepo, permissionRepo, rolePermissionRepo, authorizationService);
const revokePermissionFromRole = new RevokePermissionFromRoleUseCase(roleRepo, permissionRepo, rolePermissionRepo, authorizationService);
const listUserPermissions = new ListUserPermissionsUseCase(authorizationService);
const listRoles = new ListRolesUseCase(roleRepo);
const createRole = new CreateRoleUseCase(roleRepo);
const listPermissions = new ListPermissionsUseCase(permissionRepo);
const checkUserPermission = new CheckUserPermissionUseCase(authorizationService);

export const rbacController = new RbacController(
  listRoles,
  createRole,
  rolePermissionRepo,
  grantPermissionToRole,
  revokePermissionFromRole,
  listPermissions,
  assignRoleToUser,
  revokeRoleFromUser,
  listUserPermissions,
  checkUserPermission
);

export const rbacContainer = {
  authorizationService,
  roleAssigner,
  userRoleRepo,
};
