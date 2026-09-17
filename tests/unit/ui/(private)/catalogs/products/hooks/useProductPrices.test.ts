import { renderHook, act, waitFor } from "@testing-library/react";
import { useProductPrices } from "../../../../../../../app/(private)/catalogs/products/_logic/hooks/useProductPrices";
import { DuplicatePriceNameError, DuplicateDefaultPriceError } from "../../../../../../../app/(private)/catalogs/products/_logic/errors";
import { ForbiddenError, NetworkError } from "../../../../../../../app/_lib/authFetch";

jest.mock("../../../../../../../app/(private)/catalogs/products/_logic/services/prices", () => ({
  listPrices: jest.fn(),
  createPrice: jest.fn(),
  updatePrice: jest.fn(),
  deletePrice: jest.fn(),
}));

import { listPrices, createPrice, updatePrice } from "../../../../../../../app/(private)/catalogs/products/_logic/services/prices";
const mockList = listPrices as jest.Mock;
const mockCreate = createPrice as jest.Mock;
const mockUpdate = updatePrice as jest.Mock;

const basePrice = {
  id: "pr1",
  productId: "p1",
  branchId: null,
  isOverride: false,
  name: "Menudeo",
  price: 12,
  minQuantity: 1,
  discountPct: null,
  isDefault: true,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
};

describe("useProductPrices — traducción de errores en createOne/updateOne", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockList.mockResolvedValue([]);
  });

  it("createOne con ForbiddenError(branches:access_all) produce saveError traducido, no el texto crudo", async () => {
    mockCreate.mockRejectedValue(new ForbiddenError("branches:access_all"));
    const { result } = renderHook(() => useProductPrices("p1", "b-otra"));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.createOne({ branchId: "b-otra", name: "X", price: 10 });
    });

    expect(result.current.saveError).toBe("No puedes crear precios para otra sucursal.");
  });

  it("updateOne con ForbiddenError(branches:access_all) produce saveError traducido", async () => {
    mockUpdate.mockRejectedValue(new ForbiddenError("branches:access_all"));
    const { result } = renderHook(() => useProductPrices("p1", "b-otra"));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.updateOne("pr1", { price: 20 });
    });

    expect(result.current.saveError).toBe("No puedes crear precios para otra sucursal.");
  });

  it("createOne re-lanza DuplicatePriceNameError sin tocar saveError (comportamiento previo intacto)", async () => {
    mockCreate.mockRejectedValue(new DuplicatePriceNameError());
    const { result } = renderHook(() => useProductPrices("p1", null));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await expect(
      act(async () => {
        await result.current.createOne({ branchId: null, name: "X", price: 10 });
      })
    ).rejects.toBeInstanceOf(DuplicatePriceNameError);

    expect(result.current.saveError).toBeNull();
  });

  it("createOne re-lanza DuplicateDefaultPriceError sin tocar saveError", async () => {
    mockCreate.mockRejectedValue(new DuplicateDefaultPriceError());
    const { result } = renderHook(() => useProductPrices("p1", null));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await expect(
      act(async () => {
        await result.current.createOne({ branchId: null, name: "X", price: 10, isDefault: true });
      })
    ).rejects.toBeInstanceOf(DuplicateDefaultPriceError);

    expect(result.current.saveError).toBeNull();
  });

  it("createOne con otro error (NetworkError) sigue usando el mensaje genérico del error", async () => {
    mockCreate.mockRejectedValue(new NetworkError());
    const { result } = renderHook(() => useProductPrices("p1", null));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.createOne({ branchId: null, name: "X", price: 10 });
    });

    expect(result.current.saveError).toBe("Network error");
  });

  it("createOne exitoso deja saveError en null", async () => {
    mockCreate.mockResolvedValue(basePrice);
    const { result } = renderHook(() => useProductPrices("p1", null));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.createOne({ branchId: null, name: "Menudeo", price: 12 });
    });

    expect(result.current.saveError).toBeNull();
  });
});
