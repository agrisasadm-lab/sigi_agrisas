/**
 * @jest-environment jsdom
 */
import { renderHook, act } from "@testing-library/react";
import { NetworkError } from "../../../../../../../app/_lib/authFetch";

jest.mock("../../../../../../../app/(private)/quotes/_logic/services/createQuote", () => ({
  createQuote: jest.fn(),
}));

jest.mock("../../../../../../../app/_lib/offline/connectivity", () => ({
  isOnline: jest.fn(),
}));

jest.mock("../../../../../../../app/_lib/offline/outbox", () => ({
  enqueueQuote: jest.fn(),
}));

const mockOfflineSyncValue: { offlineEnabled: boolean; ownerBranchId: string | null } = {
  offlineEnabled: true,
  ownerBranchId: "branch-1",
};

jest.mock("../../../../../../../app/(private)/_blocks/OfflineSyncProvider", () => ({
  useOfflineSync: () => mockOfflineSyncValue,
}));

import { useQuoteSubmission } from "../../../../../../../app/(private)/quotes/_logic/hooks/useQuoteSubmission";
import { createQuote } from "../../../../../../../app/(private)/quotes/_logic/services/createQuote";
import { isOnline } from "../../../../../../../app/_lib/offline/connectivity";
import { enqueueQuote } from "../../../../../../../app/_lib/offline/outbox";

const mockCreateQuote = createQuote as jest.MockedFunction<typeof createQuote>;
const mockIsOnline = isOnline as jest.MockedFunction<typeof isOnline>;
const mockEnqueueQuote = enqueueQuote as jest.MockedFunction<typeof enqueueQuote>;

const draft = {
  branchId: "branch-1",
  folioId: "folio-1",
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

describe("useQuoteSubmission — gating por offlineEnabled/ownerBranchId", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockOfflineSyncValue.offlineEnabled = true;
    mockOfflineSyncValue.ownerBranchId = "branch-1";
  });

  it("bloquea el encolado cuando offlineEnabled=false y no está online", async () => {
    mockIsOnline.mockReturnValue(false);
    mockOfflineSyncValue.offlineEnabled = false;
    const { result } = renderHook(() => useQuoteSubmission());

    await act(async () => {
      await result.current.submit(draft);
    });

    expect(mockEnqueueQuote).not.toHaveBeenCalled();
    expect(result.current.status).toBe("offline-disabled");
    expect(result.current.error?.message).toBe("Fija tu sucursal de trabajo antes de cotizar offline.");
  });

  it("bloquea el encolado cuando ownerBranchId no coincide con la sucursal del formulario", async () => {
    mockIsOnline.mockReturnValue(false);
    mockOfflineSyncValue.ownerBranchId = "otra-sucursal";
    const { result } = renderHook(() => useQuoteSubmission());

    await act(async () => {
      await result.current.submit(draft);
    });

    expect(mockEnqueueQuote).not.toHaveBeenCalled();
    expect(result.current.status).toBe("offline-disabled");
  });

  it("encola normalmente cuando offlineEnabled=true y ownerBranchId coincide, usando ownerBranchId del contexto", async () => {
    mockIsOnline.mockReturnValue(false);
    mockEnqueueQuote.mockResolvedValue({ clientRequestId: "abc" } as never);
    const { result } = renderHook(() => useQuoteSubmission());

    await act(async () => {
      await result.current.submit(draft);
    });

    expect(mockEnqueueQuote).toHaveBeenCalledWith(
      expect.objectContaining({ ownerBranchId: "branch-1" })
    );
    expect(result.current.status).toBe("queued-offline");
  });

  it("con NetworkError en createQuote, respeta el mismo gating antes de encolar", async () => {
    mockIsOnline.mockReturnValue(true);
    mockCreateQuote.mockRejectedValue(new NetworkError());
    mockOfflineSyncValue.offlineEnabled = false;
    const { result } = renderHook(() => useQuoteSubmission());

    await act(async () => {
      await result.current.submit(draft);
    });

    expect(mockEnqueueQuote).not.toHaveBeenCalled();
    expect(result.current.status).toBe("offline-disabled");
  });

  it("regression: usa offlineEnabled/ownerBranchId actualizados tras resolución async post-montaje, no los del primer render", async () => {
    mockIsOnline.mockReturnValue(false);
    mockOfflineSyncValue.offlineEnabled = false;
    mockOfflineSyncValue.ownerBranchId = null;
    mockEnqueueQuote.mockResolvedValue({ clientRequestId: "abc" } as never);

    const { result, rerender } = renderHook(() => useQuoteSubmission());

    mockOfflineSyncValue.offlineEnabled = true;
    mockOfflineSyncValue.ownerBranchId = "branch-1";
    rerender();

    await act(async () => {
      await result.current.submit(draft);
    });

    expect(mockEnqueueQuote).toHaveBeenCalledWith(
      expect.objectContaining({ ownerBranchId: "branch-1" })
    );
    expect(result.current.status).toBe("queued-offline");
  });
});
