import { EditCompletedSaleUseCase } from "@/modules/pos/application/use-cases/EditCompletedSaleUseCase";
import { SaleRepository, SaleSummary, EditSaleData } from "@/modules/pos/application/ports/SaleRepository";
import { PosLookupService } from "@/modules/pos/application/ports/PosLookups";
import { Sale, SaleStatus } from "@/modules/pos/domain/entities/Sale";
import { SaleNotFoundError } from "@/modules/pos/domain/errors/SaleNotFoundError";
import { CancelledSaleNotEditableError } from "@/modules/pos/domain/errors/CancelledSaleNotEditableError";
import { EmptySaleError } from "@/modules/pos/domain/errors/EmptySaleError";
import { ProductPriceMismatchError } from "@/modules/pos/domain/errors/ProductPriceMismatchError";
import { ProductPriceNotAvailableForBranchError } from "@/modules/pos/domain/errors/ProductPriceNotAvailableForBranchError";
import { SaleHasActivePaymentsError } from "@/modules/payments/domain/errors/SaleHasActivePaymentsError";
import { ReturnedTotalSaleNotEditableError } from "@/modules/pos/domain/errors/ReturnedTotalSaleNotEditableError";

function makeSummary(status: SaleStatus): SaleSummary {
  const now = new Date();
  const sale = Sale.create({
    id: "sale-1",
    folioId: "f1",
    folioNumber: 1,
    folioCode: "F-1",
    branchId: "b1",
    customerId: "c1",
    cashierId: "u1",
    paymentMethodId: "pm1",
    quoteId: null,
    status,
    paidAmount: 0,
    paymentStatus: "paid",
    subtotal: 0,
    taxTotal: 0,
    total: 0,
    notes: null,
    completedAt: now,
    cancelledAt: status === "cancelled" ? now : null,
    cancellationReason: null,
    editedAt: status === "edited" ? now : null,
    createdAt: now,
    updatedAt: now,
    items: [],
  });
  return {
    sale,
    joined: { branchName: null, customerName: null, customerRfc: null, customerAddress: null, customerCreditDays: null, cashierName: null, paymentMethodCode: null, paymentMethodName: null, paymentMethodIsCredit: false },
  };
}

function makeLookups(overrides?: Partial<PosLookupService>): PosLookupService {
  return {
    getProduct: jest.fn().mockResolvedValue({
      id: "p1",
      code: "P1",
      name: "Producto",
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
    getDosificationForSale: jest.fn().mockResolvedValue({
      id: "d1",
      productId: "p1",
      name: "1/4",
      numParts: 4,
      isActive: true,
      basePrice: 100,
    }),
    getDosificationSurchargePct: jest.fn().mockResolvedValue(7),
    isProductAvailableInBranch: jest.fn().mockResolvedValue(true),
    hasBranchPriceOverrides: jest.fn().mockResolvedValue(false),
    ...overrides,
  };
}

function makeRepo(initialStatus: SaleStatus): SaleRepository {
  return {
    findAll: jest.fn(),
    findByClientRequestId: jest.fn(),
    findByIdWithItems: jest.fn().mockResolvedValue(makeSummary(initialStatus)),
    createCompleted: jest.fn(),
    createCompletedFromQuote: jest.fn(),
    cancel: jest.fn(),
    replaceItemsAndRecalculate: jest.fn((id: string, data: EditSaleData) =>
      Promise.resolve({
        ...makeSummary("edited"),
        sale: { ...makeSummary("edited").sale, subtotal: data.subtotal, taxTotal: data.taxTotal, total: data.total } as Sale,
      })
    ),
    markReturnedTotal: jest.fn(),
  };
}

const baseReq = { items: [{ productId: "p1", productPriceId: "pp1", quantity: 1 }] };

describe("EditCompletedSaleUseCase", () => {
  it("recalcula totales y delega al repo", async () => {
    const repo = makeRepo("completed");
    const result = await new EditCompletedSaleUseCase(repo, makeLookups()).execute("sale-1", baseReq);
    expect(result.dto.status).toBe("edited");
    expect(result.dto.subtotal).toBe(86.2069);
    expect(result.dto.taxTotal).toBe(13.7931);
    expect(result.dto.total).toBe(100);
  });

  it("rechaza venta cancelada con CancelledSaleNotEditableError", async () => {
    await expect(
      new EditCompletedSaleUseCase(makeRepo("cancelled"), makeLookups()).execute("sale-1", baseReq)
    ).rejects.toThrow(CancelledSaleNotEditableError);
  });

  it("permite editar una venta previamente editada", async () => {
    const repo = makeRepo("edited");
    const result = await new EditCompletedSaleUseCase(repo, makeLookups()).execute("sale-1", baseReq);
    expect(result.dto.status).toBe("edited");
  });

  it("lanza SaleNotFoundError cuando la venta no existe", async () => {
    const repo: SaleRepository = {
      findAll: jest.fn(),
      findByClientRequestId: jest.fn(),
      findByIdWithItems: jest.fn().mockResolvedValue(null),
      createCompleted: jest.fn(),
      createCompletedFromQuote: jest.fn(),
      cancel: jest.fn(),
      replaceItemsAndRecalculate: jest.fn(),
      markReturnedTotal: jest.fn(),
    };
    await expect(
      new EditCompletedSaleUseCase(repo, makeLookups()).execute("missing", baseReq)
    ).rejects.toThrow(SaleNotFoundError);
  });

  it("rechaza items vacíos con EmptySaleError", async () => {
    await expect(
      new EditCompletedSaleUseCase(makeRepo("completed"), makeLookups()).execute("sale-1", { items: [] })
    ).rejects.toThrow(EmptySaleError);
  });

  it("rechaza productPrice cuyo productId no coincide con el item", async () => {
    const lookups = makeLookups({
      getProductPrice: jest.fn().mockResolvedValue({
        id: "pp1",
        productId: "pX",
        name: "Otro",
        price: 100,
        discountPct: null,
      }),
    });
    await expect(
      new EditCompletedSaleUseCase(makeRepo("completed"), lookups).execute("sale-1", baseReq)
    ).rejects.toThrow(ProductPriceMismatchError);
  });

  it("ignora cambios de folioId/branchId (no se aceptan en el DTO)", async () => {
    const repo = makeRepo("completed");
    const result = await new EditCompletedSaleUseCase(repo, makeLookups()).execute("sale-1", baseReq);
    // El DTO de edición no incluye folioId/branchId; el use case nunca los pasa al repo
    const callArg = (repo.replaceItemsAndRecalculate as jest.Mock).mock.calls[0][1] as EditSaleData;
    expect("folioId" in callArg).toBe(false);
    expect("branchId" in callArg).toBe(false);
  });

  it("propaga SaleHasActivePaymentsError cuando el repo la lanza al editar", async () => {
    const repo: SaleRepository = {
      findAll: jest.fn(),
      findByClientRequestId: jest.fn(),
      findByIdWithItems: jest.fn().mockResolvedValue(makeSummary("completed")),
      createCompleted: jest.fn(),
      createCompletedFromQuote: jest.fn(),
      cancel: jest.fn(),
      replaceItemsAndRecalculate: jest.fn().mockRejectedValue(new SaleHasActivePaymentsError(["pay-1"])),
      markReturnedTotal: jest.fn(),
    };
    await expect(
      new EditCompletedSaleUseCase(repo, makeLookups()).execute("sale-1", baseReq)
    ).rejects.toBeInstanceOf(SaleHasActivePaymentsError);
  });

  it("lanza ReturnedTotalSaleNotEditableError cuando sale tiene status returned_total", async () => {
    await expect(
      new EditCompletedSaleUseCase(makeRepo("returned_total"), makeLookups()).execute("sale-1", baseReq)
    ).rejects.toBeInstanceOf(ReturnedTotalSaleNotEditableError);
  });

  it("reemplaza una línea de precio por una línea de dosificación", async () => {
    const repo = makeRepo("completed");
    await new EditCompletedSaleUseCase(repo, makeLookups()).execute("sale-1", {
      items: [{ productId: "p1", dosificationId: "d1", quantity: 3 }],
    });
    const callArg = (repo.replaceItemsAndRecalculate as jest.Mock).mock.calls[0][1] as EditSaleData;
    expect(callArg.items[0].dosificationId).toBe("d1");
    expect(callArg.items[0].numPartsSnapshot).toBe(4);
    expect(callArg.items[0].productPriceId).toBeNull();
    expect(callArg.items[0].unitPrice).toBeCloseTo(26.75, 4);
  });

  describe("recargo por cantidad fraccionaria (precio normal)", () => {
    it("aplica el recargo al editar una línea con quantity fraccionaria", async () => {
      const repo = makeRepo("completed");
      await new EditCompletedSaleUseCase(repo, makeLookups()).execute("sale-1", {
        items: [{ productId: "p1", productPriceId: "pp1", quantity: 2.5 }],
      });
      const callArg = (repo.replaceItemsAndRecalculate as jest.Mock).mock.calls[0][1] as EditSaleData;
      expect(callArg.items[0].unitPrice).toBeCloseTo(107, 10); // 100 * 1.07 (mock surcharge)
    });

    it("remueve el recargo al editar una línea de fraccionaria a entera", async () => {
      const repo = makeRepo("completed");
      await new EditCompletedSaleUseCase(repo, makeLookups()).execute("sale-1", baseReq); // quantity: 1
      const callArg = (repo.replaceItemsAndRecalculate as jest.Mock).mock.calls[0][1] as EditSaleData;
      expect(callArg.items[0].unitPrice).toBe(100);
    });
  });

  describe("gate de disponibilidad por sucursal (branchScopedInventory)", () => {
    it("rechaza producto no asignado a la sucursal cuando branchScopedInventory=true", async () => {
      const lookups = makeLookups({ isProductAvailableInBranch: jest.fn().mockResolvedValue(false) });
      await expect(
        new EditCompletedSaleUseCase(makeRepo("completed"), lookups, true).execute("sale-1", baseReq)
      ).rejects.toThrow("Product is not available in this branch");
    });

    it("permite producto asignado cuando branchScopedInventory=true", async () => {
      const lookups = makeLookups({ isProductAvailableInBranch: jest.fn().mockResolvedValue(true) });
      const result = await new EditCompletedSaleUseCase(makeRepo("completed"), lookups, true).execute("sale-1", baseReq);
      expect(result.dto.status).toBe("edited");
    });

    it("no aplica el gate cuando branchScopedInventory=false (default)", async () => {
      const lookups = makeLookups({ isProductAvailableInBranch: jest.fn().mockResolvedValue(false) });
      const result = await new EditCompletedSaleUseCase(makeRepo("completed"), lookups).execute("sale-1", baseReq);
      expect(result.dto.status).toBe("edited");
      expect(lookups.isProductAvailableInBranch).not.toHaveBeenCalled();
    });
  });

  describe("override de precio por sucursal", () => {
    it("rechaza el precio base cuando la sucursal ya tiene su propio override para ese producto", async () => {
      const lookups = makeLookups({ hasBranchPriceOverrides: jest.fn().mockResolvedValue(true) });
      await expect(
        new EditCompletedSaleUseCase(makeRepo("completed"), lookups).execute("sale-1", baseReq)
      ).rejects.toThrow(ProductPriceNotAvailableForBranchError);
    });

    it("acepta el precio base cuando la sucursal no tiene ningún override para ese producto", async () => {
      const lookups = makeLookups({ hasBranchPriceOverrides: jest.fn().mockResolvedValue(false) });
      const result = await new EditCompletedSaleUseCase(makeRepo("completed"), lookups).execute("sale-1", baseReq);
      expect(result.dto.status).toBe("edited");
    });
  });
});
