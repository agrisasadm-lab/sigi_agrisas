import { CustomerRepository } from "../ports/CustomerRepository";
import { CreateCustomerRequest } from "../dto/CreateCustomerRequest";
import { CustomerDto } from "../dto/CustomerDto";
import { toCustomerDto } from "../mappers/toCustomerDto";
import { CustomerBranchNotFoundError } from "../../domain/errors/CustomerBranchNotFoundError";

/** Minimal branch lookup this use case needs — avoids depending on the full BranchRepository port. */
export interface BranchActiveLookup {
  findById(id: string): Promise<{ isActive: boolean } | null>;
}

export class CreateCustomerUseCase {
  constructor(
    private readonly repo: CustomerRepository,
    private readonly branchRepo?: BranchActiveLookup
  ) {}

  async execute(req: CreateCustomerRequest): Promise<CustomerDto> {
    if (this.branchRepo) {
      for (const branchId of req.branchIds) {
        const branch = await this.branchRepo.findById(branchId);
        if (!branch || !branch.isActive) throw new CustomerBranchNotFoundError(branchId);
      }
    }

    const c = await this.repo.create({
      code: req.code,
      name: req.name,
      rfc: req.rfc,
      legalName: req.legalName ?? null,
      taxRegime: req.taxRegime ?? null,
      cfdiUse: req.cfdiUse ?? null,
      taxZipCode: req.taxZipCode ?? null,
      email: req.email ?? null,
      phone: req.phone ?? null,
      address: req.address ?? null,
      contactName: req.contactName ?? null,
      notes: req.notes ?? null,
      creditLimit: req.creditLimit ?? null,
      initialBalance: req.initialBalance ?? 0,
      creditDays: req.creditDays ?? 30,
      isActive: req.isActive ?? true,
      addressStreet: req.addressStreet ?? null,
      addressExteriorNumber: req.addressExteriorNumber ?? null,
      addressInteriorNumber: req.addressInteriorNumber ?? null,
      addressNeighborhood: req.addressNeighborhood ?? null,
      addressMunicipality: req.addressMunicipality ?? null,
      addressState: req.addressState ?? null,
      addressCountry: req.addressCountry ?? "MEX",
      addressZipCode: req.addressZipCode ?? null,
      branchIds: req.branchIds,
    });
    return toCustomerDto(c);
  }
}
