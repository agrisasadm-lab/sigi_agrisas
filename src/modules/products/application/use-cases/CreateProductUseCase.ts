import { ProductRepository } from "../ports/ProductRepository";
import { DepartmentRepository } from "@/modules/departments/application/ports/DepartmentRepository";
import { TaxRateRepository } from "@/modules/tax-rates/application/ports/TaxRateRepository";
import { BranchInventoryRepository } from "@/modules/inventory/application/ports/BranchInventoryRepository";
import { BranchRepository } from "@/modules/branches/application/ports/BranchRepository";
import { CreateProductRequest } from "../dto/CreateProductRequest";
import { ProductDto } from "../dto/ProductDto";
import { toProductDto } from "../mappers/toProductDto";
import { ProductDepartmentNotFoundError } from "../../domain/errors/ProductDepartmentNotFoundError";
import { ProductTaxRateNotFoundError } from "../../domain/errors/ProductTaxRateNotFoundError";
import { isBranchScopedInventory } from "@/shared/infrastructure/config/inventoryScope";

export interface CreateProductResult extends ProductDto {
  autoAssignedBranchIds: string[];
}

export class CreateProductUseCase {
  constructor(
    private readonly repo: ProductRepository,
    private readonly departmentRepo: DepartmentRepository,
    private readonly taxRateRepo?: TaxRateRepository,
    private readonly branchInventoryRepo?: BranchInventoryRepository,
    private readonly branchRepo?: BranchRepository
  ) {}

  async execute(req: CreateProductRequest): Promise<CreateProductResult> {
    const department = await this.departmentRepo.findById(req.departmentId);
    if (!department || !department.isActive) {
      throw new ProductDepartmentNotFoundError(req.departmentId);
    }
    if (req.taxRateId && this.taxRateRepo) {
      const taxRate = await this.taxRateRepo.findById(req.taxRateId);
      if (!taxRate || !taxRate.isActive) throw new ProductTaxRateNotFoundError(req.taxRateId);
    }
    const created = await this.repo.create(req);
    const autoAssignedBranchIds = await this.autoAssignToActiveBranches(created.product.id);
    return { ...toProductDto(created), autoAssignedBranchIds };
  }

  private async autoAssignToActiveBranches(productId: string): Promise<string[]> {
    if (!isBranchScopedInventory() || !this.branchRepo || !this.branchInventoryRepo) return [];
    const { items: activeBranches } = await this.branchRepo.findAll({ page: 1, pageSize: 1000, includeInactive: false });
    const branchIds = activeBranches.map((b) => b.id);
    for (const branchId of branchIds) {
      try {
        await this.branchInventoryRepo.create({ branchId, productId });
      } catch (err) {
        console.error("[CreateProductUseCase] auto-assign to branch failed", { branchId, productId, err });
      }
    }
    return branchIds;
  }
}
