import { GetReturnUseCase } from "@/modules/returns/application/use-cases/GetReturnUseCase";
import { InMemoryReturnRepository } from "@/modules/returns/infrastructure/repositories/InMemoryReturnRepository";
import { Return } from "@/modules/returns/domain/entities/Return";
import { ReturnItem } from "@/modules/returns/domain/entities/ReturnItem";
import { ReturnNotFoundError } from "@/modules/returns/domain/errors/ReturnNotFoundError";

describe("GetReturnUseCase", () => {
  let returnRepo: InMemoryReturnRepository;
  let useCase: GetReturnUseCase;

  beforeEach(() => {
    returnRepo = new InMemoryReturnRepository();
    useCase = new GetReturnUseCase(returnRepo);
  });

  it("returns detail dto with items when found", async () => {
    const ret = Return.create({
      id: "return-1",
      saleId: "sale-1",
      branchId: "branch-1",
      customerId: null,
      creatorId: "00000000-0000-0000-0000-000000000001",
      reason: "Test",
      returnedAt: new Date("2026-06-01"),
      notes: null,
      cancelledAt: null,
      cancelledBy: null,
      cancellationReason: null,
    });
    const item = ReturnItem.create({
      returnId: "return-1",
      saleItemId: "si-1",
      productId: "prod-1",
      productPriceId: null,
      dosificationId: null,
      numPartsSnapshot: null,
      productCodeSnapshot: "P001",
      productNameSnapshot: "Prod",
      priceNameSnapshot: "Base",
      quantity: 2,
      unitPrice: 50,
      discountPct: null,
      discountAmount: 0,
      ivaRate: null,
      iepsRate: null,
      lineSubtotal: 100,
      lineTax: 0,
      lineTotal: 100,
    });
    returnRepo.seed(ret, [item]);

    const dto = await useCase.execute("return-1");
    expect(dto.id).toBe("return-1");
    expect(dto.items).toHaveLength(1);
    expect(dto.items[0].saleItemId).toBe("si-1");
  });

  it("throws ReturnNotFoundError when not found", async () => {
    await expect(useCase.execute("nonexistent")).rejects.toBeInstanceOf(ReturnNotFoundError);
  });
});
