import { NextRequest, NextResponse } from "next/server";
import React from "react";
import { z } from "zod";
import { renderToBuffer } from "@react-pdf/renderer";
import { parseListQuery } from "@/shared/infrastructure/http/parseListQuery";
import { uuidSchema } from "@/shared/infrastructure/http/validators";
import { mapDomainError } from "@/shared/infrastructure/http/mapDomainError";
import {
  enforceBranchScope,
  resolveScopedBranchId,
} from "@/modules/rbac/infrastructure/http/enforceBranchScope";
import { AuthorizationService } from "@/modules/rbac/application/ports/AuthorizationService";
import { GetTicketSettingsUseCase } from "@/modules/settings/application/use-cases/GetTicketSettingsUseCase";
import { toPdfIssuer } from "@/shared/infrastructure/pdf/pdfIssuer";
import { ListExpensesUseCase } from "@/modules/expenses/application/use-cases/ListExpensesUseCase";
import { GetExpenseUseCase } from "@/modules/expenses/application/use-cases/GetExpenseUseCase";
import { CreateExpenseUseCase } from "@/modules/expenses/application/use-cases/CreateExpenseUseCase";
import { UpdateExpenseUseCase } from "@/modules/expenses/application/use-cases/UpdateExpenseUseCase";
import { SoftDeleteExpenseUseCase } from "@/modules/expenses/application/use-cases/SoftDeleteExpenseUseCase";
import {
  UploadExpensePhotoUseCase,
  InvalidExpensePhotoFormatError,
  ExpensePhotoTooLargeError,
} from "@/modules/expenses/application/use-cases/UploadExpensePhotoUseCase";
import { DeleteExpensePhotoUseCase } from "@/modules/expenses/application/use-cases/DeleteExpensePhotoUseCase";
import { GetExpensesReportUseCase } from "@/modules/expenses/application/use-cases/GetExpensesReportUseCase";
import { ExpenseNotFoundError } from "@/modules/expenses/domain/errors/ExpenseNotFoundError";
import { ExpenseInvalidAmountError } from "@/modules/expenses/domain/errors/ExpenseInvalidAmountError";
import { ExpenseHistoryRowDto, ExpensesReportDto, toExpenseHistoryRowDto } from "@/modules/expenses/application/dto/ExpenseReportDto";
import { buildExpensesReportWorkbook } from "@/modules/expenses/infrastructure/xlsx/buildExpensesReportWorkbook";
import { ExpensesReportPdf } from "@/modules/expenses/infrastructure/pdf/ExpensesReportPdf";

const isoDateQuerySchema = z
  .string()
  .refine((v) => !isNaN(Date.parse(v)), "must be a valid date")
  .optional();

const listQueryFiltersSchema = z.object({
  branchId: z.string().uuid().optional(),
  concept: z.string().trim().min(1).optional(),
  from: isoDateQuerySchema,
  to: isoDateQuerySchema,
});

const createBodySchema = z.object({
  branchId: z.string().uuid(),
  concept: z.string().trim().min(1).max(200),
  amount: z.number().positive("amount must be > 0"),
  notes: z.string().max(1000).nullable().optional(),
  expenseDate: z.coerce.date(),
});

const updateBodySchema = z
  .object({
    concept: z.string().trim().min(1).max(200).optional(),
    amount: z.number().positive("amount must be > 0").optional(),
    notes: z.string().max(1000).nullable().optional(),
    expenseDate: z.coerce.date().optional(),
  })
  .refine((d) => d.concept !== undefined || d.amount !== undefined || d.notes !== undefined || d.expenseDate !== undefined, {
    message: "At least one field (concept, amount, notes, expenseDate) must be provided",
  });

const historyQuerySchema = z.object({
  format: z.enum(["json", "pdf", "xlsx"]).default("json"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  branchId: z.string().uuid().optional(),
  concept: z.string().trim().min(1).optional(),
  from: isoDateQuerySchema,
  to: isoDateQuerySchema,
  includeInactive: z
    .string()
    .optional()
    .transform((v) => v === "true"),
});

export class ExpensesController {
  constructor(
    private readonly listUseCase: ListExpensesUseCase,
    private readonly getUseCase: GetExpenseUseCase,
    private readonly createUseCase: CreateExpenseUseCase,
    private readonly updateUseCase: UpdateExpenseUseCase,
    private readonly softDeleteUseCase: SoftDeleteExpenseUseCase,
    private readonly uploadPhotoUseCase: UploadExpensePhotoUseCase,
    private readonly deletePhotoUseCase: DeleteExpensePhotoUseCase,
    private readonly reportUseCase: GetExpensesReportUseCase,
    private readonly authzService: AuthorizationService,
    private readonly getTicketSettingsUseCase: GetTicketSettingsUseCase
  ) {}

  async list(req: NextRequest): Promise<NextResponse> {
    const { searchParams } = new URL(req.url);
    const parsed = parseListQuery(searchParams);
    if (!parsed.success) return NextResponse.json({ error: parsed.error }, { status: 400 });

    const filtersParsed = listQueryFiltersSchema.safeParse({
      branchId: searchParams.get("branchId") ?? undefined,
      concept: searchParams.get("concept") ?? undefined,
      from: searchParams.get("from") ?? undefined,
      to: searchParams.get("to") ?? undefined,
    });
    if (!filtersParsed.success) {
      return NextResponse.json({ error: filtersParsed.error.errors[0].message }, { status: 400 });
    }

    const scoped = await resolveScopedBranchId(req, filtersParsed.data.branchId, this.authzService);
    if (scoped instanceof NextResponse) return scoped;

    return NextResponse.json(
      await this.listUseCase.execute({
        ...parsed.data,
        branchId: scoped.branchId,
        concept: filtersParsed.data.concept,
        from: filtersParsed.data.from ? new Date(filtersParsed.data.from) : undefined,
        to: filtersParsed.data.to ? new Date(filtersParsed.data.to) : undefined,
      })
    );
  }

  async getById(req: NextRequest, id: string): Promise<NextResponse> {
    const idParsed = uuidSchema.safeParse(id);
    if (!idParsed.success) return NextResponse.json({ error: idParsed.error.errors[0].message }, { status: 400 });
    try {
      const dto = await this.getUseCase.execute(idParsed.data);
      const scope = await enforceBranchScope(req, dto.branchId, this.authzService);
      if (scope) return scope;
      return NextResponse.json(dto);
    } catch (err) {
      const mapped = mapDomainError(err, [[ExpenseNotFoundError, 404]]);
      if (mapped) return mapped;
      throw err;
    }
  }

  async create(req: NextRequest): Promise<NextResponse> {
    const body = await req.json().catch(() => ({}));
    const parsed = createBodySchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });

    const scope = await enforceBranchScope(req, parsed.data.branchId, this.authzService);
    if (scope) return scope;

    const creatorId = req.headers.get("x-user-id") ?? "";
    try {
      return NextResponse.json(
        await this.createUseCase.execute({ ...parsed.data, notes: parsed.data.notes ?? null, creatorId }),
        { status: 201 }
      );
    } catch (err) {
      const mapped = mapDomainError(err, [[ExpenseInvalidAmountError, 400]]);
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
      const existing = await this.getUseCase.execute(idParsed.data);
      const scope = await enforceBranchScope(req, existing.branchId, this.authzService);
      if (scope) return scope;

      return NextResponse.json(await this.updateUseCase.execute({ id: idParsed.data, ...parsed.data }));
    } catch (err) {
      const mapped = mapDomainError(err, [
        [ExpenseNotFoundError, 404],
        [ExpenseInvalidAmountError, 400],
      ]);
      if (mapped) return mapped;
      throw err;
    }
  }

  async softDelete(req: NextRequest, id: string): Promise<NextResponse> {
    const idParsed = uuidSchema.safeParse(id);
    if (!idParsed.success) return NextResponse.json({ error: idParsed.error.errors[0].message }, { status: 400 });
    try {
      const existing = await this.getUseCase.execute(idParsed.data);
      const scope = await enforceBranchScope(req, existing.branchId, this.authzService);
      if (scope) return scope;

      await this.softDeleteUseCase.execute(idParsed.data);
      return new NextResponse(null, { status: 204 });
    } catch (err) {
      const mapped = mapDomainError(err, [[ExpenseNotFoundError, 404]]);
      if (mapped) return mapped;
      throw err;
    }
  }

  async uploadPhoto(req: NextRequest, id: string): Promise<NextResponse> {
    const idParsed = uuidSchema.safeParse(id);
    if (!idParsed.success) return NextResponse.json({ error: idParsed.error.errors[0].message }, { status: 400 });

    try {
      const existing = await this.getUseCase.execute(idParsed.data);
      const scope = await enforceBranchScope(req, existing.branchId, this.authzService);
      if (scope) return scope;
    } catch (err) {
      const mapped = mapDomainError(err, [[ExpenseNotFoundError, 404]]);
      if (mapped) return mapped;
      throw err;
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
      const photoUrl = await this.uploadPhotoUseCase.execute({
        expenseId: idParsed.data,
        buffer,
        mime: file.type,
        sizeBytes: buffer.byteLength,
      });
      return NextResponse.json({ photoUrl });
    } catch (err) {
      const mapped = mapDomainError(err, [
        [InvalidExpensePhotoFormatError, 400],
        [ExpenseNotFoundError, 404],
      ]);
      if (mapped) return mapped;
      if (err instanceof ExpensePhotoTooLargeError) {
        return NextResponse.json({ error: err.message, maxBytes: err.maxBytes }, { status: 413 });
      }
      throw err;
    }
  }

  async deletePhoto(req: NextRequest, id: string): Promise<NextResponse> {
    const idParsed = uuidSchema.safeParse(id);
    if (!idParsed.success) return NextResponse.json({ error: idParsed.error.errors[0].message }, { status: 400 });

    try {
      const existing = await this.getUseCase.execute(idParsed.data);
      const scope = await enforceBranchScope(req, existing.branchId, this.authzService);
      if (scope) return scope;

      await this.deletePhotoUseCase.execute(idParsed.data);
      return new NextResponse(null, { status: 204 });
    } catch (err) {
      const mapped = mapDomainError(err, [[ExpenseNotFoundError, 404]]);
      if (mapped) return mapped;
      throw err;
    }
  }

  async report(req: NextRequest): Promise<NextResponse> {
    const { searchParams } = new URL(req.url);
    const parsed = historyQuerySchema.safeParse({
      format: searchParams.get("format") ?? undefined,
      page: searchParams.get("page") ?? undefined,
      pageSize: searchParams.get("pageSize") ?? undefined,
      branchId: searchParams.get("branchId") ?? undefined,
      concept: searchParams.get("concept") ?? undefined,
      from: searchParams.get("from") ?? undefined,
      to: searchParams.get("to") ?? undefined,
      includeInactive: searchParams.get("includeInactive") ?? undefined,
    });
    if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });

    const scoped = await resolveScopedBranchId(req, parsed.data.branchId, this.authzService);
    if (scoped instanceof NextResponse) return scoped;

    const userId = req.headers.get("x-user-id") ?? "";
    const userEmail = req.headers.get("x-user-email") ?? "";
    const isExport = parsed.data.format === "pdf" || parsed.data.format === "xlsx";

    const result = await this.reportUseCase.execute({
      filters: {
        branchId: scoped.branchId,
        concept: parsed.data.concept,
        from: parsed.data.from ? new Date(parsed.data.from) : undefined,
        to: parsed.data.to ? new Date(parsed.data.to) : undefined,
        includeInactive: parsed.data.includeInactive,
      },
      page: parsed.data.page,
      pageSize: parsed.data.pageSize,
      forPdf: isExport,
    });

    if (isExport && result.tooLarge) {
      return NextResponse.json({ error: "ReportTooLarge", limit: 10000 }, { status: 409 });
    }

    const generatedAt = new Date().toISOString();
    const rows: ExpenseHistoryRowDto[] = result.items.map(toExpenseHistoryRowDto);

    const dto: ExpensesReportDto = {
      generatedAt,
      generatedBy: { userId, email: userEmail },
      filters: {
        concept: parsed.data.concept ?? null,
        from: parsed.data.from ?? null,
        to: parsed.data.to ?? null,
        branchId: scoped.branchId ?? null,
        includeInactive: parsed.data.includeInactive,
      },
      items: rows,
      totals: {
        rowCount: result.total,
        totalAmount: result.totalAmount,
      },
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
    };

    if (!isExport) return NextResponse.json(dto);

    const dateStr = generatedAt.substring(0, 10);

    if (parsed.data.format === "xlsx") {
      const workbookBuffer = buildExpensesReportWorkbook(dto);
      return new NextResponse(workbookBuffer as unknown as BodyInit, {
        status: 200,
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="expenses-report-${dateStr}.xlsx"`,
        },
      });
    }

    const settings = await this.getTicketSettingsUseCase.execute();
    const issuer = toPdfIssuer(settings);
    const pdfBuffer = await renderToBuffer(React.createElement(ExpensesReportPdf, { data: dto, issuer }) as never);

    return new NextResponse(pdfBuffer as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="expenses-report-${dateStr}.pdf"`,
      },
    });
  }
}
