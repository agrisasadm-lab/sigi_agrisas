import { z } from "zod";

export const createExpenseSchema = z.object({
  branchId: z.string().uuid("La sucursal es obligatoria"),
  concept: z.string().trim().min(1, "El concepto es obligatorio").max(200),
  amount: z.number({ invalid_type_error: "La cantidad es obligatoria" }).positive("La cantidad debe ser mayor a cero"),
  notes: z.string().max(1000).nullable().optional(),
  expenseDate: z.string().min(1, "La fecha es obligatoria"),
});

export const updateExpenseSchema = z.object({
  concept: z.string().trim().min(1, "El concepto es obligatorio").max(200).optional(),
  amount: z.number().positive("La cantidad debe ser mayor a cero").optional(),
  notes: z.string().max(1000).nullable().optional(),
  expenseDate: z.string().min(1).optional(),
});

export type CreateExpenseFormValues = z.infer<typeof createExpenseSchema>;
export type UpdateExpenseFormValues = z.infer<typeof updateExpenseSchema>;
