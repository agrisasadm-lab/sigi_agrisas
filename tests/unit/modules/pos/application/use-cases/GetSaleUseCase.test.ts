import { GetSaleUseCase } from "@/modules/pos/application/use-cases/GetSaleUseCase";
import { InMemorySaleRepository } from "@/modules/pos/infrastructure/repositories/InMemorySaleRepository";
import { SaleNotFoundError } from "@/modules/pos/domain/errors/SaleNotFoundError";
import { SaleItem } from "@/modules/pos/domain/entities/SaleItem";

function makeUseCase() {
  const repo = new InMemorySaleRepository();
  const useCase = new GetSaleUseCase(repo);
  return { repo, useCase };
}

describe("GetSaleUseCase", () => {
  it("lanza SaleNotFoundError cuando el id no existe", async () => {
    const { useCase } = makeUseCase();
    await expect(useCase.execute("non-existent-id")).rejects.toThrow(SaleNotFoundError);
  });

  it("devuelve el dto de la venta cuando existe", async () => {
    const { repo, useCase } = makeUseCase();
    const created = await repo.createCompleted({
      branchId: "b1", customerId: "c1", cashierId: "u1",
      paymentMethodId: "pm1", folioId: "f1", notes: "test note",
      paidAmount: 116, paymentStatus: "paid",
      subtotal: 100, taxTotal: 16, total: 116, items: [],
    });

    const result = await useCase.execute(created.sale.id);
    expect(result.dto.id).toBe(created.sale.id);
    expect(result.dto.status).toBe("completed");
    expect(result.dto.subtotal).toBe(100);
    expect(result.dto.total).toBe(116);
    expect(result.dto.notes).toBe("test note");
    expect(result.dto.items).toHaveLength(0);
  });

  it("expone branchId para que el controller aplique scoping", async () => {
    const { repo, useCase } = makeUseCase();
    const created = await repo.createCompleted({
      branchId: "branch-X", customerId: "c1", cashierId: "u1",
      paymentMethodId: "pm1", folioId: "f1", notes: null,
      paidAmount: 58, paymentStatus: "paid",
      subtotal: 50, taxTotal: 8, total: 58, items: [],
    });

    const result = await useCase.execute(created.sale.id);
    expect(result.branchId).toBe("branch-X");
  });

  it("devuelve los items de la venta cuando existen", async () => {
    const { repo, useCase } = makeUseCase();
    const item = SaleItem.create({
      id: "item-1",
      saleId: "pending",
      productId: "prod-1",
      productPriceId: "price-1",
      dosificationId: null,
      numPartsSnapshot: null,
      productCodeSnapshot: "PROD001",
      productNameSnapshot: "Producto Uno",
      priceNameSnapshot: "Lista",
      quantity: 2,
      unitPrice: 50,
      discountPct: null,
      discountAmount: 0,
      ivaRate: 0.16,
      iepsRate: null,
      lineSubtotal: 100,
      lineTax: 16,
      lineTotal: 116,
    });

    const created = await repo.createCompleted({
      branchId: "b1", customerId: "c1", cashierId: "u1",
      paymentMethodId: "pm1", folioId: "f1", notes: null,
      paidAmount: 116, paymentStatus: "paid",
      subtotal: 100, taxTotal: 16, total: 116,
      items: [
        {
          productId: item.productId,
          productPriceId: item.productPriceId as string,
          dosificationId: null,
          numPartsSnapshot: null,
          productCodeSnapshot: item.productCodeSnapshot,
          productNameSnapshot: item.productNameSnapshot,
          priceNameSnapshot: item.priceNameSnapshot,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discountPct: item.discountPct,
          discountAmount: item.discountAmount,
          ivaRate: item.ivaRate,
          iepsRate: item.iepsRate,
          lineSubtotal: item.lineSubtotal,
          lineTax: item.lineTax,
          lineTotal: item.lineTotal,
        },
      ],
    });

    const result = await useCase.execute(created.sale.id);
    expect(result.dto.items).toHaveLength(1);
    expect(result.dto.items[0].productCodeSnapshot).toBe("PROD001");
    expect(result.dto.items[0].quantity).toBe(2);
    expect(result.dto.items[0].unitPrice).toBe(50);
  });

  it("propaga satProductCode por línea desde satProductCodeByProductId del repo (paridad con facturación)", async () => {
    const { repo, useCase } = makeUseCase();
    const created = await repo.createCompleted({
      branchId: "b1", customerId: "c1", cashierId: "u1",
      paymentMethodId: "pm1", folioId: "f1", notes: null,
      paidAmount: 116, paymentStatus: "paid",
      subtotal: 100, taxTotal: 16, total: 116,
      items: [
        {
          productId: "prod-sat-1",
          productPriceId: "price-1",
          dosificationId: null,
          numPartsSnapshot: null,
          productCodeSnapshot: "PROD001",
          productNameSnapshot: "Producto Uno",
          priceNameSnapshot: "Lista",
          quantity: 2,
          unitPrice: 50,
          discountPct: null,
          discountAmount: 0,
          ivaRate: 0.16,
          iepsRate: null,
          lineSubtotal: 100,
          lineTax: 16,
          lineTotal: 116,
        },
      ],
    });
    // Simula el join de producto que PrismaSaleRepository.findByIdWithItems hace en real DB.
    created.satProductCodeByProductId = { "prod-sat-1": "10171500" };

    const result = await useCase.execute(created.sale.id);
    expect(result.dto.items[0].satProductCode).toBe("10171500");
  });

  it("devuelve venta cancelada con sus campos de cancelación", async () => {
    const { repo, useCase } = makeUseCase();
    const created = await repo.createCompleted({
      branchId: "b1", customerId: "c1", cashierId: "u1",
      paymentMethodId: "pm1", folioId: "f1", notes: null,
      paidAmount: 116, paymentStatus: "paid",
      subtotal: 100, taxTotal: 16, total: 116, items: [],
    });
    await repo.cancel(created.sale.id, "Error de caja");

    const result = await useCase.execute(created.sale.id);
    expect(result.dto.status).toBe("cancelled");
    expect(result.dto.cancellationReason).toBe("Error de caja");
    expect(result.dto.cancelledAt).not.toBeNull();
  });
});
