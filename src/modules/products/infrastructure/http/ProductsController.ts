import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { parseListQuery } from "@/shared/infrastructure/http/parseListQuery";
import { resolveScopedBranchId } from "@/modules/rbac/infrastructure/http/enforceBranchScope";
import { rbacContainer } from "@/modules/rbac/infrastructure/di/container";
import { isBranchScopedInventory } from "@/shared/infrastructure/config/inventoryScope";
import { ListProductsUseCase } from "../../application/use-cases/ListProductsUseCase";
import { GetProductUseCase } from "../../application/use-cases/GetProductUseCase";
import { CreateProductUseCase } from "../../application/use-cases/CreateProductUseCase";
import { UpdateProductUseCase } from "../../application/use-cases/UpdateProductUseCase";
import { SoftDeleteProductUseCase } from "../../application/use-cases/SoftDeleteProductUseCase";
import { UploadProductImageUseCase, InvalidImageFormatError, ImageTooLargeError } from "../../application/use-cases/UploadProductImageUseCase";
import { DeleteProductImageUseCase } from "../../application/use-cases/DeleteProductImageUseCase";
import { ProductNotFoundError } from "../../domain/errors/ProductNotFoundError";
import { ProductCodeAlreadyInUseError } from "../../domain/errors/ProductCodeAlreadyInUseError";
import { ProductDepartmentNotFoundError } from "../../domain/errors/ProductDepartmentNotFoundError";
import { ProductTaxRateNotFoundError } from "../../domain/errors/ProductTaxRateNotFoundError";
import { mapDomainError } from "@/shared/infrastructure/http/mapDomainError";

const CODE_REGEX = /^[A-Z0-9_]{1,32}$/;
const SAT_PRODUCT_CODE_REGEX = /^\d{8}$/;
const SAT_UNIT_CODE_REGEX = /^[A-Za-z0-9]{2,3}$/;
const SUPABASE_BUCKET_PATH_PREFIX = "/storage/v1/object/public/product-images/";

/**
 * Valida host y pathname reales (no una subcadena en cualquier parte de la
 * URL) para que un atacante no pueda pasar el filtro incrustando el
 * fragmento esperado en el query string de un dominio arbitrario.
 */
function isValidSupabaseBucketUrl(u: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(u);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:") return false;
  if (parsed.host !== "supabase.co" && !parsed.host.endsWith(".supabase.co")) return false;
  return parsed.pathname.startsWith(SUPABASE_BUCKET_PATH_PREFIX);
}

const uuidParamSchema = z.string().uuid("Invalid product ID format");

const taxRateSchema = z
  .number()
  .min(0, "tax rate must be between 0 and 100")
  .max(100, "tax rate must be between 0 and 100")
  .nullable()
  .optional()
  .transform((v) => (v == null ? v : v > 1 ? v / 100 : v));

const imageUrlSchema = z
  .string()
  .url()
  .max(2048)
  .refine(isValidSupabaseBucketUrl, { message: "Invalid image URL" })
  .nullable()
  .optional();

const listQueryFiltersSchema = z.object({
  search: z
    .string()
    .optional()
    .transform((v) => v?.trim() || undefined)
    .pipe(z.string().min(2, "search must be at least 2 characters").optional()),
  departmentId: z.string().uuid("departmentId must be a valid UUID").optional(),
  providerId: z.string().uuid("providerId must be a valid UUID").optional(),
  branchId: z.string().uuid("branchId must be a valid UUID").optional(),
  satProductCode: z.string().regex(SAT_PRODUCT_CODE_REGEX, "satProductCode must be 8 digits").optional(),
});

const createBodySchema = z.object({
  code: z
    .string()
    .min(1)
    .max(32)
    .transform((v) => v.trim().toUpperCase())
    .pipe(z.string().regex(CODE_REGEX, "code must match ^[A-Z0-9_]{1,32}$")),
  name: z.string().min(1).max(200),
  unit: z.string().regex(SAT_UNIT_CODE_REGEX, "unit must be a valid SAT unit code"),
  departmentId: z.string().uuid("departmentId must be a valid UUID"),
  taxRateId: z.string().uuid("taxRateId must be a valid UUID").nullable().optional(),
  satProductCode: z
    .string()
    .regex(SAT_PRODUCT_CODE_REGEX, "satProductCode must be 8 digits")
    .nullable()
    .optional(),
  ivaRate: taxRateSchema,
  iepsRate: taxRateSchema,
  imageUrl: imageUrlSchema,
  manufactureDate: z.string().date().nullable().optional(),
  acquisitionPrice: z.number().min(0).nullable().optional(),
  isTaxable: z.boolean().optional().default(false),
  isActive: z.boolean().optional(),
});

const updateBodySchema = z
  .object({
    name: z.string().min(1).max(200).optional(),
    unit: z.string().regex(SAT_UNIT_CODE_REGEX, "unit must be a valid SAT unit code").optional(),
    departmentId: z.string().uuid("departmentId must be a valid UUID").optional(),
    taxRateId: z.string().uuid("taxRateId must be a valid UUID").nullable().optional(),
    satProductCode: z
      .string()
      .regex(SAT_PRODUCT_CODE_REGEX, "satProductCode must be 8 digits")
      .nullable()
      .optional(),
    ivaRate: taxRateSchema,
    iepsRate: taxRateSchema,
    imageUrl: imageUrlSchema,
    manufactureDate: z.string().date().nullable().optional(),
    acquisitionPrice: z.number().min(0).nullable().optional(),
    isTaxable: z.boolean().optional(),
    isActive: z.boolean().optional(),
  })
  .refine(
    (d) =>
      d.name !== undefined ||
      d.unit !== undefined ||
      d.departmentId !== undefined ||
      d.taxRateId !== undefined ||
      d.satProductCode !== undefined ||
      d.ivaRate !== undefined ||
      d.iepsRate !== undefined ||
      d.imageUrl !== undefined ||
      d.manufactureDate !== undefined ||
      d.acquisitionPrice !== undefined ||
      d.isTaxable !== undefined ||
      d.isActive !== undefined,
    { message: "At least one field must be provided" }
  );

export class ProductsController {
  constructor(
    private readonly listUseCase: ListProductsUseCase,
    private readonly getUseCase: GetProductUseCase,
    private readonly createUseCase: CreateProductUseCase,
    private readonly updateUseCase: UpdateProductUseCase,
    private readonly softDeleteUseCase: SoftDeleteProductUseCase,
    private readonly uploadImageUseCase: UploadProductImageUseCase,
    private readonly deleteImageUseCase: DeleteProductImageUseCase,
  ) {}

  async list(req: NextRequest): Promise<NextResponse> {
    const { searchParams } = new URL(req.url);
    const parsed = parseListQuery(searchParams);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const filtersParsed = listQueryFiltersSchema.safeParse({
      search: searchParams.get("search") ?? undefined,
      departmentId: searchParams.get("departmentId") ?? undefined,
      providerId: searchParams.get("providerId") ?? undefined,
      branchId: searchParams.get("branchId") ?? undefined,
      satProductCode: searchParams.get("satProductCode") ?? undefined,
    });
    if (!filtersParsed.success) {
      return NextResponse.json({ error: filtersParsed.error.errors[0].message }, { status: 400 });
    }

    let branchId = filtersParsed.data.branchId;
    let branchScoped = false;
    if (isBranchScopedInventory() && filtersParsed.data.branchId) {
      const scoped = await resolveScopedBranchId(req, branchId);
      if (scoped instanceof NextResponse) return scoped;
      branchId = scoped.branchId;
      branchScoped = true;
    }

    const result = await this.listUseCase.execute({
      ...parsed.data,
      ...filtersParsed.data,
      branchId,
      branchScoped,
    });
    return NextResponse.json(result);
  }

  async getById(_req: NextRequest, id: string): Promise<NextResponse> {
    const parsed = uuidParamSchema.safeParse(id);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }
    try {
      const product = await this.getUseCase.execute(parsed.data);
      return NextResponse.json(product);
    } catch (err) {
      const mapped = mapDomainError(err, [[ProductNotFoundError, 404]]);
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
    const userId = req.headers.get("x-user-id") ?? "";
    const userBranchId = req.headers.get("x-user-branch-id") ?? "";
    let autoAssignBranchId: string | undefined;
    if (isBranchScopedInventory() && userId && userBranchId) {
      const hasAccessAll = await rbacContainer.authorizationService.userCan(userId, "branches:access_all");
      if (!hasAccessAll) autoAssignBranchId = userBranchId;
    }
    try {
      const product = await this.createUseCase.execute(parsed.data, autoAssignBranchId);
      return NextResponse.json({ ...product, autoAssignedBranchId: autoAssignBranchId ?? null }, { status: 201 });
    } catch (err) {
      const mapped = mapDomainError(err, [
        [ProductCodeAlreadyInUseError, 409],
        [ProductDepartmentNotFoundError, 400],
      ]);
      if (mapped) return mapped;
      if (err instanceof ProductTaxRateNotFoundError) return NextResponse.json({ error: "Tax rate not found or inactive" }, { status: 400 });
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
      const product = await this.updateUseCase.execute(idParsed.data, parsed.data);
      return NextResponse.json(product);
    } catch (err) {
      const mapped = mapDomainError(err, [
        [ProductNotFoundError, 404],
        [ProductDepartmentNotFoundError, 400],
      ]);
      if (mapped) return mapped;
      if (err instanceof ProductTaxRateNotFoundError) return NextResponse.json({ error: "Tax rate not found or inactive" }, { status: 400 });
      throw err;
    }
  }

  async softDelete(_req: NextRequest, id: string): Promise<NextResponse> {
    const parsed = uuidParamSchema.safeParse(id);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }
    try {
      await this.softDeleteUseCase.execute(parsed.data);
      return new NextResponse(null, { status: 204 });
    } catch (err) {
      const mapped = mapDomainError(err, [[ProductNotFoundError, 404]]);
      if (mapped) return mapped;
      throw err;
    }
  }

  async uploadImage(req: NextRequest, id: string): Promise<NextResponse> {
    const idParsed = uuidParamSchema.safeParse(id);
    if (!idParsed.success) {
      return NextResponse.json({ error: idParsed.error.errors[0].message }, { status: 400 });
    }

    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return NextResponse.json({ error: "Invalid multipart body" }, { status: 400 });
    }

    const file = formData.get("file");
    if (!(file instanceof Blob)) {
      return NextResponse.json({ error: "Missing file field" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    try {
      const imageUrl = await this.uploadImageUseCase.execute({
        productId: idParsed.data,
        buffer,
        mime: file.type,
        sizeBytes: buffer.byteLength,
      });
      return NextResponse.json({ imageUrl });
    } catch (err) {
      const mapped = mapDomainError(err, [
        [InvalidImageFormatError, 400],
        [ProductNotFoundError, 404],
      ]);
      if (mapped) return mapped;
      if (err instanceof ImageTooLargeError) return NextResponse.json({ error: err.message, maxBytes: err.maxBytes }, { status: 413 });
      throw err;
    }
  }

  async deleteImage(_req: NextRequest, id: string): Promise<NextResponse> {
    const idParsed = uuidParamSchema.safeParse(id);
    if (!idParsed.success) {
      return NextResponse.json({ error: idParsed.error.errors[0].message }, { status: 400 });
    }
    try {
      await this.deleteImageUseCase.execute(idParsed.data);
      return new NextResponse(null, { status: 204 });
    } catch (err) {
      const mapped = mapDomainError(err, [[ProductNotFoundError, 404]]);
      if (mapped) return mapped;
      throw err;
    }
  }
}
