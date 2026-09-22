import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { parseListQuery } from "@/shared/infrastructure/http/parseListQuery";
import { ListCustomersUseCase } from "../../application/use-cases/ListCustomersUseCase";
import { GetCustomerUseCase } from "../../application/use-cases/GetCustomerUseCase";
import { CreateCustomerUseCase } from "../../application/use-cases/CreateCustomerUseCase";
import { UpdateCustomerUseCase } from "../../application/use-cases/UpdateCustomerUseCase";
import { SoftDeleteCustomerUseCase } from "../../application/use-cases/SoftDeleteCustomerUseCase";
import { CustomerNotFoundError } from "../../domain/errors/CustomerNotFoundError";
import { CustomerCodeAlreadyInUseError } from "../../domain/errors/CustomerCodeAlreadyInUseError";
import { CustomerRfcAlreadyInUseError } from "../../domain/errors/CustomerRfcAlreadyInUseError";
import { CustomerBranchNotFoundError } from "../../domain/errors/CustomerBranchNotFoundError";
import { optionalRfcSchema, taxRegimeSchema, uuidSchema } from "@/shared/infrastructure/http/validators";
import { mapDomainError } from "@/shared/infrastructure/http/mapDomainError";
import { AuthorizationService } from "@/modules/rbac/application/ports/AuthorizationService";
import { resolveScopedBranchId } from "@/modules/rbac/infrastructure/http/enforceBranchScope";

const CFDI_USE_REGEX = /^[A-Z]{1,2}\d{2}$/;
const TAX_ZIP_CODE_REGEX = /^\d{5}$/;
const CODE_REGEX = /^[A-Z0-9_]{1,32}$/;

const uuidParamSchema = uuidSchema;

const addressFieldsSchema = {
  addressStreet: z.string().max(150).nullable().optional(),
  addressExteriorNumber: z.string().max(20).nullable().optional(),
  addressInteriorNumber: z.string().max(20).nullable().optional(),
  addressNeighborhood: z.string().max(100).nullable().optional(),
  addressMunicipality: z.string().max(100).nullable().optional(),
  addressState: z
    .string()
    .regex(/^[A-Z]{2,3}$/, "addressState must be a 2-3 uppercase letter SAT state key")
    .nullable()
    .optional(),
  addressCountry: z.string().max(3).nullable().optional(),
  addressZipCode: z
    .string()
    .regex(/^\d{5}$/, "addressZipCode must be a 5-digit code")
    .nullable()
    .optional(),
};

const listQueryFiltersSchema = z.object({
  search: z
    .string()
    .optional()
    .transform((v) => v?.trim() || undefined)
    .pipe(z.string().min(2, "search must be at least 2 characters").optional()),
  branchId: uuidSchema.optional(),
});

const createBodySchema = z.object({
  code: z
    .string()
    .min(1)
    .max(32)
    .transform((v) => v.trim().toUpperCase())
    .pipe(z.string().regex(CODE_REGEX, "code must match ^[A-Z0-9_]{1,32}$")),
  name: z.string().min(1).max(120),
  rfc: optionalRfcSchema,
  legalName: z.string().max(200).nullable().optional(),
  taxRegime: taxRegimeSchema.nullable().optional(),
  cfdiUse: z
    .string()
    .regex(CFDI_USE_REGEX, "cfdiUse must match ^[A-Z]{1,2}\\d{2}$")
    .nullable()
    .optional(),
  taxZipCode: z.string().regex(TAX_ZIP_CODE_REGEX, "taxZipCode must be 5 digits").nullable().optional(),
  email: z.string().email("invalid email").max(120).nullable().optional(),
  phone: z.string().max(30).nullable().optional(),
  address: z.string().max(300).nullable().optional(),
  contactName: z.string().max(120).nullable().optional(),
  notes: z.string().nullable().optional(),
  creditLimit: z.number().min(0).nullable().optional(),
  initialBalance: z.number().min(0).optional(),
  creditDays: z.coerce.number().int().min(0).default(30),
  isActive: z.boolean().optional(),
  branchIds: z.array(uuidSchema).optional(),
  ...addressFieldsSchema,
});

const updateBodySchema = z
  .object({
    name: z.string().min(1).max(120).optional(),
    rfc: optionalRfcSchema,
    legalName: z.string().max(200).nullable().optional(),
    taxRegime: taxRegimeSchema.nullable().optional(),
    cfdiUse: z.string().regex(CFDI_USE_REGEX, "cfdiUse must match ^[A-Z]\\d{2}$").nullable().optional(),
    taxZipCode: z.string().regex(TAX_ZIP_CODE_REGEX, "taxZipCode must be 5 digits").nullable().optional(),
    email: z.string().email("invalid email").max(120).nullable().optional(),
    phone: z.string().max(30).nullable().optional(),
    address: z.string().max(300).nullable().optional(),
    contactName: z.string().max(120).nullable().optional(),
    notes: z.string().nullable().optional(),
    creditLimit: z.number().min(0).nullable().optional(),
    initialBalance: z.number().min(0).optional(),
    creditDays: z.coerce.number().int().min(0).optional(),
    isActive: z.boolean().optional(),
    branchIds: z.array(uuidSchema).optional(),
    ...addressFieldsSchema,
  })
  .refine(
    (d) =>
      d.name !== undefined ||
      d.rfc !== undefined ||
      d.legalName !== undefined ||
      d.taxRegime !== undefined ||
      d.cfdiUse !== undefined ||
      d.taxZipCode !== undefined ||
      d.email !== undefined ||
      d.phone !== undefined ||
      d.address !== undefined ||
      d.contactName !== undefined ||
      d.notes !== undefined ||
      d.creditLimit !== undefined ||
      d.initialBalance !== undefined ||
      d.creditDays !== undefined ||
      d.isActive !== undefined ||
      d.branchIds !== undefined ||
      d.addressStreet !== undefined ||
      d.addressExteriorNumber !== undefined ||
      d.addressInteriorNumber !== undefined ||
      d.addressNeighborhood !== undefined ||
      d.addressMunicipality !== undefined ||
      d.addressState !== undefined ||
      d.addressCountry !== undefined ||
      d.addressZipCode !== undefined,
    { message: "At least one updatable field must be provided" }
  );

export class CustomersController {
  constructor(
    private readonly listUseCase: ListCustomersUseCase,
    private readonly getUseCase: GetCustomerUseCase,
    private readonly createUseCase: CreateCustomerUseCase,
    private readonly updateUseCase: UpdateCustomerUseCase,
    private readonly softDeleteUseCase: SoftDeleteCustomerUseCase,
    private readonly authzService: AuthorizationService
  ) {}

  /**
   * A caller without `branches:access_all` whose own branch is not among
   * the customer's `branchIds` cannot see/modify it (403, existence not
   * disclosed). A bypass caller always passes.
   */
  private async assertCustomerVisible(req: NextRequest, branchIds: string[]): Promise<NextResponse | null> {
    const userId = req.headers.get("x-user-id") ?? "";
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const bypass = await this.authzService.userCan(userId, "branches:access_all");
    if (bypass) return null;

    const userBranchId = req.headers.get("x-user-branch-id") ?? "";
    if (userBranchId === "" || !branchIds.includes(userBranchId)) {
      return NextResponse.json({ error: "Forbidden", required: "branches:access_all" }, { status: 403 });
    }
    return null;
  }

  async list(req: NextRequest): Promise<NextResponse> {
    const { searchParams } = new URL(req.url);
    const parsed = parseListQuery(searchParams);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const filtersParsed = listQueryFiltersSchema.safeParse({
      search: searchParams.get("search") ?? undefined,
      branchId: searchParams.get("branchId") ?? undefined,
    });
    if (!filtersParsed.success) {
      return NextResponse.json({ error: filtersParsed.error.errors[0].message }, { status: 400 });
    }

    const scoped = await resolveScopedBranchId(req, filtersParsed.data.branchId, this.authzService);
    if (scoped instanceof NextResponse) return scoped;

    const result = await this.listUseCase.execute({
      ...parsed.data,
      search: filtersParsed.data.search,
      branchId: scoped.branchId,
    });
    return NextResponse.json(result);
  }

  async getById(req: NextRequest, id: string): Promise<NextResponse> {
    const parsed = uuidParamSchema.safeParse(id);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }
    try {
      const customer = await this.getUseCase.execute(parsed.data);
      const visible = await this.assertCustomerVisible(req, customer.branchIds);
      if (visible) return visible;
      return NextResponse.json(customer);
    } catch (err) {
      const mapped = mapDomainError(err, [[CustomerNotFoundError, 404]]);
      if (mapped) return mapped;
      throw err;
    }
  }

  async create(req: NextRequest): Promise<NextResponse> {
    const body = await req.json().catch(() => ({}));
    const parsed = createBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }

    const scoped = await resolveScopedBranchId(req, undefined, this.authzService);
    if (scoped instanceof NextResponse) return scoped;

    let branchIds: string[];
    if (scoped.branchId !== undefined) {
      // Non-bypass: forced to the caller's own branch, ignoring whatever the body sent.
      branchIds = [scoped.branchId];
    } else {
      // Bypass: branchIds is a required, explicit selection.
      if (!parsed.data.branchIds || parsed.data.branchIds.length === 0) {
        return NextResponse.json({ error: "branchIds must contain at least one branch" }, { status: 400 });
      }
      branchIds = parsed.data.branchIds;
    }

    try {
      const customer = await this.createUseCase.execute({ ...parsed.data, branchIds });
      return NextResponse.json(customer, { status: 201 });
    } catch (err) {
      const mapped = mapDomainError(err, [
        [CustomerCodeAlreadyInUseError, 409],
        [CustomerRfcAlreadyInUseError, 409],
        [CustomerBranchNotFoundError, 400],
      ]);
      if (mapped) return mapped;
      throw err;
    }
  }

  async update(req: NextRequest, id: string): Promise<NextResponse> {
    const idParsed = uuidParamSchema.safeParse(id);
    if (!idParsed.success) {
      return NextResponse.json({ error: idParsed.error.errors[0].message }, { status: 400 });
    }
    const body = await req.json().catch(() => ({}));
    const parsed = updateBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }

    try {
      const existing = await this.getUseCase.execute(idParsed.data);
      const visible = await this.assertCustomerVisible(req, existing.branchIds);
      if (visible) return visible;

      const userId = req.headers.get("x-user-id") ?? "";
      const bypass = await this.authzService.userCan(userId, "branches:access_all");

      let branchIds: string[] | undefined;
      if (!bypass) {
        // Non-bypass: branchIds in the body is silently ignored — same treatment as `code`.
        branchIds = undefined;
      } else if (parsed.data.branchIds !== undefined) {
        if (parsed.data.branchIds.length === 0) {
          return NextResponse.json({ error: "branchIds must contain at least one branch" }, { status: 400 });
        }
        branchIds = parsed.data.branchIds;
      }

      const customer = await this.updateUseCase.execute(idParsed.data, { ...parsed.data, branchIds });
      return NextResponse.json(customer);
    } catch (err) {
      const mapped = mapDomainError(err, [
        [CustomerNotFoundError, 404],
        [CustomerRfcAlreadyInUseError, 409],
        [CustomerBranchNotFoundError, 400],
      ]);
      if (mapped) return mapped;
      throw err;
    }
  }

  async softDelete(req: NextRequest, id: string): Promise<NextResponse> {
    const parsed = uuidParamSchema.safeParse(id);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }
    try {
      const existing = await this.getUseCase.execute(parsed.data);
      const visible = await this.assertCustomerVisible(req, existing.branchIds);
      if (visible) return visible;

      await this.softDeleteUseCase.execute(parsed.data);
      return new NextResponse(null, { status: 204 });
    } catch (err) {
      const mapped = mapDomainError(err, [[CustomerNotFoundError, 404]]);
      if (mapped) return mapped;
      throw err;
    }
  }
}
