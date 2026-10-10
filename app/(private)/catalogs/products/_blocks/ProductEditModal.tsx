"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Icon } from "../../../../_components/atoms/Icon/Icon";
import { Switch } from "../../../../_components/atoms/Switch/Switch";
import { Button } from "../../../../_components/atoms/Button/Button";
import { Select } from "../../../../_components/atoms/Select/Select";
import { createProductSchema, updateProductSchema } from "../_logic/schemas/product.schema";
import { useTaxRatesOptions } from "../../../../_hooks/useTaxRatesOptions";
import { TaxRateSelect } from "./TaxRateSelect";
import { SatCodeCombobox } from "./SatCodeCombobox";
import { SatCatalogCombobox } from "../../../../_components/molecules/SatCatalogCombobox/SatCatalogCombobox";
import type { Product } from "../_logic/types/domain";
import type { CreateProductBody, UpdateProductBody } from "../_logic/types/api";

const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp"];
const MAX_IMG_BYTES = 2 * 1024 * 1024;

interface DeptOption {
  id: string;
  name: string;
}

interface ProductEditModalProps {
  open: boolean;
  mode: "create" | "edit";
  entity: Product | null;
  isSaving: boolean;
  codeError: string | null;
  deptError: string | null;
  mutationError: string | null;
  deptOptions: DeptOption[];
  imageUploadWarning?: string | null;
  onSave: (data: CreateProductBody | UpdateProductBody, stagedImage?: File | null) => void;
  onClose: () => void;
}

function taxRateToDisplay(rate: number | null): string {
  if (rate === null) return "";
  return String(Math.round(rate * 100));
}

function parseTaxInput(val: string): number | null {
  const trimmed = val.trim();
  if (trimmed === "") return null;
  const n = parseFloat(trimmed);
  if (isNaN(n)) return null;
  return n;
}

function priceToDisplay(price: number | null): string {
  if (price === null) return "";
  return String(price);
}

function parsePriceInput(val: string): number | null {
  const trimmed = val.trim();
  if (trimmed === "") return null;
  const n = parseFloat(trimmed);
  if (isNaN(n)) return null;
  return n;
}

export function ProductEditModal({
  open,
  mode,
  entity,
  isSaving,
  codeError,
  deptError,
  mutationError,
  imageUploadWarning,
  deptOptions,
  onSave,
  onClose,
}: ProductEditModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [taxRateId, setTaxRateId] = useState<string | null>(null);
  const [satProductCode, setSatProductCode] = useState("");
  const [ivaRate, setIvaRate] = useState("");
  const [iepsRate, setIepsRate] = useState("");
  const [manufactureDate, setManufactureDate] = useState("");
  const [acquisitionPrice, setAcquisitionPrice] = useState("");
  const [isTaxable, setIsTaxable] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const { options: taxRateOptions } = useTaxRatesOptions();
  const [stagedImage, setStagedImage] = useState<File | null>(null);
  const [imgPreview, setImgPreview] = useState<string | null>(null);
  const [imgError, setImgError] = useState<string | null>(null);
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
    const handler = (e: Event) => { e.preventDefault(); onClose(); };
    dialog.addEventListener("cancel", handler);
    return () => dialog.removeEventListener("cancel", handler);
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    if (mode === "create") {
      setCode(""); setName(""); setUnit(""); setDepartmentId(""); setTaxRateId(null);
      setSatProductCode(""); setIvaRate(""); setIepsRate(""); setManufactureDate(""); setAcquisitionPrice(""); setIsTaxable(false); setIsActive(true);
      setStagedImage(null); setImgPreview(null); setImgError(null);
    } else if (entity) {
      setCode(entity.code);
      setName(entity.name);
      setUnit(entity.unit);
      setDepartmentId(entity.departmentId);
      setTaxRateId(entity.taxRateId ?? null);
      setSatProductCode(entity.satProductCode ?? "");
      setIvaRate(taxRateToDisplay(entity.ivaRate));
      setIepsRate(taxRateToDisplay(entity.iepsRate));
      setManufactureDate(entity.manufactureDate ?? "");
      setAcquisitionPrice(priceToDisplay(entity.acquisitionPrice));
      setIsTaxable(entity.isTaxable);
      setIsActive(entity.isActive);
    }
    setValidationErrors({});
  }, [open, mode, entity]);

  const buildDiff = useCallback((): UpdateProductBody => {
    if (!entity) return {};
    const diff: UpdateProductBody = {};
    if (name !== entity.name) diff.name = name;
    if (unit !== entity.unit) diff.unit = unit;
    if (departmentId !== entity.departmentId) diff.departmentId = departmentId;
    const newTaxRateId = taxRateId || null;
    if (newTaxRateId !== entity.taxRateId) diff.taxRateId = newTaxRateId;
    const parsedSat = satProductCode.trim() === "" ? null : satProductCode.trim();
    if (parsedSat !== entity.satProductCode) diff.satProductCode = parsedSat;
    const parsedIva = parseTaxInput(ivaRate);
    if (parsedIva !== entity.ivaRate) diff.ivaRate = parsedIva;
    const parsedIeps = parseTaxInput(iepsRate);
    if (parsedIeps !== entity.iepsRate) diff.iepsRate = parsedIeps;
    const parsedManufactureDate = manufactureDate.trim() === "" ? null : manufactureDate.trim();
    if (parsedManufactureDate !== entity.manufactureDate) diff.manufactureDate = parsedManufactureDate;
    const parsedAcquisitionPrice = parsePriceInput(acquisitionPrice);
    if (parsedAcquisitionPrice !== entity.acquisitionPrice) diff.acquisitionPrice = parsedAcquisitionPrice;
    if (isTaxable !== entity.isTaxable) diff.isTaxable = isTaxable;
    if (isActive !== entity.isActive) diff.isActive = isActive;
    return diff;
  }, [entity, name, unit, departmentId, taxRateId, satProductCode, ivaRate, iepsRate, manufactureDate, acquisitionPrice, isTaxable, isActive]);

  const isDiffEmpty = mode === "edit" && Object.keys(buildDiff()).length === 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationErrors({});

    const formData = {
      code: code.trim(),
      name: name.trim(),
      unit: unit.trim(),
      departmentId: departmentId,
      taxRateId: taxRateId || null,
      satProductCode: satProductCode.trim() || null,
      ivaRate: parseTaxInput(ivaRate),
      iepsRate: parseTaxInput(iepsRate),
      manufactureDate: manufactureDate.trim() || null,
      acquisitionPrice: parsePriceInput(acquisitionPrice),
      isTaxable,
      isActive,
    };

    if (mode === "create") {
      const result = createProductSchema.safeParse(formData);
      if (!result.success) {
        const errs: Record<string, string> = {};
        result.error.errors.forEach((e) => { if (e.path[0]) errs[String(e.path[0])] = e.message; });
        setValidationErrors(errs);
        return;
      }
      onSave(result.data as CreateProductBody, stagedImage);
    } else {
      const diff = buildDiff();
      if (Object.keys(diff).length === 0) return;
      onSave(diff);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      className="rounded-lg shadow-xl bg-surface p-0 w-full max-w-lg backdrop:bg-black/40"
    >
      <form onSubmit={handleSubmit} noValidate>
        <div className="px-6 pt-6 pb-4 border-b border-outline-variant">
          <h2 className="text-title-md font-semibold text-on-surface">
            {mode === "create" ? "Nuevo producto" : "Editar producto"}
          </h2>
        </div>

        <div className="px-6 py-4 space-y-4 max-h-[60vh] overflow-y-auto">
          {mutationError && (
            <p className="text-label-sm text-error bg-error-container/30 px-3 py-2 rounded-md">{mutationError}</p>
          )}
          {imageUploadWarning && (
            <p className="text-label-sm text-on-surface bg-surface-container-high px-3 py-2 rounded-md">{imageUploadWarning}</p>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-label-lg text-on-surface-variant mb-1">Código *</label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                disabled={mode === "edit"}
                maxLength={32}
                className="w-full px-3 py-2 rounded-md border border-outline-variant bg-surface-container-lowest text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
              />
              {(codeError || validationErrors.code) && (
                <p className="text-label-sm text-error mt-1">{codeError ?? validationErrors.code}</p>
              )}
            </div>

            <div>
              <label className="block text-label-lg text-on-surface-variant mb-1" htmlFor="product-unit">Unidad (clave SAT) *</label>
              <SatCatalogCombobox
                catalog="clave-unidad"
                id="product-unit"
                value={unit}
                onChange={setUnit}
                placeholder="KGM"
                className="w-full px-3 py-2 rounded-md border border-outline-variant bg-surface-container-lowest text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
              />
              {validationErrors.unit && (
                <p className="text-label-sm text-error mt-1">{validationErrors.unit}</p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-label-lg text-on-surface-variant mb-1">Nombre *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
              className="w-full px-3 py-2 rounded-md border border-outline-variant bg-surface-container-lowest text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
            />
            {validationErrors.name && (
              <p className="text-label-sm text-error mt-1">{validationErrors.name}</p>
            )}
          </div>

          <div>
            <label className="block text-label-lg text-on-surface-variant mb-1">Departamento *</label>
            <Select
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              error={deptError ?? validationErrors.departmentId}
            >
              <option value="">Selecciona un departamento</option>
              {deptOptions.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </Select>
            {(deptError || validationErrors.departmentId) && (
              <p className="text-label-sm text-error mt-1">{deptError ?? validationErrors.departmentId}</p>
            )}
          </div>

          <div>
            <label className="block text-label-lg text-on-surface-variant mb-1">Tasa de impuesto</label>
            <TaxRateSelect
              value={taxRateId}
              onChange={setTaxRateId}
              options={taxRateOptions}
              className="w-full px-3 py-2 rounded-md border border-outline-variant bg-surface-container-lowest text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-label-lg text-on-surface-variant mb-1">Cód. SAT (8 dígitos)</label>
            <SatCodeCombobox
              value={satProductCode}
              onChange={setSatProductCode}
              className="w-full px-3 py-2 rounded-md border border-outline-variant bg-surface-container-lowest text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
            />
            {validationErrors.satProductCode && (
              <p className="text-label-sm text-error mt-1">{validationErrors.satProductCode}</p>
            )}
          </div>

          <div>
            <label className="block text-label-lg text-on-surface-variant mb-1" htmlFor="product-manufacture-date">Fecha de elaboración</label>
            <input
              type="date"
              id="product-manufacture-date"
              value={manufactureDate}
              onChange={(e) => setManufactureDate(e.target.value)}
              className="w-full px-3 py-2 rounded-md border border-outline-variant bg-surface-container-lowest text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
            />
            {validationErrors.manufactureDate && (
              <p className="text-label-sm text-error mt-1">{validationErrors.manufactureDate}</p>
            )}
          </div>

          <div>
            <label className="block text-label-lg text-on-surface-variant mb-1" htmlFor="product-acquisition-price">Precio de adquisición</label>
            <input
              type="number"
              id="product-acquisition-price"
              value={acquisitionPrice}
              onChange={(e) => setAcquisitionPrice(e.target.value)}
              min={0}
              step="any"
              placeholder="Ej. 45.50"
              className="w-full px-3 py-2 rounded-md border border-outline-variant bg-surface-container-lowest text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
            />
            {validationErrors.acquisitionPrice && (
              <p className="text-label-sm text-error mt-1">{validationErrors.acquisitionPrice}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-label-lg text-on-surface-variant mb-1">IVA (%)</label>
              <div className="relative">
                <input
                  type="number"
                  value={ivaRate}
                  onChange={(e) => setIvaRate(e.target.value)}
                  min={0}
                  max={100}
                  placeholder="Ej. 16"
                  className="w-full pl-3 pr-8 py-2 rounded-md border border-outline-variant bg-surface-container-lowest text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-label-sm text-on-surface-variant">%</span>
              </div>
              {validationErrors.ivaRate && (
                <p className="text-label-sm text-error mt-1">{validationErrors.ivaRate}</p>
              )}
            </div>

            <div>
              <label className="block text-label-lg text-on-surface-variant mb-1">IEPS (%)</label>
              <div className="relative">
                <input
                  type="number"
                  value={iepsRate}
                  onChange={(e) => setIepsRate(e.target.value)}
                  min={0}
                  max={100}
                  placeholder="Ej. 8"
                  className="w-full pl-3 pr-8 py-2 rounded-md border border-outline-variant bg-surface-container-lowest text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-label-sm text-on-surface-variant">%</span>
              </div>
              {validationErrors.iepsRate && (
                <p className="text-label-sm text-error mt-1">{validationErrors.iepsRate}</p>
              )}
            </div>
          </div>

          <label className="flex items-center gap-3 cursor-pointer select-none">
            <Switch checked={isTaxable} onChange={setIsTaxable} aria-label="Sujeto a impuestos" />
            <span className="text-label-lg text-on-surface-variant">Sujeto a impuestos</span>
          </label>

          {mode === "edit" && (
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <Switch checked={isActive} onChange={setIsActive} aria-label="Activo" />
              <span className="text-label-lg text-on-surface-variant">Activo</span>
            </label>
          )}

          {mode === "create" && (
            <div>
              <label className="block text-label-lg text-on-surface-variant mb-1">
                Imagen del producto (opcional)
              </label>
              <div className="flex items-center gap-3">
                {imgPreview ? (
                  <img src={imgPreview} alt="preview" className="w-16 h-16 object-cover rounded-md border border-outline-variant" />
                ) : (
                  <div className="w-16 h-16 flex items-center justify-center rounded-md border border-dashed border-outline-variant bg-surface-container text-on-surface-variant">
                    <Icon name="image" className="text-xl" />
                  </div>
                )}
                <label className="cursor-pointer text-label-sm text-primary hover:underline">
                  {stagedImage ? "Cambiar" : "Seleccionar"}
                  <input
                    type="file"
                    accept={ALLOWED_MIME.join(",")}
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      if (!ALLOWED_MIME.includes(f.type)) { setImgError("Formato no permitido. Usa JPG, PNG o WebP."); return; }
                      if (f.size > MAX_IMG_BYTES) { setImgError("La imagen excede 2 MB."); return; }
                      setImgError(null);
                      setStagedImage(f);
                      setImgPreview(URL.createObjectURL(f));
                      e.target.value = "";
                    }}
                  />
                </label>
                {stagedImage && (
                  <Button
                    type="button"
                    variant="text"
                    size="sm"
                    onClick={() => { setStagedImage(null); setImgPreview(null); }}
                    className="text-error underline"
                  >
                    Quitar
                  </Button>
                )}
              </div>
              {imgError && <p className="text-label-sm text-error mt-1">{imgError}</p>}
            </div>
          )}
        </div>

        <div className="px-6 pb-6 pt-2 flex justify-end gap-3 border-t border-outline-variant">
          <Button type="button" variant="text" onClick={onClose} disabled={isSaving}>
            Cancelar
          </Button>
          {imageUploadWarning ? (
            <Button type="button" variant="filled" onClick={onClose}>
              Cerrar
            </Button>
          ) : (
            <Button type="submit" variant="filled" disabled={isSaving || isDiffEmpty} loading={isSaving}>
              {isSaving ? "Guardando…" : mode === "create" ? "Crear" : "Guardar"}
            </Button>
          )}
        </div>
      </form>
    </dialog>
  );
}
