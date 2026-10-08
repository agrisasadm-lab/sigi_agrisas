import { CreateReturnUseCase } from "@/modules/returns/application/use-cases/CreateReturnUseCase";
import { InMemoryReturnRepository } from "@/modules/returns/infrastructure/repositories/InMemoryReturnRepository";
import { InMemorySaleRepository } from "@/modules/pos/infrastructure/repositories/InMemorySaleRepository";
import { Sale } from "@/modules/pos/domain/entities/Sale";
import { SaleItem } from "@/modules/pos/domain/entities/SaleItem";
import { Return } from "@/modules/returns/domain/entities/Return";
import { ReturnItem } from "@/modules/returns/domain/entities/ReturnItem";
import { ReturnItemsEmptyError } from "@/modules/returns/domain/errors/ReturnItemsEmptyError";
import { SaleNotReturnableError } from "@/modules/returns/domain/errors/SaleNotReturnableError";
import { SaleItemNotPartOfSaleError } from "@/modules/returns/domain/errors/SaleItemNotPartOfSaleError";
import { ReturnQuantityExceedsRemainingError } from "@/modules/returns/domain/errors/ReturnQuantityExceedsRemainingError";
import { ReturnInvalidQuantityError } from "@/modules/returns/domain/errors/ReturnInvalidQuantityError";

const NOW = new Date("2026-06-01T10:00:00Z");

type SaleItemOverrides = { id: string; saleId: string; productId?: string; productPriceId?: string | null; dosificationId?: string | null; numPartsSnapshot?: number | null; quantity?: number; unitPrice?: number; discountPct?: number | null; discountAmount?: number; ivaRate?: number | null; iepsRate?: number | null; lineSubtotal?: number; lineTax?: number; lineTotal?: number };

function makeSaleItem(overrides: SaleItemOverrides): SaleItem {
  return SaleItem.create({
    id: overrides.id,
    saleId: overrides.saleId,
    productId: overrides.productId ?? "prod-1",
    productPriceId: overrides.productPriceId ?? "price-1",
    dosificationId: overrides.dosificationId ?? null,
    numPartsSnapshot: overrides.numPartsSnapshot ?? null,
    productCodeSnapshot: "PROD001",
    productNameSnapshot: "Producto Test",
    priceNameSnapshot: "Precio Base",
    quantity: overrides.quantity ?? 10,
    unitPrice: overrides.unitPrice ?? 100,
    discountPct: overrides.discountPct ?? null,
    discountAmount: overrides.discountAmount ?? 0,
    ivaRate: overrides.ivaRate ?? 0.16,
    iepsRate: overrides.iepsRate ?? null,
    lineSubtotal: overrides.lineSubtotal ?? 1000,
    lineTax: overrides.lineTax ?? 160,
    lineTotal: overrides.lineTotal ?? 1160,
  });
}

function makeCompletedSale(items: SaleItem[], overrides: { id?: string; status?: string } = {}): Sale {
  return Sale.create({
    id: overrides.id ?? "sale-1",
    folioId: "folio-1",
    folioNumber: 1,
    folioCode: "VNT",
    branchId: "branch-1",
    customerId: "customer-1",
    cashierId: "00000000-0000-0000-0000-000000000001",
    paymentMethodId: "pm-1",
    quoteId: null,
    status: (overrides.status ?? "completed") as "completed" | "cancelled" | "edited",
    paidAmount: 1160,
    paymentStatus: "paid",
    subtotal: 1000,
    taxTotal: 160,
    total: 1160,
    notes: null,
    completedAt: NOW,
    cancelledAt: null,
    cancellationReason: null,
    editedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    items,
  });
}

function seedSale(saleRepo: InMemorySaleRepository, sale: Sale): void {
  (saleRepo as any).store.push({ sale, joined: { branchName: null, customerName: null, customerRfc: null, cashierName: null, paymentMethodCode: null } });
}

describe("CreateReturnUseCase", () => {
  let returnRepo: InMemoryReturnRepository;
  let saleRepo: InMemorySaleRepository;
  let useCase: CreateReturnUseCase;

  beforeEach(() => {
    returnRepo = new InMemoryReturnRepository();
    saleRepo = new InMemorySaleRepository();
    useCase = new CreateReturnUseCase(returnRepo, saleRepo);
  });

  describe("happy path — partial return", () => {
    it("creates a return with correct totals and status='completed'", async () => {
      const item = makeSaleItem({ id: "si-1", saleId: "sale-1", quantity: 10, unitPrice: 100, ivaRate: 0.16 });
      const sale = makeCompletedSale([item]);
      seedSale(saleRepo, sale);

      const dto = await useCase.execute({
        saleId: "sale-1",
        creatorId: "00000000-0000-0000-0000-000000000001",
        reason: "Producto dañado",
        returnedAt: NOW,
        notes: null,
        items: [{ saleItemId: "si-1", quantity: 3 }],
      });

      expect(dto.status).toBe("completed");
      expect(dto.items).toHaveLength(1);
      expect(dto.items[0].quantity).toBe(3);
      expect(dto.items[0].productCodeSnapshot).toBe("PROD001");
      expect(dto.refundSubtotal).toBe(258.6207);
      expect(dto.refundTax).toBe(41.3793);
      expect(dto.refundTotal).toBe(300);
    });

    it("refund of a flat-amount-discounted line deducts the discount (never refunds more than was paid)", async () => {
      const item = makeSaleItem({
        id: "si-1", saleId: "sale-1", quantity: 1, unitPrice: 500, discountAmount: 100, ivaRate: null,
      });
      const sale = makeCompletedSale([item]);
      seedSale(saleRepo, sale);

      const dto = await useCase.execute({
        saleId: "sale-1",
        creatorId: "00000000-0000-0000-0000-000000000001",
        reason: "Producto dañado",
        returnedAt: NOW,
        notes: null,
        items: [{ saleItemId: "si-1", quantity: 1 }],
      });

      expect(dto.refundTotal).toBe(400); // 500 - 100 discount, not 500
      expect(dto.items[0].discountAmount).toBe(100);
    });

    it("increments inventory for the returned items", async () => {
      const item = makeSaleItem({ id: "si-1", saleId: "sale-1", productId: "prod-1", quantity: 10 });
      const sale = makeCompletedSale([item]);
      seedSale(saleRepo, sale);
      returnRepo.setInventory("branch-1", "prod-1", 5);

      await useCase.execute({
        saleId: "sale-1",
        creatorId: "00000000-0000-0000-0000-000000000001",
        reason: "Defecto",
        returnedAt: NOW,
        notes: null,
        items: [{ saleItemId: "si-1", quantity: 3 }],
      });

      expect(returnRepo.getInventory("branch-1", "prod-1")).toBe(8);
    });

    it("propaga dosificationId/numPartsSnapshot y decrementa sólo la fracción del stock base", async () => {
      const item = makeSaleItem({
        id: "si-1", saleId: "sale-1", productId: "prod-1", quantity: 3,
        dosificationId: "dosif-1", numPartsSnapshot: 4,
      });
      const sale = makeCompletedSale([item]);
      seedSale(saleRepo, sale);
      returnRepo.setInventory("branch-1", "prod-1", 10);

      const dto = await useCase.execute({
        saleId: "sale-1",
        creatorId: "00000000-0000-0000-0000-000000000001",
        reason: "Defecto",
        returnedAt: NOW,
        notes: null,
        items: [{ saleItemId: "si-1", quantity: 2 }],
      });

      expect(dto.items[0].quantity).toBe(2);
      // 2 partes de numParts=4 → 0.5 unidades base incrementadas
      expect(returnRepo.getInventory("branch-1", "prod-1")).toBe(10.5);
    });
  });

  describe("validation errors", () => {
    it("throws ReturnInvalidQuantityError when quantity = 0", async () => {
      const item = makeSaleItem({ id: "si-1", saleId: "sale-1", quantity: 10 });
      const sale = makeCompletedSale([item]);
      seedSale(saleRepo, sale);

      const err = await useCase
        .execute({
          saleId: "sale-1",
          creatorId: "00000000-0000-0000-0000-000000000001",
          reason: "Test",
          returnedAt: NOW,
          notes: null,
          items: [{ saleItemId: "si-1", quantity: 0 }],
        })
        .catch((e) => e);

      expect(err).toBeInstanceOf(ReturnInvalidQuantityError);
      expect((err as ReturnInvalidQuantityError).saleItemId).toBe("si-1");
    });

    it("throws ReturnInvalidQuantityError when quantity is negative", async () => {
      const item = makeSaleItem({ id: "si-1", saleId: "sale-1", quantity: 10 });
      const sale = makeCompletedSale([item]);
      seedSale(saleRepo, sale);

      const err = await useCase
        .execute({
          saleId: "sale-1",
          creatorId: "00000000-0000-0000-0000-000000000001",
          reason: "Test",
          returnedAt: NOW,
          notes: null,
          items: [{ saleItemId: "si-1", quantity: -3 }],
        })
        .catch((e) => e);

      expect(err).toBeInstanceOf(ReturnInvalidQuantityError);
    });

    it("throws ReturnItemsEmptyError when items is empty", async () => {
      const item = makeSaleItem({ id: "si-1", saleId: "sale-1" });
      const sale = makeCompletedSale([item]);
      seedSale(saleRepo, sale);

      await expect(
        useCase.execute({
          saleId: "sale-1",
          creatorId: "00000000-0000-0000-0000-000000000001",
          reason: "Test",
          returnedAt: NOW,
          notes: null,
          items: [],
        })
      ).rejects.toBeInstanceOf(ReturnItemsEmptyError);
    });

    it("throws error when sale not found", async () => {
      await expect(
        useCase.execute({
          saleId: "nonexistent-sale",
          creatorId: "00000000-0000-0000-0000-000000000001",
          reason: "Test",
          returnedAt: NOW,
          notes: null,
          items: [{ saleItemId: "si-1", quantity: 1 }],
        })
      ).rejects.toThrow("Sale not found");
    });

    it("throws SaleNotReturnableError when sale is cancelled", async () => {
      const item = makeSaleItem({ id: "si-1", saleId: "sale-1" });
      const sale = makeCompletedSale([item], { status: "cancelled" });
      seedSale(saleRepo, sale);

      await expect(
        useCase.execute({
          saleId: "sale-1",
          creatorId: "00000000-0000-0000-0000-000000000001",
          reason: "Test",
          returnedAt: NOW,
          notes: null,
          items: [{ saleItemId: "si-1", quantity: 1 }],
        })
      ).rejects.toBeInstanceOf(SaleNotReturnableError);
    });

    it("throws SaleNotReturnableError when sale is edited", async () => {
      const item = makeSaleItem({ id: "si-1", saleId: "sale-1" });
      const sale = makeCompletedSale([item], { status: "edited" });
      seedSale(saleRepo, sale);

      await expect(
        useCase.execute({
          saleId: "sale-1",
          creatorId: "00000000-0000-0000-0000-000000000001",
          reason: "Test",
          returnedAt: NOW,
          notes: null,
          items: [{ saleItemId: "si-1", quantity: 1 }],
        })
      ).rejects.toBeInstanceOf(SaleNotReturnableError);
    });

    it("throws SaleItemNotPartOfSaleError for foreign saleItemId", async () => {
      const item = makeSaleItem({ id: "si-1", saleId: "sale-1" });
      const sale = makeCompletedSale([item]);
      seedSale(saleRepo, sale);

      await expect(
        useCase.execute({
          saleId: "sale-1",
          creatorId: "00000000-0000-0000-0000-000000000001",
          reason: "Test",
          returnedAt: NOW,
          notes: null,
          items: [{ saleItemId: "foreign-item", quantity: 1 }],
        })
      ).rejects.toBeInstanceOf(SaleItemNotPartOfSaleError);
    });

    it("throws ReturnQuantityExceedsRemainingError when requested > sold", async () => {
      const item = makeSaleItem({ id: "si-1", saleId: "sale-1", quantity: 5 });
      const sale = makeCompletedSale([item]);
      seedSale(saleRepo, sale);

      const err = await useCase
        .execute({
          saleId: "sale-1",
          creatorId: "00000000-0000-0000-0000-000000000001",
          reason: "Test",
          returnedAt: NOW,
          notes: null,
          items: [{ saleItemId: "si-1", quantity: 6 }],
        })
        .catch((e) => e);

      expect(err).toBeInstanceOf(ReturnQuantityExceedsRemainingError);
      expect(err.saleItemId).toBe("si-1");
      expect(err.requested).toBe(6);
      expect(err.remaining).toBe(5);
    });

    it("throws ReturnQuantityExceedsRemainingError when prior completed return reduces remaining", async () => {
      const item = makeSaleItem({ id: "si-1", saleId: "sale-1", quantity: 5 });
      const sale = makeCompletedSale([item]);
      seedSale(saleRepo, sale);

      // Seed a prior completed return of 3 items
      const priorReturn = Return.create({
        id: "return-prior",
        saleId: "sale-1",
        branchId: "branch-1",
        customerId: null,
        creatorId: "00000000-0000-0000-0000-000000000001",
        reason: "Previo",
        returnedAt: NOW,
        notes: null,
        cancelledAt: null,
        cancelledBy: null,
        cancellationReason: null,
      });
      const priorItem = ReturnItem.create({
        id: "ri-prior",
        returnId: "return-prior",
        saleItemId: "si-1",
        productId: "prod-1",
        productPriceId: null,
        dosificationId: null,
        numPartsSnapshot: null,
        productCodeSnapshot: "PROD001",
        productNameSnapshot: "P",
        priceNameSnapshot: "Base",
        quantity: 3,
        unitPrice: 100,
        discountPct: null,
        discountAmount: 0,
        ivaRate: null,
        iepsRate: null,
        lineSubtotal: 300,
        lineTax: 0,
        lineTotal: 300,
      });
      returnRepo.seed(priorReturn, [priorItem]);

      const err = await useCase
        .execute({
          saleId: "sale-1",
          creatorId: "00000000-0000-0000-0000-000000000001",
          reason: "Test",
          returnedAt: NOW,
          notes: null,
          items: [{ saleItemId: "si-1", quantity: 4 }], // remaining = 5 - 3 = 2
        })
        .catch((e) => e);

      expect(err).toBeInstanceOf(ReturnQuantityExceedsRemainingError);
      expect(err.remaining).toBe(2);
    });

    it("cancelled prior returns do NOT reduce remaining (free space restored)", async () => {
      const item = makeSaleItem({ id: "si-1", saleId: "sale-1", quantity: 5 });
      const sale = makeCompletedSale([item]);
      seedSale(saleRepo, sale);

      // Seed a CANCELLED prior return of 3 items — should NOT reduce remaining
      const cancelledReturn = Return.create({
        id: "return-cancelled",
        saleId: "sale-1",
        branchId: "branch-1",
        customerId: null,
        creatorId: "00000000-0000-0000-0000-000000000001",
        reason: "Cancelado",
        returnedAt: NOW,
        notes: null,
        cancelledAt: new Date(),
        cancelledBy: "00000000-0000-0000-0000-000000000001",
        cancellationReason: null,
        status: "cancelled",
      });
      const cancelledItem = ReturnItem.create({
        id: "ri-cancelled",
        returnId: "return-cancelled",
        saleItemId: "si-1",
        productId: "prod-1",
        productPriceId: null,
        dosificationId: null,
        numPartsSnapshot: null,
        productCodeSnapshot: "PROD001",
        productNameSnapshot: "P",
        priceNameSnapshot: "Base",
        quantity: 3,
        unitPrice: 100,
        discountPct: null,
        discountAmount: 0,
        ivaRate: null,
        iepsRate: null,
        lineSubtotal: 300,
        lineTax: 0,
        lineTotal: 300,
      });
      returnRepo.seed(cancelledReturn, [cancelledItem]);

      // All 5 still available — should succeed
      const dto = await useCase.execute({
        saleId: "sale-1",
        creatorId: "00000000-0000-0000-0000-000000000001",
        reason: "Nueva devolución",
        returnedAt: NOW,
        notes: null,
        items: [{ saleItemId: "si-1", quantity: 5 }],
      });

      expect(dto.status).toBe("completed");
      expect(dto.items[0].quantity).toBe(5);
    });
  });
});
