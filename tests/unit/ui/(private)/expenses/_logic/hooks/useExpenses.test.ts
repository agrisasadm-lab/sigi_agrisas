import { renderHook, act, waitFor } from "@testing-library/react";
import { useExpenses } from "../../../../../../../app/(private)/expenses/_logic/hooks/useExpenses";

jest.mock("../../../../../../../app/(private)/expenses/_logic/services/listExpenses", () => ({
  listExpenses: jest.fn(),
}));

import { listExpenses } from "../../../../../../../app/(private)/expenses/_logic/services/listExpenses";
const mockList = listExpenses as jest.Mock;

const baseItem = {
  id: "1",
  branchId: "b1",
  branchName: "Sucursal 1",
  concept: "Gasolina",
  amount: "500",
  notes: null,
  photoUrl: null,
  expenseDate: "2026-09-01",
  creatorId: "u1",
  creatorName: "Operador",
  isActive: true,
  createdAt: new Date("2026-09-01"),
  updatedAt: new Date("2026-09-01"),
};

describe("useExpenses", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("carga inicial: llama listExpenses y retorna items y total", async () => {
    mockList.mockResolvedValueOnce({ items: [baseItem], total: 1, page: 1, pageSize: 20 });

    const { result } = renderHook(() => useExpenses({ page: 1, pageSize: 20, includeInactive: false }));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockList).toHaveBeenCalledWith({
      page: 1,
      pageSize: 20,
      branchId: undefined,
      concept: undefined,
      from: undefined,
      to: undefined,
      includeInactive: false,
    });
    expect(result.current.items).toHaveLength(1);
    expect(result.current.total).toBe(1);
    expect(result.current.error).toBeNull();
  });

  it("error: expone mensaje", async () => {
    mockList.mockRejectedValueOnce(new Error("Error al cargar"));

    const { result } = renderHook(() => useExpenses({ page: 1, pageSize: 20 }));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error).toBe("Error al cargar");
    expect(result.current.items).toHaveLength(0);
  });

  it("refresh: vuelve a llamar al servicio", async () => {
    mockList
      .mockResolvedValueOnce({ items: [baseItem], total: 1, page: 1, pageSize: 20 })
      .mockResolvedValueOnce({ items: [baseItem], total: 1, page: 1, pageSize: 20 });

    const { result } = renderHook(() => useExpenses({ page: 1, pageSize: 20 }));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.refresh();
    });

    await waitFor(() => expect(mockList).toHaveBeenCalledTimes(2));
  });
});
