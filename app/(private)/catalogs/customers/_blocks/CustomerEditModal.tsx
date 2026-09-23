"use client";

import { useState, useEffect, useRef } from "react";
import { Icon } from "../../../../_components/atoms/Icon/Icon";
import { Switch } from "../../../../_components/atoms/Switch/Switch";
import { SatCatalogCombobox } from "../../../../_components/molecules/SatCatalogCombobox/SatCatalogCombobox";
import { createCustomerSchema, updateCustomerSchema } from "../_logic/schemas/customer.schema";
import type { Customer } from "../_logic/types/domain";
import type { CreateCustomerBody, UpdateCustomerBody } from "../_logic/types/api";

interface CustomerBranchOption {
  id: string;
  name: string;
}

interface CustomerEditModalProps {
  open: boolean;
  mode: "create" | "edit";
  entity: Customer | null;
  isSaving: boolean;
  codeError: string | null;
  rfcError: string | null;
  mutationError: string | null;
  onSave: (data: CreateCustomerBody | UpdateCustomerBody) => void;
  onClose: () => void;
  /** Sucursales activas — vía useBranchesOptions(). Sólo se usan en modo bypass. */
  branches: CustomerBranchOption[];
  isBypass: boolean;
  ownBranchId: string | null;
  /** Preselección en modo create con bypass. */
  headquartersId: string | null;
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

export function CustomerEditModal({
  open,
  mode,
  entity,
  isSaving,
  codeError,
  rfcError,
  mutationError,
  onSave,
  onClose,
  branches,
  isBypass,
  ownBranchId,
  headquartersId,
}: CustomerEditModalProps) {
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
  const [addressStreet, setAddressStreet] = useState("");
  const [addressExteriorNumber, setAddressExteriorNumber] = useState("");
  const [addressInteriorNumber, setAddressInteriorNumber] = useState("");
  const [addressNeighborhood, setAddressNeighborhood] = useState("");
  const [addressMunicipality, setAddressMunicipality] = useState("");
  const [addressState, setAddressState] = useState("");
  const [addressCountry, setAddressCountry] = useState("");
  const [addressZipCode, setAddressZipCode] = useState("");
  const [branchIds, setBranchIds] = useState<string[]>([]);
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
      setAddressStreet("");
      setAddressExteriorNumber("");
      setAddressInteriorNumber("");
      setAddressNeighborhood("");
      setAddressMunicipality("");
      setAddressState("");
      setAddressCountry("");
      setAddressZipCode("");
      setBranchIds(isBypass ? (headquartersId ? [headquartersId] : []) : ownBranchId ? [ownBranchId] : []);
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
      setAddressStreet(entity.addressStreet ?? "");
      setAddressExteriorNumber(entity.addressExteriorNumber ?? "");
      setAddressInteriorNumber(entity.addressInteriorNumber ?? "");
      setAddressNeighborhood(entity.addressNeighborhood ?? "");
      setAddressMunicipality(entity.addressMunicipality ?? "");
      setAddressState(entity.addressState ?? "");
      setAddressCountry(entity.addressCountry ?? "");
      setAddressZipCode(entity.addressZipCode ?? "");
      setBranchIds(entity.branchIds);
    }
    setValidationErrors({});
  }, [open, mode, entity, isBypass, ownBranchId, headquartersId]);

  function toggleBranch(id: string) {
    setBranchIds((prev) => (prev.includes(id) ? prev.filter((b) => b !== id) : [...prev, id]));
  }

  function buildCreatePayload(): CreateCustomerBody {
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
      addressStreet: normalizeOptional(addressStreet),
      addressExteriorNumber: normalizeOptional(addressExteriorNumber),
      addressInteriorNumber: normalizeOptional(addressInteriorNumber),
      addressNeighborhood: normalizeOptional(addressNeighborhood),
      addressMunicipality: normalizeOptional(addressMunicipality),
      addressState: normalizeOptional(addressState),
      addressCountry: normalizeOptional(addressCountry),
      addressZipCode: normalizeOptional(addressZipCode),
      branchIds,
    };
  }

  function getDiff(): UpdateCustomerBody {
    if (!entity) return {};
    const diff: UpdateCustomerBody = {};
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
    const st = normalizeOptional(addressStreet);
    if (st !== entity.addressStreet) diff.addressStreet = st;
    const ext = normalizeOptional(addressExteriorNumber);
    if (ext !== entity.addressExteriorNumber) diff.addressExteriorNumber = ext;
    const int = normalizeOptional(addressInteriorNumber);
    if (int !== entity.addressInteriorNumber) diff.addressInteriorNumber = int;
    const nb = normalizeOptional(addressNeighborhood);
    if (nb !== entity.addressNeighborhood) diff.addressNeighborhood = nb;
    const mu = normalizeOptional(addressMunicipality);
    if (mu !== entity.addressMunicipality) diff.addressMunicipality = mu;
    const st2 = normalizeOptional(addressState);
    if (st2 !== entity.addressState) diff.addressState = st2;
    const co = normalizeOptional(addressCountry);
    if (co !== entity.addressCountry) diff.addressCountry = co;
    const zc = normalizeOptional(addressZipCode);
    if (zc !== entity.addressZipCode) diff.addressZipCode = zc;
    const sortedCurrent = [...branchIds].sort();
    const sortedOriginal = [...entity.branchIds].sort();
    if (JSON.stringify(sortedCurrent) !== JSON.stringify(sortedOriginal)) diff.branchIds = branchIds;
    return diff;
  }

  function validate(): boolean {
    if (mode === "create") {
      const payload = buildCreatePayload();
      const result = createCustomerSchema.safeParse(payload);
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
      const result = updateCustomerSchema.safeParse(diff);
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
  const title = isCreateMode ? "Nuevo cliente" : "Editar cliente";

  return (
    <dialog
      ref={dialogRef}
      className="rounded-lg bg-surface-container p-0 shadow-lg w-full max-w-2xl backdrop:bg-black/40"
    >
      <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant">
        <h2 className="text-title-md font-semibold text-on-surface">{title}</h2>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded text-on-surface-variant hover:bg-surface-container-high"
        >
          <Icon name="close" size={20} />
        </button>
      </div>

      <div className="px-6 py-5 space-y-6 max-h-[75vh] overflow-y-auto">
        {/* Sección: Datos básicos */}
        <section className="space-y-4">
          <h3 className="text-title-sm font-medium text-on-surface-variant uppercase tracking-wide">
            Datos básicos
          </h3>

          <div>
            <label className="block text-label-lg text-on-surface-variant mb-1" htmlFor="customer-code">
              Código <span className="text-error">*</span>
            </label>
            <input
              id="customer-code"
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              disabled={!isCreateMode}
              placeholder="EJ. CLI_001"
              className="w-full px-3 py-2 rounded-md border border-outline-variant bg-surface-container-lowest text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-40 disabled:cursor-not-allowed disabled:bg-surface-container"
            />
            {(validationErrors.code || codeError) && (
              <p className="text-label-sm text-error mt-1">{validationErrors.code ?? codeError}</p>
            )}
          </div>

          <div>
            <label className="block text-label-lg text-on-surface-variant mb-1" htmlFor="customer-name">
              Nombre <span className="text-error">*</span>
            </label>
            <input
              id="customer-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nombre comercial del cliente"
              className="w-full px-3 py-2 rounded-md border border-outline-variant bg-surface-container-lowest text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
            />
            {validationErrors.name && (
              <p className="text-label-sm text-error mt-1">{validationErrors.name}</p>
            )}
          </div>

          <div>
            <label className="block text-label-lg text-on-surface-variant mb-1" htmlFor="customer-rfc">
              RFC
            </label>
            <input
              id="customer-rfc"
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

          <div className="flex items-center gap-3">
            <Switch
              checked={isActive}
              onChange={setIsActive}
              aria-label="Activo"
              id="customer-isActive"
            />
            <label htmlFor="customer-isActive" className="text-label-lg text-on-surface-variant cursor-pointer">
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
            <label className="block text-label-lg text-on-surface-variant mb-1" htmlFor="customer-legalName">
              Razón social
            </label>
            <input
              id="customer-legalName"
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
              <label className="block text-label-lg text-on-surface-variant mb-1" htmlFor="customer-taxRegime">
                Régimen fiscal
              </label>
              <SatCatalogCombobox
                catalog="regimen-fiscal"
                id="customer-taxRegime"
                value={taxRegime}
                onChange={setTaxRegime}
                placeholder="601"
                className="w-full px-3 py-2 rounded-md border border-outline-variant bg-surface-container-lowest text-body-md text-on-surface font-mono focus:outline-none focus:ring-2 focus:ring-primary"
              />
              {validationErrors.taxRegime && (
                <p className="text-label-sm text-error mt-1">{validationErrors.taxRegime}</p>
              )}
            </div>

            <div>
              <label className="block text-label-lg text-on-surface-variant mb-1" htmlFor="customer-cfdiUse">
                Uso CFDI
              </label>
              <SatCatalogCombobox
                catalog="uso-cfdi"
                id="customer-cfdiUse"
                value={cfdiUse}
                onChange={setCfdiUse}
                placeholder="G03"
                className="w-full px-3 py-2 rounded-md border border-outline-variant bg-surface-container-lowest text-body-md text-on-surface font-mono focus:outline-none focus:ring-2 focus:ring-primary"
              />
              {validationErrors.cfdiUse && (
                <p className="text-label-sm text-error mt-1">{validationErrors.cfdiUse}</p>
              )}
            </div>

            <div>
              <label className="block text-label-lg text-on-surface-variant mb-1" htmlFor="customer-taxZipCode">
                CP fiscal
              </label>
              <input
                id="customer-taxZipCode"
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
              <label className="block text-label-lg text-on-surface-variant mb-1" htmlFor="customer-email">
                Email
              </label>
              <input
                id="customer-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="contacto@cliente.com"
                className="w-full px-3 py-2 rounded-md border border-outline-variant bg-surface-container-lowest text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
              />
              {validationErrors.email && (
                <p className="text-label-sm text-error mt-1">{validationErrors.email}</p>
              )}
            </div>

            <div>
              <label className="block text-label-lg text-on-surface-variant mb-1" htmlFor="customer-phone">
                Teléfono
              </label>
              <input
                id="customer-phone"
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
            <label className="block text-label-lg text-on-surface-variant mb-1" htmlFor="customer-contactName">
              Persona de contacto
            </label>
            <input
              id="customer-contactName"
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
            <label className="block text-label-lg text-on-surface-variant mb-1" htmlFor="customer-address">
              Dirección
            </label>
            <textarea
              id="customer-address"
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
            <label className="block text-label-lg text-on-surface-variant mb-1" htmlFor="customer-notes">
              Notas internas
            </label>
            <textarea
              id="customer-notes"
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
              <label className="block text-label-lg text-on-surface-variant mb-1" htmlFor="customer-creditLimit">
                Límite de crédito
              </label>
              <input
                id="customer-creditLimit"
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
              <label className="block text-label-lg text-on-surface-variant mb-1" htmlFor="customer-creditDays">
                Plazo de crédito (días)
              </label>
              <input
                id="customer-creditDays"
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
            <label className="block text-label-lg text-on-surface-variant mb-1" htmlFor="customer-initialBalance">
              Saldo inicial (deuda inicial)
            </label>
            <input
              id="customer-initialBalance"
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

        {/* Sección: Sucursales */}
        <section className="space-y-3 pt-4 border-t border-outline-variant">
          <h3 className="text-title-sm font-medium text-on-surface-variant uppercase tracking-wide">
            Sucursales
          </h3>

          {isBypass ? (
            <>
              <div className="flex flex-wrap gap-3">
                {branches.map((b) => (
                  <label
                    key={b.id}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-outline-variant bg-surface-container-lowest text-body-sm text-on-surface cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={branchIds.includes(b.id)}
                      onChange={() => toggleBranch(b.id)}
                      className="rounded"
                    />
                    {b.name}
                  </label>
                ))}
              </div>
              {validationErrors.branchIds && (
                <p className="text-label-sm text-error">{validationErrors.branchIds}</p>
              )}
            </>
          ) : (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-secondary-container text-on-secondary-container text-body-sm">
              <Icon name="store" size={16} />
              {branches.find((b) => b.id === ownBranchId)?.name ?? "Mi sucursal"}
            </div>
          )}
        </section>

        {/* Sección: Domicilio estructurado (Carta Porte) */}
        <section className="space-y-4 pt-4 border-t border-outline-variant">
          <h3 className="text-title-sm font-medium text-on-surface-variant uppercase tracking-wide">
            Domicilio estructurado (Carta Porte)
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-label-lg text-on-surface-variant mb-1" htmlFor="customer-addressStreet">
                Calle
              </label>
              <input
                id="customer-addressStreet"
                type="text"
                value={addressStreet}
                onChange={(e) => setAddressStreet(e.target.value)}
                placeholder="Opcional"
                className="w-full px-3 py-2 rounded-md border border-outline-variant bg-surface-container-lowest text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
              />
              {validationErrors.addressStreet && (
                <p className="text-label-sm text-error mt-1">{validationErrors.addressStreet}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label
                  className="block text-label-lg text-on-surface-variant mb-1"
                  htmlFor="customer-addressExteriorNumber"
                >
                  Núm. exterior
                </label>
                <input
                  id="customer-addressExteriorNumber"
                  type="text"
                  value={addressExteriorNumber}
                  onChange={(e) => setAddressExteriorNumber(e.target.value)}
                  placeholder="Opcional"
                  className="w-full px-3 py-2 rounded-md border border-outline-variant bg-surface-container-lowest text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
                />
                {validationErrors.addressExteriorNumber && (
                  <p className="text-label-sm text-error mt-1">{validationErrors.addressExteriorNumber}</p>
                )}
              </div>
              <div>
                <label
                  className="block text-label-lg text-on-surface-variant mb-1"
                  htmlFor="customer-addressInteriorNumber"
                >
                  Núm. interior
                </label>
                <input
                  id="customer-addressInteriorNumber"
                  type="text"
                  value={addressInteriorNumber}
                  onChange={(e) => setAddressInteriorNumber(e.target.value)}
                  placeholder="Opcional"
                  className="w-full px-3 py-2 rounded-md border border-outline-variant bg-surface-container-lowest text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
                />
                {validationErrors.addressInteriorNumber && (
                  <p className="text-label-sm text-error mt-1">{validationErrors.addressInteriorNumber}</p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-label-lg text-on-surface-variant mb-1" htmlFor="customer-addressNeighborhood">
                Colonia
              </label>
              <input
                id="customer-addressNeighborhood"
                type="text"
                value={addressNeighborhood}
                onChange={(e) => setAddressNeighborhood(e.target.value)}
                placeholder="Opcional"
                className="w-full px-3 py-2 rounded-md border border-outline-variant bg-surface-container-lowest text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
              />
              {validationErrors.addressNeighborhood && (
                <p className="text-label-sm text-error mt-1">{validationErrors.addressNeighborhood}</p>
              )}
            </div>

            <div>
              <label className="block text-label-lg text-on-surface-variant mb-1" htmlFor="customer-addressMunicipality">
                Municipio
              </label>
              <input
                id="customer-addressMunicipality"
                type="text"
                value={addressMunicipality}
                onChange={(e) => setAddressMunicipality(e.target.value)}
                placeholder="Opcional"
                className="w-full px-3 py-2 rounded-md border border-outline-variant bg-surface-container-lowest text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
              />
              {validationErrors.addressMunicipality && (
                <p className="text-label-sm text-error mt-1">{validationErrors.addressMunicipality}</p>
              )}
            </div>

            <div>
              <label className="block text-label-lg text-on-surface-variant mb-1" htmlFor="customer-addressState">
                Estado (clave SAT)
              </label>
              <input
                id="customer-addressState"
                type="text"
                value={addressState}
                onChange={(e) => setAddressState(e.target.value.toUpperCase())}
                placeholder="SON"
                maxLength={3}
                className="w-full px-3 py-2 rounded-md border border-outline-variant bg-surface-container-lowest text-body-md text-on-surface font-mono focus:outline-none focus:ring-2 focus:ring-primary"
              />
              {validationErrors.addressState && (
                <p className="text-label-sm text-error mt-1">{validationErrors.addressState}</p>
              )}
            </div>

            <div>
              <label className="block text-label-lg text-on-surface-variant mb-1" htmlFor="customer-addressCountry">
                País
              </label>
              <input
                id="customer-addressCountry"
                type="text"
                value={addressCountry}
                onChange={(e) => setAddressCountry(e.target.value.toUpperCase())}
                placeholder="MEX"
                maxLength={3}
                className="w-full px-3 py-2 rounded-md border border-outline-variant bg-surface-container-lowest text-body-md text-on-surface font-mono focus:outline-none focus:ring-2 focus:ring-primary"
              />
              {validationErrors.addressCountry && (
                <p className="text-label-sm text-error mt-1">{validationErrors.addressCountry}</p>
              )}
            </div>

            <div>
              <label className="block text-label-lg text-on-surface-variant mb-1" htmlFor="customer-addressZipCode">
                Código postal
              </label>
              <input
                id="customer-addressZipCode"
                type="text"
                value={addressZipCode}
                onChange={(e) => setAddressZipCode(e.target.value)}
                placeholder="83000"
                maxLength={5}
                className="w-full px-3 py-2 rounded-md border border-outline-variant bg-surface-container-lowest text-body-md text-on-surface font-mono focus:outline-none focus:ring-2 focus:ring-primary"
              />
              {validationErrors.addressZipCode && (
                <p className="text-label-sm text-error mt-1">{validationErrors.addressZipCode}</p>
              )}
            </div>
          </div>
        </section>

        {mutationError && (
          <p className="text-body-md text-error bg-error-container px-4 py-2 rounded">
            {mutationError}
          </p>
        )}
      </div>

      <div className="flex justify-end gap-3 px-6 py-4 border-t border-outline-variant bg-surface-container-lowest">
        <button
          type="button"
          onClick={onClose}
          disabled={isSaving}
          className="px-5 py-2.5 rounded-md border border-outline text-label-lg text-on-surface font-medium hover:bg-surface-container-high transition-colors disabled:opacity-40"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={isDiffEmpty || isSaving || hasValidationErrors}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md bg-primary text-on-primary text-label-lg font-medium hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isSaving ? (
            <>
              <Icon name="progress_activity" size={16} className="animate-spin" />
              Guardando...
            </>
          ) : (
            "Guardar"
          )}
        </button>
      </div>
    </dialog>
  );
}
