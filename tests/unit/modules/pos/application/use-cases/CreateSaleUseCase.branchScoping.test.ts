import { CreateSaleUseCase } from "@/modules/pos/application/use-cases/CreateSaleUseCase";
import { SaleRepository, SaleSummary, CreateSaleData } from "@/modules/pos/application/ports/SaleRepository";
import { PosLookupService } from "@/modules/pos/application/ports/PosLookups";
import { Sale } from "@/modules/pos/domain/entities/Sale";
import { SaleItem } from "@/modules/pos/domain/entities/SaleItem";
import { ProductPriceNotAvailableForBranchError } from "@/modules/pos/domain/errors/ProductPriceNotAvailableForBranchError";

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
      ivaRate: it.ivaRate,
      iepsRate: it.iepsRate,
      lineSubtotal: it.lineSubtotal,
      lineTax: it.lineTax,
      lineTotal: it.lineTotal,
    })
  );
  const sale = Sale.create({
    id: "sale-1",
    folioId: data.folioId,
    folioNumber: 1,
    folioCode: "F-1",
    branchId: data.branchId,
    customerId: data.customerId,
    cashierId: data.cashierId,
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
  return {
    sale,
    joined: {
      branchName: "Zarioz",
      customerName: "Cliente",
      customerRfc: "ACM010101AAA",
      customerAddress: null,
      customerCreditDays: null,
      cashierName: "Cajero",
      paymentMethodCode: "EFECTIVO",
      paymentMethodName: "Efectivo",
      paymentMethodIsCredit: false,
    },
  };
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
      branchId: null,
      name: "Precio Publico",
      price: 100,
      discountPct: null,
    }),
    getCustomer: jest.fn().mockResolvedValue({ id: "c1", isActive: true, creditLimit: null, currentBalance: 0 }),
    getBranch: jest.fn().mockResolvedValue({ id: ZARIOZ, isActive: true }),
    getFolio: jest.fn().mockResolvedValue({ id: "f1", code: "VENTA", prefix: null, scope: "POS", isActive: true }),
    getPaymentMethod: jest.fn().mockResolvedValue({ id: "pm1", isActive: true, isCredit: false }),
    getDosificationForSale: jest.fn().mockResolvedValue({
      id: "d1",
      productId: "p1",
      name: "1/4",
      numParts: 4,
      isActive: true,
      basePrice: 100,
    }),
    getDosificationSurchargePct: jest.fn().mockResolvedValue(5),
    isProductAvailableInBranch: jest.fn().mockResolvedValue(true),
    hasBranchPriceOverrides: jest.fn().mockResolvedValue(false),
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

describe("CreateSaleUseCase — precio por sucursal", () => {
  it("usa el precio base cuando branchId de la fila es null", async () => {
    const repo = makeRepo();
    await new CreateSaleUseCase(repo, makeLookups()).execute(baseReq, "user-1");
    const call = (repo.createCompleted as jest.Mock).mock.calls[0][0] as CreateSaleData;
    expect(call.items[0].unitPrice).toBe(100);
  });

  it("usa el override cuando branchId de la fila coincide con la sucursal de la venta", async () => {
    const repo = makeRepo();
    const lookups = makeLookups({
      getProductPrice: jest.fn().mockResolvedValue({
        id: "pp1",
        productId: "p1",
        branchId: ZARIOZ,
        name: "Precio Publico",
        price: 80,
        discountPct: null,
      }),
    });
    await new CreateSaleUseCase(repo, lookups).execute(baseReq, "user-1");
    const call = (repo.createCompleted as jest.Mock).mock.calls[0][0] as CreateSaleData;
    expect(call.items[0].unitPrice).toBe(80);
  });

  it("rechaza un precio cuyo branchId pertenece a otra sucursal", async () => {
    const lookups = makeLookups({
      getProductPrice: jest.fn().mockResolvedValue({
        id: "pp1",
        productId: "p1",
        branchId: HUAJUAPAN,
        name: "Precio Publico",
        price: 70,
        discountPct: null,
      }),
    });
    await expect(new CreateSaleUseCase(makeRepo(), lookups).execute(baseReq, "user-1")).rejects.toThrow(
      ProductPriceNotAvailableForBranchError
    );
  });

  it("rechaza el precio base cuando la sucursal ya tiene su propio override para ese producto", async () => {
    const lookups = makeLookups({
      hasBranchPriceOverrides: jest.fn().mockResolvedValue(true),
    });
    await expect(new CreateSaleUseCase(makeRepo(), lookups).execute(baseReq, "user-1")).rejects.toThrow(
      ProductPriceNotAvailableForBranchError
    );
  });

  it("acepta el precio base cuando la sucursal no tiene ningún override para ese producto", async () => {
    const repo = makeRepo();
    const lookups = makeLookups({
      hasBranchPriceOverrides: jest.fn().mockResolvedValue(false),
    });
    await new CreateSaleUseCase(repo, lookups).execute(baseReq, "user-1");
    const call = (repo.createCompleted as jest.Mock).mock.calls[0][0] as CreateSaleData;
    expect(call.items[0].unitPrice).toBe(100);
  });

  it("resuelve el default de dosificación pasando la sucursal propia de la venta", async () => {
    const lookups = makeLookups();
    await new CreateSaleUseCase(makeRepo(), lookups).execute(
      { ...baseReq, items: [{ productId: "p1", dosificationId: "d1", quantity: 4 }] },
      "user-1"
    );
    expect(lookups.getDosificationForSale).toHaveBeenCalledWith("d1", ZARIOZ);
  });
});
