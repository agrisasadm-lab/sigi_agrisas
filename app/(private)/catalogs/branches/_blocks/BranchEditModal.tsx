"use client";

import { useState, useEffect, useRef } from "react";
import { IconButton } from "../../../../_components/atoms/IconButton/IconButton";
import { Button } from "../../../../_components/atoms/Button/Button";
import { Switch } from "../../../../_components/atoms/Switch/Switch";
import { createBranchSchema, updateBranchSchema } from "../_logic/schemas/branch.schema";
import type { Branch } from "../_logic/types/domain";
import type { CreateBranchBody, UpdateBranchBody } from "../_logic/types/api";

interface BranchEditModalProps {
  open: boolean;
  mode: "create" | "edit";
  entity: Branch | null;
  isSaving: boolean;
  codeError: string | null;
  mutationError: string | null;
  onSave: (data: CreateBranchBody | UpdateBranchBody) => void;
  onClose: () => void;
}

function normalizeOptional(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

export function BranchEditModal({
  open,
  mode,
  entity,
  isSaving,
  codeError,
  mutationError,
  onSave,
  onClose,
}: BranchEditModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [addressStreet, setAddressStreet] = useState("");
  const [addressExteriorNumber, setAddressExteriorNumber] = useState("");
  const [addressInteriorNumber, setAddressInteriorNumber] = useState("");
  const [addressNeighborhood, setAddressNeighborhood] = useState("");
  const [addressMunicipality, setAddressMunicipality] = useState("");
  const [addressState, setAddressState] = useState("");
  const [addressCountry, setAddressCountry] = useState("");
  const [addressZipCode, setAddressZipCode] = useState("");
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
      setAddress("");
      setPhone("");
      setEmail("");
      setIsActive(true);
      setAddressStreet("");
      setAddressExteriorNumber("");
      setAddressInteriorNumber("");
      setAddressNeighborhood("");
      setAddressMunicipality("");
      setAddressState("");
      setAddressCountry("");
      setAddressZipCode("");
    } else if (entity) {
      setCode(entity.code);
      setName(entity.name);
      setAddress(entity.address ?? "");
      setPhone(entity.phone ?? "");
      setEmail(entity.email ?? "");
      setIsActive(entity.isActive);
      setAddressStreet(entity.addressStreet ?? "");
      setAddressExteriorNumber(entity.addressExteriorNumber ?? "");
      setAddressInteriorNumber(entity.addressInteriorNumber ?? "");
      setAddressNeighborhood(entity.addressNeighborhood ?? "");
      setAddressMunicipality(entity.addressMunicipality ?? "");
      setAddressState(entity.addressState ?? "");
      setAddressCountry(entity.addressCountry ?? "");
      setAddressZipCode(entity.addressZipCode ?? "");
    }
    setValidationErrors({});
  }, [open, mode, entity]);

  function buildCreatePayload(): CreateBranchBody {
    return {
      code,
      name,
      address: normalizeOptional(address),
      phone: normalizeOptional(phone),
      email: normalizeOptional(email),
      isActive,
      addressStreet: normalizeOptional(addressStreet),
      addressExteriorNumber: normalizeOptional(addressExteriorNumber),
      addressInteriorNumber: normalizeOptional(addressInteriorNumber),
      addressNeighborhood: normalizeOptional(addressNeighborhood),
      addressMunicipality: normalizeOptional(addressMunicipality),
      addressState: normalizeOptional(addressState),
      addressCountry: normalizeOptional(addressCountry),
      addressZipCode: normalizeOptional(addressZipCode),
    };
  }

  function getDiff(): UpdateBranchBody {
    if (!entity) return {};
    const diff: UpdateBranchBody = {};
    if (name !== entity.name) diff.name = name;
    const addr = normalizeOptional(address);
    if (addr !== entity.address) diff.address = addr;
    const ph = normalizeOptional(phone);
    if (ph !== entity.phone) diff.phone = ph;
    const em = normalizeOptional(email);
    if (em !== entity.email) diff.email = em;
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
    return diff;
  }

  function validate(): boolean {
    if (mode === "create") {
      const result = createBranchSchema.safeParse(buildCreatePayload());
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
      const result = updateBranchSchema.safeParse(diff);
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
    if (isCreateMode) {
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
  const title = isCreateMode ? "Nueva Sucursal" : "Editar Sucursal";

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
        {/* Sección: Identificación */}
        <section className="space-y-4">
          <h3 className="text-title-sm font-medium text-on-surface-variant uppercase tracking-wide">
            Identificación
          </h3>

          <div>
            <label className="block text-label-lg text-on-surface-variant mb-1" htmlFor="branch-code">
              Código
            </label>
            <input
              id="branch-code"
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              disabled={!isCreateMode}
              placeholder="EJ. CDMX_01"
              className="w-full px-3 py-2 rounded-md border border-outline-variant bg-surface-container-lowest text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-40 disabled:cursor-not-allowed disabled:bg-surface-container"
            />
            {(validationErrors.code || codeError) && (
              <p className="text-label-sm text-error mt-1">{validationErrors.code ?? codeError}</p>
            )}
          </div>

          <div>
            <label className="block text-label-lg text-on-surface-variant mb-1" htmlFor="branch-name">
              Nombre
            </label>
            <input
              id="branch-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nombre de la sucursal"
              className="w-full px-3 py-2 rounded-md border border-outline-variant bg-surface-container-lowest text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
            />
            {validationErrors.name && <p className="text-label-sm text-error mt-1">{validationErrors.name}</p>}
          </div>

          <div className="flex items-center gap-3">
            <Switch checked={isActive} onChange={setIsActive} aria-label="Activo" id="branch-isActive" />
            <label htmlFor="branch-isActive" className="text-label-lg text-on-surface-variant cursor-pointer">
              Activo
            </label>
          </div>
        </section>

        {/* Sección: Contacto */}
        <section className="space-y-4 pt-4 border-t border-outline-variant">
          <h3 className="text-title-sm font-medium text-on-surface-variant uppercase tracking-wide">Contacto</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-label-lg text-on-surface-variant mb-1" htmlFor="branch-phone">
                Teléfono
              </label>
              <input
                id="branch-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Teléfono (opcional)"
                className="w-full px-3 py-2 rounded-md border border-outline-variant bg-surface-container-lowest text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
              />
              {validationErrors.phone && <p className="text-label-sm text-error mt-1">{validationErrors.phone}</p>}
            </div>

            <div>
              <label className="block text-label-lg text-on-surface-variant mb-1" htmlFor="branch-email">
                Email
              </label>
              <input
                id="branch-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email de contacto (opcional)"
                className="w-full px-3 py-2 rounded-md border border-outline-variant bg-surface-container-lowest text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
              />
              {validationErrors.email && <p className="text-label-sm text-error mt-1">{validationErrors.email}</p>}
            </div>
          </div>

          <div>
            <label className="block text-label-lg text-on-surface-variant mb-1" htmlFor="branch-address">
              Dirección
            </label>
            <textarea
              id="branch-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Dirección de la sucursal (opcional)"
              rows={2}
              className="w-full px-3 py-2 rounded-md border border-outline-variant bg-surface-container-lowest text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            />
            {validationErrors.address && <p className="text-label-sm text-error mt-1">{validationErrors.address}</p>}
          </div>
        </section>

        {/* Sección: Domicilio fiscal (Carta Porte) */}
        <section className="space-y-4 pt-4 border-t border-outline-variant">
          <h3 className="text-title-sm font-medium text-on-surface-variant uppercase tracking-wide">
            Domicilio fiscal (Carta Porte)
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-label-lg text-on-surface-variant mb-1" htmlFor="branch-addressStreet">
                Calle
              </label>
              <input
                id="branch-addressStreet"
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
                  htmlFor="branch-addressExteriorNumber"
                >
                  Núm. exterior
                </label>
                <input
                  id="branch-addressExteriorNumber"
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
                  htmlFor="branch-addressInteriorNumber"
                >
                  Núm. interior
                </label>
                <input
                  id="branch-addressInteriorNumber"
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
              <label className="block text-label-lg text-on-surface-variant mb-1" htmlFor="branch-addressNeighborhood">
                Colonia
              </label>
              <input
                id="branch-addressNeighborhood"
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
              <label className="block text-label-lg text-on-surface-variant mb-1" htmlFor="branch-addressMunicipality">
                Municipio
              </label>
              <input
                id="branch-addressMunicipality"
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
              <label className="block text-label-lg text-on-surface-variant mb-1" htmlFor="branch-addressState">
                Estado (clave SAT)
              </label>
              <input
                id="branch-addressState"
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
              <label className="block text-label-lg text-on-surface-variant mb-1" htmlFor="branch-addressCountry">
                País
              </label>
              <input
                id="branch-addressCountry"
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
              <label className="block text-label-lg text-on-surface-variant mb-1" htmlFor="branch-addressZipCode">
                Código postal
              </label>
              <input
                id="branch-addressZipCode"
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
          <p className="text-body-md text-error bg-error-container px-4 py-2 rounded">{mutationError}</p>
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
