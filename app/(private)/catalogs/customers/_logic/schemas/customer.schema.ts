import { z } from "zod";

const codeRegex = /^[A-Z0-9_]{1,32}$/;
const rfcRegex = /^([A-ZÑ&]{3,4})\d{6}([A-Z\d]{3})$/;
const taxRegimeRegex = /^\d{3}$/;
const cfdiUseRegex = /^[A-Z]{1,2}\d{2}$/;
const taxZipCodeRegex = /^\d{5}$/;

const codeSchema = z
  .string()
  .regex(codeRegex, "El código debe ser MAYÚSCULAS, dígitos y guiones bajos (máx. 32).");

const rfcSchema = z
  .string()
  .regex(rfcRegex, "RFC inválido. Formato esperado: 3-4 letras + 6 dígitos + 3 alfanuméricos.");

const optionalRfc = z
  .string()
  .regex(rfcRegex, "RFC inválido. Formato esperado: 3-4 letras + 6 dígitos + 3 alfanuméricos.")
  .nullable()
  .optional();

const optionalInitialBalance = z
  .number()
  .min(0, "El saldo inicial no puede ser negativo.")
  .optional();

const optionalTaxRegime = z
  .string()
  .regex(taxRegimeRegex, "El régimen fiscal debe ser de 3 dígitos (ej. 601).")
  .nullable()
  .optional();

const optionalCfdiUse = z
  .string()
  .regex(cfdiUseRegex, "El uso CFDI debe ser 1-2 letras + 2 dígitos (ej. G03, CP01).")
  .nullable()
  .optional();

const optionalTaxZipCode = z
  .string()
  .regex(taxZipCodeRegex, "El código postal fiscal debe ser de 5 dígitos.")
  .nullable()
  .optional();

const optionalEmail = z
  .string()
  .email("Email inválido.")
  .max(120)
  .nullable()
  .optional();

const optionalCreditLimit = z
  .number()
  .min(0, "El límite de crédito no puede ser negativo.")
  .nullable()
  .optional();

const optionalCreditDays = z
  .number()
  .int("El plazo de crédito debe ser un número entero de días.")
  .min(0, "El plazo de crédito no puede ser negativo.")
  .optional();

const structuredAddressFields = {
  addressStreet: z.string().max(150).nullable().optional(),
  addressExteriorNumber: z.string().max(20).nullable().optional(),
  addressInteriorNumber: z.string().max(20).nullable().optional(),
  addressNeighborhood: z.string().max(100).nullable().optional(),
  addressMunicipality: z.string().max(100).nullable().optional(),
  addressState: z.string().regex(/^[A-Z]{2,3}$/, "Clave de estado inválida (2-3 letras mayúsculas)").nullable().optional(),
  addressCountry: z.string().max(3).nullable().optional(),
  addressZipCode: z.string().regex(/^\d{5}$/, "Código postal inválido (5 dígitos)").nullable().optional(),
};

export const createCustomerSchema = z.object({
  code: codeSchema,
  name: z.string().min(1, "El nombre es obligatorio.").max(120),
  branchIds: z.array(z.string().uuid()).min(1, "Selecciona al menos una sucursal.").optional(),
  rfc: optionalRfc,
  legalName: z.string().max(200).nullable().optional(),
  taxRegime: optionalTaxRegime,
  cfdiUse: optionalCfdiUse,
  taxZipCode: optionalTaxZipCode,
  email: optionalEmail,
  phone: z.string().max(30).nullable().optional(),
  address: z.string().max(300).nullable().optional(),
  contactName: z.string().max(120).nullable().optional(),
  notes: z.string().nullable().optional(),
  creditLimit: optionalCreditLimit,
  initialBalance: optionalInitialBalance,
  creditDays: optionalCreditDays,
  isActive: z.boolean().optional(),
  ...structuredAddressFields,
});

export const updateCustomerSchema = z
  .object({
    name: z.string().min(1).max(120).optional(),
    branchIds: z.array(z.string().uuid()).min(1, "Selecciona al menos una sucursal.").optional(),
    rfc: optionalRfc,
    legalName: z.string().max(200).nullable().optional(),
    taxRegime: optionalTaxRegime,
    cfdiUse: optionalCfdiUse,
    taxZipCode: optionalTaxZipCode,
    email: optionalEmail,
    phone: z.string().max(30).nullable().optional(),
    address: z.string().max(300).nullable().optional(),
    contactName: z.string().max(120).nullable().optional(),
    notes: z.string().nullable().optional(),
    creditLimit: optionalCreditLimit,
    initialBalance: optionalInitialBalance,
    creditDays: optionalCreditDays,
    isActive: z.boolean().optional(),
    ...structuredAddressFields,
  })
  .refine(
    (d) =>
      d.name !== undefined ||
      d.rfc !== undefined ||
      d.legalName !== undefined ||
      d.taxRegime !== undefined ||
      d.cfdiUse !== undefined ||
      d.taxZipCode !== undefined ||
      d.email !== undefined ||
      d.phone !== undefined ||
      d.address !== undefined ||
      d.contactName !== undefined ||
      d.notes !== undefined ||
      d.creditLimit !== undefined ||
      d.initialBalance !== undefined ||
      d.creditDays !== undefined ||
      d.isActive !== undefined ||
      d.branchIds !== undefined ||
      d.addressStreet !== undefined ||
      d.addressExteriorNumber !== undefined ||
      d.addressInteriorNumber !== undefined ||
      d.addressNeighborhood !== undefined ||
      d.addressMunicipality !== undefined ||
      d.addressState !== undefined ||
      d.addressCountry !== undefined ||
      d.addressZipCode !== undefined,
    { message: "Debes modificar al menos un campo." }
  );

export type CreateCustomerFormValues = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerFormValues = z.infer<typeof updateCustomerSchema>;
