import { prisma } from "@/shared/infrastructure/prisma/client";
import { PrismaCustomerRepository } from "@/modules/customers/infrastructure/repositories/PrismaCustomerRepository";
import { ListCustomersUseCase } from "@/modules/customers/application/use-cases/ListCustomersUseCase";
import { GetCustomerUseCase } from "@/modules/customers/application/use-cases/GetCustomerUseCase";
import { CreateCustomerUseCase } from "@/modules/customers/application/use-cases/CreateCustomerUseCase";
import { UpdateCustomerUseCase } from "@/modules/customers/application/use-cases/UpdateCustomerUseCase";
import { SoftDeleteCustomerUseCase } from "@/modules/customers/application/use-cases/SoftDeleteCustomerUseCase";
import { CustomersController } from "@/modules/customers/infrastructure/http/CustomersController";
import { rbacContainer } from "@/modules/rbac/infrastructure/di/container";
import { branchRepo } from "@/modules/branches/infrastructure/di/container";

const customerRepo = new PrismaCustomerRepository(prisma);

const listCustomersUseCase = new ListCustomersUseCase(customerRepo);
const getCustomerUseCase = new GetCustomerUseCase(customerRepo);
const createCustomerUseCase = new CreateCustomerUseCase(customerRepo, branchRepo);
const updateCustomerUseCase = new UpdateCustomerUseCase(customerRepo, branchRepo);
const softDeleteCustomerUseCase = new SoftDeleteCustomerUseCase(customerRepo);

export const customersController = new CustomersController(
  listCustomersUseCase,
  getCustomerUseCase,
  createCustomerUseCase,
  updateCustomerUseCase,
  softDeleteCustomerUseCase,
  rbacContainer.authorizationService
);

export { customerRepo };
