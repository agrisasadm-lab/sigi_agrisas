import { CreateProductUseCase } from "@/modules/products/application/use-cases/CreateProductUseCase";
import { InMemoryProductRepository } from "@/modules/products/infrastructure/repositories/InMemoryProductRepository";
import { InMemoryDepartmentRepository } from "@/modules/departments/infrastructure/repositories/InMemoryDepartmentRepository";
import { InMemoryTaxRateRepository } from "@/modules/tax-rates/infrastructure/repositories/InMemoryTaxRateRepository";
import { InMemoryBranchInventoryRepository } from "@/modules/inventory/infrastructure/repositories/InMemoryBranchInventoryRepository";
import { CreateTaxRateUseCase } from "@/modules/tax-rates/application/use-cases/CreateTaxRateUseCase";
import { DeactivateTaxRateUseCase } from "@/modules/tax-rates/application/use-cases/DeactivateTaxRateUseCase";
import { ProductCodeAlreadyInUseError } from "@/modules/products/domain/errors/ProductCodeAlreadyInUseError";
import { ProductDepartmentNotFoundError } from "@/modules/products/domain/errors/ProductDepartmentNotFoundError";
import { ProductTaxRateNotFoundError } from "@/modules/products/domain/errors/ProductTaxRateNotFoundError";

describe("CreateProductUseCase", () => {
  let repo: InMemoryProductRepository;
  let deptRepo: InMemoryDepartmentRepository;
  let taxRateRepo: InMemoryTaxRateRepository;
  let useCase: CreateProductUseCase;
  let departmentId: string;

  beforeEach(async () => {
    repo = new InMemoryProductRepository();
    repo.reset();
    deptRepo = new InMemoryDepartmentRepository();
    const dept = await deptRepo.create({ code: "DEPT1", name: "Abarrotes" });
    departmentId = dept.id;
    taxRateRepo = new InMemoryTaxRateRepository();
    useCase = new CreateProductUseCase(repo, deptRepo, taxRateRepo);
  });

  it("creates a product with the minimum required fields", async () => {
    const result = await useCase.execute({ code: "ARROZ_001", name: "Arroz", unit: "kg", departmentId });
    expect(result.code).toBe("ARROZ_001");
    expect(result.satProductCode).toBeNull();
    expect(result.ivaRate).toBeNull();
    expect(result.iepsRate).toBeNull();
    expect(result.isActive).toBe(true);
  });

  it("creates a product with fiscal fields", async () => {
    const result = await useCase.execute({
      code: "TEQUILA_001",
      name: "Tequila",
      unit: "lt",
      departmentId,
      satProductCode: "50202306",
      ivaRate: 0.16,
      iepsRate: 0.53,
    });
    expect(result.satProductCode).toBe("50202306");
    expect(result.ivaRate).toBe(0.16);
    expect(result.iepsRate).toBe(0.53);
  });

  it("throws ProductCodeAlreadyInUseError on duplicate code", async () => {
    await useCase.execute({ code: "DUP", name: "A", unit: "kg", departmentId });
    await expect(useCase.execute({ code: "DUP", name: "B", unit: "kg", departmentId })).rejects.toThrow(
      ProductCodeAlreadyInUseError
    );
  });

  it("throws ProductDepartmentNotFoundError when department does not exist", async () => {
    await expect(
      useCase.execute({ code: "X1", name: "X", unit: "kg", departmentId: "00000000-0000-0000-0000-000000000000" })
    ).rejects.toThrow(ProductDepartmentNotFoundError);
  });

  it("rejects an inactive department", async () => {
    const dept = await deptRepo.create({ code: "OLD", name: "Viejo" });
    await deptRepo.softDelete(dept.id);
    await expect(
      useCase.execute({ code: "X2", name: "X", unit: "kg", departmentId: dept.id })
    ).rejects.toThrow(ProductDepartmentNotFoundError);
  });

  it("creates a product with a valid taxRateId", async () => {
    const taxRate = await new CreateTaxRateUseCase(taxRateRepo).execute({
      code: "IVA_16",
      name: "IVA 16%",
      satTaxCode: "002",
      factorType: "Tasa",
      displayValue: 16,
      rate: 0.16,
    });
    const result = await useCase.execute({
      code: "ARROZ_002",
      name: "Arroz",
      unit: "kg",
      departmentId,
      taxRateId: taxRate.id,
    });
    expect(result.taxRateId).toBe(taxRate.id);
  });

  it("throws ProductTaxRateNotFoundError when taxRateId does not exist", async () => {
    await expect(
      useCase.execute({
        code: "X3",
        name: "X",
        unit: "kg",
        departmentId,
        taxRateId: "00000000-0000-0000-0000-000000000000",
      })
    ).rejects.toThrow(ProductTaxRateNotFoundError);
  });

  it("throws ProductTaxRateNotFoundError when taxRateId is inactive", async () => {
    const taxRate = await new CreateTaxRateUseCase(taxRateRepo).execute({
      code: "IVA_0",
      name: "IVA 0%",
      satTaxCode: "002",
      factorType: "Tasa",
      displayValue: 0,
      rate: 0,
    });
    await new DeactivateTaxRateUseCase(taxRateRepo).execute(taxRate.id);
    await expect(
      useCase.execute({ code: "X4", name: "X", unit: "kg", departmentId, taxRateId: taxRate.id })
    ).rejects.toThrow(ProductTaxRateNotFoundError);
  });
});

describe("CreateProductUseCase — auto-assign a branch", () => {
  let repo: InMemoryProductRepository;
  let deptRepo: InMemoryDepartmentRepository;
  let branchInventoryRepo: InMemoryBranchInventoryRepository;
  let useCase: CreateProductUseCase;
  let departmentId: string;

  beforeEach(async () => {
    repo = new InMemoryProductRepository();
    repo.reset();
    deptRepo = new InMemoryDepartmentRepository();
    const dept = await deptRepo.create({ code: "DEPT1", name: "Abarrotes" });
    departmentId = dept.id;
    branchInventoryRepo = new InMemoryBranchInventoryRepository();
    branchInventoryRepo.reset();
    useCase = new CreateProductUseCase(repo, deptRepo, undefined, branchInventoryRepo);
  });

  it("creates a branch_inventory row with quantity 0 when autoAssignBranchId is passed", async () => {
    const result = await useCase.execute(
      { code: "ARROZ_003", name: "Arroz", unit: "kg", departmentId },
      "B1"
    );
    const view = await branchInventoryRepo.findByBranchAndProduct("B1", result.id);
    expect(view).not.toBeNull();
    expect(view?.inventory.quantity).toBe(0);
  });

  it("does not create any inventory row when autoAssignBranchId is omitted", async () => {
    const result = await useCase.execute({ code: "ARROZ_004", name: "Arroz", unit: "kg", departmentId });
    const view = await branchInventoryRepo.findByBranchAndProduct("B1", result.id);
    expect(view).toBeNull();
  });

  it("still resolves with the created product when the auto-assign write fails (best-effort)", async () => {
    jest.spyOn(branchInventoryRepo, "create").mockRejectedValueOnce(new Error("db down"));
    const result = await useCase.execute(
      { code: "ARROZ_005", name: "Arroz", unit: "kg", departmentId },
      "B1"
    );
    expect(result.code).toBe("ARROZ_005");
  });
});
