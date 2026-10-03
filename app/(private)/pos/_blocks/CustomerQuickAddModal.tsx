"use client";

import { useState, useEffect, useRef } from "react";
import { Icon } from "../../../_components/atoms/Icon/Icon";
import { Spinner } from "../../../_components/atoms/Spinner/Spinner";
import { SatCatalogCombobox } from "../../../_components/molecules/SatCatalogCombobox/SatCatalogCombobox";
import { customerQuickAddSchema } from "../_logic/schemas/customerQuickAdd.schema";
import { createCustomer } from "../_logic/services/createCustomer";
import { CustomerCodeAlreadyInUseError, CustomerRfcAlreadyInUseError } from "../_logic/errors";
import type { CustomerDto } from "../_logic/types/api";

interface CustomerQuickAddModalProps {
  onCreated: (customer: CustomerDto) => void;
  onClose: () => void;
  branchId?: string | null;
}

interface FieldErrors {
  code?: string;
  name?: string;
  rfc?: string;
  legalName?: string;
  taxRegime?: string;
  cfdiUse?: string;
  taxZipCode?: string;
  email?: string;
  phone?: string;
}

export function CustomerQuickAddModal({ onCreated, onClose, branchId }: CustomerQuickAddModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    code: "",
    name: "",
    rfc: "",
    legalName: "",
    taxRegime: "",
    cfdiUse: "",
    taxZipCode: "",
    email: "",
    phone: "",
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showFiscal, setShowFiscal] = useState(false);

  useEffect(() => {
    dialogRef.current?.showModal();
    firstInputRef.current?.focus();
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handleCancel = (e: Event) => {
      e.preventDefault();
      onClose();
    };
    dialog.addEventListener("cancel", handleCancel);
    return () => dialog.removeEventListener("cancel", handleCancel);
  }, [onClose]);

  function set(field: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setGlobalError(null);

    const input = {
      code: form.code.trim().toUpperCase(),
      name: form.name.trim(),
      ...(form.rfc.trim() ? { rfc: form.rfc.trim().toUpperCase() } : {}),
      ...(form.legalName.trim() ? { legalName: form.legalName.trim() } : {}),
      ...(form.taxRegime.trim() ? { taxRegime: form.taxRegime.trim() } : {}),
      ...(form.cfdiUse.trim() ? { cfdiUse: form.cfdiUse.trim().toUpperCase() } : {}),
      ...(form.taxZipCode.trim() ? { taxZipCode: form.taxZipCode.trim() } : {}),
      ...(form.email.trim() ? { email: form.email.trim() } : {}),
      ...(form.phone.trim() ? { phone: form.phone.trim() } : {}),
    };

    const result = customerQuickAddSchema.safeParse(input);
    if (!result.success) {
      const fieldErrors: FieldErrors = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0] as keyof FieldErrors;
        if (field) fieldErrors[field] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      const customer = await createCustomer({
        ...result.data,
        ...(branchId ? { branchIds: [branchId] } : {}),
      });
      onCreated(customer);
    } catch (err) {
      if (err instanceof CustomerCodeAlreadyInUseError) {
        setErrors((prev) => ({ ...prev, code: "Este código ya está en uso." }));
      } else if (err instanceof CustomerRfcAlreadyInUseError) {
        setErrors((prev) => ({ ...prev, rfc: "Este RFC ya está en uso por otro cliente." }));
      } else {
        setGlobalError("Error al crear el cliente. Inténtalo de nuevo.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="w-full max-w-lg rounded-lg bg-surface p-6 shadow-xl max-h-[90vh] overflow-y-auto backdrop:bg-black/40"
    >
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-title-md font-semibold text-on-surface">Nuevo cliente</h2>
        <button type="button" onClick={onClose} className="text-on-surface-variant hover:text-on-surface">
          <Icon name="close" size={18} />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-label-sm text-on-surface-variant mb-1 block">Código *</label>
            <input
              ref={firstInputRef}
              value={form.code}
              onChange={(e) => set("code", e.target.value.toUpperCase())}
              placeholder="CLI001"
              className={`w-full rounded border px-3 py-2 text-body-sm font-mono focus:outline-none focus:ring-1 ${errors.code ? "border-error focus:ring-error" : "border-outline focus:border-primary focus:ring-primary"}`}
            />
            {errors.code && <p className="text-label-sm text-error mt-1">{errors.code}</p>}
          </div>
          <div>
            <label className="text-label-sm text-on-surface-variant mb-1 block">RFC</label>
            <input
              value={form.rfc}
              onChange={(e) => set("rfc", e.target.value.toUpperCase())}
              placeholder="XAXX010101000"
              className={`w-full rounded border px-3 py-2 text-body-sm font-mono focus:outline-none focus:ring-1 ${errors.rfc ? "border-error focus:ring-error" : "border-outline focus:border-primary focus:ring-primary"}`}
            />
            {errors.rfc && <p className="text-label-sm text-error mt-1">{errors.rfc}</p>}
          </div>
        </div>

        <div>
          <label className="text-label-sm text-on-surface-variant mb-1 block">Nombre *</label>
          <input
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="Nombre del cliente"
            className={`w-full rounded border px-3 py-2 text-body-sm focus:outline-none focus:ring-1 ${errors.name ? "border-error focus:ring-error" : "border-outline focus:border-primary focus:ring-primary"}`}
          />
          {errors.name && <p className="text-label-sm text-error mt-1">{errors.name}</p>}
        </div>

        <button
          type="button"
          onClick={() => setShowFiscal((v) => !v)}
          className="flex items-center gap-1 text-label-sm text-primary hover:text-primary/80"
        >
          <Icon name={showFiscal ? "chevron_left" : "chevron_right"} size={16} />
          Datos fiscales (opcionales)
        </button>

        {showFiscal && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-label-sm text-on-surface-variant mb-1 block">Régimen fiscal</label>
              <SatCatalogCombobox
                catalog="regimen-fiscal"
                id="customer-taxRegime"
                value={form.taxRegime}
                onChange={(v) => set("taxRegime", v)}
                placeholder="601"
                className="w-full rounded border border-outline px-3 py-2 text-body-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
              {errors.taxRegime && <p className="text-label-sm text-error mt-1">{errors.taxRegime}</p>}
            </div>
            <div>
              <label className="text-label-sm text-on-surface-variant mb-1 block">Uso CFDI</label>
              <SatCatalogCombobox
                catalog="uso-cfdi"
                id="customer-cfdiUse"
                value={form.cfdiUse}
                onChange={(v) => set("cfdiUse", v)}
                placeholder="G03"
                className="w-full rounded border border-outline px-3 py-2 text-body-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
              {errors.cfdiUse && <p className="text-label-sm text-error mt-1">{errors.cfdiUse}</p>}
            </div>
            <div>
              <label className="text-label-sm text-on-surface-variant mb-1 block">Código postal</label>
              <input value={form.taxZipCode} onChange={(e) => set("taxZipCode", e.target.value)} placeholder="01000"
                className="w-full rounded border border-outline px-3 py-2 text-body-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary" />
              {errors.taxZipCode && <p className="text-label-sm text-error mt-1">{errors.taxZipCode}</p>}
            </div>
            <div>
              <label className="text-label-sm text-on-surface-variant mb-1 block">Email</label>
              <input value={form.email} onChange={(e) => set("email", e.target.value)} type="email" placeholder="correo@ejemplo.com"
                className="w-full rounded border border-outline px-3 py-2 text-body-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary" />
              {errors.email && <p className="text-label-sm text-error mt-1">{errors.email}</p>}
            </div>
          </div>
        )}

        {globalError && (
          <p className="text-body-sm text-error">{globalError}</p>
        )}

        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose}
            className="flex-1 rounded-full border border-outline py-2 text-body-sm font-medium text-on-surface hover:bg-surface-container-low transition-colors">
            Cancelar
          </button>
          <button type="submit" disabled={isSubmitting}
            className="flex-1 rounded-full bg-primary py-2 text-body-sm font-medium text-on-primary hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            {isSubmitting && <Spinner size="sm" />}
            Crear cliente
          </button>
        </div>
      </form>
    </dialog>
  );
}
