import { CreateProductUseCase } from "@/modules/products/application/use-cases/CreateProductUseCase";
import { InMemoryProductRepository } from "@/modules/products/infrastructure/repositories/InMemoryProductRepository";
import { InMemoryDepartmentRepository } from "@/modules/departments/infrastructure/repositories/InMemoryDepartmentRepository";
import { InMemoryTaxRateRepository } from "@/modules/tax-rates/infrastructure/repositories/InMemoryTaxRateRepository";
import { InMemoryBranchInventoryRepository } from "@/modules/inventory/infrastructure/repositories/InMemoryBranchInventoryRepository";
import { InMemoryBranchRepository } from "@/modules/branches/infrastructure/repositories/InMemoryBranchRepository";
import { Branch } from "@/modules/branches/domain/entities/Branch";
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

function makeBranch(id: string, overrides: Partial<{ isActive: boolean }> = {}): Branch {
  const now = new Date();
  return Branch.create(id, {
    code: id,
    name: `Branch ${id}`,
    address: null,
    phone: null,
    email: null,
    isHeadquarters: false,
    isActive: overrides.isActive ?? true,
    addressStreet: null,
    addressExteriorNumber: null,
    addressInteriorNumber: null,
    addressNeighborhood: null,
    addressMunicipality: null,
    addressState: null,
    addressCountry: null,
    addressZipCode: null,
    createdAt: now,
    updatedAt: now,
  });
}

describe("CreateProductUseCase — auto-assign to all active branches (scope mode branch)", () => {
  let repo: InMemoryProductRepository;
  let deptRepo: InMemoryDepartmentRepository;
  let branchInventoryRepo: InMemoryBranchInventoryRepository;
  let branchRepo: InMemoryBranchRepository;
  let useCase: CreateProductUseCase;
  let departmentId: string;
  const originalMode = process.env.INVENTORY_SCOPE_MODE;

  beforeEach(async () => {
    process.env.INVENTORY_SCOPE_MODE = "branch";
    repo = new InMemoryProductRepository();
    repo.reset();
    deptRepo = new InMemoryDepartmentRepository();
    const dept = await deptRepo.create({ code: "DEPT1", name: "Abarrotes" });
    departmentId = dept.id;
    branchInventoryRepo = new InMemoryBranchInventoryRepository();
    branchInventoryRepo.reset();
    branchRepo = new InMemoryBranchRepository();
    useCase = new CreateProductUseCase(repo, deptRepo, undefined, branchInventoryRepo, branchRepo);
  });

  afterEach(() => {
    if (originalMode === undefined) delete process.env.INVENTORY_SCOPE_MODE;
    else process.env.INVENTORY_SCOPE_MODE = originalMode;
  });

  it("creates a branch_inventory row with quantity 0 in every active branch", async () => {
    branchRepo.seed([makeBranch("B1"), makeBranch("B2")]);
    const result = await useCase.execute({ code: "ARROZ_003", name: "Arroz", unit: "kg", departmentId });
    expect(result.autoAssignedBranchIds.sort()).toEqual(["B1", "B2"]);
    const viewB1 = await branchInventoryRepo.findByBranchAndProduct("B1", result.id);
    const viewB2 = await branchInventoryRepo.findByBranchAndProduct("B2", result.id);
    expect(viewB1?.inventory.quantity).toBe(0);
    expect(viewB2?.inventory.quantity).toBe(0);
  });

  it("excludes inactive branches", async () => {
    branchRepo.seed([makeBranch("B1"), makeBranch("B3", { isActive: false })]);
    const result = await useCase.execute({ code: "ARROZ_004", name: "Arroz", unit: "kg", departmentId });
    expect(result.autoAssignedBranchIds).toEqual(["B1"]);
    const view = await branchInventoryRepo.findByBranchAndProduct("B3", result.id);
    expect(view).toBeNull();
  });

  it("returns an empty list and creates no rows when there are no active branches", async () => {
    const result = await useCase.execute({ code: "ARROZ_005", name: "Arroz", unit: "kg", departmentId });
    expect(result.autoAssignedBranchIds).toEqual([]);
  });

  it("does not auto-assign in general scope mode", async () => {
    delete process.env.INVENTORY_SCOPE_MODE;
    branchRepo.seed([makeBranch("B1")]);
    const result = await useCase.execute({ code: "ARROZ_006", name: "Arroz", unit: "kg", departmentId });
    expect(result.autoAssignedBranchIds).toEqual([]);
    const view = await branchInventoryRepo.findByBranchAndProduct("B1", result.id);
    expect(view).toBeNull();
  });

  it("still resolves with the created product and assigns the remaining branches when one insert fails (best-effort)", async () => {
    branchRepo.seed([makeBranch("B1"), makeBranch("B2")]);
    jest.spyOn(branchInventoryRepo, "create").mockImplementationOnce(() => {
      throw new Error("db down");
    });
    const result = await useCase.execute({ code: "ARROZ_007", name: "Arroz", unit: "kg", departmentId });
    expect(result.code).toBe("ARROZ_007");
    expect(result.autoAssignedBranchIds.sort()).toEqual(["B1", "B2"]);
    const viewB2 = await branchInventoryRepo.findByBranchAndProduct("B2", result.id);
    expect(viewB2).not.toBeNull();
  });
});
