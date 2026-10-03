import { renderHook, act } from "@testing-library/react";
import { useExpenseMutations } from "../../../../../../../app/(private)/expenses/_logic/hooks/useExpenseMutations";

jest.mock("../../../../../../../app/(private)/expenses/_logic/services/createExpense", () => ({
  createExpense: jest.fn(),
}));
jest.mock("../../../../../../../app/(private)/expenses/_logic/services/updateExpense", () => ({
  updateExpense: jest.fn(),
}));
jest.mock("../../../../../../../app/(private)/expenses/_logic/services/softDeleteExpense", () => ({
  softDeleteExpense: jest.fn(),
}));
jest.mock("../../../../../../../app/(private)/expenses/_logic/services/uploadExpensePhoto", () => ({
  uploadExpensePhoto: jest.fn(),
}));

import { createExpense } from "../../../../../../../app/(private)/expenses/_logic/services/createExpense";
import { updateExpense } from "../../../../../../../app/(private)/expenses/_logic/services/updateExpense";
import { softDeleteExpense } from "../../../../../../../app/(private)/expenses/_logic/services/softDeleteExpense";
import { uploadExpensePhoto } from "../../../../../../../app/(private)/expenses/_logic/services/uploadExpensePhoto";

const mockCreate = createExpense as jest.Mock;
const mockUpdate = updateExpense as jest.Mock;
const mockSoftDelete = softDeleteExpense as jest.Mock;
const mockUploadPhoto = uploadExpensePhoto as jest.Mock;

const baseEntity = {
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

const CREATE_BODY = { branchId: "b1", concept: "Gasolina", amount: 500, expenseDate: "2026-09-01" };

describe("useExpenseMutations", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("createOne sin foto: retorna expense y photoError null", async () => {
    mockCreate.mockResolvedValueOnce(baseEntity);

    const { result } = renderHook(() => useExpenseMutations());

    let out;
    await act(async () => {
      out = await result.current.createOne(CREATE_BODY);
    });

    expect(out).toEqual({ expense: baseEntity, photoError: null });
    expect(mockUploadPhoto).not.toHaveBeenCalled();
    expect(result.current.mutationError).toBeNull();
  });

  it("createOne con foto: encadena uploadExpensePhoto y actualiza photoUrl", async () => {
    mockCreate.mockResolvedValueOnce(baseEntity);
    mockUploadPhoto.mockResolvedValueOnce("https://storage.test/expenses/1/a.jpg");
    const file = new File(["x"], "comprobante.jpg", { type: "image/jpeg" });

    const { result } = renderHook(() => useExpenseMutations());

    let out;
    await act(async () => {
      out = await result.current.createOne(CREATE_BODY, file);
    });

    expect(mockUploadPhoto).toHaveBeenCalledWith("1", file);
    expect(out).toEqual({
      expense: { ...baseEntity, photoUrl: "https://storage.test/expenses/1/a.jpg" },
      photoError: null,
    });
  });

  it("createOne con foto que falla: mantiene el gasto creado y expone photoError sin revertir", async () => {
    mockCreate.mockResolvedValueOnce(baseEntity);
    mockUploadPhoto.mockRejectedValueOnce(new Error("Invalid image format"));
    const file = new File(["x"], "comprobante.pdf", { type: "application/pdf" });

    const { result } = renderHook(() => useExpenseMutations());

    let out;
    await act(async () => {
      out = await result.current.createOne(CREATE_BODY, file);
    });

    expect(out?.expense).toEqual(baseEntity);
    expect(out?.photoError).toBe("Invalid image format");
    expect(result.current.mutationError).toBeNull();
  });

  it("createOne error de creación: retorna expense null y setea mutationError", async () => {
    mockCreate.mockRejectedValueOnce(new Error("amount must be > 0"));

    const { result } = renderHook(() => useExpenseMutations());

    let out;
    await act(async () => {
      out = await result.current.createOne({ ...CREATE_BODY, amount: 0 });
    });

    expect(out).toEqual({ expense: null, photoError: null });
    expect(result.current.mutationError).not.toBeNull();
  });

  it("updateOne: llama updateExpense con diff", async () => {
    mockUpdate.mockResolvedValueOnce({ ...baseEntity, concept: "Diesel" });

    const { result } = renderHook(() => useExpenseMutations());

    await act(async () => {
      await result.current.updateOne("1", { concept: "Diesel" });
    });

    expect(mockUpdate).toHaveBeenCalledWith({ id: "1", body: { concept: "Diesel" } });
  });

  it("softDeleteOne: llama softDeleteExpense y retorna true", async () => {
    mockSoftDelete.mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useExpenseMutations());

    let success;
    await act(async () => {
      success = await result.current.softDeleteOne("1");
    });

    expect(mockSoftDelete).toHaveBeenCalledWith({ id: "1" });
    expect(success).toBe(true);
  });

  it("softDeleteOne error: retorna false y setea mutationError", async () => {
    mockSoftDelete.mockRejectedValueOnce(new Error("Expense not found"));

    const { result } = renderHook(() => useExpenseMutations());

    let success;
    await act(async () => {
      success = await result.current.softDeleteOne("ghost");
    });

    expect(success).toBe(false);
    expect(result.current.mutationError).toBe("Expense not found");
  });
});
