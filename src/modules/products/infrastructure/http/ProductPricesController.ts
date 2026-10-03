import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ListProductPricesUseCase } from "../../application/use-cases/ListProductPricesUseCase";
import { CreateProductPriceUseCase } from "../../application/use-cases/CreateProductPriceUseCase";
import { UpdateProductPriceUseCase } from "../../application/use-cases/UpdateProductPriceUseCase";
import { DeleteProductPriceUseCase } from "../../application/use-cases/DeleteProductPriceUseCase";
import { ProductNotFoundError } from "../../domain/errors/ProductNotFoundError";
import { ProductPriceNotFoundError } from "../../domain/errors/ProductPriceNotFoundError";
import { DuplicatePriceNameError } from "../../domain/errors/DuplicatePriceNameError";
import { DuplicateDefaultPriceError } from "../../domain/errors/DuplicateDefaultPriceError";
import { ProductPriceBranchNotFoundError } from "../../domain/errors/ProductPriceBranchNotFoundError";
import { ProductPriceInvalidBranchError } from "../../domain/errors/ProductPriceInvalidBranchError";
import { enforceBranchScope } from "@/modules/rbac/infrastructure/http/enforceBranchScope";

const productIdSchema = z.string().uuid("Invalid product ID format");
const priceIdSchema = z.string().uuid("Invalid price ID format");
const branchIdQuerySchema = z.string().uuid("Invalid branchId");

const createBodySchema = z.object({
  branchId: z.string({ required_error: "branchId is required" }).uuid("Invalid branchId"),
  name: z.string().min(1).max(60),
  price: z.number().min(0, "price must be >= 0"),
  minQuantity: z.number().int().min(1, "minQuantity must be >= 1").optional(),
  discountPct: z.number().min(0).max(100, "discountPct must be between 0 and 100").nullable().optional(),
  isDefault: z.boolean().optional(),
});

const updateBodySchema = z
  .object({
    name: z.string().min(1).max(60).optional(),
    price: z.number().min(0, "price must be >= 0").optional(),
    minQuantity: z.number().int().min(1, "minQuantity must be >= 1").optional(),
    discountPct: z.number().min(0).max(100, "discountPct must be between 0 and 100").nullable().optional(),
    isDefault: z.boolean().optional(),
  })
  .refine(
    (d) =>
      d.name !== undefined ||
      d.price !== undefined ||
      d.minQuantity !== undefined ||
      d.discountPct !== undefined ||
      d.isDefault !== undefined,
    { message: "At least one field must be provided" }
  );

/** Lectura mínima para resolver la sucursal dueña de un precio antes de autorizar una escritura. */
export interface ProductPriceOwnerLookup {
  findById(priceId: string): Promise<{ branchId: string } | null>;
}

export class ProductPricesController {
  constructor(
    private readonly listUseCase: ListProductPricesUseCase,
    private readonly createUseCase: CreateProductPriceUseCase,
    private readonly updateUseCase: UpdateProductPriceUseCase,
    private readonly deleteUseCase: DeleteProductPriceUseCase,
    private readonly ownerLookup?: ProductPriceOwnerLookup
  ) {}

  /**
   * Editar o borrar un precio exige pertenecer a su sucursal (o tener
   * `branches:access_all`). Devuelve la respuesta de error o `null` si pasa.
   * Un precio inexistente no se resuelve aquí: lo reporta el use case como 404.
   */
  private async enforceOwnerBranch(req: NextRequest, priceId: string): Promise<NextResponse | null> {
    if (!this.ownerLookup) return null;
    const existing = await this.ownerLookup.findById(priceId);
    if (!existing) return null;
    return enforceBranchScope(req, existing.branchId);
  }

  async list(req: NextRequest, productId: string): Promise<NextResponse> {
    const parsed = productIdSchema.safeParse(productId);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }
    const rawBranchId = req.nextUrl.searchParams.get("branchId");
    if (!rawBranchId) {
      return NextResponse.json({ error: "branchId is required" }, { status: 400 });
    }
    const branchIdParsed = branchIdQuerySchema.safeParse(rawBranchId);
    if (!branchIdParsed.success) {
      return NextResponse.json({ error: branchIdParsed.error.errors[0].message }, { status: 400 });
    }
    try {
      const result = await this.listUseCase.execute(parsed.data, branchIdParsed.data);
      return NextResponse.json(result);
    } catch (err) {
      if (err instanceof ProductNotFoundError) return NextResponse.json({ error: err.message }, { status: 404 });
      if (err instanceof ProductPriceBranchNotFoundError) return NextResponse.json({ error: "Branch not found" }, { status: 404 });
      throw err;
    }
  }

  async create(req: NextRequest, productId: string): Promise<NextResponse> {
    const idParsed = productIdSchema.safeParse(productId);
    if (!idParsed.success) {
      return NextResponse.json({ error: idParsed.error.errors[0].message }, { status: 400 });
    }
    const body = await req.json().catch(() => ({}));
    const parsed = createBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }
    const scopeError = await enforceBranchScope(req, parsed.data.branchId);
    if (scopeError) return scopeError;
    try {
      const price = await this.createUseCase.execute(idParsed.data, parsed.data);
      return NextResponse.json(price, { status: 201 });
    } catch (err) {
      if (err instanceof ProductNotFoundError) return NextResponse.json({ error: err.message }, { status: 404 });
      if (err instanceof ProductPriceInvalidBranchError) return NextResponse.json({ error: err.message }, { status: 400 });
      if (err instanceof DuplicatePriceNameError) return NextResponse.json({ error: err.message }, { status: 409 });
      if (err instanceof DuplicateDefaultPriceError) return NextResponse.json({ error: err.message }, { status: 409 });
      throw err;
    }
  }

  async update(req: NextRequest, productId: string, priceId: string): Promise<NextResponse> {
    const pidParsed = productIdSchema.safeParse(productId);
    if (!pidParsed.success) {
      return NextResponse.json({ error: pidParsed.error.errors[0].message }, { status: 400 });
    }
    const priceParsed = priceIdSchema.safeParse(priceId);
    if (!priceParsed.success) {
      return NextResponse.json({ error: priceParsed.error.errors[0].message }, { status: 400 });
    }
    const body = await req.json().catch(() => ({}));
    const parsed = updateBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }
    const ownerError = await this.enforceOwnerBranch(req, priceParsed.data);
    if (ownerError) return ownerError;
    try {
      const price = await this.updateUseCase.execute(pidParsed.data, priceParsed.data, parsed.data);
      return NextResponse.json(price);
    } catch (err) {
      if (err instanceof ProductPriceNotFoundError) return NextResponse.json({ error: err.message }, { status: 404 });
      if (err instanceof DuplicatePriceNameError) return NextResponse.json({ error: err.message }, { status: 409 });
      if (err instanceof DuplicateDefaultPriceError) return NextResponse.json({ error: err.message }, { status: 409 });
      throw err;
    }
  }

  async delete(_req: NextRequest, productId: string, priceId: string): Promise<NextResponse> {
    const pidParsed = productIdSchema.safeParse(productId);
    if (!pidParsed.success) {
      return NextResponse.json({ error: pidParsed.error.errors[0].message }, { status: 400 });
    }
    const priceParsed = priceIdSchema.safeParse(priceId);
    if (!priceParsed.success) {
      return NextResponse.json({ error: priceParsed.error.errors[0].message }, { status: 400 });
    }
    const ownerError = await this.enforceOwnerBranch(_req, priceParsed.data);
    if (ownerError) return ownerError;
    try {
      await this.deleteUseCase.execute(pidParsed.data, priceParsed.data);
      return new NextResponse(null, { status: 204 });
    } catch (err) {
      if (err instanceof ProductPriceNotFoundError) return NextResponse.json({ error: err.message }, { status: 404 });
      throw err;
    }
  }
}
