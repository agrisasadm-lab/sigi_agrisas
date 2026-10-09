import {
  createPaymentMethodSchema,
  updatePaymentMethodSchema,
} from "../../../../../../../app/(private)/catalogs/payment-methods/_logic/schemas/paymentMethod.schema";

describe("createPaymentMethodSchema — isCredit", () => {
  const base = { code: "CRED", name: "Crédito" };

  it("acepta isCredit: true", () => {
    const result = createPaymentMethodSchema.safeParse({ ...base, isCredit: true });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.isCredit).toBe(true);
  });

  it("acepta isCredit: false", () => {
    const result = createPaymentMethodSchema.safeParse({ ...base, isCredit: false });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.isCredit).toBe(false);
  });

  it("acepta la ausencia de isCredit (opcional)", () => {
    const result = createPaymentMethodSchema.safeParse(base);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.isCredit).toBeUndefined();
  });
});

describe("updatePaymentMethodSchema — sin isCredit", () => {
  it("no define isCredit como campo del schema", () => {
    expect(updatePaymentMethodSchema.shape).not.toHaveProperty("isCredit");
  });
});
