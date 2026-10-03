import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { parseListQuery } from "@/shared/infrastructure/http/parseListQuery";
import { entityCodeSchema, uuidSchema } from "@/shared/infrastructure/http/validators";
import { mapDomainError } from "@/shared/infrastructure/http/mapDomainError";
import { ListFoliosUseCase } from "@/modules/folios/application/use-cases/ListFoliosUseCase";
import { GetFolioUseCase } from "@/modules/folios/application/use-cases/GetFolioUseCase";
import { CreateFolioUseCase } from "@/modules/folios/application/use-cases/CreateFolioUseCase";
import { UpdateFolioUseCase } from "@/modules/folios/application/use-cases/UpdateFolioUseCase";
import { SoftDeleteFolioUseCase } from "@/modules/folios/application/use-cases/SoftDeleteFolioUseCase";
import { AuditFolioSequenceUseCase } from "@/modules/folios/application/use-cases/AuditFolioSequenceUseCase";
import { FolioNotFoundError } from "@/modules/folios/domain/errors/FolioNotFoundError";
import { FolioCodeAlreadyInUseError } from "@/modules/folios/domain/errors/FolioCodeAlreadyInUseError";
import { FOLIO_SCOPES } from "@/shared/domain/types/FolioScope";
import { AuthorizationService } from "@/modules/rbac/application/ports/AuthorizationService";
import { resolveScopedBranchId } from "@/modules/rbac/infrastructure/http/enforceBranchScope";
import { FolioBranchNotFoundError } from "@/modules/folios/domain/errors/FolioBranchNotFoundError";

const scopeSchema = z.enum(FOLIO_SCOPES as unknown as [string, ...string[]]);

const createBodySchema = z.object({
  code: entityCodeSchema,
  name: z.string().min(1).max(100),
  prefix: z
    .string()
    .regex(/^[A-Z0-9-]{1,8}$/, "prefix must be uppercase letters, digits, or hyphens (1–8 chars)")
    .nullable()
    .optional(),
  scope: scopeSchema,
  currentNumber: z.number().int().min(0, "currentNumber must be 0 or greater").optional(),
  isActive: z.boolean().optional(),
});

const updateBodySchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    prefix: z
      .string()
      .regex(/^[A-Z0-9-]{1,8}$/, "prefix must be uppercase letters, digits, or hyphens (1–8 chars)")
      .nullable()
      .optional(),
    scope: scopeSchema.optional(),
    currentNumber: z.number().int().min(0, "currentNumber must be 0 or greater").optional(),
    isActive: z.boolean().optional(),
  })
  .refine(
    (d) =>
      d.name !== undefined ||
      d.prefix !== undefined ||
      d.scope !== undefined ||
      d.currentNumber !== undefined ||
      d.isActive !== undefined,
    { message: "At least one field (name, prefix, scope, currentNumber, isActive) must be provided" }
  );

export class FoliosController {
  constructor(
    private readonly listUseCase: ListFoliosUseCase,
    private readonly getUseCase: GetFolioUseCase,
    private readonly createUseCase: CreateFolioUseCase,
    private readonly updateUseCase: UpdateFolioUseCase,
    private readonly softDeleteUseCase: SoftDeleteFolioUseCase,
    private readonly auditUseCase: AuditFolioSequenceUseCase,
    private readonly authzService: AuthorizationService
  ) {}

  async list(req: NextRequest): Promise<NextResponse> {
    const { searchParams } = new URL(req.url);
    const parsed = parseListQuery(searchParams);
    if (!parsed.success) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const rawScope = searchParams.get("scope");
    let scope: import("@/shared/domain/types/FolioScope").FolioScope | undefined;
    if (rawScope !== null) {
      const scopeParsed = scopeSchema.safeParse(rawScope);
      if (!scopeParsed.success)
        return NextResponse.json({ error: "scope must be one of POS, INVENTORY, OPERATIONS" }, { status: 400 });
      scope = scopeParsed.data as import("@/shared/domain/types/FolioScope").FolioScope;
    }
    const rawBranchId = searchParams.get("branchId");
    if (rawBranchId !== null) {
      const branchIdParsed = uuidSchema.safeParse(rawBranchId);
      if (!branchIdParsed.success)
        return NextResponse.json({ error: branchIdParsed.error.errors[0].message }, { status: 400 });
    }
    const scoped = await resolveScopedBranchId(req, rawBranchId ?? undefined, this.authzService);
    if (scoped instanceof NextResponse) return scoped;
    try {
      return NextResponse.json(await this.listUseCase.execute({ ...parsed.data, scope, branchId: scoped.branchId }));
    } catch (err) {
      if (err instanceof FolioBranchNotFoundError) return NextResponse.json({ error: "Branch not found" }, { status: 404 });
      throw err;
    }
  }

  async getById(_req: NextRequest, id: string): Promise<NextResponse> {
    const idParsed = uuidSchema.safeParse(id);
    if (!idParsed.success) return NextResponse.json({ error: idParsed.error.errors[0].message }, { status: 400 });
    try {
      return NextResponse.json(await this.getUseCase.execute(idParsed.data));
    } catch (err) {
      const mapped = mapDomainError(err, [[FolioNotFoundError, 404]]);
      if (mapped) return mapped;
      throw err;
    }
  }

  async create(req: NextRequest): Promise<NextResponse> {
    const body = await req.json().catch(() => ({}));
    const parsed = createBodySchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    try {
      return NextResponse.json(
        await this.createUseCase.execute({
          ...parsed.data,
          scope: parsed.data.scope as import("@/shared/domain/types/FolioScope").FolioScope,
        }),
        { status: 201 }
      );
    } catch (err) {
      const mapped = mapDomainError(err, [[FolioCodeAlreadyInUseError, 409]]);
      if (mapped) return mapped;
      throw err;
    }
  }

  async update(req: NextRequest, id: string): Promise<NextResponse> {
    const idParsed = uuidSchema.safeParse(id);
    if (!idParsed.success) return NextResponse.json({ error: idParsed.error.errors[0].message }, { status: 400 });
    const body = await req.json().catch(() => ({}));
    const parsed = updateBodySchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    try {
      return NextResponse.json(
        await this.updateUseCase.execute({
          id: idParsed.data,
          ...parsed.data,
          scope: parsed.data.scope as import("@/shared/domain/types/FolioScope").FolioScope | undefined,
        })
      );
    } catch (err) {
      const mapped = mapDomainError(err, [[FolioNotFoundError, 404]]);
      if (mapped) return mapped;
      throw err;
    }
  }

  async softDelete(_req: NextRequest, id: string): Promise<NextResponse> {
    const idParsed = uuidSchema.safeParse(id);
    if (!idParsed.success) return NextResponse.json({ error: idParsed.error.errors[0].message }, { status: 400 });
    try {
      await this.softDeleteUseCase.execute(idParsed.data);
      return new NextResponse(null, { status: 204 });
    } catch (err) {
      const mapped = mapDomainError(err, [[FolioNotFoundError, 404]]);
      if (mapped) return mapped;
      throw err;
    }
  }

  async audit(req: NextRequest, id: string): Promise<NextResponse> {
    const idParsed = uuidSchema.safeParse(id);
    if (!idParsed.success) return NextResponse.json({ error: idParsed.error.errors[0].message }, { status: 400 });
    const { searchParams } = new URL(req.url);
    const rawBranchId = searchParams.get("branchId");
    if (rawBranchId !== null) {
      const branchIdParsed = uuidSchema.safeParse(rawBranchId);
      if (!branchIdParsed.success)
        return NextResponse.json({ error: branchIdParsed.error.errors[0].message }, { status: 400 });
    }
    const scoped = await resolveScopedBranchId(req, rawBranchId ?? undefined, this.authzService);
    if (scoped instanceof NextResponse) return scoped;
    try {
      return NextResponse.json(await this.auditUseCase.execute(idParsed.data, scoped.branchId));
    } catch (err) {
      if (err instanceof FolioBranchNotFoundError) return NextResponse.json({ error: "Branch not found" }, { status: 404 });
      const mapped = mapDomainError(err, [[FolioNotFoundError, 404]]);
      if (mapped) return mapped;
      throw err;
    }
  }
}
