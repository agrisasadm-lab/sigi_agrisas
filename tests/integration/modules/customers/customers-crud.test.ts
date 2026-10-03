import { prisma } from "@/shared/infrastructure/prisma/client";
import { PrismaBranchRepository } from "@/modules/branches/infrastructure/repositories/PrismaBranchRepository";
import { PrismaCustomerRepository } from "@/modules/customers/infrastructure/repositories/PrismaCustomerRepository";
import { ListCustomersUseCase } from "@/modules/customers/application/use-cases/ListCustomersUseCase";
import { GetCustomerUseCase } from "@/modules/customers/application/use-cases/GetCustomerUseCase";
import { CreateCustomerUseCase } from "@/modules/customers/application/use-cases/CreateCustomerUseCase";
import { UpdateCustomerUseCase } from "@/modules/customers/application/use-cases/UpdateCustomerUseCase";
import { SoftDeleteCustomerUseCase } from "@/modules/customers/application/use-cases/SoftDeleteCustomerUseCase";
import { CustomerNotFoundError } from "@/modules/customers/domain/errors/CustomerNotFoundError";
import { CustomerCodeAlreadyInUseError } from "@/modules/customers/domain/errors/CustomerCodeAlreadyInUseError";
import { CustomerRfcAlreadyInUseError } from "@/modules/customers/domain/errors/CustomerRfcAlreadyInUseError";

const PREFIX = "CUSTINT_";
const TEST_CODE = `${PREFIX}CLI001`;
const TEST_RFC = "XAX010101001";
const TEST_RFC_2 = "XAX020202002";

async function cleanup() {
  await prisma.customer.deleteMany({ where: { code: { startsWith: PREFIX } } });
  await prisma.branch.deleteMany({ where: { code: { startsWith: PREFIX } } });
}

afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

describe("Customers CRUD — integration (real DB)", () => {
  const repo = new PrismaCustomerRepository(prisma);
  const branchRepo = new PrismaBranchRepository(prisma);
  const listUseCase = new ListCustomersUseCase(repo);
  const getUseCase = new GetCustomerUseCase(repo);
  const createUseCase = new CreateCustomerUseCase(repo);
  const updateUseCase = new UpdateCustomerUseCase(repo);
  const softDeleteUseCase = new SoftDeleteCustomerUseCase(repo);

  let createdId: string;
  let branchId: string;

  beforeAll(async () => {
    await cleanup();
    const branch = await branchRepo.create({ code: `${PREFIX}BR1`, name: "Sucursal Integración" });
    branchId = branch.id;
  });

  it("crea un cliente con campos mínimos; currentBalance=0", async () => {
    const result = await createUseCase.execute({
      code: TEST_CODE,
      name: "Cliente Integración",
      rfc: TEST_RFC,
      branchIds: [branchId],
    });
    createdId = result.id;
    expect(result.code).toBe(TEST_CODE);
    expect(result.rfc).toBe(TEST_RFC);
    expect(result.currentBalance).toBe(0);
    expect(result.isActive).toBe(true);
    expect(result.creditLimit).toBeNull();
    expect(result.creditDays).toBe(30);
  });

  it("obtiene el cliente por ID", async () => {
    const result = await getUseCase.execute(createdId);
    expect(result.id).toBe(createdId);
    expect(result.code).toBe(TEST_CODE);
  });

  it("lista clientes activos; encuentra el creado", async () => {
    const result = await listUseCase.execute({ page: 1, pageSize: 20, includeInactive: false });
    const found = result.items.find((c) => c.id === createdId);
    expect(found).toBeDefined();
  });

  it("búsqueda por nombre funciona (ILIKE)", async () => {
    const result = await listUseCase.execute({ page: 1, pageSize: 20, includeInactive: false, search: "integ" });
    const found = result.items.find((c) => c.id === createdId);
    expect(found).toBeDefined();
  });

  it("búsqueda por RFC funciona", async () => {
    const result = await listUseCase.execute({ page: 1, pageSize: 20, includeInactive: false, search: TEST_RFC.slice(0, 5) });
    const found = result.items.find((c) => c.id === createdId);
    expect(found).toBeDefined();
  });

  it("actualiza nombre y creditLimit", async () => {
    const result = await updateUseCase.execute(createdId, {
      name: "Cliente Actualizado",
      creditLimit: 50000,
    });
    expect(result.name).toBe("Cliente Actualizado");
    expect(result.creditLimit).toBe(50000);
    expect(result.currentBalance).toBe(0);
  });

  it("code no cambia con update (campo ignorado)", async () => {
    const result = await updateUseCase.execute(createdId, { name: "Nombre Nuevo" });
    expect(result.code).toBe(TEST_CODE);
  });

  it("rfc duplicado en update → CustomerRfcAlreadyInUseError", async () => {
    const second = await createUseCase.execute({
      code: `${PREFIX}CLI002`,
      name: "Cliente Dos",
      rfc: TEST_RFC_2,
      branchIds: [branchId],
    });
    await expect(
      updateUseCase.execute(second.id, { rfc: TEST_RFC })
    ).rejects.toThrow(CustomerRfcAlreadyInUseError);
  });

  it("code duplicado en create → CustomerCodeAlreadyInUseError", async () => {
    await expect(
      createUseCase.execute({ code: TEST_CODE, name: "Duplicado", rfc: "DUP010101001", branchIds: [branchId] })
    ).rejects.toThrow(CustomerCodeAlreadyInUseError);
  });

  it("soft delete marca isActive=false sin borrar la fila", async () => {
    await softDeleteUseCase.execute(createdId);
    const row = await prisma.customer.findUnique({ where: { id: createdId } });
    expect(row).not.toBeNull();
    expect(row!.isActive).toBe(false);
  });

  it("cliente inactivo NO aparece en listado por defecto", async () => {
    const result = await listUseCase.execute({ page: 1, pageSize: 100, includeInactive: false });
    expect(result.items.find((c) => c.id === createdId)).toBeUndefined();
  });

  it("cliente inactivo SÍ aparece con includeInactive=true", async () => {
    const result = await listUseCase.execute({ page: 1, pageSize: 100, includeInactive: true });
    const found = result.items.find((c) => c.id === createdId);
    expect(found).toBeDefined();
    expect(found!.isActive).toBe(false);
  });

  it("reactivación vía update: isActive=true", async () => {
    const result = await updateUseCase.execute(createdId, { isActive: true });
    expect(result.isActive).toBe(true);
  });

  it("not found lanza CustomerNotFoundError", async () => {
    await expect(getUseCase.execute("00000000-0000-0000-0000-000000000000")).rejects.toThrow(CustomerNotFoundError);
  });
});
