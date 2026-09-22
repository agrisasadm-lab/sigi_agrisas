import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ListProductDosificationsUseCase } from "../../application/use-cases/ListProductDosificationsUseCase";
import { CreateProductDosificationUseCase } from "../../application/use-cases/CreateProductDosificationUseCase";
import { UpdateProductDosificationUseCase } from "../../application/use-cases/UpdateProductDosificationUseCase";
import { SoftDeleteProductDosificationUseCase } from "../../application/use-cases/SoftDeleteProductDosificationUseCase";
import { ProductNotFoundError } from "../../domain/errors/ProductNotFoundError";
import { ProductDosificationNotFoundError } from "../../domain/errors/ProductDosificationNotFoundError";
import { DuplicateDosificationNameError } from "../../domain/errors/DuplicateDosificationNameError";

const productIdSchema = z.string().uuid("Invalid product ID format");
const dosificationIdSchema = z.string().uuid("Invalid dosification ID format");
const branchIdSchema = z.string().uuid("Invalid branchId");

const createBodySchema = z.object({
  name: z.string().min(1).max(60),
  numParts: z.number().int().min(2, "numParts must be >= 2"),
  isActive: z.boolean().optional(),
});

const updateBodySchema = z
  .object({
    name: z.string().min(1).max(60).optional(),
    numParts: z.number().int().min(2, "numParts must be >= 2").optional(),
    isActive: z.boolean().optional(),
  })
  .refine((d) => d.name !== undefined || d.numParts !== undefined || d.isActive !== undefined, {
    message: "At least one field must be provided",
  });

/** `branchId` del querystring — obligatorio: el precio default que alimenta `computedUnitPrice` es por sucursal. */
function parseBranchId(req: NextRequest): { branchId: string } | NextResponse {
  const raw = req.nextUrl.searchParams.get("branchId");
  if (!raw) return NextResponse.json({ error: "branchId is required" }, { status: 400 });
  const parsed = branchIdSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  return { branchId: parsed.data };
}

export class ProductDosificationsController {
  constructor(
    private readonly listUseCase: ListProductDosificationsUseCase,
    private readonly createUseCase: CreateProductDosificationUseCase,
    private readonly updateUseCase: UpdateProductDosificationUseCase,
    private readonly softDeleteUseCase: SoftDeleteProductDosificationUseCase
  ) {}

  async list(req: NextRequest, productId: string): Promise<NextResponse> {
    const parsed = productIdSchema.safeParse(productId);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }
    const branch = parseBranchId(req);
    if (branch instanceof NextResponse) return branch;
    try {
      const result = await this.listUseCase.execute(parsed.data, branch.branchId);
      return NextResponse.json(result);
    } catch (err) {
      if (err instanceof ProductNotFoundError) return NextResponse.json({ error: err.message }, { status: 404 });
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
    const branch = parseBranchId(req);
    if (branch instanceof NextResponse) return branch;
    try {
      const dosification = await this.createUseCase.execute(idParsed.data, branch.branchId, parsed.data);
      return NextResponse.json(dosification, { status: 201 });
    } catch (err) {
      if (err instanceof ProductNotFoundError) return NextResponse.json({ error: err.message }, { status: 404 });
      if (err instanceof DuplicateDosificationNameError) return NextResponse.json({ error: err.message }, { status: 409 });
      throw err;
    }
  }

  async update(req: NextRequest, productId: string, dosificationId: string): Promise<NextResponse> {
    const pidParsed = productIdSchema.safeParse(productId);
    if (!pidParsed.success) {
      return NextResponse.json({ error: pidParsed.error.errors[0].message }, { status: 400 });
    }
    const dosParsed = dosificationIdSchema.safeParse(dosificationId);
    if (!dosParsed.success) {
      return NextResponse.json({ error: dosParsed.error.errors[0].message }, { status: 400 });
    }
    const body = await req.json().catch(() => ({}));
    const parsed = updateBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }
    const branch = parseBranchId(req);
    if (branch instanceof NextResponse) return branch;
    try {
      const dosification = await this.updateUseCase.execute(pidParsed.data, dosParsed.data, branch.branchId, parsed.data);
      return NextResponse.json(dosification);
    } catch (err) {
      if (err instanceof ProductDosificationNotFoundError) return NextResponse.json({ error: err.message }, { status: 404 });
      if (err instanceof DuplicateDosificationNameError) return NextResponse.json({ error: err.message }, { status: 409 });
      throw err;
    }
  }

  async delete(_req: NextRequest, productId: string, dosificationId: string): Promise<NextResponse> {
    const pidParsed = productIdSchema.safeParse(productId);
    if (!pidParsed.success) {
      return NextResponse.json({ error: pidParsed.error.errors[0].message }, { status: 400 });
    }
    const dosParsed = dosificationIdSchema.safeParse(dosificationId);
    if (!dosParsed.success) {
      return NextResponse.json({ error: dosParsed.error.errors[0].message }, { status: 400 });
    }
    try {
      await this.softDeleteUseCase.execute(pidParsed.data, dosParsed.data);
      return new NextResponse(null, { status: 204 });
    } catch (err) {
      if (err instanceof ProductDosificationNotFoundError) return NextResponse.json({ error: err.message }, { status: 404 });
      throw err;
    }
  }
}
