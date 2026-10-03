/**
 * @jest-environment jsdom
 */
import { renderHook, waitFor } from "@testing-library/react";
import * as searchProductsModule from "../../../../../../../app/(private)/purchases/_logic/services/searchProducts";

jest.mock("../../../../../../../app/(private)/purchases/_logic/services/searchProducts");

import { useProductSearch } from "../../../../../../../app/(private)/purchases/_logic/hooks/useProductSearch";

const mockSearchProducts = searchProductsModule.searchProducts as jest.Mock;

function makeProduct(overrides = {}) {
  return {
    id: "prod1",
    code: "AMK",
    name: "AMINOGREEN K 1LT",
    unit: "LTR",
    ivaRate: 0.16,
    iepsRate: null,
    isActive: true,
    ...overrides,
  };
}

describe("useProductSearch (purchases)", () => {
  beforeEach(() => jest.clearAllMocks());

  it("no llama a searchProducts cuando branchId está vacío", () => {
    renderHook(() => useProductSearch({ search: "AMK", branchId: undefined }));
    expect(mockSearchProducts).not.toHaveBeenCalled();
  });

  it("deja items/total vacíos e isLoading en false sin branchId", () => {
    const { result } = renderHook(() => useProductSearch({ search: "AMK", branchId: "" }));
    expect(result.current.items).toEqual([]);
    expect(result.current.total).toBe(0);
    expect(result.current.isLoading).toBe(false);
  });

  it("incluye branchId en la llamada a searchProducts cuando está presente", async () => {
    mockSearchProducts.mockResolvedValue({ items: [makeProduct()], total: 1 });

    const { result } = renderHook(() => useProductSearch({ search: "AMK", branchId: "branch-zarioz" }));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockSearchProducts).toHaveBeenCalledTimes(1);
    expect(mockSearchProducts).toHaveBeenCalledWith(
      expect.objectContaining({ search: "AMK", branchId: "branch-zarioz" })
    );
    expect(result.current.items).toEqual([makeProduct()]);
    expect(result.current.total).toBe(1);
  });

  it("dispara una nueva búsqueda al cambiar de branchId", async () => {
    mockSearchProducts.mockResolvedValue({ items: [makeProduct()], total: 1 });

    const { rerender } = renderHook(
      ({ branchId }) => useProductSearch({ search: "AMK", branchId }),
      { initialProps: { branchId: "branch-zarioz" } },
    );

    await waitFor(() => expect(mockSearchProducts).toHaveBeenCalledTimes(1));

    rerender({ branchId: "branch-pradera" });

    await waitFor(() => expect(mockSearchProducts).toHaveBeenCalledTimes(2));
    expect(mockSearchProducts).toHaveBeenLastCalledWith(
      expect.objectContaining({ branchId: "branch-pradera" })
    );
  });
});
