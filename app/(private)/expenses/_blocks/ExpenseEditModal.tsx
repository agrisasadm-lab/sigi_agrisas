"use client";

import { useState, useEffect, useRef } from "react";
import { Icon } from "../../../_components/atoms/Icon/Icon";
import { Button } from "../../../_components/atoms/Button/Button";
import { Select } from "../../../_components/atoms/Select/Select";
import { ImageUploadField } from "../../../_components/molecules/ImageUploadField/ImageUploadField";
import { useCurrentUser } from "../../../_hooks/useCurrentUser";
import { useBranchesOptions } from "../../../_hooks/useBranchesOptions";
import { createExpenseSchema, updateExpenseSchema } from "../_logic/schemas/expense.schema";
import { uploadExpensePhoto } from "../_logic/services/uploadExpensePhoto";
import { deleteExpensePhoto } from "../_logic/services/deleteExpensePhoto";
import type { Expense } from "../_logic/types/domain";
import type { CreateExpenseBody, UpdateExpenseBody } from "../_logic/types/api";

const ALLOWED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_PHOTO_BYTES = 2 * 1024 * 1024;

interface ExpenseEditModalProps {
  open: boolean;
  mode: "create" | "edit";
  entity: Expense | null;
  isSaving: boolean;
  mutationError: string | null;
  onSave: (data: CreateExpenseBody | UpdateExpenseBody, photoFile?: File | null) => void;
  onClose: () => void;
}

export function ExpenseEditModal({
  open,
  mode,
  entity,
  isSaving,
  mutationError,
  onSave,
  onClose,
}: ExpenseEditModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { branchId: userBranchId, can } = useCurrentUser();
  const isBypass = can("branches:access_all") === true;
  const { options: branchOptions } = useBranchesOptions();

  const [branchId, setBranchId] = useState("");
  const [concept, setConcept] = useState("");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [expenseDate, setExpenseDate] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [pendingPhotoFile, setPendingPhotoFile] = useState<File | null>(null);
  const [pendingPhotoPreview, setPendingPhotoPreview] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const isCreateMode = mode === "create";

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
      setBranchId(isBypass ? "" : userBranchId ?? "");
      setConcept("");
      setAmount("");
      setNotes("");
      setExpenseDate(new Date().toISOString().slice(0, 10));
      setPhotoUrl(null);
      setPendingPhotoFile(null);
      setPendingPhotoPreview(null);
    } else if (entity) {
      setBranchId(entity.branchId);
      setConcept(entity.concept);
      setAmount(entity.amount);
      setNotes(entity.notes ?? "");
      setExpenseDate(entity.expenseDate);
      setPhotoUrl(entity.photoUrl);
      setPendingPhotoFile(null);
      setPendingPhotoPreview(null);
    }
    setPhotoError(null);
    setValidationErrors({});
  }, [open, mode, entity, isBypass, userBranchId]);

  function validate(): boolean {
    const amountNum = amount === "" ? NaN : Number(amount);
    if (isCreateMode) {
      const result = createExpenseSchema.safeParse({
        branchId,
        concept,
        amount: amountNum,
        notes: notes || null,
        expenseDate,
      });
      if (!result.success) {
        const errs: Record<string, string> = {};
        for (const issue of result.error.issues) errs[String(issue.path[0])] = issue.message;
        setValidationErrors(errs);
        return false;
      }
    } else {
      const result = updateExpenseSchema.safeParse({
        concept,
        amount: amountNum,
        notes: notes || null,
        expenseDate,
      });
      if (!result.success) {
        const errs: Record<string, string> = {};
        for (const issue of result.error.issues) errs[String(issue.path[0])] = issue.message;
        setValidationErrors(errs);
        return false;
      }
    }
    setValidationErrors({});
    return true;
  }

  function getDiff(): UpdateExpenseBody {
    if (!entity) return {};
    const diff: UpdateExpenseBody = {};
    if (concept !== entity.concept) diff.concept = concept;
    if (amount !== entity.amount && amount !== "") diff.amount = Number(amount);
    const newNotes = notes || null;
    if (newNotes !== entity.notes) diff.notes = newNotes;
    if (expenseDate !== entity.expenseDate) diff.expenseDate = expenseDate;
    return diff;
  }

  const isDirty = isCreateMode
    ? concept !== "" || amount !== "" || notes !== "" || pendingPhotoFile !== null || (isBypass && branchId !== "")
    : entity !== null && (Object.keys(getDiff()).length > 0);

  const isDiffEmpty = !isCreateMode && Object.keys(getDiff()).length === 0;

  function validatePhotoFile(file: File): string | null {
    if (!ALLOWED_PHOTO_TYPES.includes(file.type)) return "Formato no permitido. Usa JPG, PNG o WebP.";
    if (file.size > MAX_PHOTO_BYTES) return "La imagen excede 2 MB.";
    return null;
  }

  function handlePendingPhotoChange(file: File) {
    const err = validatePhotoFile(file);
    if (err) { setPhotoError(err); return; }
    setPhotoError(null);
    setPendingPhotoFile(file);
    setPendingPhotoPreview(URL.createObjectURL(file));
  }

  function handleSave() {
    if (!validate()) return;
    if (isCreateMode) {
      onSave(
        { branchId, concept, amount: Number(amount), notes: notes || null, expenseDate },
        pendingPhotoFile
      );
    } else {
      const diff = getDiff();
      if (Object.keys(diff).length === 0) return;
      onSave(diff);
    }
  }

  const title = isCreateMode ? "Nuevo Gasto" : "Editar Gasto";

  return (
    <dialog
      ref={dialogRef}
      className="rounded-lg bg-surface-container p-0 shadow-lg w-full max-w-lg backdrop:bg-black/40"
    >
      <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant">
        <h2 className="text-title-md font-semibold text-on-surface">{title}</h2>
        <Button variant="text" size="sm" icon="close" onClick={onClose} aria-label="Cerrar" />
      </div>

      <div className="px-6 py-5 space-y-5 max-h-[65vh] overflow-y-auto">
        {isCreateMode && isBypass && (
          <div>
            <label className="block text-label-lg text-on-surface-variant mb-1" htmlFor="expense-branch">
              Sucursal <span className="text-error">*</span>
            </label>
            <Select
              id="expense-branch"
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              error={validationErrors.branchId}
            >
              <option value="">Selecciona una sucursal</option>
              {branchOptions.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </Select>
            {validationErrors.branchId && <p className="text-label-sm text-error mt-1">{validationErrors.branchId}</p>}
          </div>
        )}

        <div>
          <label className="block text-label-lg text-on-surface-variant mb-1" htmlFor="expense-concept">Concepto</label>
          <input
            id="expense-concept"
            type="text"
            value={concept}
            onChange={(e) => setConcept(e.target.value)}
            placeholder="Ej. Combustible, papelería, viáticos"
            className="w-full px-3 py-2 rounded-md border border-outline-variant bg-surface-container-lowest text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
          />
          {validationErrors.concept && <p className="text-label-sm text-error mt-1">{validationErrors.concept}</p>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-label-lg text-on-surface-variant mb-1" htmlFor="expense-amount">Cantidad</label>
            <input
              id="expense-amount"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full px-3 py-2 rounded-md border border-outline-variant bg-surface-container-lowest text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
            />
            {validationErrors.amount && <p className="text-label-sm text-error mt-1">{validationErrors.amount}</p>}
          </div>

          <div>
            <label className="block text-label-lg text-on-surface-variant mb-1" htmlFor="expense-date">Fecha</label>
            <input
              id="expense-date"
              type="date"
              value={expenseDate}
              onChange={(e) => setExpenseDate(e.target.value)}
              className="w-full px-3 py-2 rounded-md border border-outline-variant bg-surface-container-lowest text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
            />
            {validationErrors.expenseDate && <p className="text-label-sm text-error mt-1">{validationErrors.expenseDate}</p>}
          </div>
        </div>

        <div>
          <label className="block text-label-lg text-on-surface-variant mb-1" htmlFor="expense-notes">Notas</label>
          <textarea
            id="expense-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notas opcionales"
            rows={3}
            className="w-full px-3 py-2 rounded-md border border-outline-variant bg-surface-container-lowest text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary resize-none"
          />
          {validationErrors.notes && <p className="text-label-sm text-error mt-1">{validationErrors.notes}</p>}
        </div>

        <div>
          <label className="block text-label-lg text-on-surface-variant mb-1">Fotografía del comprobante (opcional)</label>
          {isCreateMode ? (
            <div className="flex flex-col gap-2">
              <div
                className="relative border-2 border-dashed border-outline-variant rounded-md flex items-center justify-center bg-surface-container cursor-pointer hover:bg-surface-container-high transition-colors"
                style={{ width: 128, height: 128 }}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const file = e.dataTransfer.files[0];
                  if (file) handlePendingPhotoChange(file);
                }}
              >
                {pendingPhotoPreview ? (
                  <img src={pendingPhotoPreview} alt="Vista previa" className="w-full h-full object-cover rounded-md" />
                ) : (
                  <div className="flex flex-col items-center gap-1 text-on-surface-variant text-center px-2">
                    <Icon name="image_not_supported" className="text-3xl" />
                    <span className="text-label-sm">Arrastra o haz click</span>
                  </div>
                )}
              </div>
              {pendingPhotoPreview && (
                <Button
                  variant="text"
                  size="sm"
                  onClick={() => { setPendingPhotoFile(null); setPendingPhotoPreview(null); }}
                  className="text-error self-start px-0"
                >
                  Quitar
                </Button>
              )}
              {photoError && <p className="text-label-sm text-error">{photoError}</p>}
              <input
                ref={fileInputRef}
                type="file"
                accept={ALLOWED_PHOTO_TYPES.join(",")}
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handlePendingPhotoChange(file);
                  e.target.value = "";
                }}
              />
            </div>
          ) : entity ? (
            <ImageUploadField
              currentUrl={photoUrl}
              entityId={entity.id}
              canWrite={true}
              onUploaded={setPhotoUrl}
              onDeleted={() => setPhotoUrl(null)}
              uploadFn={uploadExpensePhoto}
              deleteFn={deleteExpensePhoto}
              confirmDeleteDescription="¿Confirmas eliminar la fotografía del comprobante?"
            />
          ) : null}
        </div>

        {mutationError && (
          <p className="text-body-md text-error bg-error-container px-4 py-2 rounded">{mutationError}</p>
        )}
      </div>

      <div className="flex justify-end gap-3 px-6 py-4 border-t border-outline-variant bg-surface-container-lowest">
        <Button variant="outlined" onClick={onClose} disabled={isSaving}>
          Cancelar
        </Button>
        <Button variant="filled" onClick={handleSave} disabled={!isDirty || isDiffEmpty || isSaving} loading={isSaving}>
          {isSaving ? "Guardando..." : "Guardar"}
        </Button>
      </div>
    </dialog>
  );
}
