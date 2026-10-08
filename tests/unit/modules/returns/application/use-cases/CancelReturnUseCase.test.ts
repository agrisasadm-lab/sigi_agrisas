import { CancelReturnUseCase } from "@/modules/returns/application/use-cases/CancelReturnUseCase";
import { InMemoryReturnRepository } from "@/modules/returns/infrastructure/repositories/InMemoryReturnRepository";
import { Return } from "@/modules/returns/domain/entities/Return";
import { ReturnItem } from "@/modules/returns/domain/entities/ReturnItem";
import { ReturnNotFoundError } from "@/modules/returns/domain/errors/ReturnNotFoundError";
import { ReturnAlreadyCancelledError } from "@/modules/returns/domain/errors/ReturnAlreadyCancelledError";

const NOW = new Date("2026-06-01T10:00:00Z");
const CREATOR = "00000000-0000-0000-0000-000000000001";

function makeReturn(status: "completed" | "cancelled" = "completed"): Return {
  return Return.create({
    id: "return-1",
    saleId: "sale-1",
    branchId: "branch-1",
    customerId: null,
    creatorId: CREATOR,
    status,
    reason: "Producto dañado",
    returnedAt: NOW,
    refundSubtotal: 300,
    refundTax: 48,
    refundTotal: 348,
    notes: null,
    cancelledAt: status === "cancelled" ? NOW : null,
    cancelledBy: status === "cancelled" ? CREATOR : null,
    cancellationReason: null,
  });
}

function makeReturnItem(returnId = "return-1", overrides: Partial<Parameters<typeof ReturnItem.create>[0]> = {}): ReturnItem {
  return ReturnItem.create({
    returnId,
    saleItemId: "si-1",
    productId: "prod-1",
    productPriceId: null,
    dosificationId: null,
    numPartsSnapshot: null,
    productCodeSnapshot: "PROD001",
    productNameSnapshot: "Producto",
    priceNameSnapshot: "Base",
    quantity: 3,
    unitPrice: 100,
    discountPct: null,
    discountAmount: 0,
    ivaRate: 0.16,
    iepsRate: null,
    lineSubtotal: 300,
    lineTax: 48,
    lineTotal: 348,
    ...overrides,
  });
}

describe("CancelReturnUseCase", () => {
  let returnRepo: InMemoryReturnRepository;
  let useCase: CancelReturnUseCase;

  beforeEach(() => {
    returnRepo = new InMemoryReturnRepository();
    useCase = new CancelReturnUseCase(returnRepo);
  });

  it("cancels a completed return and decrements inventory", async () => {
    const ret = makeReturn("completed");
    const item = makeReturnItem();
    returnRepo.seed(ret, [item]);
    returnRepo.setInventory("branch-1", "prod-1", 10);

    const dto = await useCase.execute({
      id: "return-1",
      cancelledBy: CREATOR,
      cancellationReason: "Error de registro",
    });

    expect(dto.status).toBe("cancelled");
    expect(dto.cancelledBy).toBe(CREATOR);
    expect(dto.items).toHaveLength(1);
    expect(dto.items[0].productId).toBe("prod-1");
    expect(dto.items[0].quantity).toBe(3);
    expect(returnRepo.getInventory("branch-1", "prod-1")).toBe(7);
  });

  it("allows inventory to go negative when decrementing", async () => {
    const ret = makeReturn("completed");
    const item = makeReturnItem();
    returnRepo.seed(ret, [item]);
    returnRepo.setInventory("branch-1", "prod-1", 1);

    await useCase.execute({
      id: "return-1",
      cancelledBy: CREATOR,
      cancellationReason: null,
    });

    expect(returnRepo.getInventory("branch-1", "prod-1")).toBe(-2);
  });

  it("decrements only the fraction of base stock for a dosification return (numPartsSnapshot=4, quantity=2 parts → 0.5)", async () => {
    const ret = makeReturn("completed");
    const item = makeReturnItem("return-1", { numPartsSnapshot: 4, quantity: 2 });
    returnRepo.seed(ret, [item]);
    returnRepo.setInventory("branch-1", "prod-1", 10);

    await useCase.execute({
      id: "return-1",
      cancelledBy: CREATOR,
      cancellationReason: null,
    });

    expect(returnRepo.getInventory("branch-1", "prod-1")).toBe(9.5);
  });

  it("throws ReturnNotFoundError when return does not exist", async () => {
    await expect(
      useCase.execute({
        id: "nonexistent",
        cancelledBy: CREATOR,
        cancellationReason: null,
      })
    ).rejects.toBeInstanceOf(ReturnNotFoundError);
  });

  it("throws ReturnAlreadyCancelledError when already cancelled", async () => {
    const ret = makeReturn("cancelled");
    returnRepo.seed(ret, [makeReturnItem()]);

    await expect(
      useCase.execute({
        id: "return-1",
        cancelledBy: CREATOR,
        cancellationReason: null,
      })
    ).rejects.toBeInstanceOf(ReturnAlreadyCancelledError);
  });
});
