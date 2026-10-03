import { createExpenseSchema, updateExpenseSchema } from "../../../../../../../app/(private)/expenses/_logic/schemas/expense.schema";

const BASE = {
  branchId: "8f14e45f-ceea-467e-9575-000000000001",
  concept: "Gasolina",
  amount: 500,
  expenseDate: "2026-09-01",
};

describe("createExpenseSchema", () => {
  it("acepta datos válidos", () => {
    expect(createExpenseSchema.safeParse(BASE).success).toBe(true);
  });

  it("rechaza branchId inválido", () => {
    expect(createExpenseSchema.safeParse({ ...BASE, branchId: "not-a-uuid" }).success).toBe(false);
  });

  it("rechaza concepto vacío", () => {
    expect(createExpenseSchema.safeParse({ ...BASE, concept: "  " }).success).toBe(false);
  });

  it("rechaza amount <= 0", () => {
    expect(createExpenseSchema.safeParse({ ...BASE, amount: 0 }).success).toBe(false);
    expect(createExpenseSchema.safeParse({ ...BASE, amount: -10 }).success).toBe(false);
  });

  it("rechaza fecha vacía", () => {
    expect(createExpenseSchema.safeParse({ ...BASE, expenseDate: "" }).success).toBe(false);
  });

  it("acepta notes null u omitido", () => {
    expect(createExpenseSchema.safeParse({ ...BASE, notes: null }).success).toBe(true);
    expect(createExpenseSchema.safeParse(BASE).success).toBe(true);
  });
});

describe("updateExpenseSchema", () => {
  it("acepta un solo campo", () => {
    expect(updateExpenseSchema.safeParse({ concept: "Diesel" }).success).toBe(true);
  });

  it("acepta objeto vacío (la regla de ≥1 campo la aplica el backend)", () => {
    expect(updateExpenseSchema.safeParse({}).success).toBe(true);
  });

  it("rechaza amount <= 0 si se envía", () => {
    expect(updateExpenseSchema.safeParse({ amount: 0 }).success).toBe(false);
  });
});
