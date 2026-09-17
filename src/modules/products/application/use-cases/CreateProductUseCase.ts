import { ProductRepository } from "../ports/ProductRepository";
import { DepartmentRepository } from "@/modules/departments/application/ports/DepartmentRepository";
import { TaxRateRepository } from "@/modules/tax-rates/application/ports/TaxRateRepository";
import { BranchInventoryRepository } from "@/modules/inventory/application/ports/BranchInventoryRepository";
import { CreateProductRequest } from "../dto/CreateProductRequest";
import { ProductDto } from "../dto/ProductDto";
import { toProductDto } from "../mappers/toProductDto";
import { ProductDepartmentNotFoundError } from "../../domain/errors/ProductDepartmentNotFoundError";
import { ProductTaxRateNotFoundError } from "../../domain/errors/ProductTaxRateNotFoundError";

export class CreateProductUseCase {
  constructor(
    private readonly repo: ProductRepository,
    private readonly departmentRepo: DepartmentRepository,
    private readonly taxRateRepo?: TaxRateRepository,
    private readonly branchInventoryRepo?: BranchInventoryRepository
  ) {}

  async execute(req: CreateProductRequest, autoAssignBranchId?: string): Promise<ProductDto> {
    const department = await this.departmentRepo.findById(req.departmentId);
    if (!department || !department.isActive) {
      throw new ProductDepartmentNotFoundError(req.departmentId);
    }
    if (req.taxRateId && this.taxRateRepo) {
      const taxRate = await this.taxRateRepo.findById(req.taxRateId);
      if (!taxRate || !taxRate.isActive) throw new ProductTaxRateNotFoundError(req.taxRateId);
    }
    const created = await this.repo.create(req);
    if (autoAssignBranchId && this.branchInventoryRepo) {
      try {
        await this.branchInventoryRepo.create({ branchId: autoAssignBranchId, productId: created.product.id });
      } catch (err) {
        console.error("[CreateProductUseCase] auto-assign to branch failed", err);
      }
    }
    return toProductDto(created);
  }
}
