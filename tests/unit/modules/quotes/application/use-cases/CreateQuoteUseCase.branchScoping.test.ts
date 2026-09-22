import { CreateQuoteUseCase } from "@/modules/quotes/application/use-cases/CreateQuoteUseCase";
import { UpdateQuoteUseCase } from "@/modules/quotes/application/use-cases/UpdateQuoteUseCase";
import { InMemoryQuoteRepository } from "@/modules/quotes/infrastructure/repositories/InMemoryQuoteRepository";
import { PosLookupService } from "@/modules/pos/application/ports/PosLookups";
import { ProductPriceNotAvailableForBranchError } from "@/modules/quotes/domain/errors/ProductPriceNotAvailableForBranchError";

const ZARIOZ = "11111111-1111-1111-1111-111111111111";
const HUAJUAPAN = "88888888-8888-8888-8888-888888888888";
const CUSTOMER_ID = "22222222-2222-2222-2222-222222222222";
const FOLIO_ID = "33333333-3333-3333-3333-333333333333";
const PRODUCT_ID = "44444444-4444-4444-4444-444444444444";
const PRICE_ID = "55555555-5555-5555-5555-555555555555";
const USER_ID = "00000000-0000-0000-0000-000000000001";

function makeLookups(overrides: Partial<PosLookupService> = {}): PosLookupService {
  return {
    async getCustomer(id) {
      return { id, isActive: true, creditLimit: null, currentBalance: 0, email: null };
    },
    async getBranch(id) {
      return { id, isActive: true };
    },
    async getFolio(id) {
      return { id, code: "COT", prefix: "COT", scope: "POS", isActive: true };
    },
    async getPaymentMethod(id) {
      return { id, isActive: true, isCredit: false };
    },
    async getProduct(id) {
      return { id, code: "FERT_001", name: "Fertilizante", ivaRate: 0.16, iepsRate: null, isTaxable: true, isActive: true };
    },
    async getProductPrice(id) {
      return { id, productId: PRODUCT_ID, branchId: null, name: "Menudeo", price: 100, discountPct: null };
    },
    async getDosificationForSale() {
      return null;
    },
    async getDosificationSurchargePct() {
      return 5;
    },
    async isProductAvailableInBranch() {
      return true;
    },
    async hasBranchPriceOverrides() {
      return false;
    },
    ...overrides,
  };
}

const baseCreateReq = {
  branchId: ZARIOZ,
  customerId: CUSTOMER_ID,
  folioId: FOLIO_ID,
  items: [{ productId: PRODUCT_ID, productPriceId: PRICE_ID, quantity: 2 }],
};

describe("CreateQuoteUseCase — precio por sucursal", () => {
  let repo: InMemoryQuoteRepository;

  beforeEach(() => {
    repo = new InMemoryQuoteRepository();
    repo.reset();
  });

  it("usa el override cuando pertenece a la sucursal de la cotización", async () => {
    const lookups = makeLookups({
      getProductPrice: async (id) => ({ id, productId: PRODUCT_ID, branchId: ZARIOZ, name: "Menudeo", price: 80, discountPct: null }),
    });
    const result = await new CreateQuoteUseCase(repo, lookups).execute(baseCreateReq, USER_ID);
    expect(result.dto.items[0].unitPrice).toBe(80);
  });

  it("rechaza un precio cuyo branchId pertenece a otra sucursal", async () => {
    const lookups = makeLookups({
      getProductPrice: async (id) => ({ id, productId: PRODUCT_ID, branchId: HUAJUAPAN, name: "Menudeo", price: 70, discountPct: null }),
    });
    await expect(new CreateQuoteUseCase(repo, lookups).execute(baseCreateReq, USER_ID)).rejects.toThrow(
      ProductPriceNotAvailableForBranchError
    );
  });

  it("rechaza el precio base cuando la sucursal ya tiene su propio override para ese producto", async () => {
    const lookups = makeLookups({ hasBranchPriceOverrides: async () => true });
    await expect(new CreateQuoteUseCase(repo, lookups).execute(baseCreateReq, USER_ID)).rejects.toThrow(
      ProductPriceNotAvailableForBranchError
    );
  });

  it("acepta el precio base cuando la sucursal no tiene ningún override para ese producto", async () => {
    const lookups = makeLookups({ hasBranchPriceOverrides: async () => false });
    const result = await new CreateQuoteUseCase(repo, lookups).execute(baseCreateReq, USER_ID);
    expect(result.dto.items[0].unitPrice).toBe(100);
  });
});

describe("UpdateQuoteUseCase — precio por sucursal", () => {
  let repo: InMemoryQuoteRepository;

  beforeEach(() => {
    repo = new InMemoryQuoteRepository();
    repo.reset();
  });

  it("rechaza al editar items con un precio de otra sucursal", async () => {
    const lookups = makeLookups();
    const created = await new CreateQuoteUseCase(repo, lookups).execute(baseCreateReq, USER_ID);
    const editLookups = makeLookups({
      getProductPrice: async (id) => ({ id, productId: PRODUCT_ID, branchId: HUAJUAPAN, name: "Menudeo", price: 70, discountPct: null }),
    });
    await expect(
      new UpdateQuoteUseCase(repo, editLookups).execute(created.dto.id, {
        items: [{ productId: PRODUCT_ID, productPriceId: PRICE_ID, quantity: 1 }],
      })
    ).rejects.toThrow(ProductPriceNotAvailableForBranchError);
  });

  it("rechaza al editar items con el precio base cuando la sucursal ya tiene su propio override", async () => {
    const lookups = makeLookups();
    const created = await new CreateQuoteUseCase(repo, lookups).execute(baseCreateReq, USER_ID);
    const editLookups = makeLookups({ hasBranchPriceOverrides: async () => true });
    await expect(
      new UpdateQuoteUseCase(repo, editLookups).execute(created.dto.id, {
        items: [{ productId: PRODUCT_ID, productPriceId: PRICE_ID, quantity: 1 }],
      })
    ).rejects.toThrow(ProductPriceNotAvailableForBranchError);
  });
});
