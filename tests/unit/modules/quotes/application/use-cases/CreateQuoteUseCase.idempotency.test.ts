import { CreateQuoteUseCase } from "@/modules/quotes/application/use-cases/CreateQuoteUseCase";
import { InMemoryQuoteRepository } from "@/modules/quotes/infrastructure/repositories/InMemoryQuoteRepository";
import { PosLookupService } from "@/modules/pos/application/ports/PosLookups";

function makeLookups(): PosLookupService {
  return {
    getProduct: jest.fn().mockResolvedValue({
      id: "p1",
      code: "P1",
      name: "Producto 1",
      ivaRate: 0.16,
      iepsRate: null,
      isActive: true,
    }),
    getProductPrice: jest.fn().mockResolvedValue({
      id: "pp1",
      productId: "p1",
      name: "Menudeo",
      price: 100,
      discountPct: null,
    }),
    getCustomer: jest.fn().mockResolvedValue({ id: "c1", isActive: true, creditLimit: null, currentBalance: 0 }),
    getBranch: jest.fn().mockResolvedValue({ id: "b1", isActive: true }),
    getFolio: jest.fn().mockResolvedValue({ id: "f1", code: "COT", prefix: null, scope: "POS", isActive: true }),
    getPaymentMethod: jest.fn(),
    getDosificationForSale: jest.fn(),
    getDosificationSurchargePct: jest.fn().mockResolvedValue(5),
    isProductAvailableInBranch: jest.fn().mockResolvedValue(true),
    hasBranchPriceOverrides: jest.fn().mockResolvedValue(false),
  };
}

const baseReq = {
  branchId: "b1",
  customerId: "c1",
  folioId: "f1",
  items: [{ productId: "p1", productPriceId: "pp1", quantity: 2 }],
};

describe("CreateQuoteUseCase — idempotencia via clientRequestId (offline-sync)", () => {
  it("misma clientRequestId enviada dos veces devuelve la misma cotización, sin doble folio", async () => {
    const repo = new InMemoryQuoteRepository();
    const useCase = new CreateQuoteUseCase(repo, makeLookups());
    const clientRequestId = "33333333-3333-3333-3333-333333333333";

    const first = await useCase.execute({ ...baseReq, clientRequestId }, "user-1");
    const second = await useCase.execute({ ...baseReq, clientRequestId }, "user-1");

    expect(second.dto.id).toBe(first.dto.id);
    expect(second.dto.folioNumber).toBe(first.dto.folioNumber);

    const { total } = await repo.findAll({ page: 1, pageSize: 10 });
    expect(total).toBe(1);
  });

  it("clientRequestId distinta crea cotizaciones independientes", async () => {
    const repo = new InMemoryQuoteRepository();
    const useCase = new CreateQuoteUseCase(repo, makeLookups());

    const first = await useCase.execute(
      { ...baseReq, clientRequestId: "33333333-3333-3333-3333-333333333333" },
      "user-1"
    );
    const second = await useCase.execute(
      { ...baseReq, clientRequestId: "44444444-4444-4444-4444-444444444444" },
      "user-1"
    );

    expect(second.dto.id).not.toBe(first.dto.id);
    const { total } = await repo.findAll({ page: 1, pageSize: 10 });
    expect(total).toBe(2);
  });

  it("clientRequestId ausente (flujo online) se comporta como hoy: no dedupe entre cotizaciones distintas", async () => {
    const repo = new InMemoryQuoteRepository();
    const useCase = new CreateQuoteUseCase(repo, makeLookups());

    const first = await useCase.execute(baseReq, "user-1");
    const second = await useCase.execute(baseReq, "user-1");

    expect(second.dto.id).not.toBe(first.dto.id);
    const { total } = await repo.findAll({ page: 1, pageSize: 10 });
    expect(total).toBe(2);
  });
});
