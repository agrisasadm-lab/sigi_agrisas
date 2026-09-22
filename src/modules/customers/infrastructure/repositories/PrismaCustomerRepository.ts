import { PrismaClient, Customer as PrismaCustomer, Prisma } from "@prisma/client";
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
import { isPrismaUniqueError, isPrismaNotFoundError } from "@/shared/infrastructure/prisma/errors";

const WITH_BRANCHES = { branches: { select: { branchId: true } } } satisfies Prisma.CustomerInclude;

type CustomerRow = PrismaCustomer & { branches: { branchId: string }[] };

function toCustomer(row: CustomerRow): Customer {
  return Customer.create({
    id: row.id,
    code: row.code,
    name: row.name,
    rfc: row.rfc,
    legalName: row.legalName,
    taxRegime: row.taxRegime,
    cfdiUse: row.cfdiUse,
    taxZipCode: row.taxZipCode,
    email: row.email,
    phone: row.phone,
    address: row.address,
    contactName: row.contactName,
    notes: row.notes,
    creditLimit: row.creditLimit ? Number(row.creditLimit) : null,
    currentBalance: Number(row.currentBalance),
    initialBalance: Number(row.initialBalance),
    creditDays: row.creditDays,
    isActive: row.isActive,
    addressStreet: row.addressStreet,
    addressExteriorNumber: row.addressExteriorNumber,
    addressInteriorNumber: row.addressInteriorNumber,
    addressNeighborhood: row.addressNeighborhood,
    addressMunicipality: row.addressMunicipality,
    addressState: row.addressState,
    addressCountry: row.addressCountry,
    addressZipCode: row.addressZipCode,
    branchIds: row.branches.map((b) => b.branchId),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}


export class PrismaCustomerRepository implements CustomerRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findAll({ page, pageSize, includeInactive, search, branchId }: FindAllOptions): Promise<{ items: Customer[]; total: number }> {
    const skip = (page - 1) * pageSize;

    const where: Prisma.CustomerWhereInput = {
      ...(includeInactive ? {} : { isActive: true }),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { legalName: { contains: search, mode: "insensitive" } },
              { rfc: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(branchId ? { branches: { some: { branchId } } } : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.customer.findMany({ where, skip, take: pageSize, orderBy: { createdAt: "desc" }, include: WITH_BRANCHES }),
      this.prisma.customer.count({ where }),
    ]);

    return { items: rows.map(toCustomer), total };
  }

  async findById(id: string): Promise<Customer | null> {
    const row = await this.prisma.customer.findUnique({ where: { id }, include: WITH_BRANCHES });
    return row ? toCustomer(row) : null;
  }

  async create(data: CreateCustomerData): Promise<Customer> {
    try {
      const row = await this.prisma.customer.create({
        data: {
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
          initialBalance: data.initialBalance ?? 0,
          currentBalance: data.initialBalance ?? 0,
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
          branches: { create: data.branchIds.map((branchId) => ({ branchId })) },
        },
        include: WITH_BRANCHES,
      });
      return toCustomer(row);
    } catch (err) {
      if (isPrismaUniqueError(err, "code")) throw new CustomerCodeAlreadyInUseError(data.code);
      if (isPrismaUniqueError(err, "rfc")) throw new CustomerRfcAlreadyInUseError(data.rfc ?? "");
      throw err;
    }
  }

  async update(id: string, data: UpdateCustomerData): Promise<Customer> {
    let balanceDelta: number | null = null;
    if (data.initialBalance !== undefined) {
      const existing = await this.prisma.customer.findUnique({ where: { id }, select: { initialBalance: true } });
      if (!existing) throw new CustomerNotFoundError(id);
      balanceDelta = data.initialBalance - Number(existing.initialBalance);
    }
    try {
      const row = await this.prisma.customer.update({
        where: { id },
        data: {
          ...(data.name !== undefined ? { name: data.name } : {}),
          ...(data.rfc !== undefined ? { rfc: data.rfc } : {}),
          ...(data.legalName !== undefined ? { legalName: data.legalName } : {}),
          ...(data.taxRegime !== undefined ? { taxRegime: data.taxRegime } : {}),
          ...(data.cfdiUse !== undefined ? { cfdiUse: data.cfdiUse } : {}),
          ...(data.taxZipCode !== undefined ? { taxZipCode: data.taxZipCode } : {}),
          ...(data.email !== undefined ? { email: data.email } : {}),
          ...(data.phone !== undefined ? { phone: data.phone } : {}),
          ...(data.address !== undefined ? { address: data.address } : {}),
          ...(data.contactName !== undefined ? { contactName: data.contactName } : {}),
          ...(data.notes !== undefined ? { notes: data.notes } : {}),
          ...(data.creditLimit !== undefined ? { creditLimit: data.creditLimit } : {}),
          ...(data.initialBalance !== undefined
            ? { initialBalance: data.initialBalance, currentBalance: { increment: balanceDelta as number } }
            : {}),
          ...(data.creditDays !== undefined ? { creditDays: data.creditDays } : {}),
          ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
          ...(data.addressStreet !== undefined ? { addressStreet: data.addressStreet } : {}),
          ...(data.addressExteriorNumber !== undefined ? { addressExteriorNumber: data.addressExteriorNumber } : {}),
          ...(data.addressInteriorNumber !== undefined ? { addressInteriorNumber: data.addressInteriorNumber } : {}),
          ...(data.addressNeighborhood !== undefined ? { addressNeighborhood: data.addressNeighborhood } : {}),
          ...(data.addressMunicipality !== undefined ? { addressMunicipality: data.addressMunicipality } : {}),
          ...(data.addressState !== undefined ? { addressState: data.addressState } : {}),
          ...(data.addressCountry !== undefined ? { addressCountry: data.addressCountry } : {}),
          ...(data.addressZipCode !== undefined ? { addressZipCode: data.addressZipCode } : {}),
          ...(data.branchIds !== undefined
            ? { branches: { deleteMany: {}, create: data.branchIds.map((branchId) => ({ branchId })) } }
            : {}),
        },
        include: WITH_BRANCHES,
      });
      return toCustomer(row);
    } catch (err) {
      if (isPrismaNotFoundError(err)) throw new CustomerNotFoundError(id);
      if (isPrismaUniqueError(err, "rfc")) throw new CustomerRfcAlreadyInUseError(data.rfc ?? "");
      throw err;
    }
  }

  async softDelete(id: string): Promise<void> {
    try {
      await this.prisma.customer.update({ where: { id }, data: { isActive: false } });
    } catch (err) {
      if (isPrismaNotFoundError(err)) throw new CustomerNotFoundError(id);
      throw err;
    }
  }
}
