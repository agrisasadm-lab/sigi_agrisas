/**
 * @jest-environment jsdom
 */
import { renderHook, act } from "@testing-library/react";
import { NetworkError } from "../../../../../../../app/_lib/authFetch";

jest.mock("../../../../../../../app/(private)/pos/_logic/services/createSale", () => ({
  createSale: jest.fn(),
}));

jest.mock("../../../../../../../app/_lib/offline/connectivity", () => ({
  isOnline: jest.fn(),
}));

jest.mock("../../../../../../../app/_lib/offline/outbox", () => ({
  enqueueSale: jest.fn(),
  makeProvisionalCode: jest.fn(),
}));

const mockOfflineSyncValue: { offlineEnabled: boolean; ownerBranchId: string | null } = {
  offlineEnabled: true,
  ownerBranchId: "branch-1",
};

jest.mock("../../../../../../../app/(private)/_blocks/OfflineSyncProvider", () => ({
  useOfflineSync: () => mockOfflineSyncValue,
}));

import { useSaleSubmission } from "../../../../../../../app/(private)/pos/_logic/hooks/useSaleSubmission";
import { createSale } from "../../../../../../../app/(private)/pos/_logic/services/createSale";
import { isOnline } from "../../../../../../../app/_lib/offline/connectivity";
import { enqueueSale } from "../../../../../../../app/_lib/offline/outbox";

const mockCreateSale = createSale as jest.MockedFunction<typeof createSale>;
const mockIsOnline = isOnline as jest.MockedFunction<typeof isOnline>;
const mockEnqueueSale = enqueueSale as jest.MockedFunction<typeof enqueueSale>;

const draft = {
  branchId: "branch-1",
  folioId: "folio-1",
  paymentMethodId: "pm-1",
  lines: [
    {
      id: "line-1",
      productId: "prod-1",
      productCode: "P1",
      productName: "Producto 1",
      productPriceId: "price-1",
      quantity: 1,
      unitPrice: 100,
      discountPct: 0,
      ivaRate: 0.16,
      iepsRate: 0,
      lineSubtotal: 100,
      lineIva: 16,
      lineIeps: 0,
    },
  ] as never,
};

describe("useSaleSubmission — gating por offlineEnabled/ownerBranchId", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockOfflineSyncValue.offlineEnabled = true;
    mockOfflineSyncValue.ownerBranchId = "branch-1";
  });

  it("bloquea el encolado cuando offlineEnabled=false y no está online", async () => {
    mockIsOnline.mockReturnValue(false);
    mockOfflineSyncValue.offlineEnabled = false;
    const { result } = renderHook(() => useSaleSubmission());

    await act(async () => {
      await result.current.submit(draft);
    });

    expect(mockEnqueueSale).not.toHaveBeenCalled();
    expect(result.current.status).toBe("offline-disabled");
    expect(result.current.error?.message).toBe("Fija tu sucursal de trabajo antes de vender offline.");
  });

  it("bloquea el encolado cuando ownerBranchId no coincide con la sucursal del formulario", async () => {
    mockIsOnline.mockReturnValue(false);
    mockOfflineSyncValue.offlineEnabled = true;
    mockOfflineSyncValue.ownerBranchId = "otra-sucursal";
    const { result } = renderHook(() => useSaleSubmission());

    await act(async () => {
      await result.current.submit(draft);
    });

    expect(mockEnqueueSale).not.toHaveBeenCalled();
    expect(result.current.status).toBe("offline-disabled");
  });

  it("encola normalmente cuando offlineEnabled=true y ownerBranchId coincide, usando ownerBranchId del contexto", async () => {
    mockIsOnline.mockReturnValue(false);
    mockEnqueueSale.mockResolvedValue({ clientRequestId: "abc" } as never);
    const { result } = renderHook(() => useSaleSubmission());

    await act(async () => {
      await result.current.submit(draft);
    });

    expect(mockEnqueueSale).toHaveBeenCalledWith(
      expect.objectContaining({ ownerBranchId: "branch-1" })
    );
    expect(result.current.status).toBe("queued-offline");
  });

  it("con NetworkError en createSale, respeta el mismo gating antes de encolar", async () => {
    mockIsOnline.mockReturnValue(true);
    mockCreateSale.mockRejectedValue(new NetworkError());
    mockOfflineSyncValue.offlineEnabled = false;
    const { result } = renderHook(() => useSaleSubmission());

    await act(async () => {
      await result.current.submit(draft);
    });

    expect(mockEnqueueSale).not.toHaveBeenCalled();
    expect(result.current.status).toBe("offline-disabled");
  });

  it("regression: usa offlineEnabled/ownerBranchId actualizados tras resolución async post-montaje, no los del primer render", async () => {
    mockIsOnline.mockReturnValue(false);
    mockOfflineSyncValue.offlineEnabled = false;
    mockOfflineSyncValue.ownerBranchId = null;
    mockEnqueueSale.mockResolvedValue({ clientRequestId: "abc" } as never);

    const { result, rerender } = renderHook(() => useSaleSubmission());

    mockOfflineSyncValue.offlineEnabled = true;
    mockOfflineSyncValue.ownerBranchId = "branch-1";
    rerender();

    await act(async () => {
      await result.current.submit(draft);
    });

    expect(mockEnqueueSale).toHaveBeenCalledWith(
      expect.objectContaining({ ownerBranchId: "branch-1" })
    );
    expect(result.current.status).toBe("queued-offline");
  });
});
