import { CustomerRepository } from "../ports/CustomerRepository";
import { UpdateCustomerRequest } from "../dto/UpdateCustomerRequest";
import { CustomerDto } from "../dto/CustomerDto";
import { toCustomerDto } from "../mappers/toCustomerDto";
import { CustomerBranchNotFoundError } from "../../domain/errors/CustomerBranchNotFoundError";
import { BranchActiveLookup } from "./CreateCustomerUseCase";

export class UpdateCustomerUseCase {
  constructor(
    private readonly repo: CustomerRepository,
    private readonly branchRepo?: BranchActiveLookup
  ) {}

  async execute(id: string, req: UpdateCustomerRequest): Promise<CustomerDto> {
    if (this.branchRepo && req.branchIds !== undefined) {
      for (const branchId of req.branchIds) {
        const branch = await this.branchRepo.findById(branchId);
        if (!branch || !branch.isActive) throw new CustomerBranchNotFoundError(branchId);
      }
    }
    const c = await this.repo.update(id, req);
    return toCustomerDto(c);
  }
}
