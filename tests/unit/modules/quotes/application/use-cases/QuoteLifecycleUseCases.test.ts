/**
 * Consolidated unit tests for the quote lifecycle use cases:
 * Create, List, Get, Update, Authorize, Cancel, Convert.
 * Uses InMemoryQuoteRepository + a hand-rolled PosLookupService stub.
 *
 * Integration coverage (real DB transactions, folio increment, etc.) lives in
 * tests/integration/modules/quotes/*.
 */
import { CreateQuoteUseCase } from "@/modules/quotes/application/use-cases/CreateQuoteUseCase";
import { ListQuotesUseCase } from "@/modules/quotes/application/use-cases/ListQuotesUseCase";
import { GetQuoteUseCase } from "@/modules/quotes/application/use-cases/GetQuoteUseCase";
import { UpdateQuoteUseCase } from "@/modules/quotes/application/use-cases/UpdateQuoteUseCase";
import { AuthorizeQuoteUseCase } from "@/modules/quotes/application/use-cases/AuthorizeQuoteUseCase";
import { CancelQuoteUseCase } from "@/modules/quotes/application/use-cases/CancelQuoteUseCase";
import { ConvertQuoteToSaleUseCase } from "@/modules/quotes/application/use-cases/ConvertQuoteToSaleUseCase";
import { InMemoryQuoteRepository } from "@/modules/quotes/infrastructure/repositories/InMemoryQuoteRepository";
import { InMemorySaleRepository } from "@/modules/pos/infrastructure/repositories/InMemorySaleRepository";
import { PosLookupService } from "@/modules/pos/application/ports/PosLookups";
import { EmptyQuoteError } from "@/modules/quotes/domain/errors/EmptyQuoteError";
import { ProductPriceMismatchError } from "@/modules/quotes/domain/errors/ProductPriceMismatchError";
import { InactiveResourceError } from "@/modules/quotes/domain/errors/InactiveResourceError";
import { QuoteNotFoundError } from "@/modules/quotes/domain/errors/QuoteNotFoundError";
import { QuoteNotEditableError } from "@/modules/quotes/domain/errors/QuoteNotEditableError";
import { QuoteAlreadyAuthorizedError } from "@/modules/quotes/domain/errors/QuoteAlreadyAuthorizedError";
import { QuoteNotAuthorizedError } from "@/modules/quotes/domain/errors/QuoteNotAuthorizedError";
import { QuoteAlreadyConvertedError } from "@/modules/quotes/domain/errors/QuoteAlreadyConvertedError";
import { QuoteAlreadyCancelledError } from "@/modules/quotes/domain/errors/QuoteAlreadyCancelledError";
import { QuoteExpiredError } from "@/modules/quotes/domain/errors/QuoteExpiredError";
import { FolioScopeMismatchError } from "@/shared/domain/errors/FolioScopeMismatchError";

const BRANCH_ID = "11111111-1111-1111-1111-111111111111";
const CUSTOMER_ID = "22222222-2222-2222-2222-222222222222";
const FOLIO_ID = "33333333-3333-3333-3333-333333333333";
const PRODUCT_ID = "44444444-4444-4444-4444-444444444444";
const PRICE_ID = "55555555-5555-5555-5555-555555555555";
const PAYMENT_ID = "66666666-6666-6666-6666-666666666666";
const FISCAL_FOLIO_ID = "77777777-7777-7777-7777-777777777777";
const USER_ID = "00000000-0000-0000-0000-000000000001";

function makeLookups(overrides: Partial<PosLookupService> = {}): PosLookupService {
  return {
    async getCustomer(id) {
      if (overrides.getCustomer) return overrides.getCustomer(id);
      return { id, isActive: true, creditLimit: null, currentBalance: 0, email: null };
    },
    async getBranch(id) {
      if (overrides.getBranch) return overrides.getBranch(id);
      return { id, isActive: true };
    },
    async getFolio(id) {
      if (overrides.getFolio) return overrides.getFolio(id);
      return { id, code: "COT", prefix: "COT", scope: "POS", isActive: true };
    },
    async getPaymentMethod(id) {
      if (overrides.getPaymentMethod) return overrides.getPaymentMethod(id);
      return { id, isActive: true, isCredit: false };
    },
    async getProduct(id) {
      if (overrides.getProduct) return overrides.getProduct(id);
      return { id, code: "FERT_001", name: "Fertilizante", ivaRate: 0.16, iepsRate: null, isTaxable: true, isActive: true };
    },
    async getProductPrice(id) {
      if (overrides.getProductPrice) return overrides.getProductPrice(id);
      return { id, productId: PRODUCT_ID, name: "Menudeo", price: 100, discountPct: null };
    },
    async getDosificationForSale(id) {
      if (overrides.getDosificationForSale) return overrides.getDosificationForSale(id);
      return null;
    },
    async getDosificationSurchargePct() {
      if (overrides.getDosificationSurchargePct) return overrides.getDosificationSurchargePct();
      // 8% (not the 5% default) to distinguish "surcharge applied" from "surcharge default" in assertions.
      return 8;
    },
    async isProductAvailableInBranch(productId, branchId) {
      if (overrides.isProductAvailableInBranch) return overrides.isProductAvailableInBranch(productId, branchId);
      return true;
    },
    async hasBranchPriceOverrides(productId, branchId) {
      if (overrides.hasBranchPriceOverrides) return overrides.hasBranchPriceOverrides(productId, branchId);
      return false;
    },
  };
}

const baseCreateReq = {
  branchId: BRANCH_ID,
  customerId: CUSTOMER_ID,
  folioId: FOLIO_ID,
  items: [{ productId: PRODUCT_ID, productPriceId: PRICE_ID, quantity: 2 }],
};

describe("CreateQuoteUseCase", () => {
  let repo: InMemoryQuoteRepository;

  beforeEach(() => {
    repo = new InMemoryQuoteRepository();
    repo.reset();
  });

  it("crea una cotización en estado draft con totales calculados", async () => {
    const uc = new CreateQuoteUseCase(repo, makeLookups());
    const { dto } = await uc.execute(baseCreateReq, USER_ID);
    expect(dto.status).toBe("draft");
    expect(dto.subtotal).toBe(172.4138); // 2 × 100 = 200 gross, IVA 16% extraído
    expect(dto.taxTotal).toBe(27.5862);
    expect(dto.total).toBe(200);
    expect(dto.items).toHaveLength(1);
    expect(dto.items[0].productCodeSnapshot).toBe("FERT_001");
    expect(dto.creatorId).toBe(USER_ID);
    expect(dto.folioNumber).toBe(1);
    expect(dto.convertedSaleId).toBeNull();
  });

  it("lanza EmptyQuoteError con items vacíos", async () => {
    const uc = new CreateQuoteUseCase(repo, makeLookups());
    await expect(uc.execute({ ...baseCreateReq, items: [] }, USER_ID)).rejects.toThrow(
      EmptyQuoteError
    );
  });

  it("lanza ProductPriceMismatchError cuando price.productId no coincide", async () => {
    const uc = new CreateQuoteUseCase(
      repo,
      makeLookups({
        async getProductPrice(id) {
          return { id, productId: "OTRO_PRODUCT", name: "X", price: 10, discountPct: null };
        },
      })
    );
    await expect(uc.execute(baseCreateReq, USER_ID)).rejects.toThrow(ProductPriceMismatchError);
  });

  it("rechaza customer inactivo", async () => {
    const uc = new CreateQuoteUseCase(
      repo,
      makeLookups({ async getCustomer(id) { return { id, isActive: false, creditLimit: null, currentBalance: 0, email: null }; } })
    );
    await expect(uc.execute(baseCreateReq, USER_ID)).rejects.toThrow(InactiveResourceError);
  });

  it("rechaza folio inactivo", async () => {
    const uc = new CreateQuoteUseCase(
      repo,
      makeLookups({
        async getFolio(id) {
          return { id, code: "COT", prefix: null, scope: "POS", isActive: false };
        },
      })
    );
    await expect(uc.execute(baseCreateReq, USER_ID)).rejects.toThrow(InactiveResourceError);
  });

  it("rechaza producto inactivo", async () => {
    const uc = new CreateQuoteUseCase(
      repo,
      makeLookups({
        async getProduct(id) {
          return { id, code: "X", name: "X", ivaRate: null, iepsRate: null, isTaxable: true, isActive: false };
        },
      })
    );
    await expect(uc.execute(baseCreateReq, USER_ID)).rejects.toThrow(InactiveResourceError);
  });

  it("rechaza expiresAt en el pasado", async () => {
    const uc = new CreateQuoteUseCase(repo, makeLookups());
    await expect(
      uc.execute({ ...baseCreateReq, expiresAt: "2020-01-01T00:00:00Z" }, USER_ID)
    ).rejects.toThrow(/expiresAt/);
  });

  it("rechaza folio con scope OPERATIONS (espera POS)", async () => {
    const uc = new CreateQuoteUseCase(
      repo,
      makeLookups({
        async getFolio(id) { return { id, code: "RB", prefix: "RB-", scope: "OPERATIONS", isActive: true }; },
      })
    );
    const err = await uc.execute(baseCreateReq, USER_ID).catch((e) => e);
    expect(err).toBeInstanceOf(FolioScopeMismatchError);
    expect(err.expected).toBe("POS");
    expect(err.actual).toBe("OPERATIONS");
  });

  it("rechaza folio con scope INVENTORY (espera POS)", async () => {
    const uc = new CreateQuoteUseCase(
      repo,
      makeLookups({
        async getFolio(id) { return { id, code: "TS", prefix: "TS-", scope: "INVENTORY", isActive: true }; },
      })
    );
    const err = await uc.execute(baseCreateReq, USER_ID).catch((e) => e);
    expect(err).toBeInstanceOf(FolioScopeMismatchError);
    expect(err.actual).toBe("INVENTORY");
  });

  it("aplica el recargo configurado cuando quantity es fraccionaria", async () => {
    const uc = new CreateQuoteUseCase(repo, makeLookups());
    const { dto } = await uc.execute(
      { ...baseCreateReq, items: [{ productId: PRODUCT_ID, productPriceId: PRICE_ID, quantity: 0.5 }] },
      USER_ID
    );
    expect(dto.items[0].unitPrice).toBeCloseTo(108, 10); // 100 * 1.08 (mock surcharge)
  });

  it("no aplica recargo cuando quantity es entera", async () => {
    const uc = new CreateQuoteUseCase(repo, makeLookups());
    const { dto } = await uc.execute(baseCreateReq, USER_ID); // quantity: 2
    expect(dto.items[0].unitPrice).toBe(100);
  });

  describe("gate de disponibilidad por sucursal (branchScopedInventory)", () => {
    it("rechaza producto no asignado a la sucursal cuando branchScopedInventory=true", async () => {
      const lookups = makeLookups({ isProductAvailableInBranch: jest.fn().mockResolvedValue(false) });
      const uc = new CreateQuoteUseCase(repo, lookups, true);
      await expect(uc.execute(baseCreateReq, USER_ID)).rejects.toThrow("Product is not available in this branch");
    });

    it("permite producto asignado cuando branchScopedInventory=true", async () => {
      const lookups = makeLookups({ isProductAvailableInBranch: jest.fn().mockResolvedValue(true) });
      const uc = new CreateQuoteUseCase(repo, lookups, true);
      const { dto } = await uc.execute(baseCreateReq, USER_ID);
      expect(dto.status).toBe("draft");
    });

    it("no aplica el gate cuando branchScopedInventory=false (default)", async () => {
      const isProductAvailableInBranch = jest.fn().mockResolvedValue(false);
      const uc = new CreateQuoteUseCase(repo, makeLookups({ isProductAvailableInBranch }));
      const { dto } = await uc.execute(baseCreateReq, USER_ID);
      expect(dto.status).toBe("draft");
      expect(isProductAvailableInBranch).not.toHaveBeenCalled();
    });
  });
});

describe("ListQuotesUseCase / GetQuoteUseCase", () => {
  let repo: InMemoryQuoteRepository;

  beforeEach(async () => {
    repo = new InMemoryQuoteRepository();
    repo.reset();
    const create = new CreateQuoteUseCase(repo, makeLookups());
    await create.execute(baseCreateReq, USER_ID);
    await create.execute({ ...baseCreateReq, customerId: "9999999-9999" as never }, USER_ID).catch(() => undefined);
    await create.execute(baseCreateReq, USER_ID);
  });

  it("lista con paginación", async () => {
    const uc = new ListQuotesUseCase(repo);
    const res = await uc.execute({ page: 1, pageSize: 10 });
    expect(res.total).toBeGreaterThanOrEqual(2);
    expect(res.items.every((q) => q.status === "draft")).toBe(true);
  });

  it("filtra por branchId", async () => {
    const uc = new ListQuotesUseCase(repo);
    const res = await uc.execute({ page: 1, pageSize: 10, branchId: BRANCH_ID });
    expect(res.items.every((q) => q.branchId === BRANCH_ID)).toBe(true);
  });

  it("get devuelve isExpired=false para draft sin expiresAt", async () => {
    const created = (await repo.findAll({ page: 1, pageSize: 1 })).items[0];
    const uc = new GetQuoteUseCase(repo);
    const { dto } = await uc.execute(created.quote.id);
    expect(dto.isExpired).toBe(false);
    expect(dto.items.length).toBeGreaterThan(0);
  });

  it("get lanza QuoteNotFoundError cuando no existe", async () => {
    const uc = new GetQuoteUseCase(repo);
    await expect(uc.execute("missing-id")).rejects.toThrow(QuoteNotFoundError);
  });
});

describe("UpdateQuoteUseCase", () => {
  let repo: InMemoryQuoteRepository;
  let id: string;

  beforeEach(async () => {
    repo = new InMemoryQuoteRepository();
    repo.reset();
    const create = new CreateQuoteUseCase(repo, makeLookups());
    const { dto } = await create.execute(baseCreateReq, USER_ID);
    id = dto.id;
  });

  it("edita items en estado draft y recalcula totales", async () => {
    const uc = new UpdateQuoteUseCase(repo, makeLookups());
    const { dto } = await uc.execute(id, {
      items: [
        { productId: PRODUCT_ID, productPriceId: PRICE_ID, quantity: 1 },
        { productId: PRODUCT_ID, productPriceId: PRICE_ID, quantity: 3 },
      ],
    });
    expect(dto.subtotal).toBe(344.8276); // línea qty1 (86.2069) + línea qty3 (258.6207), IVA 16% extraído por línea
    expect(dto.taxTotal).toBe(55.1724);
    expect(dto.total).toBe(400);
  });

  it("edita sólo notes sin recalcular totales", async () => {
    const uc = new UpdateQuoteUseCase(repo, makeLookups());
    const before = await new GetQuoteUseCase(repo).execute(id);
    const { dto } = await uc.execute(id, { notes: "nuevo" });
    expect(dto.notes).toBe("nuevo");
    expect(dto.subtotal).toBe(before.dto.subtotal);
  });

  it("rechaza items vacíos con EmptyQuoteError", async () => {
    const uc = new UpdateQuoteUseCase(repo, makeLookups());
    await expect(uc.execute(id, { items: [] })).rejects.toThrow(EmptyQuoteError);
  });

  it("rechaza edición de cotización autorizada con QuoteNotEditableError", async () => {
    await new AuthorizeQuoteUseCase(repo).execute(id, {}, USER_ID);
    const uc = new UpdateQuoteUseCase(repo, makeLookups());
    await expect(uc.execute(id, { notes: "x" })).rejects.toThrow(QuoteNotEditableError);
  });

  it("recalcula con recargo al cambiar una línea de cantidad entera a fraccionaria", async () => {
    const uc = new UpdateQuoteUseCase(repo, makeLookups());
    const { dto } = await uc.execute(id, {
      items: [{ productId: PRODUCT_ID, productPriceId: PRICE_ID, quantity: 2.5 }],
    });
    expect(dto.items[0].unitPrice).toBeCloseTo(108, 10); // 100 * 1.08 (mock surcharge)
  });

  describe("gate de disponibilidad por sucursal (branchScopedInventory)", () => {
    it("rechaza producto no asignado a la sucursal cuando branchScopedInventory=true", async () => {
      const lookups = makeLookups({ isProductAvailableInBranch: jest.fn().mockResolvedValue(false) });
      const uc = new UpdateQuoteUseCase(repo, lookups, true);
      await expect(
        uc.execute(id, { items: [{ productId: PRODUCT_ID, productPriceId: PRICE_ID, quantity: 1 }] })
      ).rejects.toThrow("Product is not available in this branch");
    });

    it("permite producto asignado cuando branchScopedInventory=true", async () => {
      const lookups = makeLookups({ isProductAvailableInBranch: jest.fn().mockResolvedValue(true) });
      const uc = new UpdateQuoteUseCase(repo, lookups, true);
      const { dto } = await uc.execute(id, {
        items: [{ productId: PRODUCT_ID, productPriceId: PRICE_ID, quantity: 1 }],
      });
      expect(dto.status).toBe("draft");
    });

    it("no aplica el gate cuando branchScopedInventory=false (default)", async () => {
      const isProductAvailableInBranch = jest.fn().mockResolvedValue(false);
      const uc = new UpdateQuoteUseCase(repo, makeLookups({ isProductAvailableInBranch }));
      const { dto } = await uc.execute(id, {
        items: [{ productId: PRODUCT_ID, productPriceId: PRICE_ID, quantity: 1 }],
      });
      expect(dto.status).toBe("draft");
      expect(isProductAvailableInBranch).not.toHaveBeenCalled();
    });
  });
});

describe("AuthorizeQuoteUseCase", () => {
  let repo: InMemoryQuoteRepository;
  let id: string;

  beforeEach(async () => {
    repo = new InMemoryQuoteRepository();
    repo.reset();
    const create = new CreateQuoteUseCase(repo, makeLookups());
    const { dto } = await create.execute(baseCreateReq, USER_ID);
    id = dto.id;
  });

  it("autoriza una cotización draft", async () => {
    const uc = new AuthorizeQuoteUseCase(repo);
    const { dto } = await uc.execute(id, {}, USER_ID);
    expect(dto.status).toBe("authorized");
    expect(dto.authorizedAt).not.toBeNull();
    expect(dto.authorizedBy).toBe(USER_ID);
  });

  it("rechaza autorizar dos veces (QuoteAlreadyAuthorizedError)", async () => {
    const uc = new AuthorizeQuoteUseCase(repo);
    await uc.execute(id, {}, USER_ID);
    await expect(uc.execute(id, {}, USER_ID)).rejects.toThrow(QuoteAlreadyAuthorizedError);
  });

  it("rechaza autorizar draft expirado (QuoteExpiredError)", async () => {
    // Force the existing draft into an "expired" state by injecting expiresAt
    // in the past via the InMemoryQuoteRepository internals. Easiest path:
    // create a new in-memory store with a pre-set expiresAt.
    const summary = (await repo.findByIdWithItems(id))!;
    // Re-construct the quote with expiresAt in the past
    const pastDate = new Date("2020-01-01");
    // mutate via private store reset + insert is overkill; we leverage updateMeta
    await repo.updateMeta(id, { expiresAt: pastDate });
    const uc = new AuthorizeQuoteUseCase(repo);
    await expect(uc.execute(id, {}, USER_ID)).rejects.toThrow(QuoteExpiredError);
    expect(summary.quote.id).toBe(id); // sanity
  });
});

describe("CancelQuoteUseCase", () => {
  let repo: InMemoryQuoteRepository;
  let id: string;

  beforeEach(async () => {
    repo = new InMemoryQuoteRepository();
    repo.reset();
    const create = new CreateQuoteUseCase(repo, makeLookups());
    const { dto } = await create.execute(baseCreateReq, USER_ID);
    id = dto.id;
  });

  it("cancela una cotización draft con razón", async () => {
    const uc = new CancelQuoteUseCase(repo);
    const { dto } = await uc.execute(id, { reason: "Cliente decidió no comprar" });
    expect(dto.status).toBe("cancelled");
    expect(dto.cancellationReason).toBe("Cliente decidió no comprar");
  });

  it("cancela una cotización autorizada", async () => {
    await new AuthorizeQuoteUseCase(repo).execute(id, {}, USER_ID);
    const uc = new CancelQuoteUseCase(repo);
    const { dto } = await uc.execute(id, {});
    expect(dto.status).toBe("cancelled");
  });

  it("rechaza cancelar dos veces (QuoteAlreadyCancelledError)", async () => {
    const uc = new CancelQuoteUseCase(repo);
    await uc.execute(id, {});
    await expect(uc.execute(id, {})).rejects.toThrow(QuoteAlreadyCancelledError);
  });

  it("rechaza cancelar una cotización convertida (QuoteAlreadyConvertedError)", async () => {
    await new AuthorizeQuoteUseCase(repo).execute(id, {}, USER_ID);
    await repo.markConverted(id, "sale-id-123");
    const uc = new CancelQuoteUseCase(repo);
    await expect(uc.execute(id, {})).rejects.toThrow(QuoteAlreadyConvertedError);
  });
});

describe("ConvertQuoteToSaleUseCase", () => {
  let qRepo: InMemoryQuoteRepository;
  let sRepo: InMemorySaleRepository;
  let id: string;

  beforeEach(async () => {
    qRepo = new InMemoryQuoteRepository();
    qRepo.reset();
    sRepo = new InMemorySaleRepository();
    sRepo.reset();
    const create = new CreateQuoteUseCase(qRepo, makeLookups());
    const { dto } = await create.execute(baseCreateReq, USER_ID);
    id = dto.id;
    await new AuthorizeQuoteUseCase(qRepo).execute(id, {}, USER_ID);
  });

  it("convierte una cotización autorizada en venta y deja la cotización en converted", async () => {
    const uc = new ConvertQuoteToSaleUseCase(qRepo, sRepo, makeLookups());
    const { dto } = await uc.execute(
      id,
      { paymentMethodId: PAYMENT_ID, folioId: FISCAL_FOLIO_ID },
      USER_ID
    );
    expect(dto.status).toBe("completed");
    expect(dto.quoteId).toBe(id);

    const after = (await qRepo.findByIdWithItems(id))!;
    expect(after.quote.status).toBe("converted");
    expect(after.quote.convertedSaleId).toBe(dto.id);
  });

  it("es idempotente: segunda conversión devuelve la misma venta", async () => {
    const uc = new ConvertQuoteToSaleUseCase(qRepo, sRepo, makeLookups());
    const first = await uc.execute(
      id,
      { paymentMethodId: PAYMENT_ID, folioId: FISCAL_FOLIO_ID },
      USER_ID
    );
    const second = await uc.execute(
      id,
      { paymentMethodId: PAYMENT_ID, folioId: FISCAL_FOLIO_ID },
      USER_ID
    );
    expect(second.dto.id).toBe(first.dto.id);
    // Verify no double creation in the store
    const all = await sRepo.findAll({ page: 1, pageSize: 10 });
    expect(all.total).toBe(1);
  });

  it("rechaza si status='draft' (QuoteNotAuthorizedError)", async () => {
    const create = new CreateQuoteUseCase(qRepo, makeLookups());
    const { dto: draft } = await create.execute(baseCreateReq, USER_ID);
    const uc = new ConvertQuoteToSaleUseCase(qRepo, sRepo, makeLookups());
    await expect(
      uc.execute(draft.id, { paymentMethodId: PAYMENT_ID, folioId: FISCAL_FOLIO_ID }, USER_ID)
    ).rejects.toThrow(QuoteNotAuthorizedError);
  });

  it("rechaza si status='cancelled'", async () => {
    await new CancelQuoteUseCase(qRepo).execute(id, {});
    const uc = new ConvertQuoteToSaleUseCase(qRepo, sRepo, makeLookups());
    await expect(
      uc.execute(id, { paymentMethodId: PAYMENT_ID, folioId: FISCAL_FOLIO_ID }, USER_ID)
    ).rejects.toThrow(QuoteNotAuthorizedError);
  });

  it("rechaza si está expirada (QuoteExpiredError)", async () => {
    await qRepo.updateMeta(id, { expiresAt: new Date("2020-01-01") });
    const uc = new ConvertQuoteToSaleUseCase(qRepo, sRepo, makeLookups());
    await expect(
      uc.execute(id, { paymentMethodId: PAYMENT_ID, folioId: FISCAL_FOLIO_ID }, USER_ID)
    ).rejects.toThrow(QuoteExpiredError);
  });

  it("rechaza si paymentMethod inactivo", async () => {
    const uc = new ConvertQuoteToSaleUseCase(
      qRepo,
      sRepo,
      makeLookups({ async getPaymentMethod(idArg) { return { id: idArg, isActive: false, isCredit: false }; } })
    );
    await expect(
      uc.execute(id, { paymentMethodId: PAYMENT_ID, folioId: FISCAL_FOLIO_ID }, USER_ID)
    ).rejects.toThrow(InactiveResourceError);
  });

  it("preserva el snapshot del precio (no re-resuelve el catálogo)", async () => {
    // The lookups would now return a different price, but the use case
    // builds the sale items from the quote snapshot, so unitPrice should stay 100.
    const uc = new ConvertQuoteToSaleUseCase(
      qRepo,
      sRepo,
      makeLookups({
        async getProductPrice(idArg) {
          return { id: idArg, productId: PRODUCT_ID, name: "Menudeo", price: 999, discountPct: null };
        },
      })
    );
    const { dto } = await uc.execute(
      id,
      { paymentMethodId: PAYMENT_ID, folioId: FISCAL_FOLIO_ID },
      USER_ID
    );
    expect(dto.items[0].unitPrice).toBe(100);
  });

  it("preserva el recargo por cantidad fraccionaria al convertir (no se re-resuelve el %)", async () => {
    const create = new CreateQuoteUseCase(qRepo, makeLookups());
    const { dto: draft } = await create.execute(
      { ...baseCreateReq, items: [{ productId: PRODUCT_ID, productPriceId: PRICE_ID, quantity: 0.5 }] },
      USER_ID
    );
    await new AuthorizeQuoteUseCase(qRepo).execute(draft.id, {}, USER_ID);
    expect(draft.items[0].unitPrice).toBeCloseTo(108, 10); // 100 * 1.08 baked in at creation

    // Convert with a DIFFERENT configured surcharge — must not re-resolve or re-apply it.
    const uc = new ConvertQuoteToSaleUseCase(
      qRepo,
      sRepo,
      makeLookups({ async getDosificationSurchargePct() { return 20; } })
    );
    const { dto } = await uc.execute(
      draft.id,
      { paymentMethodId: PAYMENT_ID, folioId: FISCAL_FOLIO_ID },
      USER_ID
    );
    expect(dto.items[0].unitPrice).toBeCloseTo(108, 10);
  });

  it("rechaza folio fiscal con scope OPERATIONS al convertir (espera POS)", async () => {
    const uc = new ConvertQuoteToSaleUseCase(
      qRepo,
      sRepo,
      makeLookups({
        async getFolio(id) { return { id, code: "RB", prefix: "RB-", scope: "OPERATIONS", isActive: true }; },
      })
    );
    const err = await uc.execute(id, { paymentMethodId: PAYMENT_ID, folioId: FISCAL_FOLIO_ID }, USER_ID).catch((e) => e);
    expect(err).toBeInstanceOf(FolioScopeMismatchError);
    expect(err.expected).toBe("POS");
    expect(err.actual).toBe("OPERATIONS");
  });

  it("rechaza folio fiscal con scope INVENTORY al convertir (espera POS)", async () => {
    const uc = new ConvertQuoteToSaleUseCase(
      qRepo,
      sRepo,
      makeLookups({
        async getFolio(id) { return { id, code: "TS", prefix: "TS-", scope: "INVENTORY", isActive: true }; },
      })
    );
    const err = await uc.execute(id, { paymentMethodId: PAYMENT_ID, folioId: FISCAL_FOLIO_ID }, USER_ID).catch((e) => e);
    expect(err).toBeInstanceOf(FolioScopeMismatchError);
    expect(err.actual).toBe("INVENTORY");
  });

  describe("gate de disponibilidad por sucursal (branchScopedInventory)", () => {
    it("rechaza la conversión si el producto dejó de estar asignado a la sucursal desde que se creó la cotización", async () => {
      const uc = new ConvertQuoteToSaleUseCase(
        qRepo,
        sRepo,
        makeLookups({ isProductAvailableInBranch: jest.fn().mockResolvedValue(false) }),
        true
      );
      await expect(
        uc.execute(id, { paymentMethodId: PAYMENT_ID, folioId: FISCAL_FOLIO_ID }, USER_ID)
      ).rejects.toThrow("Product is not available in this branch");

      const after = (await qRepo.findByIdWithItems(id))!;
      expect(after.quote.status).toBe("authorized");
      expect(after.quote.convertedSaleId).toBeNull();
    });

    it("permite la conversión cuando el producto sigue asignado", async () => {
      const uc = new ConvertQuoteToSaleUseCase(
        qRepo,
        sRepo,
        makeLookups({ isProductAvailableInBranch: jest.fn().mockResolvedValue(true) }),
        true
      );
      const { dto } = await uc.execute(id, { paymentMethodId: PAYMENT_ID, folioId: FISCAL_FOLIO_ID }, USER_ID);
      expect(dto.status).toBe("completed");
    });

    it("no aplica el gate cuando branchScopedInventory=false (default)", async () => {
      const isProductAvailableInBranch = jest.fn().mockResolvedValue(false);
      const uc = new ConvertQuoteToSaleUseCase(qRepo, sRepo, makeLookups({ isProductAvailableInBranch }));
      const { dto } = await uc.execute(id, { paymentMethodId: PAYMENT_ID, folioId: FISCAL_FOLIO_ID }, USER_ID);
      expect(dto.status).toBe("completed");
      expect(isProductAvailableInBranch).not.toHaveBeenCalled();
    });

    it("conversión idempotente no re-evalúa el gate en la segunda llamada", async () => {
      const isProductAvailableInBranch = jest.fn().mockResolvedValue(true);
      const uc = new ConvertQuoteToSaleUseCase(qRepo, sRepo, makeLookups({ isProductAvailableInBranch }), true);
      const first = await uc.execute(id, { paymentMethodId: PAYMENT_ID, folioId: FISCAL_FOLIO_ID }, USER_ID);
      const callsAfterFirst = isProductAvailableInBranch.mock.calls.length;

      const second = await uc.execute(id, { paymentMethodId: PAYMENT_ID, folioId: FISCAL_FOLIO_ID }, USER_ID);
      expect(second.dto.id).toBe(first.dto.id);
      expect(isProductAvailableInBranch.mock.calls.length).toBe(callsAfterFirst);
    });
  });
});
