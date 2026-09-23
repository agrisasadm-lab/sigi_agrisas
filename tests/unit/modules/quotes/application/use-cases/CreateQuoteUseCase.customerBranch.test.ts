import { CreateQuoteUseCase } from "@/modules/quotes/application/use-cases/CreateQuoteUseCase";
import { InMemoryQuoteRepository } from "@/modules/quotes/infrastructure/repositories/InMemoryQuoteRepository";
import { PosLookupService } from "@/modules/pos/application/ports/PosLookups";
import { CustomerNotAvailableInBranchError } from "@/modules/quotes/domain/errors/CustomerNotAvailableInBranchError";

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
      return { id, isActive: true, creditLimit: null, currentBalance: 0, email: null, branchIds: [ZARIOZ] };
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
      return { id, productId: PRODUCT_ID, branchId: ZARIOZ, name: "Menudeo", price: 100, discountPct: null };
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
    ...overrides,
  };
}

const baseCreateReq = {
  branchId: ZARIOZ,
  customerId: CUSTOMER_ID,
  folioId: FOLIO_ID,
  items: [{ productId: PRODUCT_ID, productPriceId: PRICE_ID, quantity: 2 }],
};

describe("CreateQuoteUseCase — cliente por sucursal", () => {
  let repo: InMemoryQuoteRepository;

  beforeEach(() => {
    repo = new InMemoryQuoteRepository();
    repo.reset();
  });

  it("rechaza un cliente fuera de sucursal", async () => {
    const lookups = makeLookups({
      async getCustomer(id) {
        return { id, isActive: true, creditLimit: null, currentBalance: 0, email: null, branchIds: [HUAJUAPAN] };
      },
    });
    await expect(new CreateQuoteUseCase(repo, lookups).execute(baseCreateReq, USER_ID)).rejects.toThrow(
      CustomerNotAvailableInBranchError
    );
  });

  it("acepta un cliente multi-sucursal que incluye la de la operación", async () => {
    const lookups = makeLookups({
      async getCustomer(id) {
        return { id, isActive: true, creditLimit: null, currentBalance: 0, email: null, branchIds: [HUAJUAPAN, ZARIOZ] };
      },
    });
    const result = await new CreateQuoteUseCase(repo, lookups).execute(baseCreateReq, USER_ID);
    expect(result.dto.status).toBe("draft");
  });

  it("customerId nulo no dispara el gate", async () => {
    const getCustomerSpy = jest.fn();
    const lookups = makeLookups({ getCustomer: getCustomerSpy });
    const result = await new CreateQuoteUseCase(repo, lookups).execute(
      { ...baseCreateReq, customerId: undefined },
      USER_ID
    );
    expect(result.dto.status).toBe("draft");
    expect(getCustomerSpy).not.toHaveBeenCalled();
  });

  it("gate incondicional: rechaza cliente fuera de sucursal tanto con branchScopedInventory=false como =true", async () => {
    const lookups = makeLookups({
      async getCustomer(id) {
        return { id, isActive: true, creditLimit: null, currentBalance: 0, email: null, branchIds: [HUAJUAPAN] };
      },
    });
    await expect(
      new CreateQuoteUseCase(repo, lookups, false).execute(baseCreateReq, USER_ID)
    ).rejects.toThrow(CustomerNotAvailableInBranchError);
    repo.reset();
    await expect(
      new CreateQuoteUseCase(repo, lookups, true).execute(baseCreateReq, USER_ID)
    ).rejects.toThrow(CustomerNotAvailableInBranchError);
  });
});
