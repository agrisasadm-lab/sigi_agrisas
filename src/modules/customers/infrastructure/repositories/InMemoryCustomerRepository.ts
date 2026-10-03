import { randomUUID } from "crypto";
import {
  CustomerRepository,
  CreateCustomerData,
  UpdateCustomerData,
  FindAllOptions,
} from "../../application/ports/CustomerRepository";
import { Customer } from "../../domain/entities/Customer";
import { CustomerNotFoundError } from "../../domain/errors/CustomerNotFoundError";
import { CustomerCodeAlreadyInUseError } from "../../domain/errors/CustomerCodeAlreadyInUseError";
import { CustomerRfcAlreadyInUseError } from "../../domain/errors/CustomerRfcAlreadyInUseError";

function makeId(): string {
  return randomUUID();
}

export class InMemoryCustomerRepository implements CustomerRepository {
  private store: Customer[] = [];

  async findAll({ page, pageSize, includeInactive, search, branchId }: FindAllOptions): Promise<{ items: Customer[]; total: number }> {
    let items = includeInactive ? this.store : this.store.filter((c) => c.isActive);

    if (search) {
      const q = search.toLowerCase();
      items = items.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.legalName ?? "").toLowerCase().includes(q) ||
          (c.rfc ?? "").toLowerCase().includes(q)
      );
    }

    if (branchId) {
      items = items.filter((c) => c.branchIds.includes(branchId));
    }

    const total = items.length;
    const start = (page - 1) * pageSize;
    return { items: items.slice(start, start + pageSize), total };
  }

  async findById(id: string): Promise<Customer | null> {
    return this.store.find((c) => c.id === id) ?? null;
  }

  async create(data: CreateCustomerData): Promise<Customer> {
    if (this.store.some((c) => c.code === data.code)) {
      throw new CustomerCodeAlreadyInUseError(data.code);
    }
    if (data.rfc != null && this.store.some((c) => c.rfc === data.rfc)) {
      throw new CustomerRfcAlreadyInUseError(data.rfc);
    }

    const now = new Date();
    const customer = Customer.create({
      id: makeId(),
      code: data.code,
      name: data.name,
      rfc: data.rfc ?? null,
      legalName: data.legalName ?? null,
      taxRegime: data.taxRegime ?? null,
      cfdiUse: data.cfdiUse ?? null,
      taxZipCode: data.taxZipCode ?? null,
      email: data.email ?? null,
      phone: data.phone ?? null,
      address: data.address ?? null,
      contactName: data.contactName ?? null,
      notes: data.notes ?? null,
      creditLimit: data.creditLimit ?? null,
      currentBalance: data.initialBalance ?? 0,
      initialBalance: data.initialBalance ?? 0,
      creditDays: data.creditDays ?? 30,
      isActive: data.isActive ?? true,
      addressStreet: data.addressStreet ?? null,
      addressExteriorNumber: data.addressExteriorNumber ?? null,
      addressInteriorNumber: data.addressInteriorNumber ?? null,
      addressNeighborhood: data.addressNeighborhood ?? null,
      addressMunicipality: data.addressMunicipality ?? null,
      addressState: data.addressState ?? null,
      addressCountry: data.addressCountry ?? "MEX",
      addressZipCode: data.addressZipCode ?? null,
      branchIds: [...data.branchIds],
      createdAt: now,
      updatedAt: now,
    });

    this.store.push(customer);
    return customer;
  }

  async update(id: string, data: UpdateCustomerData): Promise<Customer> {
    const idx = this.store.findIndex((c) => c.id === id);
    if (idx === -1) throw new CustomerNotFoundError(id);

    if (data.rfc != null && this.store.some((c, i) => i !== idx && c.rfc === data.rfc)) {
      throw new CustomerRfcAlreadyInUseError(data.rfc);
    }

    const existing = this.store[idx];
    const newInitialBalance = data.initialBalance !== undefined ? data.initialBalance : existing.initialBalance;
    const balanceDelta = data.initialBalance !== undefined ? data.initialBalance - existing.initialBalance : 0;
    const updated = Customer.create({
      id: existing.id,
      code: existing.code,
      name: data.name ?? existing.name,
      rfc: "rfc" in data ? data.rfc ?? null : existing.rfc,
      legalName: "legalName" in data ? data.legalName ?? null : existing.legalName,
      taxRegime: "taxRegime" in data ? data.taxRegime ?? null : existing.taxRegime,
      cfdiUse: "cfdiUse" in data ? data.cfdiUse ?? null : existing.cfdiUse,
      taxZipCode: "taxZipCode" in data ? data.taxZipCode ?? null : existing.taxZipCode,
      email: "email" in data ? data.email ?? null : existing.email,
      phone: "phone" in data ? data.phone ?? null : existing.phone,
      address: "address" in data ? data.address ?? null : existing.address,
      contactName: "contactName" in data ? data.contactName ?? null : existing.contactName,
      notes: "notes" in data ? data.notes ?? null : existing.notes,
      creditLimit: "creditLimit" in data ? data.creditLimit ?? null : existing.creditLimit,
      currentBalance: existing.currentBalance + balanceDelta,
      initialBalance: newInitialBalance,
      creditDays: data.creditDays ?? existing.creditDays,
      isActive: data.isActive ?? existing.isActive,
      addressStreet: "addressStreet" in data ? data.addressStreet ?? null : existing.addressStreet,
      addressExteriorNumber:
        "addressExteriorNumber" in data ? data.addressExteriorNumber ?? null : existing.addressExteriorNumber,
      addressInteriorNumber:
        "addressInteriorNumber" in data ? data.addressInteriorNumber ?? null : existing.addressInteriorNumber,
      addressNeighborhood:
        "addressNeighborhood" in data ? data.addressNeighborhood ?? null : existing.addressNeighborhood,
      addressMunicipality:
        "addressMunicipality" in data ? data.addressMunicipality ?? null : existing.addressMunicipality,
      addressState: "addressState" in data ? data.addressState ?? null : existing.addressState,
      addressCountry: "addressCountry" in data ? data.addressCountry ?? null : existing.addressCountry,
      addressZipCode: "addressZipCode" in data ? data.addressZipCode ?? null : existing.addressZipCode,
      branchIds: data.branchIds !== undefined ? [...data.branchIds] : existing.branchIds,
      createdAt: existing.createdAt,
      updatedAt: new Date(),
    });

    this.store[idx] = updated;
    return updated;
  }

  async softDelete(id: string): Promise<void> {
    const idx = this.store.findIndex((c) => c.id === id);
    if (idx === -1) throw new CustomerNotFoundError(id);
    await this.update(id, { isActive: false });
  }

  reset(): void {
    this.store = [];
  }
}
