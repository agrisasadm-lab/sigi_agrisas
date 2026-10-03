"use client";

import { useState, useCallback } from "react";
import { Switch } from "../../../../_components/atoms/Switch/Switch";
import { ImageUploadField } from "../../../../_components/molecules/ImageUploadField/ImageUploadField";
import { updateProduct } from "../_logic/services/products";
import { uploadProductImage } from "../_logic/services/uploadProductImage";
import { deleteProductImage } from "../_logic/services/deleteProductImage";
import { ProductDepartmentInvalidError } from "../_logic/errors";
import { createProductSchema } from "../_logic/schemas/product.schema";
import { useTaxRatesOptions } from "../../../../_hooks/useTaxRatesOptions";
import { useDepartmentsOptions } from "../../../../_hooks/useDepartmentsOptions";
import { TaxRateSelect } from "./TaxRateSelect";
import { SatCodeCombobox } from "./SatCodeCombobox";
import { SatCatalogCombobox } from "../../../../_components/molecules/SatCatalogCombobox/SatCatalogCombobox";
import type { Product } from "../_logic/types/domain";
import type { UpdateProductBody } from "../_logic/types/api";

interface DeptOption { id: string; name: string; }

interface ProductGeneralTabProps {
  product: Product;
  canWrite: boolean;
  deptOptions: DeptOption[];
  onUpdated: (updated: Product) => void;
}

function taxRateToDisplay(rate: number | null): string {
  if (rate === null) return "";
  return String(Math.round(rate * 100));
}

function parseTaxInput(val: string): number | null {
  const t = val.trim();
  if (!t) return null;
  const n = parseFloat(t);
  return isNaN(n) ? null : n;
}

function priceToDisplay(price: number | null): string {
  if (price === null) return "";
  return String(price);
}

function parsePriceInput(val: string): number | null {
  const t = val.trim();
  if (!t) return null;
  const n = parseFloat(t);
  return isNaN(n) ? null : n;
}

export function ProductGeneralTab({ product, canWrite, deptOptions, onUpdated }: ProductGeneralTabProps) {
  const [name, setName] = useState(product.name);
  const [unit, setUnit] = useState(product.unit);
  const [departmentId, setDepartmentId] = useState(product.departmentId);
  const [taxRateId, setTaxRateId] = useState<string | null>(product.taxRateId ?? null);
  const [satProductCode, setSatProductCode] = useState(product.satProductCode ?? "");
  const [ivaRate, setIvaRate] = useState(taxRateToDisplay(product.ivaRate));
  const [iepsRate, setIepsRate] = useState(taxRateToDisplay(product.iepsRate));
  const [manufactureDate, setManufactureDate] = useState(product.manufactureDate ?? "");
  const [acquisitionPrice, setAcquisitionPrice] = useState(priceToDisplay(product.acquisitionPrice));
  const [isTaxable, setIsTaxable] = useState(product.isTaxable);
  const [isActive, setIsActive] = useState(product.isActive);
  const [imageUrl, setImageUrl] = useState<string | null>(product.imageUrl ?? null);
  const [isSaving, setIsSaving] = useState(false);
  const [deptError, setDeptError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const { options: taxRateOptions } = useTaxRatesOptions();
  const { options: allDeptOptions } = useDepartmentsOptions();
  const derivedProviderName = allDeptOptions.find((d) => d.id === departmentId)?.providerName ?? null;

  const buildDiff = useCallback((): UpdateProductBody => {
    const diff: UpdateProductBody = {};
    if (name !== product.name) diff.name = name;
    if (unit !== product.unit) diff.unit = unit;
    if (departmentId !== product.departmentId) diff.departmentId = departmentId;
    const newTaxRateId = taxRateId || null;
    if (newTaxRateId !== product.taxRateId) diff.taxRateId = newTaxRateId;
    const parsedSat = satProductCode.trim() === "" ? null : satProductCode.trim();
    if (parsedSat !== product.satProductCode) diff.satProductCode = parsedSat;
    const parsedIva = parseTaxInput(ivaRate);
    if (parsedIva !== product.ivaRate) diff.ivaRate = parsedIva;
    const parsedIeps = parseTaxInput(iepsRate);
    if (parsedIeps !== product.iepsRate) diff.iepsRate = parsedIeps;
    const parsedManufactureDate = manufactureDate.trim() === "" ? null : manufactureDate.trim();
    if (parsedManufactureDate !== product.manufactureDate) diff.manufactureDate = parsedManufactureDate;
    const parsedAcquisitionPrice = parsePriceInput(acquisitionPrice);
    if (parsedAcquisitionPrice !== product.acquisitionPrice) diff.acquisitionPrice = parsedAcquisitionPrice;
    if (isTaxable !== product.isTaxable) diff.isTaxable = isTaxable;
    if (isActive !== product.isActive) diff.isActive = isActive;
    return diff;
  }, [product, name, unit, departmentId, taxRateId, satProductCode, ivaRate, iepsRate, manufactureDate, acquisitionPrice, isTaxable, isActive]);

  const isDiffEmpty = Object.keys(buildDiff()).length === 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeptError(null);
    setSaveError(null);
    setValidationErrors({});
    const diff = buildDiff();
    if (Object.keys(diff).length === 0) return;
    setIsSaving(true);
    try {
      const updated = await updateProduct({ id: product.id, body: diff });
      onUpdated(updated);
    } catch (err) {
      if (err instanceof ProductDepartmentInvalidError) {
        setDeptError("El departamento no existe o está inactivo.");
      } else {
        setSaveError((err as Error).message ?? "Error al guardar.");
      }
    } finally {
      setIsSaving(false);
    }
  };

  const fieldClass = "w-full px-3 py-2 rounded-md border border-outline-variant bg-surface-container-lowest text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50";

  return (
    <form onSubmit={handleSubmit} noValidate className="max-w-xl space-y-4">
      {saveError && (
        <p className="text-label-sm text-error bg-error-container/30 px-3 py-2 rounded-md">{saveError}</p>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-label-lg text-on-surface-variant mb-1">Código</label>
          <input type="text" value={product.code} disabled className={fieldClass} />
        </div>
        <div>
          <label className="block text-label-lg text-on-surface-variant mb-1" htmlFor="product-unit">Unidad (clave SAT) *</label>
          <SatCatalogCombobox
            catalog="clave-unidad"
            id="product-unit"
            value={unit}
            onChange={setUnit}
            placeholder="KGM"
            disabled={!canWrite}
            className={fieldClass}
          />
          {validationErrors.unit && <p className="text-label-sm text-error mt-1">{validationErrors.unit}</p>}
        </div>
      </div>

      <div>
        <label className="block text-label-lg text-on-surface-variant mb-1">Nombre *</label>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} disabled={!canWrite} maxLength={120} className={fieldClass} />
        {validationErrors.name && <p className="text-label-sm text-error mt-1">{validationErrors.name}</p>}
      </div>

      <div>
        <label className="block text-label-lg text-on-surface-variant mb-1">Departamento *</label>
        <select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} disabled={!canWrite} className={fieldClass}>
          <option value="">Selecciona un departamento</option>
          {deptOptions.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        {deptError && <p className="text-label-sm text-error mt-1">{deptError}</p>}
      </div>

      <div>
        <label className="block text-label-lg text-on-surface-variant mb-1">Proveedor</label>
        <input type="text" value={derivedProviderName ?? "Sin proveedor"} disabled className={fieldClass} />
      </div>

      <div>
        <label className="block text-label-lg text-on-surface-variant mb-1">Tasa de impuesto</label>
        <TaxRateSelect value={taxRateId} onChange={setTaxRateId} options={taxRateOptions} disabled={!canWrite} className={fieldClass} />
      </div>

      <div>
        <label className="block text-label-lg text-on-surface-variant mb-1">Cód. SAT (8 dígitos)</label>
        <SatCodeCombobox value={satProductCode} onChange={setSatProductCode} disabled={!canWrite} className={fieldClass} />
      </div>

      <div>
        <label className="block text-label-lg text-on-surface-variant mb-1" htmlFor="product-manufacture-date">Fecha de elaboración</label>
        <input
          type="date"
          id="product-manufacture-date"
          value={manufactureDate}
          onChange={(e) => setManufactureDate(e.target.value)}
          disabled={!canWrite}
          className={fieldClass}
        />
      </div>

      <div>
        <label className="block text-label-lg text-on-surface-variant mb-1">Imagen del producto</label>
        <ImageUploadField
          currentUrl={imageUrl}
          entityId={product.id}
          canWrite={canWrite}
          onUploaded={(url) => { setImageUrl(url); onUpdated({ ...product, imageUrl: url }); }}
          onDeleted={() => { setImageUrl(null); onUpdated({ ...product, imageUrl: null }); }}
          uploadFn={uploadProductImage}
          deleteFn={deleteProductImage}
        />
      </div>

      <div>
        <label className="block text-label-lg text-on-surface-variant mb-1" htmlFor="product-acquisition-price">Precio de adquisición</label>
        <input
          type="number"
          id="product-acquisition-price"
          value={acquisitionPrice}
          onChange={(e) => setAcquisitionPrice(e.target.value)}
          disabled={!canWrite}
          min={0}
          step="any"
          placeholder="Ej. 45.50"
          className={fieldClass}
        />
        {validationErrors.acquisitionPrice && <p className="text-label-sm text-error mt-1">{validationErrors.acquisitionPrice}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-label-lg text-on-surface-variant mb-1">IVA (%)</label>
          <div className="relative">
            <input type="number" value={ivaRate} onChange={(e) => setIvaRate(e.target.value)} disabled={!canWrite} min={0} max={100} placeholder="Ej. 16" className={`${fieldClass} pr-8`} />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-label-sm text-on-surface-variant">%</span>
          </div>
        </div>
        <div>
          <label className="block text-label-lg text-on-surface-variant mb-1">IEPS (%)</label>
          <div className="relative">
            <input type="number" value={iepsRate} onChange={(e) => setIepsRate(e.target.value)} disabled={!canWrite} min={0} max={100} placeholder="Ej. 8" className={`${fieldClass} pr-8`} />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-label-sm text-on-surface-variant">%</span>
          </div>
        </div>
      </div>

      <label className={`flex items-center gap-3 select-none ${canWrite ? "cursor-pointer" : "cursor-default opacity-70"}`}>
        <Switch checked={isTaxable} onChange={canWrite ? setIsTaxable : () => {}} aria-label="Sujeto a impuestos" />
        <span className="text-label-lg text-on-surface-variant">Sujeto a impuestos</span>
      </label>

      {canWrite && (
        <label className="flex items-center gap-3 cursor-pointer select-none">
          <Switch checked={isActive} onChange={setIsActive} aria-label="Activo" />
          <span className="text-label-lg text-on-surface-variant">Activo</span>
        </label>
      )}

      {canWrite && (
        <button
          type="submit"
          disabled={isSaving || isDiffEmpty}
          className="px-4 py-2 rounded-md bg-primary text-on-primary text-label-lg font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {isSaving ? "Guardando…" : "Guardar cambios"}
        </button>
      )}
    </form>
  );
}
