"use client";

import { useState, useEffect, useRef } from "react";
import { IconButton } from "../../../../_components/atoms/IconButton/IconButton";
import { Button } from "../../../../_components/atoms/Button/Button";
import { Select } from "../../../../_components/atoms/Select/Select";
import { Switch } from "../../../../_components/atoms/Switch/Switch";
import { createTaxRateSchema, updateTaxRateSchema } from "../_logic/schemas/taxRate.schema";
import type { TaxRate } from "../_logic/types/domain";
import type { CreateTaxRateBody, UpdateTaxRateBody } from "../_logic/types/api";

interface TaxRateEditModalProps {
  open: boolean;
  mode: "create" | "edit";
  entity: TaxRate | null;
  isSaving: boolean;
  codeError: string | null;
  mutationError: string | null;
  onSave: (data: CreateTaxRateBody | UpdateTaxRateBody) => void;
  onClose: () => void;
}

const FACTOR_TYPES = ["Tasa", "Cuota", "Exento"] as const;

function toAccountValue(v: string): string | null {
  return v.trim() === "" ? null : v.trim();
}

export function TaxRateEditModal({
  open,
  mode,
  entity,
  isSaving,
  codeError,
  mutationError,
  onSave,
  onClose,
}: TaxRateEditModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [satTaxCode, setSatTaxCode] = useState("");
  const [factorType, setFactorType] = useState<string>("Tasa");
  const [displayValueStr, setDisplayValueStr] = useState("");
  const [rateStr, setRateStr] = useState("");
  const [transferredAccount, setTransferredAccount] = useState("");
  const [pendingTransferredAccount, setPendingTransferredAccount] = useState("");
  const [creditedAccount, setCreditedAccount] = useState("");
  const [pendingCreditedAccount, setPendingCreditedAccount] = useState("");
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
    const handleCancel = (e: Event) => { e.preventDefault(); onClose(); };
    dialog.addEventListener("cancel", handleCancel);
    return () => dialog.removeEventListener("cancel", handleCancel);
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    if (mode === "create") {
      setCode(""); setName(""); setDescription("");
      setSatTaxCode(""); setFactorType("Tasa"); setDisplayValueStr(""); setRateStr("");
      setTransferredAccount(""); setPendingTransferredAccount(""); setCreditedAccount(""); setPendingCreditedAccount("");
      setIsActive(true);
    } else if (entity) {
      setCode(entity.code);
      setName(entity.name);
      setDescription(entity.description ?? "");
      setSatTaxCode(entity.satTaxCode);
      setFactorType(entity.factorType);
      setDisplayValueStr(String(entity.displayValue));
      setRateStr(String((entity.rate * 100).toFixed(4).replace(/\.?0+$/, "")));
      setTransferredAccount(entity.transferredAccount ?? "");
      setPendingTransferredAccount(entity.pendingTransferredAccount ?? "");
      setCreditedAccount(entity.creditedAccount ?? "");
      setPendingCreditedAccount(entity.pendingCreditedAccount ?? "");
      setIsActive(entity.isActive);
    }
    setValidationErrors({});
  }, [open, mode, entity]);

  const rateNum = parseFloat(rateStr);
  const displayValueNum = parseFloat(displayValueStr);

  function validate(): boolean {
    const schema = mode === "create" ? createTaxRateSchema : updateTaxRateSchema;
    const shared = {
      description: description || null,
      satTaxCode: satTaxCode || (mode === "create" ? "" : undefined),
      factorType: mode === "create" ? factorType : factorType,
      displayValue: isNaN(displayValueNum) ? undefined : displayValueNum,
      rate: isNaN(rateNum) ? undefined : rateNum,
      transferredAccount: toAccountValue(transferredAccount),
      pendingTransferredAccount: toAccountValue(pendingTransferredAccount),
      creditedAccount: toAccountValue(creditedAccount),
      pendingCreditedAccount: toAccountValue(pendingCreditedAccount),
      isActive,
    };
    const data = mode === "create" ? { code, name, ...shared } : { name, ...shared };
    const result = schema.safeParse(data);
    if (!result.success) {
      const errs: Record<string, string> = {};
      for (const issue of result.error.issues) errs[String(issue.path[0])] = issue.message;
      setValidationErrors(errs);
      return false;
    }
    setValidationErrors({});
    return true;
  }

  function getDiff(): UpdateTaxRateBody {
    if (!entity) return {};
    const diff: UpdateTaxRateBody = {};
    if (name !== entity.name) diff.name = name;
    const desc = description || null;
    if (desc !== entity.description) diff.description = desc;
    if (satTaxCode !== entity.satTaxCode) diff.satTaxCode = satTaxCode;
    if (factorType !== entity.factorType) diff.factorType = factorType;
    if (!isNaN(displayValueNum) && displayValueNum !== entity.displayValue) diff.displayValue = displayValueNum;
    const newRate = isNaN(rateNum) ? null : rateNum / 100;
    if (newRate !== null && newRate !== entity.rate) diff.rate = newRate;
    const newTransferredAccount = toAccountValue(transferredAccount);
    if (newTransferredAccount !== entity.transferredAccount) diff.transferredAccount = newTransferredAccount;
    const newPendingTransferredAccount = toAccountValue(pendingTransferredAccount);
    if (newPendingTransferredAccount !== entity.pendingTransferredAccount) diff.pendingTransferredAccount = newPendingTransferredAccount;
    const newCreditedAccount = toAccountValue(creditedAccount);
    if (newCreditedAccount !== entity.creditedAccount) diff.creditedAccount = newCreditedAccount;
    const newPendingCreditedAccount = toAccountValue(pendingCreditedAccount);
    if (newPendingCreditedAccount !== entity.pendingCreditedAccount) diff.pendingCreditedAccount = newPendingCreditedAccount;
    if (isActive !== entity.isActive) diff.isActive = isActive;
    return diff;
  }

  const isDirty =
    mode === "create"
      ? code !== "" || name !== "" || description !== "" || satTaxCode !== "" || displayValueStr !== "" || rateStr !== "" ||
        transferredAccount !== "" || pendingTransferredAccount !== "" || creditedAccount !== "" || pendingCreditedAccount !== "" ||
        factorType !== "Tasa" || !isActive
      : entity !== null && Object.keys(getDiff()).length > 0;

  const isDiffEmpty = mode === "edit" && Object.keys(getDiff()).length === 0;

  function handleSave() {
    if (!validate()) return;
    if (mode === "create") {
      onSave({
        code,
        name,
        description: description || null,
        satTaxCode,
        factorType,
        displayValue: displayValueNum,
        rate: rateNum / 100,
        transferredAccount: toAccountValue(transferredAccount),
        pendingTransferredAccount: toAccountValue(pendingTransferredAccount),
        creditedAccount: toAccountValue(creditedAccount),
        pendingCreditedAccount: toAccountValue(pendingCreditedAccount),
        isActive,
      });
    } else {
      const diff = getDiff();
      if (Object.keys(diff).length === 0) return;
      onSave(diff);
    }
  }

  const title = mode === "create" ? "Nueva Tasa de Impuesto" : "Editar Tasa de Impuesto";

  return (
    <dialog
      ref={dialogRef}
      className="rounded-lg bg-surface-container p-0 shadow-lg w-full max-w-lg backdrop:bg-black/40"
    >
      <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant">
        <h2 className="text-title-md font-semibold text-on-surface">{title}</h2>
        <IconButton icon="close" iconSize={20} ariaLabel="Cerrar" variant="ghost" onClick={onClose} className="rounded p-1.5" />
      </div>

      <div className="px-6 py-5 space-y-5 max-h-[65vh] overflow-y-auto">
        <div>
          <label className="block text-label-lg text-on-surface-variant mb-1" htmlFor="tr-code">Código</label>
          <input
            id="tr-code"
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            disabled={mode !== "create"}
            placeholder="EJ. IVA_16"
            className="w-full px-3 py-2 rounded-md border border-outline-variant bg-surface-container-lowest text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-40 disabled:cursor-not-allowed disabled:bg-surface-container"
          />
          {(validationErrors.code || codeError) && (
            <p className="text-label-sm text-error mt-1">{validationErrors.code ?? codeError}</p>
          )}
        </div>

        <div>
          <label className="block text-label-lg text-on-surface-variant mb-1" htmlFor="tr-name">Nombre</label>
          <input
            id="tr-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nombre de la tasa"
            className="w-full px-3 py-2 rounded-md border border-outline-variant bg-surface-container-lowest text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
          />
          {validationErrors.name && <p className="text-label-sm text-error mt-1">{validationErrors.name}</p>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-label-lg text-on-surface-variant mb-1" htmlFor="tr-sat-tax-code">Clave SAT</label>
            <input
              id="tr-sat-tax-code"
              type="text"
              value={satTaxCode}
              onChange={(e) => setSatTaxCode(e.target.value.replace(/\D/g, "").slice(0, 3))}
              placeholder="002"
              maxLength={3}
              className="w-full px-3 py-2 rounded-md border border-outline-variant bg-surface-container-lowest text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
            />
            {validationErrors.satTaxCode && <p className="text-label-sm text-error mt-1">{validationErrors.satTaxCode}</p>}
          </div>

          <div>
            <label className="block text-label-lg text-on-surface-variant mb-1" htmlFor="tr-factor-type">Tipo Factor</label>
            <Select
              id="tr-factor-type"
              value={factorType}
              onChange={(e) => setFactorType(e.target.value)}
              error={validationErrors.factorType}
            >
              {FACTOR_TYPES.map((ft) => (
                <option key={ft} value={ft}>{ft}</option>
              ))}
            </Select>
            {validationErrors.factorType && <p className="text-label-sm text-error mt-1">{validationErrors.factorType}</p>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-label-lg text-on-surface-variant mb-1" htmlFor="tr-display-value">Valor</label>
            <input
              id="tr-display-value"
              type="number"
              value={displayValueStr}
              onChange={(e) => setDisplayValueStr(e.target.value)}
              placeholder="16"
              step="0.01"
              className="w-full px-3 py-2 rounded-md border border-outline-variant bg-surface-container-lowest text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
            />
            {validationErrors.displayValue && <p className="text-label-sm text-error mt-1">{validationErrors.displayValue}</p>}
          </div>

          <div>
            <label className="block text-label-lg text-on-surface-variant mb-1" htmlFor="tr-rate">Tasa/Cuota (%)</label>
            <div className="relative">
              <input
                id="tr-rate"
                type="number"
                value={rateStr}
                onChange={(e) => setRateStr(e.target.value)}
                placeholder="16"
                step="0.000001"
                min="0"
                className="w-full px-3 py-2 pr-8 rounded-md border border-outline-variant bg-surface-container-lowest text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-body-md">%</span>
            </div>
            {validationErrors.rate && <p className="text-label-sm text-error mt-1">{validationErrors.rate}</p>}
          </div>
        </div>

        <div>
          <label className="block text-label-lg text-on-surface-variant mb-1" htmlFor="tr-description">Descripción</label>
          <textarea
            id="tr-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Descripción opcional"
            rows={3}
            className="w-full px-3 py-2 rounded-md border border-outline-variant bg-surface-container-lowest text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary resize-none"
          />
          {validationErrors.description && <p className="text-label-sm text-error mt-1">{validationErrors.description}</p>}
        </div>

        <fieldset className="space-y-3">
          <legend className="text-label-lg text-on-surface-variant mb-1">Cuentas contables (opcional)</legend>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-label-md text-on-surface-variant mb-1" htmlFor="tr-transferred-account">Cuenta Trasladado</label>
              <input
                id="tr-transferred-account"
                type="text"
                value={transferredAccount}
                onChange={(e) => setTransferredAccount(e.target.value)}
                maxLength={20}
                className="w-full px-3 py-2 rounded-md border border-outline-variant bg-surface-container-lowest text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-label-md text-on-surface-variant mb-1" htmlFor="tr-pending-transferred-account">Cuenta x Trasladar</label>
              <input
                id="tr-pending-transferred-account"
                type="text"
                value={pendingTransferredAccount}
                onChange={(e) => setPendingTransferredAccount(e.target.value)}
                maxLength={20}
                className="w-full px-3 py-2 rounded-md border border-outline-variant bg-surface-container-lowest text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-label-md text-on-surface-variant mb-1" htmlFor="tr-credited-account">Cuenta Acreditado</label>
              <input
                id="tr-credited-account"
                type="text"
                value={creditedAccount}
                onChange={(e) => setCreditedAccount(e.target.value)}
                maxLength={20}
                className="w-full px-3 py-2 rounded-md border border-outline-variant bg-surface-container-lowest text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-label-md text-on-surface-variant mb-1" htmlFor="tr-pending-credited-account">Cuenta x Acreditar</label>
              <input
                id="tr-pending-credited-account"
                type="text"
                value={pendingCreditedAccount}
                onChange={(e) => setPendingCreditedAccount(e.target.value)}
                maxLength={20}
                className="w-full px-3 py-2 rounded-md border border-outline-variant bg-surface-container-lowest text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>
        </fieldset>

        <div className="flex items-center gap-3">
          <Switch checked={isActive} onChange={setIsActive} aria-label="Activo" id="tr-isActive" />
          <label htmlFor="tr-isActive" className="text-label-lg text-on-surface-variant cursor-pointer">Activo</label>
        </div>

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
          disabled={!isDirty || isDiffEmpty || isSaving || Object.keys(validationErrors).length > 0}
          loading={isSaving}
        >
          {isSaving ? "Guardando..." : "Guardar"}
        </Button>
      </div>
    </dialog>
  );
}
