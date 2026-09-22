import { InMemoryCustomerRepository } from "@/modules/customers/infrastructure/repositories/InMemoryCustomerRepository";
import { ListCustomersUseCase } from "@/modules/customers/application/use-cases/ListCustomersUseCase";
import { GetCustomerUseCase } from "@/modules/customers/application/use-cases/GetCustomerUseCase";
import { CreateCustomerUseCase } from "@/modules/customers/application/use-cases/CreateCustomerUseCase";
import { UpdateCustomerUseCase } from "@/modules/customers/application/use-cases/UpdateCustomerUseCase";
import { SoftDeleteCustomerUseCase } from "@/modules/customers/application/use-cases/SoftDeleteCustomerUseCase";
import { CustomerNotFoundError } from "@/modules/customers/domain/errors/CustomerNotFoundError";
import { CustomerCodeAlreadyInUseError } from "@/modules/customers/domain/errors/CustomerCodeAlreadyInUseError";
import { CustomerRfcAlreadyInUseError } from "@/modules/customers/domain/errors/CustomerRfcAlreadyInUseError";

describe("Customers use cases", () => {
  let repo: InMemoryCustomerRepository;

  beforeEach(() => {
    repo = new InMemoryCustomerRepository();
    repo.reset();
  });

  it("crea y lista clientes", async () => {
    await new CreateCustomerUseCase(repo).execute({
      branchIds: ["branch-a"],
      code: "CLI_001",
      name: "Acme",
      rfc: "ACM010101AAA",
    });
    const list = await new ListCustomersUseCase(repo).execute({
      page: 1,
      pageSize: 20,
      includeInactive: false,
    });
    expect(list.total).toBe(1);
    expect(list.items[0].currentBalance).toBe(0);
  });

  it("rechaza código duplicado", async () => {
    await new CreateCustomerUseCase(repo).execute({
      branchIds: ["branch-a"],
      code: "CLI_001",
      name: "A",
      rfc: "ACM010101AAA",
    });
    await expect(
      new CreateCustomerUseCase(repo).execute({
      branchIds: ["branch-a"],
        code: "CLI_001",
        name: "B",
        rfc: "BBB010101AAA",
      })
    ).rejects.toThrow(CustomerCodeAlreadyInUseError);
  });

  it("rechaza RFC duplicado", async () => {
    await new CreateCustomerUseCase(repo).execute({
      branchIds: ["branch-a"],
      code: "CLI_001",
      name: "A",
      rfc: "ACM010101AAA",
    });
    await expect(
      new CreateCustomerUseCase(repo).execute({
      branchIds: ["branch-a"],
        code: "CLI_002",
        name: "B",
        rfc: "ACM010101AAA",
      })
    ).rejects.toThrow(CustomerRfcAlreadyInUseError);
  });

  it("get devuelve el cliente o lanza not found", async () => {
    const created = await new CreateCustomerUseCase(repo).execute({
      branchIds: ["branch-a"],
      code: "CLI_001",
      name: "Acme",
      rfc: "ACM010101AAA",
    });
    const fetched = await new GetCustomerUseCase(repo).execute(created.id);
    expect(fetched.id).toBe(created.id);
    await expect(new GetCustomerUseCase(repo).execute("missing")).rejects.toThrow(
      CustomerNotFoundError
    );
  });

  it("update no permite cambiar code (lo ignora)", async () => {
    const created = await new CreateCustomerUseCase(repo).execute({
      branchIds: ["branch-a"],
      code: "CLI_001",
      name: "Acme",
      rfc: "ACM010101AAA",
    });
    const updated = await new UpdateCustomerUseCase(repo).execute(created.id, {
      name: "Nuevo nombre",
    });
    expect(updated.code).toBe("CLI_001");
    expect(updated.name).toBe("Nuevo nombre");
  });

  it("update con creditLimit nulo lo limpia", async () => {
    const created = await new CreateCustomerUseCase(repo).execute({
      branchIds: ["branch-a"],
      code: "CLI_001",
      name: "A",
      rfc: "ACM010101AAA",
      creditLimit: 5000,
    });
    expect(created.creditLimit).toBe(5000);
    const updated = await new UpdateCustomerUseCase(repo).execute(created.id, {
      creditLimit: null,
    });
    expect(updated.creditLimit).toBeNull();
  });

  it("crea sin creditDays y aplica default 30", async () => {
    const created = await new CreateCustomerUseCase(repo).execute({
      branchIds: ["branch-a"],
      code: "CLI_001",
      name: "Acme",
      rfc: "ACM010101AAA",
    });
    expect(created.creditDays).toBe(30);
  });

  it("crea con creditDays custom y lo persiste", async () => {
    const created = await new CreateCustomerUseCase(repo).execute({
      branchIds: ["branch-a"],
      code: "CLI_001",
      name: "Acme",
      rfc: "ACM010101AAA",
      creditDays: 45,
    });
    expect(created.creditDays).toBe(45);
  });

  it("update con creditDays como único campo persiste el nuevo valor", async () => {
    const created = await new CreateCustomerUseCase(repo).execute({
      branchIds: ["branch-a"],
      code: "CLI_001",
      name: "Acme",
      rfc: "ACM010101AAA",
    });
    const updated = await new UpdateCustomerUseCase(repo).execute(created.id, {
      creditDays: 60,
    });
    expect(updated.creditDays).toBe(60);
  });

  it("crea sin dirección estructurada y aplica default addressCountry=MEX", async () => {
    const created = await new CreateCustomerUseCase(repo).execute({
      branchIds: ["branch-a"],
      code: "CLI_001",
      name: "Acme",
      rfc: "ACM010101AAA",
    });
    expect(created.addressStreet).toBeNull();
    expect(created.addressZipCode).toBeNull();
    expect(created.addressCountry).toBe("MEX");
  });

  it("crea con dirección estructurada completa y la persiste", async () => {
    const created = await new CreateCustomerUseCase(repo).execute({
      branchIds: ["branch-a"],
      code: "CLI_001",
      name: "Acme",
      rfc: "ACM010101AAA",
      addressStreet: "Av. Reforma",
      addressExteriorNumber: "123",
      addressInteriorNumber: "4B",
      addressNeighborhood: "Centro",
      addressMunicipality: "Cuauhtémoc",
      addressState: "CMX",
      addressCountry: "MEX",
      addressZipCode: "06000",
    });
    expect(created.addressStreet).toBe("Av. Reforma");
    expect(created.addressExteriorNumber).toBe("123");
    expect(created.addressInteriorNumber).toBe("4B");
    expect(created.addressNeighborhood).toBe("Centro");
    expect(created.addressMunicipality).toBe("Cuauhtémoc");
    expect(created.addressState).toBe("CMX");
    expect(created.addressCountry).toBe("MEX");
    expect(created.addressZipCode).toBe("06000");
  });

  it("update de un solo campo de dirección no toca los demás", async () => {
    const created = await new CreateCustomerUseCase(repo).execute({
      branchIds: ["branch-a"],
      code: "CLI_001",
      name: "Acme",
      rfc: "ACM010101AAA",
      addressStreet: "Av. Reforma",
      addressZipCode: "06000",
    });
    const updated = await new UpdateCustomerUseCase(repo).execute(created.id, {
      addressZipCode: "06010",
    });
    expect(updated.addressStreet).toBe("Av. Reforma");
    expect(updated.addressZipCode).toBe("06010");
  });

  it("update con addressStreet nulo lo limpia", async () => {
    const created = await new CreateCustomerUseCase(repo).execute({
      branchIds: ["branch-a"],
      code: "CLI_001",
      name: "Acme",
      rfc: "ACM010101AAA",
      addressStreet: "Av. Reforma",
    });
    const updated = await new UpdateCustomerUseCase(repo).execute(created.id, {
      addressStreet: null,
    });
    expect(updated.addressStreet).toBeNull();
  });

  it("crea sin rfc y permite un segundo cliente sin rfc", async () => {
    const a = await new CreateCustomerUseCase(repo).execute({
      branchIds: ["branch-a"], code: "CLI_001", name: "A" });
    const b = await new CreateCustomerUseCase(repo).execute({
      branchIds: ["branch-a"], code: "CLI_002", name: "B" });
    expect(a.rfc).toBeNull();
    expect(b.rfc).toBeNull();
  });

  it("crea con initialBalance y fija currentBalance al mismo valor", async () => {
    const created = await new CreateCustomerUseCase(repo).execute({
      branchIds: ["branch-a"],
      code: "CLI_001",
      name: "Acme",
      rfc: "ACM010101AAA",
      initialBalance: 1000,
    });
    expect(created.initialBalance).toBe(1000);
    expect(created.currentBalance).toBe(1000);
  });

  it("update de initialBalance ajusta currentBalance por delta, sin resetearlo", async () => {
    const created = await new CreateCustomerUseCase(repo).execute({
      branchIds: ["branch-a"],
      code: "CLI_001",
      name: "Acme",
      rfc: "ACM010101AAA",
      initialBalance: 1000,
    });
    // Simula que currentBalance ya divergió de initialBalance (p. ej. por un abono de 300).
    (repo as unknown as { store: { currentBalance: number }[] }).store[0].currentBalance = 700;

    const updated = await new UpdateCustomerUseCase(repo).execute(created.id, {
      initialBalance: 1300,
    });
    expect(updated.initialBalance).toBe(1300);
    // delta = 1300 - 1000 = 300 → currentBalance = 700 + 300 = 1000 (no se resetea a 1300)
    expect(updated.currentBalance).toBe(1000);
  });

  it("softDelete marca isActive=false", async () => {
    const created = await new CreateCustomerUseCase(repo).execute({
      branchIds: ["branch-a"],
      code: "CLI_001",
      name: "A",
      rfc: "ACM010101AAA",
    });
    await new SoftDeleteCustomerUseCase(repo).execute(created.id);
    const fetched = await new GetCustomerUseCase(repo).execute(created.id);
    expect(fetched.isActive).toBe(false);
  });
});
