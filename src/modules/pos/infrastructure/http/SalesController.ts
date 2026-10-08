import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { parseListQuery } from "@/shared/infrastructure/http/parseListQuery";
import { ListSalesUseCase } from "../../application/use-cases/ListSalesUseCase";
import { GetSaleUseCase } from "../../application/use-cases/GetSaleUseCase";
import { CreateSaleUseCase } from "../../application/use-cases/CreateSaleUseCase";
import { CancelSaleUseCase } from "../../application/use-cases/CancelSaleUseCase";
import { EditCompletedSaleUseCase } from "../../application/use-cases/EditCompletedSaleUseCase";
import { SendSaleTicketEmailUseCase } from "../../application/use-cases/SendSaleTicketEmailUseCase";
import { SaleNotFoundError } from "../../domain/errors/SaleNotFoundError";
import { SaleNoEmailError } from "../../domain/errors/SaleNoEmailError";
import { SaleEmailSendFailedError } from "../../domain/errors/SaleEmailSendFailedError";
import { EmptySaleError } from "../../domain/errors/EmptySaleError";
import { ProductPriceMismatchError } from "../../domain/errors/ProductPriceMismatchError";
import { ProductPriceNotAvailableForBranchError } from "../../domain/errors/ProductPriceNotAvailableForBranchError";
import { ProductNotAvailableInBranchError } from "../../domain/errors/ProductNotAvailableInBranchError";
import { CustomerNotAvailableInBranchError } from "../../domain/errors/CustomerNotAvailableInBranchError";
import { DosificationMismatchError } from "../../domain/errors/DosificationMismatchError";
import { DosificationRequiresDefaultPriceError } from "../../domain/errors/DosificationRequiresDefaultPriceError";
import { InactiveResourceError } from "../../domain/errors/InactiveResourceError";
import { FolioScopeMismatchError } from "@/shared/domain/errors/FolioScopeMismatchError";
import { CancelledSaleNotEditableError } from "../../domain/errors/CancelledSaleNotEditableError";
import { SaleNotEditableHereError } from "../../domain/errors/SaleNotEditableHereError";
import { ReturnedTotalSaleNotCancellableError } from "../../domain/errors/ReturnedTotalSaleNotCancellableError";
import { ReturnedTotalSaleNotEditableError } from "../../domain/errors/ReturnedTotalSaleNotEditableError";
import { QuoteLinkInvalidError } from "../../domain/errors/QuoteLinkInvalidError";
import { SaleStatus } from "../../domain/entities/Sale";
import { SaleHasActivePaymentsError } from "@/modules/payments/domain/errors/SaleHasActivePaymentsError";
import {
  enforceBranchScope,
  resolveScopedBranchId,
} from "@/modules/rbac/infrastructure/http/enforceBranchScope";
import { requirePermission } from "@/modules/rbac/infrastructure/http/requirePermission";
import { BranchRepository } from "@/modules/branches/application/ports/BranchRepository";
import { AuthorizationService } from "@/modules/rbac/application/ports/AuthorizationService";
import { PosLookupService } from "../../application/ports/PosLookups";

const uuidSchema = z.string().uuid("Invalid sale ID format");

const STATUS_VALUES: SaleStatus[] = ["completed", "cancelled", "edited", "returned_total"];

const listQueryFiltersSchema = z.object({
  branchId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
  status: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  search: z
    .string()
    .optional()
    .transform((v) => v?.trim() || undefined)
    .pipe(z.string().min(2, "search must be at least 2 characters").optional()),
});

const saleItemSchema = z
  .object({
    productId: z.string().uuid(),
    productPriceId: z.string().uuid().optional(),
    dosificationId: z.string().uuid().optional(),
    quantity: z.number().positive("quantity must be > 0"),
    discountPctOverride: z.number().min(0).max(100).nullable().optional(),
    discountAmount: z.number().min(0).max(100).nullable().optional(),
  })
  .refine((item) => Boolean(item.productPriceId) !== Boolean(item.dosificationId), {
    message: "Exactly one of productPriceId or dosificationId is required",
  })
  .refine(
    (item) => !((item.discountPctOverride ?? 0) > 0 && (item.discountAmount ?? 0) > 0),
    { message: "discountPctOverride and discountAmount are mutually exclusive" }
  );

const createSaleSchema = z.object({
  branchId: z.string().uuid(),
  customerId: z.string().uuid().nullable().optional(),
  paymentMethodId: z.string().uuid(),
  folioId: z.string().uuid(),
  notes: z.string().max(1000).nullable().optional(),
  quoteId: z.string().uuid().nullable().optional(),
  clientRequestId: z.string().uuid().nullable().optional(),
  items: z.array(saleItemSchema).min(1, "Sale must include at least one item"),
});

const cancelSaleSchema = z.object({
  reason: z.string().max(500).nullable().optional(),
});

const sendTicketEmailSchema = z.object({
  email: z.string().email().optional(),
});

const editSaleSchema = z.object({
  customerId: z.string().uuid().optional(),
  paymentMethodId: z.string().uuid().optional(),
  notes: z.string().max(1000).nullable().optional(),
  items: z.array(saleItemSchema).min(1, "Sale must include at least one item"),
});

export class SalesController {
  constructor(
    private readonly listUseCase: ListSalesUseCase,
    private readonly getUseCase: GetSaleUseCase,
    private readonly createUseCase: CreateSaleUseCase,
    private readonly cancelUseCase: CancelSaleUseCase,
    private readonly editUseCase: EditCompletedSaleUseCase,
    private readonly sendTicketEmailUseCase: SendSaleTicketEmailUseCase,
    private readonly branchRepo: BranchRepository,
    private readonly lookups: PosLookupService,
    private readonly authzService: AuthorizationService
  ) {}

  async list(req: NextRequest): Promise<NextResponse> {
    const { searchParams } = new URL(req.url);
    const parsed = parseListQuery(searchParams);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const filtersParsed = listQueryFiltersSchema.safeParse({
      branchId: searchParams.get("branchId") ?? undefined,
      customerId: searchParams.get("customerId") ?? undefined,
      status: searchParams.get("status") ?? undefined,
      from: searchParams.get("from") ?? undefined,
      to: searchParams.get("to") ?? undefined,
      search: searchParams.get("search") ?? undefined,
    });
    if (!filtersParsed.success) {
      return NextResponse.json({ error: filtersParsed.error.errors[0].message }, { status: 400 });
    }

    // Resolve branch scoping
    const scoped = await resolveScopedBranchId(req, filtersParsed.data.branchId, this.authzService);
    if (scoped instanceof NextResponse) return scoped;

    const statuses = filtersParsed.data.status
      ? filtersParsed.data.status
          .split(",")
          .map((s) => s.trim())
          .filter((s): s is SaleStatus => (STATUS_VALUES as string[]).includes(s))
      : undefined;

    const result = await this.listUseCase.execute({
      page: parsed.data.page,
      pageSize: parsed.data.pageSize,
      branchId: scoped.branchId,
      customerId: filtersParsed.data.customerId,
      statuses,
      from: filtersParsed.data.from ? new Date(filtersParsed.data.from) : undefined,
      to: filtersParsed.data.to ? new Date(filtersParsed.data.to) : undefined,
      search: filtersParsed.data.search,
    });
    return NextResponse.json(result);
  }

  async getById(req: NextRequest, id: string): Promise<NextResponse> {
    const idParsed = uuidSchema.safeParse(id);
    if (!idParsed.success) {
      return NextResponse.json({ error: idParsed.error.errors[0].message }, { status: 400 });
    }
    try {
      const { dto, branchId } = await this.getUseCase.execute(idParsed.data);
      const scope = await enforceBranchScope(req, branchId, this.authzService);
      if (scope) return scope;
      return NextResponse.json(dto);
    } catch (err) {
      if (err instanceof SaleNotFoundError) return NextResponse.json({ error: err.message }, { status: 404 });
      throw err;
    }
  }

  async create(req: NextRequest): Promise<NextResponse> {
    const body = await req.json().catch(() => ({}));
    const parsed = createSaleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }
    const scope = await enforceBranchScope(req, parsed.data.branchId, this.authzService);
    if (scope) return scope;

    // Check sales:create_credit BEFORE invoking the use case when using a credit method
    const pm = await this.lookups.getPaymentMethod(parsed.data.paymentMethodId);
    if (pm?.isCredit) {
      const permCheck = await requirePermission(req, "sales:create_credit", this.authzService);
      if (permCheck) return permCheck;
    }

    const cashierId = req.headers.get("x-user-id") ?? "";
    try {
      const { dto, creditLimitExceeded } = await this.createUseCase.execute(parsed.data, cashierId);
      return NextResponse.json({ ...dto, creditLimitExceeded }, { status: 201 });
    } catch (err) {
      if (err instanceof EmptySaleError) return NextResponse.json({ error: err.message }, { status: 400 });
      if (err instanceof ProductPriceMismatchError) return NextResponse.json({ error: err.message }, { status: 400 });
      if (err instanceof ProductPriceNotAvailableForBranchError) return NextResponse.json({ error: err.message }, { status: 400 });
      if (err instanceof ProductNotAvailableInBranchError) return NextResponse.json({ error: err.message }, { status: 400 });
      if (err instanceof CustomerNotAvailableInBranchError) return NextResponse.json({ error: err.message }, { status: 400 });
      if (err instanceof DosificationMismatchError) return NextResponse.json({ error: err.message }, { status: 400 });
      if (err instanceof DosificationRequiresDefaultPriceError) return NextResponse.json({ error: err.message }, { status: 400 });
      if (err instanceof InactiveResourceError) return NextResponse.json({ error: err.message }, { status: 400 });
      if (err instanceof FolioScopeMismatchError) {
        return NextResponse.json(
          { error: "FolioScopeMismatch", expected: err.expected, actual: err.actual },
          { status: 400 }
        );
      }
      if (err instanceof QuoteLinkInvalidError) {
        return NextResponse.json({ error: err.message, reason: err.reason }, { status: 400 });
      }
      throw err;
    }
  }

  async cancel(req: NextRequest, id: string): Promise<NextResponse> {
    const idParsed = uuidSchema.safeParse(id);
    if (!idParsed.success) {
      return NextResponse.json({ error: idParsed.error.errors[0].message }, { status: 400 });
    }
    const body = await req.json().catch(() => ({}));
    const parsed = cancelSaleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }
    try {
      // Resolve sale first to extract branchId for scope check
      const existing = await this.getUseCase.execute(idParsed.data);
      const scope = await enforceBranchScope(req, existing.branchId, this.authzService);
      if (scope) return scope;
      const { dto } = await this.cancelUseCase.execute(idParsed.data, parsed.data);
      return NextResponse.json(dto);
    } catch (err) {
      if (err instanceof SaleNotFoundError) return NextResponse.json({ error: err.message }, { status: 404 });
      if (err instanceof ReturnedTotalSaleNotCancellableError) return NextResponse.json({ error: err.message }, { status: 409 });
      if (err instanceof SaleHasActivePaymentsError) {
        return NextResponse.json({ error: "SaleHasActivePayments", paymentIds: err.paymentIds }, { status: 409 });
      }
      throw err;
    }
  }

  async edit(req: NextRequest, id: string): Promise<NextResponse> {
    const idParsed = uuidSchema.safeParse(id);
    if (!idParsed.success) {
      return NextResponse.json({ error: idParsed.error.errors[0].message }, { status: 400 });
    }
    const body = await req.json().catch(() => ({}));
    const parsed = editSaleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }

    // HQ guard: bypass or x-user-branch-id === headquarters.id
    const userId = req.headers.get("x-user-id") ?? "";
    const bypass = await this.authzService.userCan(userId, "branches:access_all");
    if (!bypass) {
      const userBranchId = req.headers.get("x-user-branch-id") ?? "";
      const hq = await this.branchRepo.findHeadquarters();
      if (!hq || userBranchId === "" || userBranchId !== hq.id) {
        return NextResponse.json(
          { error: "Sales can only be edited from the headquarters branch" },
          { status: 403 }
        );
      }
    }

    // If changing to a credit payment method, require sales:create_credit
    if (parsed.data.paymentMethodId) {
      const pm = await this.lookups.getPaymentMethod(parsed.data.paymentMethodId);
      if (pm?.isCredit) {
        const permCheck = await requirePermission(req, "sales:create_credit", this.authzService);
        if (permCheck) return permCheck;
      }
    }

    try {
      const { dto } = await this.editUseCase.execute(idParsed.data, parsed.data);
      return NextResponse.json(dto);
    } catch (err) {
      if (err instanceof SaleNotFoundError) return NextResponse.json({ error: err.message }, { status: 404 });
      if (err instanceof CancelledSaleNotEditableError) return NextResponse.json({ error: err.message }, { status: 409 });
      if (err instanceof ReturnedTotalSaleNotEditableError) return NextResponse.json({ error: err.message }, { status: 409 });
      if (err instanceof SaleNotEditableHereError) return NextResponse.json({ error: err.message }, { status: 403 });
      if (err instanceof EmptySaleError) return NextResponse.json({ error: err.message }, { status: 400 });
      if (err instanceof ProductPriceMismatchError) return NextResponse.json({ error: err.message }, { status: 400 });
      if (err instanceof ProductPriceNotAvailableForBranchError) return NextResponse.json({ error: err.message }, { status: 400 });
      if (err instanceof ProductNotAvailableInBranchError) return NextResponse.json({ error: err.message }, { status: 400 });
      if (err instanceof CustomerNotAvailableInBranchError) return NextResponse.json({ error: err.message }, { status: 400 });
      if (err instanceof DosificationMismatchError) return NextResponse.json({ error: err.message }, { status: 400 });
      if (err instanceof DosificationRequiresDefaultPriceError) return NextResponse.json({ error: err.message }, { status: 400 });
      if (err instanceof InactiveResourceError) return NextResponse.json({ error: err.message }, { status: 400 });
      if (err instanceof SaleHasActivePaymentsError) {
        return NextResponse.json({ error: "SaleHasActivePayments", paymentIds: err.paymentIds }, { status: 409 });
      }
      throw err;
    }
  }

  async sendTicketEmail(req: NextRequest, id: string): Promise<NextResponse> {
    const idParsed = uuidSchema.safeParse(id);
    if (!idParsed.success) {
      return NextResponse.json({ error: idParsed.error.errors[0].message }, { status: 400 });
    }
    const body = await req.json().catch(() => ({}));
    const parsed = sendTicketEmailSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }
    try {
      const existing = await this.getUseCase.execute(idParsed.data);
      const scope = await enforceBranchScope(req, existing.branchId, this.authzService);
      if (scope) return scope;
      const result = await this.sendTicketEmailUseCase.execute(idParsed.data, parsed.data.email);
      return NextResponse.json(result);
    } catch (err) {
      if (err instanceof SaleNotFoundError) return NextResponse.json({ error: err.message }, { status: 404 });
      if (err instanceof SaleNoEmailError) return NextResponse.json({ error: err.message }, { status: 400 });
      if (err instanceof SaleEmailSendFailedError) return NextResponse.json({ error: err.message }, { status: 502 });
      throw err;
    }
  }
}
