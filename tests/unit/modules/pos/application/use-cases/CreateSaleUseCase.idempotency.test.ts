import { CreateSaleUseCase } from "@/modules/pos/application/use-cases/CreateSaleUseCase";
import { InMemorySaleRepository } from "@/modules/pos/infrastructure/repositories/InMemorySaleRepository";
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
    getFolio: jest.fn().mockResolvedValue({ id: "f1", code: "VENTA", prefix: null, scope: "POS", isActive: true }),
    getPaymentMethod: jest.fn().mockResolvedValue({ id: "pm1", isActive: true, isCredit: false }),
    getDosificationForSale: jest.fn(),
    getDosificationSurchargePct: jest.fn().mockResolvedValue(5),
    isProductAvailableInBranch: jest.fn().mockResolvedValue(true),
    hasBranchPriceOverrides: jest.fn().mockResolvedValue(false),
  };
}

const baseReq = {
  branchId: "b1",
  customerId: "c1",
  paymentMethodId: "pm1",
  folioId: "f1",
  items: [{ productId: "p1", productPriceId: "pp1", quantity: 2 }],
};

describe("CreateSaleUseCase — idempotencia via clientRequestId (offline-sync)", () => {
  it("misma clientRequestId enviada dos veces devuelve la misma venta, sin doble folio ni doble decremento", async () => {
    const repo = new InMemorySaleRepository();
    const useCase = new CreateSaleUseCase(repo, makeLookups());
    const clientRequestId = "11111111-1111-1111-1111-111111111111";

    const first = await useCase.execute({ ...baseReq, clientRequestId }, "user-1");
    const second = await useCase.execute({ ...baseReq, clientRequestId }, "user-1");

    expect(second.dto.id).toBe(first.dto.id);
    expect(second.dto.folioNumber).toBe(first.dto.folioNumber);

    const { total } = await repo.findAll({ page: 1, pageSize: 10 });
    expect(total).toBe(1);
  });

  it("clientRequestId distinta crea ventas independientes", async () => {
    const repo = new InMemorySaleRepository();
    const useCase = new CreateSaleUseCase(repo, makeLookups());

    const first = await useCase.execute(
      { ...baseReq, clientRequestId: "11111111-1111-1111-1111-111111111111" },
      "user-1"
    );
    const second = await useCase.execute(
      { ...baseReq, clientRequestId: "22222222-2222-2222-2222-222222222222" },
      "user-1"
    );

    expect(second.dto.id).not.toBe(first.dto.id);
    const { total } = await repo.findAll({ page: 1, pageSize: 10 });
    expect(total).toBe(2);
  });

  it("clientRequestId ausente (flujo online) se comporta como hoy: no dedupe entre ventas distintas", async () => {
    const repo = new InMemorySaleRepository();
    const useCase = new CreateSaleUseCase(repo, makeLookups());

    const first = await useCase.execute(baseReq, "user-1");
    const second = await useCase.execute(baseReq, "user-1");

    expect(second.dto.id).not.toBe(first.dto.id);
    const { total } = await repo.findAll({ page: 1, pageSize: 10 });
    expect(total).toBe(2);
  });
});
