"use client";

import { useState, useEffect, useRef } from "react";
import { IconButton } from "../../../../_components/atoms/IconButton/IconButton";
import { Button } from "../../../../_components/atoms/Button/Button";
import { Switch } from "../../../../_components/atoms/Switch/Switch";
import { createProviderSchema, updateProviderSchema } from "../_logic/schemas/provider.schema";
import type { Provider } from "../_logic/types/domain";
import type { CreateProviderBody, UpdateProviderBody } from "../_logic/types/api";

interface ProviderEditModalProps {
  open: boolean;
  mode: "create" | "edit";
  entity: Provider | null;
  isSaving: boolean;
  codeError: string | null;
  rfcError: string | null;
  mutationError: string | null;
  onSave: (data: CreateProviderBody | UpdateProviderBody) => void;
  onClose: () => void;
}

function normalizeOptional(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function normalizeOptionalNumber(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  const parsed = Number(trimmed);
  return Number.isNaN(parsed) ? null : parsed;
}

const DEFAULT_CREDIT_DAYS = 30;

export function ProviderEditModal({
  open,
  mode,
  entity,
  isSaving,
  codeError,
  rfcError,
  mutationError,
  onSave,
  onClose,
}: ProviderEditModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [rfc, setRfc] = useState("");
  const [legalName, setLegalName] = useState("");
  const [taxRegime, setTaxRegime] = useState("");
  const [cfdiUse, setCfdiUse] = useState("");
  const [taxZipCode, setTaxZipCode] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [contactName, setContactName] = useState("");
  const [notes, setNotes] = useState("");
  const [creditLimit, setCreditLimit] = useState("");
  const [initialBalance, setInitialBalance] = useState("");
  const [creditDays, setCreditDays] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) dialog.showModal();
    else dialog.close();
  }, [open]);

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

  useEffect(() => {
    if (!open) return;
    if (mode === "create") {
      setCode("");
      setName("");
      setRfc("");
      setLegalName("");
      setTaxRegime("");
      setCfdiUse("");
      setTaxZipCode("");
      setEmail("");
      setPhone("");
      setAddress("");
      setContactName("");
      setNotes("");
      setCreditLimit("");
      setInitialBalance("");
      setCreditDays("");
      setIsActive(true);
    } else if (entity) {
      setCode(entity.code);
      setName(entity.name);
      setRfc(entity.rfc ?? "");
      setLegalName(entity.legalName ?? "");
      setTaxRegime(entity.taxRegime ?? "");
      setCfdiUse(entity.cfdiUse ?? "");
      setTaxZipCode(entity.taxZipCode ?? "");
      setEmail(entity.email ?? "");
      setPhone(entity.phone ?? "");
      setAddress(entity.address ?? "");
      setContactName(entity.contactName ?? "");
      setNotes(entity.notes ?? "");
      setCreditLimit(entity.creditLimit !== null ? String(entity.creditLimit) : "");
      setInitialBalance(String(entity.initialBalance));
      setCreditDays(String(entity.creditDays));
      setIsActive(entity.isActive);
    }
    setValidationErrors({});
  }, [open, mode, entity]);

  function buildCreatePayload(): CreateProviderBody {
    const trimmedCreditDays = creditDays.trim();
    return {
      code,
      name: name.trim(),
      rfc: normalizeOptional(rfc),
      legalName: normalizeOptional(legalName),
      taxRegime: normalizeOptional(taxRegime),
      cfdiUse: normalizeOptional(cfdiUse),
      taxZipCode: normalizeOptional(taxZipCode),
      email: normalizeOptional(email),
      phone: normalizeOptional(phone),
      address: normalizeOptional(address),
      contactName: normalizeOptional(contactName),
      notes: normalizeOptional(notes),
      creditLimit: normalizeOptionalNumber(creditLimit),
      ...(initialBalance.trim().length > 0 ? { initialBalance: Number(initialBalance.trim()) } : {}),
      ...(trimmedCreditDays.length > 0 ? { creditDays: Number(trimmedCreditDays) } : {}),
      isActive,
    };
  }

  function getDiff(): UpdateProviderBody {
    if (!entity) return {};
    const diff: UpdateProviderBody = {};
    if (name.trim() !== entity.name) diff.name = name.trim();
    const rfcNorm = normalizeOptional(rfc);
    if (rfcNorm !== entity.rfc) diff.rfc = rfcNorm;
    const ln = normalizeOptional(legalName);
    if (ln !== entity.legalName) diff.legalName = ln;
    const tr = normalizeOptional(taxRegime);
    if (tr !== entity.taxRegime) diff.taxRegime = tr;
    const cu = normalizeOptional(cfdiUse);
    if (cu !== entity.cfdiUse) diff.cfdiUse = cu;
    const tzc = normalizeOptional(taxZipCode);
    if (tzc !== entity.taxZipCode) diff.taxZipCode = tzc;
    const em = normalizeOptional(email);
    if (em !== entity.email) diff.email = em;
    const ph = normalizeOptional(phone);
    if (ph !== entity.phone) diff.phone = ph;
    const ad = normalizeOptional(address);
    if (ad !== entity.address) diff.address = ad;
    const cn = normalizeOptional(contactName);
    if (cn !== entity.contactName) diff.contactName = cn;
    const nt = normalizeOptional(notes);
    if (nt !== entity.notes) diff.notes = nt;
    const cl = normalizeOptionalNumber(creditLimit);
    if (cl !== entity.creditLimit) diff.creditLimit = cl;
    const trimmedInitialBalance = initialBalance.trim();
    const ib = trimmedInitialBalance.length > 0 ? Number(trimmedInitialBalance) : entity.initialBalance;
    if (ib !== entity.initialBalance) diff.initialBalance = ib;
    const trimmedCreditDays = creditDays.trim();
    const cd = trimmedCreditDays.length > 0 ? Number(trimmedCreditDays) : entity.creditDays;
    if (cd !== entity.creditDays) diff.creditDays = cd;
    if (isActive !== entity.isActive) diff.isActive = isActive;
    return diff;
  }

  function validate(): boolean {
    const payload = buildCreatePayload();
    if (mode === "create") {
      const result = createProviderSchema.safeParse(payload);
      if (!result.success) {
        const errs: Record<string, string> = {};
        for (const issue of result.error.issues) {
          const key = String(issue.path[0]);
          if (!errs[key]) errs[key] = issue.message;
        }
        setValidationErrors(errs);
        return false;
      }
    } else {
      const diff = getDiff();
      const result = updateProviderSchema.safeParse(diff);
      if (!result.success) {
        const errs: Record<string, string> = {};
        for (const issue of result.error.issues) {
          const key = String(issue.path[0]);
          if (!errs[key]) errs[key] = issue.message;
        }
        setValidationErrors(errs);
        return false;
      }
    }
    setValidationErrors({});
    return true;
  }

  function handleSave() {
    if (!validate()) return;
    if (mode === "create") {
      onSave(buildCreatePayload());
    } else {
      const diff = getDiff();
      if (Object.keys(diff).length === 0) return;
      onSave(diff);
    }
  }

  const isCreateMode = mode === "create";
  const diff = mode === "edit" ? getDiff() : null;
  const isDiffEmpty = mode === "edit" && diff !== null && Object.keys(diff).length === 0;
  const hasValidationErrors = Object.keys(validationErrors).length > 0;
  const title = isCreateMode ? "Nuevo proveedor" : "Editar proveedor";

  return (
    <dialog
      ref={dialogRef}
      className="rounded-lg bg-surface-container p-0 shadow-lg w-full max-w-2xl backdrop:bg-black/40"
    >
      <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant">
        <h2 className="text-title-md font-semibold text-on-surface">{title}</h2>
        <IconButton
          icon="close"
          iconSize={20}
          ariaLabel="Cerrar"
          variant="ghost"
          onClick={onClose}
          className="rounded p-1.5"
        />
      </div>

      <div className="px-6 py-5 space-y-6 max-h-[75vh] overflow-y-auto">
        {/* Sección: Datos básicos */}
        <section className="space-y-4">
          <h3 className="text-title-sm font-medium text-on-surface-variant uppercase tracking-wide">
            Datos básicos
          </h3>

          <div>
            <label className="block text-label-lg text-on-surface-variant mb-1" htmlFor="provider-code">
              Código <span className="text-error">*</span>
            </label>
            <input
              id="provider-code"
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              disabled={!isCreateMode}
              placeholder="EJ. PROV_001"
              className="w-full px-3 py-2 rounded-md border border-outline-variant bg-surface-container-lowest text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-40 disabled:cursor-not-allowed disabled:bg-surface-container"
            />
            {(validationErrors.code || codeError) && (
              <p className="text-label-sm text-error mt-1">{validationErrors.code ?? codeError}</p>
            )}
          </div>

          <div>
            <label className="block text-label-lg text-on-surface-variant mb-1" htmlFor="provider-name">
              Nombre <span className="text-error">*</span>
            </label>
            <input
              id="provider-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nombre comercial del proveedor"
              className="w-full px-3 py-2 rounded-md border border-outline-variant bg-surface-container-lowest text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
            />
            {validationErrors.name && (
              <p className="text-label-sm text-error mt-1">{validationErrors.name}</p>
            )}
          </div>

          <div className="flex items-center gap-3">
            <Switch
              checked={isActive}
              onChange={setIsActive}
              aria-label="Activo"
              id="provider-isActive"
            />
            <label htmlFor="provider-isActive" className="text-label-lg text-on-surface-variant cursor-pointer">
              Activo
            </label>
          </div>
        </section>

        {/* Sección: Datos fiscales */}
        <section className="space-y-4 pt-4 border-t border-outline-variant">
          <h3 className="text-title-sm font-medium text-on-surface-variant uppercase tracking-wide">
            Datos fiscales
          </h3>

          <div>
            <label className="block text-label-lg text-on-surface-variant mb-1" htmlFor="provider-rfc">
              RFC
            </label>
            <input
              id="provider-rfc"
              type="text"
              value={rfc}
              onChange={(e) => setRfc(e.target.value.toUpperCase())}
              placeholder="EJ. SAC120101A12"
              className="w-full px-3 py-2 rounded-md border border-outline-variant bg-surface-container-lowest text-body-md text-on-surface font-mono focus:outline-none focus:ring-2 focus:ring-primary"
            />
            {(validationErrors.rfc || rfcError) && (
              <p className="text-label-sm text-error mt-1">{validationErrors.rfc ?? rfcError}</p>
            )}
          </div>

          <div>
            <label className="block text-label-lg text-on-surface-variant mb-1" htmlFor="provider-legalName">
              Razón social
            </label>
            <input
              id="provider-legalName"
              type="text"
              value={legalName}
              onChange={(e) => setLegalName(e.target.value)}
              placeholder="Denominación legal (opcional)"
              className="w-full px-3 py-2 rounded-md border border-outline-variant bg-surface-container-lowest text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
            />
            {validationErrors.legalName && (
              <p className="text-label-sm text-error mt-1">{validationErrors.legalName}</p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-label-lg text-on-surface-variant mb-1" htmlFor="provider-taxRegime">
                Régimen fiscal
              </label>
              <input
                id="provider-taxRegime"
                type="text"
                value={taxRegime}
                onChange={(e) => setTaxRegime(e.target.value)}
                placeholder="601"
                maxLength={3}
                className="w-full px-3 py-2 rounded-md border border-outline-variant bg-surface-container-lowest text-body-md text-on-surface font-mono focus:outline-none focus:ring-2 focus:ring-primary"
              />
              {validationErrors.taxRegime && (
                <p className="text-label-sm text-error mt-1">{validationErrors.taxRegime}</p>
              )}
            </div>

            <div>
              <label className="block text-label-lg text-on-surface-variant mb-1" htmlFor="provider-cfdiUse">
                Uso CFDI
              </label>
              <input
                id="provider-cfdiUse"
                type="text"
                value={cfdiUse}
                onChange={(e) => setCfdiUse(e.target.value.toUpperCase())}
                placeholder="G03"
                maxLength={3}
                className="w-full px-3 py-2 rounded-md border border-outline-variant bg-surface-container-lowest text-body-md text-on-surface font-mono focus:outline-none focus:ring-2 focus:ring-primary"
              />
              {validationErrors.cfdiUse && (
                <p className="text-label-sm text-error mt-1">{validationErrors.cfdiUse}</p>
              )}
            </div>

            <div>
              <label className="block text-label-lg text-on-surface-variant mb-1" htmlFor="provider-taxZipCode">
                CP fiscal
              </label>
              <input
                id="provider-taxZipCode"
                type="text"
                value={taxZipCode}
                onChange={(e) => setTaxZipCode(e.target.value)}
                placeholder="06600"
                maxLength={5}
                className="w-full px-3 py-2 rounded-md border border-outline-variant bg-surface-container-lowest text-body-md text-on-surface font-mono focus:outline-none focus:ring-2 focus:ring-primary"
              />
              {validationErrors.taxZipCode && (
                <p className="text-label-sm text-error mt-1">{validationErrors.taxZipCode}</p>
              )}
            </div>
          </div>
        </section>

        {/* Sección: Contacto y crédito */}
        <section className="space-y-4 pt-4 border-t border-outline-variant">
          <h3 className="text-title-sm font-medium text-on-surface-variant uppercase tracking-wide">
            Contacto y crédito
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-label-lg text-on-surface-variant mb-1" htmlFor="provider-email">
                Email
              </label>
              <input
                id="provider-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="contacto@proveedor.com"
                className="w-full px-3 py-2 rounded-md border border-outline-variant bg-surface-container-lowest text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
              />
              {validationErrors.email && (
                <p className="text-label-sm text-error mt-1">{validationErrors.email}</p>
              )}
            </div>

            <div>
              <label className="block text-label-lg text-on-surface-variant mb-1" htmlFor="provider-phone">
                Teléfono
              </label>
              <input
                id="provider-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Opcional"
                className="w-full px-3 py-2 rounded-md border border-outline-variant bg-surface-container-lowest text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
              />
              {validationErrors.phone && (
                <p className="text-label-sm text-error mt-1">{validationErrors.phone}</p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-label-lg text-on-surface-variant mb-1" htmlFor="provider-contactName">
              Persona de contacto
            </label>
            <input
              id="provider-contactName"
              type="text"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              placeholder="Nombre del contacto principal (opcional)"
              className="w-full px-3 py-2 rounded-md border border-outline-variant bg-surface-container-lowest text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
            />
            {validationErrors.contactName && (
              <p className="text-label-sm text-error mt-1">{validationErrors.contactName}</p>
            )}
          </div>

          <div>
            <label className="block text-label-lg text-on-surface-variant mb-1" htmlFor="provider-address">
              Dirección
            </label>
            <textarea
              id="provider-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Dirección postal (opcional)"
              rows={2}
              className="w-full px-3 py-2 rounded-md border border-outline-variant bg-surface-container-lowest text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            />
            {validationErrors.address && (
              <p className="text-label-sm text-error mt-1">{validationErrors.address}</p>
            )}
          </div>

          <div>
            <label className="block text-label-lg text-on-surface-variant mb-1" htmlFor="provider-notes">
              Notas internas
            </label>
            <textarea
              id="provider-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notas internas (opcional)"
              rows={2}
              className="w-full px-3 py-2 rounded-md border border-outline-variant bg-surface-container-lowest text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            />
            {validationErrors.notes && (
              <p className="text-label-sm text-error mt-1">{validationErrors.notes}</p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-label-lg text-on-surface-variant mb-1" htmlFor="provider-creditLimit">
                Límite de crédito
              </label>
              <input
                id="provider-creditLimit"
                type="number"
                min={0}
                step="0.01"
                value={creditLimit}
                onChange={(e) => setCreditLimit(e.target.value)}
                placeholder="Sin límite (opcional)"
                className="w-full px-3 py-2 rounded-md border border-outline-variant bg-surface-container-lowest text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
              />
              {validationErrors.creditLimit && (
                <p className="text-label-sm text-error mt-1">{validationErrors.creditLimit}</p>
              )}
            </div>

            <div>
              <label className="block text-label-lg text-on-surface-variant mb-1" htmlFor="provider-creditDays">
                Plazo de crédito (días)
              </label>
              <input
                id="provider-creditDays"
                type="number"
                min={0}
                step="1"
                value={creditDays}
                onChange={(e) => setCreditDays(e.target.value)}
                placeholder={String(DEFAULT_CREDIT_DAYS)}
                className="w-full px-3 py-2 rounded-md border border-outline-variant bg-surface-container-lowest text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
              />
              {validationErrors.creditDays && (
                <p className="text-label-sm text-error mt-1">{validationErrors.creditDays}</p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-label-lg text-on-surface-variant mb-1" htmlFor="provider-initialBalance">
              Saldo inicial (deuda inicial)
            </label>
            <input
              id="provider-initialBalance"
              type="number"
              min={0}
              step="0.01"
              value={initialBalance}
              onChange={(e) => setInitialBalance(e.target.value)}
              placeholder="0.00"
              className="w-full px-3 py-2 rounded-md border border-outline-variant bg-surface-container-lowest text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
            />
            {validationErrors.initialBalance && (
              <p className="text-label-sm text-error mt-1">{validationErrors.initialBalance}</p>
            )}
          </div>
        </section>

        {mutationError && (
          <p className="text-body-md text-error bg-error-container px-4 py-2 rounded">
            {mutationError}
          </p>
        )}
      </div>

      <div className="flex justify-end gap-3 px-6 py-4 border-t border-outline-variant bg-surface-container-lowest">
        <Button type="button" variant="outlined" onClick={onClose} disabled={isSaving}>
          Cancelar
        </Button>
        <Button
          type="button"
          variant="filled"
          onClick={handleSave}
          disabled={isDiffEmpty || isSaving || hasValidationErrors}
          loading={isSaving}
        >
          {isSaving ? "Guardando..." : "Guardar"}
        </Button>
      </div>
    </dialog>
  );
}
