/**
 * @jest-environment jsdom
 */
import { renderHook, waitFor } from "@testing-library/react";
import * as searchProductsModule from "../../../../../../../app/(private)/payments/_logic/services/searchProducts";

jest.mock("../../../../../../../app/(private)/payments/_logic/services/searchProducts");

import { useProductSearch } from "../../../../../../../app/(private)/payments/_logic/hooks/useProductSearch";

const mockSearchProducts = searchProductsModule.searchProducts as jest.Mock;

function makeProduct(overrides = {}) {
  return { id: "prod1", code: "PROD001", name: "Producto de prueba", ...overrides };
}

describe("useProductSearch (payments)", () => {
  beforeEach(() => jest.clearAllMocks());

  it("busca sin branchId cuando no se pasa (caso 'Todas' intencional para bypass)", async () => {
    mockSearchProducts.mockResolvedValue({ items: [makeProduct()], total: 1 });

    const { result } = renderHook(() => useProductSearch({ search: "flor" }));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockSearchProducts).toHaveBeenCalledWith(
      expect.objectContaining({ search: "flor", branchId: undefined })
    );
    expect(result.current.items).toEqual([makeProduct()]);
  });

  it("incluye branchId en la llamada cuando está presente (operador o admin con sucursal elegida)", async () => {
    mockSearchProducts.mockResolvedValue({ items: [makeProduct()], total: 1 });

    const { result } = renderHook(() => useProductSearch({ search: "flor", branchId: "branch-1" }));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockSearchProducts).toHaveBeenCalledWith(
      expect.objectContaining({ search: "flor", branchId: "branch-1" })
    );
  });

  it("dispara una nueva búsqueda al cambiar de branchId", async () => {
    mockSearchProducts.mockResolvedValue({ items: [], total: 0 });

    const { rerender } = renderHook(
      ({ branchId }) => useProductSearch({ search: "flor", branchId }),
      { initialProps: { branchId: "branch-1" as string | undefined } }
    );

    await waitFor(() => expect(mockSearchProducts).toHaveBeenCalledTimes(1));

    rerender({ branchId: "branch-2" });

    await waitFor(() => expect(mockSearchProducts).toHaveBeenCalledTimes(2));
    expect(mockSearchProducts).toHaveBeenLastCalledWith(expect.objectContaining({ branchId: "branch-2" }));
  });
});
