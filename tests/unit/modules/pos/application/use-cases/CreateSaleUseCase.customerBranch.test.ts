import { CreateSaleUseCase } from "@/modules/pos/application/use-cases/CreateSaleUseCase";
import { SaleRepository, SaleSummary, CreateSaleData } from "@/modules/pos/application/ports/SaleRepository";
import { PosLookupService } from "@/modules/pos/application/ports/PosLookups";
import { Sale } from "@/modules/pos/domain/entities/Sale";
import { SaleItem } from "@/modules/pos/domain/entities/SaleItem";
import { CustomerNotAvailableInBranchError } from "@/modules/pos/domain/errors/CustomerNotAvailableInBranchError";

function makeSummary(data: CreateSaleData): SaleSummary {
  const now = new Date();
  const items = data.items.map((it, idx) =>
    SaleItem.create({
      id: `it-${idx}`,
      saleId: "sale-1",
      productId: it.productId,
      productPriceId: it.productPriceId,
      dosificationId: it.dosificationId,
      numPartsSnapshot: it.numPartsSnapshot,
      productCodeSnapshot: it.productCodeSnapshot,
      productNameSnapshot: it.productNameSnapshot,
      priceNameSnapshot: it.priceNameSnapshot,
      quantity: it.quantity,
      unitPrice: it.unitPrice,
      discountPct: it.discountPct,
      discountAmount: it.discountAmount,
      ivaRate: it.ivaRate,
      iepsRate: it.iepsRate,
      lineSubtotal: 0,
      lineTax: 0,
      lineTotal: 0,
    })
  );
  const sale = Sale.create({
    id: "sale-1",
    folioId: data.folioId,
    folioNumber: 1,
    folioCode: "TK-000001",
    branchId: data.branchId,
    customerId: data.customerId,
    cashierId: "user-1",
    paymentMethodId: data.paymentMethodId,
    quoteId: data.quoteId ?? null,
    status: "completed",
    paidAmount: data.paidAmount,
    paymentStatus: data.paymentStatus,
    subtotal: data.subtotal,
    taxTotal: data.taxTotal,
    total: data.total,
    notes: data.notes,
    completedAt: now,
    cancelledAt: null,
    cancellationReason: null,
    editedAt: null,
    createdAt: now,
    updatedAt: now,
    items,
  });
  return { sale, joined: { branchName: null, customerName: null, customerRfc: null, customerAddress: null, customerCreditDays: null, cashierName: null, paymentMethodCode: null, paymentMethodName: null, paymentMethodIsCredit: false } };
}

function makeRepo(): SaleRepository {
  return {
    findAll: jest.fn(),
    findByIdWithItems: jest.fn(),
    findByClientRequestId: jest.fn().mockResolvedValue(null),
    createCompleted: jest.fn((data) => Promise.resolve(makeSummary(data))),
    createCompletedFromQuote: jest.fn((data) => Promise.resolve(makeSummary(data))),
    cancel: jest.fn(),
    replaceItemsAndRecalculate: jest.fn(),
    markReturnedTotal: jest.fn(),
  };
}

const ZARIOZ = "branch-zarioz";
const HUAJUAPAN = "branch-huajuapan";

function makeLookups(overrides?: Partial<PosLookupService>): PosLookupService {
  return {
    getProduct: jest.fn().mockResolvedValue({
      id: "p1", code: "P1", name: "Producto 1", ivaRate: 0.16, iepsRate: null, isActive: true,
    }),
    getProductPrice: jest.fn().mockResolvedValue({
      id: "pp1", productId: "p1", branchId: ZARIOZ, name: "Precio Publico", price: 100, discountPct: null,
    }),
    getCustomer: jest.fn().mockResolvedValue({ id: "c1", isActive: true, creditLimit: null, currentBalance: 0, branchIds: [ZARIOZ] }),
    getBranch: jest.fn().mockResolvedValue({ id: ZARIOZ, isActive: true }),
    getFolio: jest.fn().mockResolvedValue({ id: "f1", code: "VENTA", prefix: null, scope: "POS", isActive: true }),
    getPaymentMethod: jest.fn().mockResolvedValue({ id: "pm1", isActive: true, isCredit: false }),
    getDosificationForSale: jest.fn(),
    getDosificationSurchargePct: jest.fn().mockResolvedValue(5),
    isProductAvailableInBranch: jest.fn().mockResolvedValue(true),
    ...overrides,
  };
}

const baseReq = {
  branchId: ZARIOZ,
  customerId: "c1",
  paymentMethodId: "pm1",
  folioId: "f1",
  items: [{ productId: "p1", productPriceId: "pp1", quantity: 2 }],
};

describe("CreateSaleUseCase — cliente por sucursal", () => {
  it("rechaza un cliente fuera de sucursal", async () => {
    const lookups = makeLookups({
      getCustomer: jest.fn().mockResolvedValue({ id: "c1", isActive: true, creditLimit: null, currentBalance: 0, branchIds: [HUAJUAPAN] }),
    });
    await expect(new CreateSaleUseCase(makeRepo(), lookups).execute(baseReq, "user-1")).rejects.toThrow(
      CustomerNotAvailableInBranchError
    );
  });

  it("acepta un cliente multi-sucursal que incluye la de la operación", async () => {
    const lookups = makeLookups({
      getCustomer: jest.fn().mockResolvedValue({ id: "c1", isActive: true, creditLimit: null, currentBalance: 0, branchIds: [HUAJUAPAN, ZARIOZ] }),
    });
    const result = await new CreateSaleUseCase(makeRepo(), lookups).execute(baseReq, "user-1");
    expect(result.dto.status).toBe("completed");
  });

  it("customerId nulo no dispara el gate", async () => {
    const lookups = makeLookups({ getCustomer: jest.fn() });
    const result = await new CreateSaleUseCase(makeRepo(), lookups).execute(
      { ...baseReq, customerId: undefined },
      "user-1"
    );
    expect(result.dto.status).toBe("completed");
    expect(lookups.getCustomer).not.toHaveBeenCalled();
  });

  it("gate incondicional: rechaza cliente fuera de sucursal tanto con branchScopedInventory=false como =true", async () => {
    const lookups = makeLookups({
      getCustomer: jest.fn().mockResolvedValue({ id: "c1", isActive: true, creditLimit: null, currentBalance: 0, branchIds: [HUAJUAPAN] }),
      isProductAvailableInBranch: jest.fn().mockResolvedValue(true),
    });
    await expect(
      new CreateSaleUseCase(makeRepo(), lookups, undefined, false).execute(baseReq, "user-1")
    ).rejects.toThrow(CustomerNotAvailableInBranchError);
    await expect(
      new CreateSaleUseCase(makeRepo(), lookups, undefined, true).execute(baseReq, "user-1")
    ).rejects.toThrow(CustomerNotAvailableInBranchError);
  });
});
